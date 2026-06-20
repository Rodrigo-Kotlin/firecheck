-- =============================================================================
-- FireCheck · Add soft delete columns to planos_acao
-- =============================================================================
-- Adds deleted_at and deleted_by so action plans can be tombstoned and
-- reconciled across clients, mirroring the pattern already in place for
-- equipamentos.
-- =============================================================================

alter table public.planos_acao
  add column if not exists deleted_at timestamptz;

alter table public.planos_acao
  add column if not exists deleted_by uuid
  references auth.users(id) on delete set null;

create index if not exists idx_planos_acao_deleted_at
  on public.planos_acao (deleted_at);

-- Notificar PostgREST para recarregar o schema
notify pgrst, 'reload schema';
