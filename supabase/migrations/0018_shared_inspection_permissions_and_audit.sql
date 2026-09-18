-- =============================================================================
-- FireCheck · Inspeções compartilhadas, rastreabilidade e conflitos
-- =============================================================================
--
-- 1. Inspecoes ganham auditoria: `updated_by` (uuid = conta autenticada da
--    última alteração) e `updated_by_name` (nome operacional do último editor).
-- 2. Trigger de auditoria/imutabilidade: em UPDATE o banco força
--    `updated_at = now()` / `updated_by = auth.uid()` e REJEITA qualquer
--    tentativa de alterar `id`, `equipment_id`, `user_id`, `inspetor` e
--    `created_at`. Em INSERT força `user_id = auth.uid()`.
-- 3. RLS de `inspecoes`: SELECT/INSERT/UPDATE para admin OU inspetor
--    autorizado (qualquer inspeção — hoje há 1 organização, sem
--    organisation_id); DELETE restrito a admin. Inspetores NÃO ganham
--    exclusão.
-- 4. `fotos_inspecao.SELECT` e o SELECT do Storage seguem
--    `can_access_inspection()` — a foto da inspeção de A fica legível por B,
--    mantendo o bucket privado e sem ampliar mutações.
-- 5. Nova RPC `recalculate_equipment_from_latest_inspection` substitui a
--    aplicação cega de status: recria o status do equipamento a partir da
--    inspeção mais recente (ordem determinística data DESC, created_at DESC,
--    id DESC) — nunca regride por edição de inspeção antiga. `updated_at`
--    (auditoria/CAS/conflito) NÃO participa da cronologia operacional.
--    Somente admin e inspetores podem executá-la. A próxima inspeção só muda
--    quando o trigger é a inspeção vencedora do equipamento.
--
-- Idempotente: pode ser re-aplicado no SQL Editor do Supabase.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. COLUNAS DE RASTREABILIDADE
-- ---------------------------------------------------------------------------

alter table public.inspecoes
  add column if not exists updated_by      uuid references auth.users(id) on delete set null,
  add column if not exists updated_by_name text;

create index if not exists idx_inspecoes_updated_at on public.inspecoes (updated_at);
create index if not exists idx_inspecoes_updated_by on public.inspecoes (updated_by);

-- ---------------------------------------------------------------------------
-- 2. HELPERS DE AUTORIZAÇÃO
-- ---------------------------------------------------------------------------
-- Papel real existente: `profiles.role` em ('admin', 'inspector').
-- Sem organização no schema: acesso de inspetor é global na organização única.
-- (Evolução futura: escopar por organização quando existir multiempresa.)

create or replace function public.is_inspector_or_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin', 'inspector')
  );
$$;

revoke execute on function public.is_inspector_or_admin() from public;
grant  execute on function public.is_inspector_or_admin() to authenticated;

