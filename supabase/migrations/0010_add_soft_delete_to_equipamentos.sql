-- =============================================================================
-- FireCheck · Soft delete (tombstone) para equipamentos
-- =============================================================================
-- Permite que exclusões feitas por um cliente sejam propagadas para os demais
-- sem perder informações (hard DELETE impede a descoberta de exclusões remotas).
-- =============================================================================

alter table public.equipamentos
add column if not exists deleted_at timestamptz;

alter table public.equipamentos
add column if not exists deleted_by uuid;

alter table public.equipamentos
add column if not exists created_at timestamptz default now();

alter table public.equipamentos
add column if not exists updated_at timestamptz default now();

notify pgrst, 'reload schema';
