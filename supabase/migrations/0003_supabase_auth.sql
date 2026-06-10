-- =============================================================================
-- FireCheck · Supabase Auth (migration 0003)
-- =============================================================================
-- Adiciona tabela `profiles` (1:1 com auth.users), trigger que provisiona o
-- perfil no signup, função `is_admin()`, RPC `admin_delete_user`, e aperta
-- o RLS das tabelas de domínio para exigir `auth.role() = 'authenticated'`.
--
-- Idempotente: pode ser re-aplicado no SQL Editor do Supabase.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. TABELA `profiles`
-- ---------------------------------------------------------------------------
-- Espelha `auth.users` com os campos de aplicação (nome, cargo, role).
-- O id é o mesmo UUID do `auth.users.id` (1:1).
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id          uuid        primary key references auth.users(id) on delete cascade,
  email       text        unique not null,
  nome        text        not null default '',
  cargo       text        not null default 'Inspetor',
  role        text        not null default 'inspector'
    check (role in ('admin', 'inspector')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_profiles_role on public.profiles (role);

-- ---------------------------------------------------------------------------
-- 2. TRIGGER: cria perfil automaticamente no signup
-- ---------------------------------------------------------------------------
-- O primeiro perfil a ser criado vira 'admin' (mesma regra do app offline).
-- Demais perfis entram como 'inspector'. Lê nome/cargo de `raw_user_meta_data`
-- (passado via `options.data` no `supabase.auth.signUp`).
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

drop trigger if exists trg_on_auth_user_created on auth.users;
create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 3. HELPER: is_admin()
-- ---------------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

grant execute on function public.is_admin() to authenticated, anon;

-- ---------------------------------------------------------------------------
-- 4. RLS DE `profiles`
-- ---------------------------------------------------------------------------
-- Leitura: qualquer usuário autenticado.
-- Inserção:  bloqueada (perfil é criado via trigger).
-- Update:    o próprio usuário (mas NÃO pode mexer no próprio role)
--            OU um admin (pode mexer em qualquer um, exceto o próprio role
--            quando rebaixar a si mesmo — bloqueado pelo RPC `is_admin()`).
-- Delete:    apenas admins e nunca em si mesmos.
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;

drop policy if exists "p_profiles_select"        on public.profiles;
drop policy if exists "p_profiles_update_self"   on public.profiles;
drop policy if exists "p_profiles_update_admin"  on public.profiles;
drop policy if exists "p_profiles_delete_admin"  on public.profiles;

create policy "p_profiles_select"
  on public.profiles
  for select
  to authenticated
  using (true);

create policy "p_profiles_update_self"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and role = (select role from public.profiles where id = auth.uid())
  );

create policy "p_profiles_update_admin"
  on public.profiles
  for update
  to authenticated
  using (public.is_admin());

create policy "p_profiles_delete_admin"
  on public.profiles
  for delete
  to authenticated
  using (public.is_admin() and id <> auth.uid());

-- ---------------------------------------------------------------------------
-- 5. RPC: admin_delete_user (deleta auth + perfil atomicamente)
-- ---------------------------------------------------------------------------
-- Anon key NÃO permite `auth.admin.deleteUser` no client, então expomos um
-- wrapper seguro. O caller precisa ser admin e não pode deletar a si mesmo.
-- ---------------------------------------------------------------------------

create or replace function public.admin_delete_user(target_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden: caller is not admin';
  end if;
  if target_id = auth.uid() then
    raise exception 'cannot delete own account';
  end if;
  delete from auth.users where id = target_id;
end;
$$;

grant execute on function public.admin_delete_user(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. UPDATED-AT trigger reaproveitado de 0001 (`public.set_updated_at()`)
-- ---------------------------------------------------------------------------

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 7. APERTAR RLS DAS TABELAS DE DOMÍNIO
-- ---------------------------------------------------------------------------
-- Em 0001 criamos policies permissivas (using (true)). Agora que temos
-- Supabase Auth, exigimos `auth.role() = 'authenticated'`.
-- ---------------------------------------------------------------------------

drop policy if exists "p_all_equipamentos" on public.equipamentos;
drop policy if exists "p_all_inspetores"   on public.inspetores;
drop policy if exists "p_all_inspecoes"    on public.inspecoes;
drop policy if exists "p_all_planos"       on public.planos_acao;
drop policy if exists "p_all_fotos"        on public.fotos_inspecao;

drop policy if exists "p_auth_equipamentos" on public.equipamentos;
create policy "p_auth_equipamentos" on public.equipamentos
  for all to authenticated
  using (true) with check (true);

drop policy if exists "p_auth_inspetores" on public.inspetores;
create policy "p_auth_inspetores" on public.inspetores
  for all to authenticated
  using (true) with check (true);

drop policy if exists "p_auth_inspecoes" on public.inspecoes;
create policy "p_auth_inspecoes" on public.inspecoes
  for all to authenticated
  using (true) with check (true);

drop policy if exists "p_auth_planos" on public.planos_acao;
create policy "p_auth_planos" on public.planos_acao
  for all to authenticated
  using (true) with check (true);

drop policy if exists "p_auth_fotos" on public.fotos_inspecao;
create policy "p_auth_fotos" on public.fotos_inspecao
  for all to authenticated
  using (true) with check (true);

-- Storage: mesmas regras, exigindo authenticated
drop policy if exists "p_storage_select" on storage.objects;
drop policy if exists "p_storage_insert" on storage.objects;
drop policy if exists "p_storage_update" on storage.objects;
drop policy if exists "p_storage_delete" on storage.objects;

create policy "p_storage_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'inspection-photos');

create policy "p_storage_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'inspection-photos');

create policy "p_storage_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'inspection-photos');

create policy "p_storage_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'inspection-photos');
