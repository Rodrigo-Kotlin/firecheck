-- =============================================================================
-- FireCheck · Security linter fixes
-- =============================================================================
-- Resolves all Supabase Database Linter warnings:
--   1. Function Search Path Mutable   → set_updated_at gains fixed search_path
--   2. RLS Always True                → granular policies per operation
--   3. SECURITY DEFINER               → revoke unnecessary execute grants
--   4. Leaked Password Protection     → documented only (manual setup)
--
-- Idempotent: safe to re-run. Works standalone or on top of earlier migrations.
-- =============================================================================

-- =============================================================================
-- 1. FUNCTION SEARCH PATH MUTABLE
-- =============================================================================
-- set_updated_at from 0001 had no search_path, making it vulnerable to search
-- path hijacking. The trigger system still worked, but the linter flagged it.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =============================================================================
-- 2. ADD OWNERSHIP COLUMNS (idempotent)
-- =============================================================================
-- These columns let RLS policies tie rows to the authenticated user who created
-- them. Type is uuid matching auth.users.id so we can compare directly with
-- auth.uid() without casting.

alter table public.equipamentos
  add column if not exists created_by uuid
  references auth.users(id) on delete set null;

alter table public.inspecoes
  add column if not exists user_id uuid
  references auth.users(id) on delete set null;

alter table public.planos_acao
  add column if not exists user_id uuid
  references auth.users(id) on delete set null;

create index if not exists idx_equipamentos_created_by
  on public.equipamentos (created_by);

create index if not exists idx_inspecoes_user_id
  on public.inspecoes (user_id);

create index if not exists idx_planos_acao_user_id
  on public.planos_acao (user_id);

-- =============================================================================
-- 3. REMOVE PERMISSIVE POLICIES
-- =============================================================================
-- Drop the FOR ALL … USING(true) WITH CHECK(true) policies created in 0003.
-- Also drop any policies from 0006 so we always start clean below.

drop policy if exists "p_auth_equipamentos"       on public.equipamentos;
drop policy if exists "p_auth_inspetores"         on public.inspetores;
drop policy if exists "p_auth_inspecoes"          on public.inspecoes;
drop policy if exists "p_auth_planos"             on public.planos_acao;
drop policy if exists "p_auth_fotos"              on public.fotos_inspecao;

-- (ensure 0006-style names are gone too for idempotency)
drop policy if exists "p_equipamentos_select"     on public.equipamentos;
drop policy if exists "p_equipamentos_insert"     on public.equipamentos;
drop policy if exists "p_equipamentos_update"     on public.equipamentos;
drop policy if exists "p_equipamentos_delete"     on public.equipamentos;

-- =============================================================================
-- 4. GRANULAR POLICIES PER TABLE
-- =============================================================================
-- Every authenticated user can SELECT everything (needed for pull/sync).
-- INSERT / UPDATE / DELETE are restricted to the owner or an admin.
-- -------------------------------------------------------------------------

-- 4a. equipamentos ─── owner column: created_by (uuid) ──────────────────────

create policy "p_equipamentos_select" on public.equipamentos
  for select to authenticated using (true);

create policy "p_equipamentos_insert" on public.equipamentos
  for insert to authenticated with check (created_by = auth.uid());

create policy "p_equipamentos_update" on public.equipamentos
  for update to authenticated
  using (public.is_admin() or created_by = auth.uid())
  with check (public.is_admin() or created_by = auth.uid());

create policy "p_equipamentos_delete" on public.equipamentos
  for delete to authenticated
  using (public.is_admin() or created_by = auth.uid());

-- 4b. inspecoes ─── owner column: user_id (uuid) ───────────────────────────

drop policy if exists "p_inspecoes_select" on public.inspecoes;
create policy "p_inspecoes_select" on public.inspecoes
  for select to authenticated using (true);

drop policy if exists "p_inspecoes_insert" on public.inspecoes;
create policy "p_inspecoes_insert" on public.inspecoes
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "p_inspecoes_update" on public.inspecoes;
create policy "p_inspecoes_update" on public.inspecoes
  for update to authenticated
  using (public.is_admin() or user_id = auth.uid())
  with check (public.is_admin() or user_id = auth.uid());

