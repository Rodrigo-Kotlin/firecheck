-- =============================================================================
-- FireCheck · Seed data (idempotent)
-- =============================================================================
-- Populates the demo inspectors + a few example equipment / inspections so the
-- PWA shows meaningful data the first time it opens. Safe to re-run: every
-- insert uses `on conflict do nothing` keyed on the natural primary key.
-- =============================================================================

insert into public.inspetores (id, nome, cargo) values
  ('1', 'Ricardo Silva',  'Inspetor Líder'),
  ('2', 'Ana Paula',      'Inspetora Plena'),
  ('3', 'Marcos Rocha',   'Inspetor Técnico')
on conflict (id) do nothing;

insert into public.equipamentos (id, tipo, subtipo, local, setor, status) values
  ('EXT-001', 'Extintor',    'PQS 6kg',           'Bloco A, Piso 1',     'Administrativo', 'regular'),
  ('HID-042', 'Hidrante',    'Parede',            'Garagem, Nível -1',   'Estacionamento', 'pendente'),
  ('EXT-109', 'Extintor',    'CO2 4kg',           'CPD, Sala Técnica',   'TI',             'vencido'),
  ('ALM-005', 'Acionador',   'Manual',            'Bloco B, Recepção',   'Comercial',      'regular'),
  ('ILU-018', 'Iluminação',  'Emergência',        'Escada 2',            'Circulação',     'observacao')
on conflict (id) do nothing;

insert into public.inspecoes (id, equipment_id, data, inspetor, status, observacoes) values
  ('INSP-001', 'EXT-001', current_date - 5, 'Ricardo Silva', 'regular',
   'Manômetro na faixa verde, lacre intacto.'),
  ('INSP-002', 'ILU-018', current_date - 2, 'Ana Paula',     'observacao',
   'Autonomia de bateria ligeiramente abaixo do esperado, agendar troca preventiva.')
on conflict (id) do nothing;