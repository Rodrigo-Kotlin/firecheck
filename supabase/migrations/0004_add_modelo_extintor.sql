-- =============================================================================
-- FireCheck · Add modelo_extintor column to equipamentos
-- =============================================================================
-- Run this in the Supabase SQL Editor (https://app.supabase.com → SQL).
-- Idempotent: safe to re-run.
-- =============================================================================

alter table public.equipamentos
  add column if not exists modelo_extintor text;
