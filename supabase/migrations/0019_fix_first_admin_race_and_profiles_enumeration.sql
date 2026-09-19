-- =============================================================================
-- FireCheck · Correções de segurança pré-produção (preflight) — migration 0019
-- =============================================================================
-- Prompt 19 (preflight de produção) — auditoria SQL do app confirmou 2
-- correções de banco, ambas seguras e sem impacto no fluxo de inspeções
-- compartilhadas:
--
-- 1. P0 · RACE do primeiro admin (`handle_new_user`, migration 0003).
--    O trigger decida o papel com `select count(*)` **sem lock**. Dois
--    signups concorrentes podem ambos ler total=0 e ambos virarem `admin`
--    (nenhum UUID único de "primeiro-perfil" é garantido). Fix: advisory
--    lock transacional (`pg_advisory_xact_lock`) cobrindo count+insert,
--    tornando a decisão "count==0 ⇨ admin" atômica.
--
-- 2. P1 · Enumeração de `profiles` por qualquer authenticated
--    (`p_profiles_select using (true)`, migration 0003). Um inspector
--    (não-admin) conseguia listar email/nome/cargo/role de todos os
--    usuários via `listUsers()` no hydrate do app. Fix: SELECT passa a
--    exigir `is_admin()` OU a própria linha (`id = auth.uid()`).
--    O frontend apenas (a) lê o próprio perfil (`fetchOwnProfile`, filtrando
--    por `id = uid`) — continua funcionando; e (b) lista todos os usuários
--    em `listUsers()`, que só roda na tela admin (guardada por `isAdmin`).
--    O compartilhamento de inspeções usa os campos `inspetor`/`owner_id` da
--    própria inspeção — NÃO consome a enumeração de `profiles` — portanto o
--    fluxo de compartilhar permanece íntegro.
--
-- Regra de ouro do repo mantida: esta migration NÃO altera os arquivos
-- 0001–0018 (imutáveis). Executa `create or replace`/`drop+create policy`
-- idempotentes e respeita o RLS já existente.
--
-- Idempotente: pode ser re-aplicada no SQL Editor do Supabase.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. fix: handle_new_user — advisory lock no count+insert (first-admin sem race)
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  total_profiles integer;
begin
  -- Lock transacional global de "primeira conta": serializa signups
  -- concorrentes, garantindo que a decisão count==0 ⇨ admin seja atômica.
  -- (chave fixa: 0x01C0_F1C3 ⇨ não conflita com locks de app/Supabase).
  perform pg_advisory_xact_lock(0x01c0f1c3::bigint);

  select count(*) into total_profiles from public.profiles;
  insert into public.profiles (id, email, nome, cargo, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'nome', ''),
    coalesce(new.raw_user_meta_data->>'cargo', 'Inspetor'),
    case when total_profiles = 0 then 'admin' else 'inspector' end
  );
  return new;
end;
$$;

-- Trigger inalterado em semântica (só re-criado para apontar para a função
-- nova). Aldeia `drop` + `create` idempotente, como nas migrations 0003+.
drop trigger if exists trg_on_auth_user_created on auth.users;
create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 2. fix: p_profiles_select — só admin ou a própria linha
-- ---------------------------------------------------------------------------

drop policy if exists "p_profiles_select" on public.profiles;

create policy "p_profiles_select" on public.profiles
  for select to authenticated
  using (public.is_admin() or id = auth.uid());

notify pgrst, 'reload schema';