drop policy if exists "p_inspecoes_delete" on public.inspecoes;
create policy "p_inspecoes_delete" on public.inspecoes
  for delete to authenticated
  using (public.is_admin() or user_id = auth.uid());

-- 4c. planos_acao ─── owner column: user_id (uuid) ─────────────────────────

drop policy if exists "p_planos_select" on public.planos_acao;
create policy "p_planos_select" on public.planos_acao
  for select to authenticated using (true);

drop policy if exists "p_planos_insert" on public.planos_acao;
create policy "p_planos_insert" on public.planos_acao
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "p_planos_update" on public.planos_acao;
create policy "p_planos_update" on public.planos_acao
  for update to authenticated
  using (public.is_admin() or user_id = auth.uid())
  with check (public.is_admin() or user_id = auth.uid());

drop policy if exists "p_planos_delete" on public.planos_acao;
create policy "p_planos_delete" on public.planos_acao
  for delete to authenticated
  using (public.is_admin() or user_id = auth.uid());

-- 4d. fotos_inspecao ─── ownership derived from the parent inspection ───────
-- Since fotos_inspecao has no direct owner column, we join through
-- inspection_id → inspecoes.id to check user_id.

drop policy if exists "p_fotos_select" on public.fotos_inspecao;
create policy "p_fotos_select" on public.fotos_inspecao
  for select to authenticated using (true);

drop policy if exists "p_fotos_insert" on public.fotos_inspecao;
create policy "p_fotos_insert" on public.fotos_inspecao
  for insert to authenticated
  with check (
    public.is_admin()
    or exists (
      select 1 from public.inspecoes
      where id = inspection_id and user_id = auth.uid()
    )
  );

drop policy if exists "p_fotos_update" on public.fotos_inspecao;
create policy "p_fotos_update" on public.fotos_inspecao
  for update to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.inspecoes
      where id = inspection_id and user_id = auth.uid()
    )
  );

drop policy if exists "p_fotos_delete" on public.fotos_inspecao;
create policy "p_fotos_delete" on public.fotos_inspecao
  for delete to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.inspecoes
      where id = inspection_id and user_id = auth.uid()
    )
  );

-- 4e. inspetores ─── reference table, admin-only writes ────────────────────

drop policy if exists "p_inspetores_select" on public.inspetores;
create policy "p_inspetores_select" on public.inspetores
  for select to authenticated using (true);

drop policy if exists "p_inspetores_insert" on public.inspetores;
create policy "p_inspetores_insert" on public.inspetores
  for insert to authenticated with check (public.is_admin());

drop policy if exists "p_inspetores_update" on public.inspetores;
create policy "p_inspetores_update" on public.inspetores
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "p_inspetores_delete" on public.inspetores;
create policy "p_inspetores_delete" on public.inspetores
  for delete to authenticated
  using (public.is_admin());

-- =============================================================================
-- 5. SECURITY DEFINER — REVOKE EXECUTE FROM PUBLIC / ANON
-- =============================================================================
-- The linter flagged these functions because SECURITY DEFINER + wide execute
-- grants can be abused for privilege escalation.
--
-- handle_new_user is a trigger-only function; no user session should call it.
-- is_admin       must remain callable by authenticated (RLS policies use it).
-- admin_delete_user  must remain callable by authenticated (admin UI uses it).
-- All three: anon must never execute them.
--
-- We revoke from PUBLIC first (removes default grant to every role) and then
-- re-grant only to the roles that genuinely need access.

-- handle_new_user ── trigger only ───────────────────────────────────────────
revoke execute on function public.handle_new_user from public;

-- is_admin ── authenticated needs it for RLS ────────────────────────────────
revoke execute on function public.is_admin from public;
grant execute on function public.is_admin to authenticated;

-- admin_delete_user ── authenticated needs it for admin UI ──────────────────
revoke execute on function public.admin_delete_user from public;
grant execute on function public.admin_delete_user to authenticated;

-- =============================================================================
-- 6. LEAKED PASSWORD PROTECTION
-- =============================================================================
-- This check requires a one-click toggle in the Supabase Dashboard:
--   Authentication → Settings → Bot Protection → Leaked Password Protection
-- It cannot be enabled via SQL because the feature lives in the GoTrue
-- adapter, not in PostgreSQL. Enable it manually.
-- =============================================================================
