-- =============================================================================
-- FireCheck · Add dados_tecnicos JSONB and qr_code columns
-- =============================================================================
-- Idempotent: safe to re-run.
-- =============================================================================

alter table public.equipamentos
add column if not exists dados_tecnicos jsonb not null default '{}'::jsonb;

alter table public.equipamentos
add column if not exists qr_code text;

notify pgrst, 'reload schema';
