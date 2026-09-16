-- =============================================================================
-- FireCheck · Fotos de inspeção — restringe Storage e formaliza fotos_inspecao
-- =============================================================================
-- Metadados das evidências fotográficas de inspeção:
--
--   1. `fotos_inspecao` ganha os campos de metadados que o app envia no sync
--      (mime_type, size_bytes, created_by). O push agora grava estas colunas.
--   2. As policies do bucket `inspection-photos` deixam de ser globais e
--      passam a exigir que o objeto resida na pasta do próprio usuário
--      (`<uid>/...`) — path usado pelo app: `<userId>/<inspectionId>/<photoUuid>.jpg`.
--      Admins continuam podendo acessar tudo.
--   3. Garante o bucket não-público (idempotente).
--
-- Idempotente: pode ser re-aplicado no SQL Editor do Supabase.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. COLUNAS DE METADADOS EM `fotos_inspecao`
-- ---------------------------------------------------------------------------

alter table public.fotos_inspecao
  add column if not exists mime_type  text,
  add column if not exists size_bytes bigint,
  add column if not exists created_by uuid references auth.users(id) on delete set null;

-- A policy de INSERT (criada em 0007) valida que o autor é dono da inspeção
-- pai via join em `inspecoes.user_id`; `created_by` é apenas metadado informativo.

-- ---------------------------------------------------------------------------
-- 2. BUCKET (idempotente) — permanece não-público; download exige RLS.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('inspection-photos', 'inspection-photos', false)
on conflict (id) do update set public = false;

-- ---------------------------------------------------------------------------
-- 3. STORAGE POLICIES — por proprietário
-- ---------------------------------------------------------------------------
-- Objetos em `inspection-photos` são organizados em pastas
-- `<userId>/<inspectionId>/<photoUuid>.<ext>`.
-- As políticas abaixo garantem que:
--   • qualquer usuário autenticado pode criar objetos na SUA pasta;
--   • só o dono (ou admin) pode ler/atualizar/excluir objetos da pasta;
--   • objetos legados fora de `/<user>/...` ficam acessíveis só a admins
--     (nenhum foi enviado até o momento — o upload estava órfão no app).

drop policy if exists "p_storage_select" on storage.objects;
drop policy if exists "p_storage_insert" on storage.objects;
drop policy if exists "p_storage_update" on storage.objects;
drop policy if exists "p_storage_delete" on storage.objects;

create policy "p_storage_select_owner" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'inspection-photos'
    and (
      public.is_admin()
      or (storage.foldername(name))[1] = (select auth.uid()::text)
    )
  );

create policy "p_storage_insert_owner" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'inspection-photos'
    and (
      public.is_admin()
      or (storage.foldername(name))[1] = (select auth.uid()::text)
    )
  );

create policy "p_storage_update_owner" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'inspection-photos'
    and (
      public.is_admin()
      or (storage.foldername(name))[1] = (select auth.uid()::text)
    )
  );

create policy "p_storage_delete_owner" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'inspection-photos'
    and (
      public.is_admin()
      or (storage.foldername(name))[1] = (select auth.uid()::text)
    )
  );