-- Acesso a uma inspeção: existe + usuário atual é admin/inspetor autorizado.
create or replace function public.can_access_inspection(p_inspection_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_inspector_or_admin()
    and exists (
      select 1 from public.inspecoes i
      where i.id = p_inspection_id
    );
$$;

revoke execute on function public.can_access_inspection(text) from public;
grant  execute on function public.can_access_inspection(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. TRIGGER DE AUDITORIA / IMUTABILIDADE
-- ---------------------------------------------------------------------------
-- INSERT: força user_id = auth.uid() (autoria autenticada, não confiando no
-- payload) e não grava rastreabilidade de edição.
-- UPDATE: força updated_at/updated_by e rejeita mudança de autoria original
-- (id, equipment_id, user_id, inspetor, created_at).
-- updated_by_name vem do formulário (nome operacional do editor) e é
-- preservado quando o cliente não envia.

create or replace function public.inspecoes_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.user_id       := auth.uid();
    new.created_at    := coalesce(new.created_at, now());
    new.updated_at    := now();
    new.updated_by    := null;
    new.updated_by_name := null;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id then
      raise exception 'Campo imutavel: id' using errcode = 'IMMUT';
    end if;
    if new.equipment_id is distinct from old.equipment_id then
      raise exception 'Campo imutavel: equipment_id' using errcode = 'IMMUT';
    end if;
    if new.user_id is distinct from old.user_id then
      raise exception 'Campo imutavel: user_id' using errcode = 'IMMUT';
    end if;
    if new.inspetor is distinct from old.inspetor then
      raise exception 'Campo imutavel: inspetor' using errcode = 'IMMUT';
    end if;
    if new.created_at is distinct from old.created_at then
      raise exception 'Campo imutavel: created_at' using errcode = 'IMMUT';
    end if;
    new.updated_at    := now();
    new.updated_by    := auth.uid();
    new.updated_by_name := coalesce(new.updated_by_name, old.updated_by_name);
    return new;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_inspecoes_audit on public.inspecoes;
create trigger trg_inspecoes_audit
  before insert or update on public.inspecoes
  for each row execute function public.inspecoes_audit();

-- SECURITY DEFINER: nenhum papel precisa de EXECUTE direto (só o trigger chama).
revoke all on function public.inspecoes_audit() from public;

-- ---------------------------------------------------------------------------
-- 4. RLS DE `inspecoes`
-- ---------------------------------------------------------------------------
-- SELECT / INSERT / UPDATE: admin ou inspetor autorizado.
-- DELETE: ADMIN ONLY (inspetor pode ver e editar, NÃO excluir).

drop policy if exists "p_inspecoes_select" on public.inspecoes;
create policy "p_inspecoes_select" on public.inspecoes
  for select to authenticated
  using (public.is_inspector_or_admin());

drop policy if exists "p_inspecoes_insert" on public.inspecoes;
create policy "p_inspecoes_insert" on public.inspecoes
  for insert to authenticated
  with check (public.is_inspector_or_admin() and user_id = auth.uid());

drop policy if exists "p_inspecoes_update" on public.inspecoes;
create policy "p_inspecoes_update" on public.inspecoes
  for update to authenticated
  using (public.is_inspector_or_admin())
  with check (public.is_inspector_or_admin());

drop policy if exists "p_inspecoes_delete" on public.inspecoes;
create policy "p_inspecoes_delete" on public.inspecoes
  for delete to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- 5. RLS DE `fotos_inspecao` — SELECT compartilhado via can_access_inspection
-- ---------------------------------------------------------------------------
-- O pull de metadados precisa permitir que B receba a foto de uma inspeção
-- que B pode visualizar. INSERT/UPDATE/DELETE permanecem como em 0007
-- (owner da inspeção ou admin) — nenhuma nova mutação é concedida.

drop policy if exists "p_fotos_select" on public.fotos_inspecao;
create policy "p_fotos_select" on public.fotos_inspecao
  for select to authenticated
  using (public.can_access_inspection(inspection_id));

-- ---------------------------------------------------------------------------
-- 6. STORAGE — SELECT compartilhado, bucket continua privado
-- ---------------------------------------------------------------------------
-- Auditoria das policies de `storage.objects` criadas na 0017:
--   p_storage_select_owner  → SELECT: admin OU pasta do próprio uid
--   p_storage_insert_owner  → INSERT: admin OU pasta do próprio uid
--   p_storage_update_owner  → UPDATE: admin OU pasta do próprio uid
--   p_storage_delete_owner  → DELETE: admin OU pasta do próprio uid
-- Policies permissivas do PostgreSQL combinam por OR. A `p_storage_select_owner`
-- NÃO é bypass para outros perfis: ela só libera a pasta do próprio uid (jamais
-- a pasta de outro inspetor). Portanto é mantida como fallback de objetos
-- legados sem registro em `fotos_inspecao`, e a nova policy compartilhada é
-- adicionada por OR: SELECT = admin OR pasta-dono OR inspeção acessível.
-- As mutações (INSERT/UPDATE/DELETE) permanecem owner/admin — não ampliadas.

-- Remoção defensiva de policies legadas amplas (0001/0003). Em um banco com a
-- 0017 aplicada estas já não existem; o drop é idempotente e garante que
-- nenhuma SELECT de bucket inteiro sobreviva, e que INSERT/UPDATE/DELETE
-- continuem restritos ao dono (`*_owner`, da 0017).
drop policy if exists "p_storage_select" on storage.objects;
drop policy if exists "p_storage_insert" on storage.objects;
drop policy if exists "p_storage_update" on storage.objects;
drop policy if exists "p_storage_delete" on storage.objects;

drop policy if exists "p_storage_select_shared" on storage.objects;
create policy "p_storage_select_shared" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'inspection-photos'
    and exists (
      select 1 from public.fotos_inspecao f
      where f.storage_path = storage.objects.name
        and public.can_access_inspection(f.inspection_id)
    )
  );

-- Garante bucket não-público (idempotente).
insert into storage.buckets (id, name, public)
values ('inspection-photos', 'inspection-photos', false)
on conflict (id) do update set public = false;

-- ---------------------------------------------------------------------------
-- 7. RPC DE STATUS — recálculo a partir da inspeção mais recente
-- ---------------------------------------------------------------------------
-- Substitui a aplicação cega de `apply_equipment_inspection_status`:
-- o status do equipamento é sempre derivado da inspeção mais recente válida
-- (ordem determinística: data DESC, created_at DESC, id DESC — `updated_at`
-- NÃO define cronologia operacional), então a edição de uma inspeção antiga
-- NUNCA regride o status operacional.
--
-- `p_trigger_inspection_id`: inspeção que originou a chamada. A próxima
-- inspeção só é atualizada quando TODAS as condições valem:
--   p_next_inspection_date IS NOT NULL
--   AND p_trigger_inspection_id IS NOT NULL
--   AND p_trigger_inspection_id = inspeção vencedora
--   AND essa inspeção pertence a p_equipment_id
-- Caso contrário `data_proxima_inspecao` é preservada.

create or replace function public.recalculate_equipment_from_latest_inspection(
  p_equipment_id          text,
  p_next_inspection_date  date default null,
  p_trigger_inspection_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated_at    timestamptz;
  v_status        text;
  v_ultima        date;
  v_proxima       date;
  v_inspection_id text;
begin
  -- 1. Autenticação obrigatória
  if auth.uid() is null then
    raise exception 'Usuario nao autenticado.' using errcode = 'UNAUTH';
  end if;

  -- 2. Autorização: somente admin/inspetor executam alteração operacional.
  if not public.is_inspector_or_admin() then
    raise exception 'Acesso negado: role nao autorizada.' using errcode = 'PFORB';
  end if;

  -- 3. Equipamento deve existir. Soft-deleted (`deleted_at` não nulo) ainda
  --    existe e é tratado adiante com `applied:false` (sem ressuscitar status).
  if not exists (
    select 1 from public.equipamentos e
    where e.id = p_equipment_id
  ) then
    raise exception 'Equipamento inexistente.' using errcode = 'NOEQPT';
  end if;

  -- 4. Trigger de referência (se informado) deve existir e pertencer ao
  --    equipamento — rejeita trigger de outro equipamento.
  if p_trigger_inspection_id is not null then
    if not exists (
      select 1 from public.inspecoes i
      where i.id = p_trigger_inspection_id
        and i.equipment_id = p_equipment_id
    ) then
      raise exception 'Inspecao de referencia invalida para o equipamento.' using errcode = 'BADTRIG';
    end if;
  end if;

  -- 5. Inspeção mais recente e válida (ordem determinística — sem updated_at)
  select i.id, i.data, i.status
    into v_inspection_id, v_ultima, v_status
  from public.inspecoes i
  where i.equipment_id = p_equipment_id
  order by i.data desc, i.created_at desc, i.id desc
  limit 1;

  if not found then
    -- Sem inspeções restantes: não altera o status (sem regressão forçada).
    return jsonb_build_object(
      'equipment_id', p_equipment_id,
      'applied', false,
      'inspection_id', null,
      'status', null,
      'updated_at', null,
      'data_ultima_inspecao', null,
      'data_proxima_inspecao', null
    );
  end if;

  -- 6. Aplicar somente campos operacionais derivados da inspeção mais recente.
  --    data_proxima_inspecao muda APENAS quando o trigger é a vencedora E
  --    pertence ao equipamento E p_next foi informado.
  update public.equipamentos e
     set status               = v_status,
         data_ultima_inspecao = v_ultima,
         data_proxima_inspecao = case
           when p_next_inspection_date is not null
            and p_trigger_inspection_id is not null
            and p_trigger_inspection_id = v_inspection_id
           then p_next_inspection_date
           else e.data_proxima_inspecao
         end
   where e.id = p_equipment_id
     and e.deleted_at is null
   returning e.updated_at, e.status, e.data_ultima_inspecao, e.data_proxima_inspecao
   into v_updated_at, v_status, v_ultima, v_proxima;

  -- 7. Equipamento inexistente/excluído
  if not found then
    return jsonb_build_object(
      'equipment_id', p_equipment_id,
      'applied', false,
      'inspection_id', v_inspection_id,
      'status', null,
      'updated_at', null,
      'data_ultima_inspecao', null,
      'data_proxima_inspecao', null
    );
  end if;

  -- 8. Resultado
  return jsonb_build_object(
    'equipment_id', p_equipment_id,
    'applied', true,
    'inspection_id', v_inspection_id,
    'status', v_status,
    'updated_at', v_updated_at,
    'data_ultima_inspecao', v_ultima,
    'data_proxima_inspecao', v_proxima
  );
end;
$$;

revoke all on function public.recalculate_equipment_from_latest_inspection(text, date, text) from public;
grant execute on function public.recalculate_equipment_from_latest_inspection(text, date, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 8. RECARREGAR SCHEMA DO PostgREST
-- ---------------------------------------------------------------------------

notify pgrst, 'reload schema';