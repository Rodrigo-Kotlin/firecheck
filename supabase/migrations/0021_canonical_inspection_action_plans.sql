-- Canonical identity for action plans generated from inspection deviations.
alter table public.planos_acao
  add column if not exists inspection_id text references public.inspecoes(id) on delete set null,
  add column if not exists deviation_key text,
  add column if not exists origin_type text not null default 'manual';

alter table public.planos_acao
  add constraint planos_acao_origin_type_check
  check (origin_type in ('manual', 'inspection'));

create index if not exists idx_planos_acao_inspection_id
  on public.planos_acao (inspection_id)
  where inspection_id is not null;

create unique index if not exists uq_planos_acao_active_inspection_deviation
  on public.planos_acao (user_id, inspection_id, deviation_key)
  where origin_type = 'inspection'
    and inspection_id is not null
    and deviation_key is not null
    and deleted_at is null;

notify pgrst, 'reload schema';
