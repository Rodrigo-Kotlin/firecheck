-- =============================================================================
-- FireCheck · Initial schema
-- =============================================================================
-- Run this in the Supabase SQL Editor (https://app.supabase.com → SQL).
-- Idempotent: safe to re-run.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. TABLES
-- ---------------------------------------------------------------------------

create table if not exists public.equipamentos (
  id                      text primary key,
  tipo                    text        not null,
  subtipo                 text,
  local                   text        not null,
  setor                   text        not null,
  pavimento               text,
  fabricante              text,
  num_serie               text,
  capacidade              text,
  tipo_carga              text,
  data_fabricacao         date,
  data_ultima_manutencao  date,
  data_proxima_manutencao date,
  data_proxima_inspecao   date,
  status                  text        not null default 'regular'
    check (status in ('regular', 'pendente', 'vencido', 'observacao')),
  qrcode                  text,
  foto_url                text,
  observacoes             text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index if not exists idx_equipamentos_status on public.equipamentos (status);
create index if not exists idx_equipamentos_tipo   on public.equipamentos (tipo);
create index if not exists idx_equipamentos_setor  on public.equipamentos (setor);

create table if not exists public.inspetores (
  id     text primary key,
  nome   text not null,
  cargo  text not null
);

create table if not exists public.inspecoes (
  id              text primary key,
  equipment_id    text        not null references public.equipamentos(id) on delete cascade,
  data            date        not null default current_date,
  inspetor        text        not null,
  status          text        not null
    check (status in ('regular', 'pendente', 'vencido', 'observacao')),
  observacoes     text,
  checklist_json  jsonb,
  sincronizado    boolean     not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_inspecoes_equipment on public.inspecoes (equipment_id);
create index if not exists idx_inspecoes_data       on public.inspecoes (data desc);

create table if not exists public.planos_acao (
  id            text primary key,
  equipment_id  text        not null references public.equipamentos(id) on delete cascade,
  local         text        not null,
  descricao     text        not null,
  criticidade   text        not null default 'Médio'
    check (criticidade in ('Crítico', 'Alto', 'Médio', 'Baixo')),
  responsavel   text        not null default '',
  prazo         date,
  status        text        not null default 'Aberta'
    check (status in ('Aberta', 'Em andamento', 'Concluída', 'Vencida')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_planos_status      on public.planos_acao (status);
create index if not exists idx_planos_equipment   on public.planos_acao (equipment_id);

-- ---------------------------------------------------------------------------
-- 2. PHOTO STORAGE
-- ---------------------------------------------------------------------------
-- Photos are kept in Dexie (base64) for offline-first; on sync we upload
-- them to the `inspection-photos` bucket. The DB only tracks the path.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('inspection-photos', 'inspection-photos', false)
on conflict (id) do nothing;

create table if not exists public.fotos_inspecao (
  id              text primary key,
  inspection_id   text not null references public.inspecoes(id) on delete cascade,
  storage_path    text not null,
  uploaded_at     timestamptz not null default now()
);

create index if not exists idx_fotos_inspecao on public.fotos_inspecao (inspection_id);

-- ---------------------------------------------------------------------------
-- 3. UPDATED-AT TRIGGER
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_equipamentos_updated_at on public.equipamentos;
create trigger trg_equipamentos_updated_at
  before update on public.equipamentos
  for each row execute function public.set_updated_at();

drop trigger if exists trg_inspecoes_updated_at on public.inspecoes;
create trigger trg_inspecoes_updated_at
  before update on public.inspecoes
  for each row execute function public.set_updated_at();

drop trigger if exists trg_planos_updated_at on public.planos_acao;
create trigger trg_planos_updated_at
  before update on public.planos_acao
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 4. ROW-LEVEL SECURITY
-- ---------------------------------------------------------------------------
-- The PWA uses a mock login (no Supabase Auth), so for the demo we leave RLS
-- permissive. TIGHTEN THIS IN PRODUCTION: require `auth.role() = 'authenticated'`
-- and add policies per user / org.
-- ---------------------------------------------------------------------------

alter table public.equipamentos   enable row level security;
alter table public.inspetores     enable row level security;
alter table public.inspecoes      enable row level security;
alter table public.planos_acao    enable row level security;
alter table public.fotos_inspecao enable row level security;

drop policy if exists "p_all_equipamentos"   on public.equipamentos;
drop policy if exists "p_all_inspetores"     on public.inspetores;
drop policy if exists "p_all_inspecoes"      on public.inspecoes;
drop policy if exists "p_all_planos"         on public.planos_acao;
drop policy if exists "p_all_fotos"          on public.fotos_inspecao;

create policy "p_all_equipamentos"   on public.equipamentos   for all using (true) with check (true);
create policy "p_all_inspetores"     on public.inspetores     for all using (true) with check (true);
create policy "p_all_inspecoes"      on public.inspecoes      for all using (true) with check (true);
create policy "p_all_planos"         on public.planos_acao    for all using (true) with check (true);
create policy "p_all_fotos"          on public.fotos_inspecao for all using (true) with check (true);

-- Storage policies (permissive for demo)
drop policy if exists "p_storage_select" on storage.objects;
drop policy if exists "p_storage_insert" on storage.objects;
drop policy if exists "p_storage_update" on storage.objects;
drop policy if exists "p_storage_delete" on storage.objects;
create policy "p_storage_select" on storage.objects for select using (bucket_id = 'inspection-photos');
create policy "p_storage_insert" on storage.objects for insert with check (bucket_id = 'inspection-photos');
create policy "p_storage_update" on storage.objects for update using (bucket_id = 'inspection-photos');
create policy "p_storage_delete" on storage.objects for delete using (bucket_id = 'inspection-photos');
