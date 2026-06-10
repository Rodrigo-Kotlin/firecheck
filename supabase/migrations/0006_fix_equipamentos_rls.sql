-- =============================================================================
-- FireCheck · Fix RLS policies for public.equipamentos
-- =============================================================================
-- Replaces the permissive `p_auth_equipamentos` (from 0003) with granular
-- policies that restrict INSERT/UPDATE/DELETE based on ownership.
--
-- Adds `created_by` column to track the user who created the equipment.
-- Idempotent: safe to re-run.
-- =============================================================================

-- 1. Add created_by column (uuid, FK to auth.users)
alter table public.equipamentos
  add column if not exists created_by uuid references auth.users(id) on delete set null;

-- 2. Drop the old permissive policy from migration 0003
drop policy if exists "p_auth_equipamentos" on public.equipamentos;

-- 3. New granular policies

drop policy if exists "p_equipamentos_select" on public.equipamentos;

-- SELECT: any authenticated user can read all equipment (needed for sync/pull)
create policy "p_equipamentos_select" on public.equipamentos
  for select to authenticated
  using (true);

drop policy if exists "p_equipamentos_insert" on public.equipamentos;

-- INSERT: equipment must be attributed to the creating user
create policy "p_equipamentos_insert" on public.equipamentos
  for insert to authenticated
  with check (created_by = auth.uid());

drop policy if exists "p_equipamentos_update" on public.equipamentos;

-- UPDATE: only the owner or an admin can update
create policy "p_equipamentos_update" on public.equipamentos
  for update to authenticated
  using (public.is_admin() or created_by = auth.uid())
  with check (public.is_admin() or created_by = auth.uid());

drop policy if exists "p_equipamentos_delete" on public.equipamentos;

-- DELETE: only the owner or an admin can delete
create policy "p_equipamentos_delete" on public.equipamentos
  for delete to authenticated
  using (public.is_admin() or created_by = auth.uid());
