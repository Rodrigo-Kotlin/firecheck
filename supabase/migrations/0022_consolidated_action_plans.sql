-- Consolidated inspection action plans. Existing plans remain model_version 1.
alter table public.planos_acao
  add column if not exists model_version smallint not null default 1;

alter table public.planos_acao
  add constraint planos_acao_model_version_check
  check (model_version in (1, 2));

create unique index if not exists uq_planos_acao_active_consolidated_inspection
  on public.planos_acao (user_id, inspection_id)
  where model_version = 2
    and origin_type = 'inspection'
    and inspection_id is not null
    and deleted_at is null;

create table if not exists public.planos_acao_itens (
  id text primary key,
  plan_id text not null references public.planos_acao(id) on delete cascade,
  deviation_key text not null,
  checklist_item_key text not null,
  tipo_desvio text not null check (tipo_desvio in ('warning', 'nonconformity')),
  descricao_desvio text not null,
  acao_corretiva text not null default '',
  solucao_adotada text not null default '',
  responsavel text not null default '',
  prazo date,
  status text not null default 'Aberta' check (status in ('Aberta', 'Em andamento', 'Concluída')),
  concluido_em timestamptz,
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null
);

create index if not exists idx_planos_acao_itens_plan_id on public.planos_acao_itens (plan_id);
create index if not exists idx_planos_acao_itens_status on public.planos_acao_itens (status);

create unique index if not exists uq_planos_acao_itens_active_deviation
  on public.planos_acao_itens (plan_id, deviation_key)
  where deleted_at is null;

alter table public.planos_acao_itens enable row level security;

create policy "p_planos_acao_itens_select" on public.planos_acao_itens
  for select to authenticated using (public.is_admin() or user_id = auth.uid());
create policy "p_planos_acao_itens_insert" on public.planos_acao_itens
  for insert to authenticated with check (public.is_admin() or user_id = auth.uid());
create policy "p_planos_acao_itens_update" on public.planos_acao_itens
  for update to authenticated
  using (public.is_admin() or user_id = auth.uid())
  with check (public.is_admin() or user_id = auth.uid());
create policy "p_planos_acao_itens_delete" on public.planos_acao_itens
  for delete to authenticated using (public.is_admin() or user_id = auth.uid());

notify pgrst, 'reload schema';
