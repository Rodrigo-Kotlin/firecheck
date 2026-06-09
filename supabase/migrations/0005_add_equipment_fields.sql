-- =============================================================================
-- FireCheck · Add dynamic equipment fields and expand status options
-- =============================================================================
-- Run this in the Supabase SQL Editor (https://app.supabase.com → SQL).
-- Idempotent: safe to re-run.
-- =============================================================================

-- 1. Update status check constraint to accept new statuses
alter table public.equipamentos
  drop constraint if exists equipamentos_status_check;

alter table public.equipamentos
  add constraint equipamentos_status_check
    check (status in (
      'regular', 'pendente', 'vencido', 'observacao',
      'em_manutencao', 'inativo', 'substituido', 'extraviado'
    ));

-- 2. Add all new columns (each idempotent via IF NOT EXISTS)
alter table public.equipamentos add column if not exists classe_fogo              text;
alter table public.equipamentos add column if not exists selo_lacre               text;
alter table public.equipamentos add column if not exists manometro                text;
alter table public.equipamentos add column if not exists suporte                  text;
alter table public.equipamentos add column if not exists sinalizacao              text;
alter table public.equipamentos add column if not exists acesso_desobstruido      text;
alter table public.equipamentos add column if not exists estado_geral             text;
alter table public.equipamentos add column if not exists tipo_hidrante            text;
alter table public.equipamentos add column if not exists tipo_abrigo_vinculado    text;
alter table public.equipamentos add column if not exists registro                 text;
alter table public.equipamentos add column if not exists valvula                  text;
alter table public.equipamentos add column if not exists adaptador                text;
alter table public.equipamentos add column if not exists tampao                   text;
alter table public.equipamentos add column if not exists pressao                  text;
alter table public.equipamentos add column if not exists tipo_mangueira           text;
alter table public.equipamentos add column if not exists diametro                 text;
alter table public.equipamentos add column if not exists comprimento              text;
alter table public.equipamentos add column if not exists tipo_uniao               text;
alter table public.equipamentos add column if not exists estado_mangueira         text;
alter table public.equipamentos add column if not exists acondicionamento         text;
alter table public.equipamentos add column if not exists possui_etiqueta_inspecao text;
alter table public.equipamentos add column if not exists tipo_abrigo              text;
alter table public.equipamentos add column if not exists material                 text;
alter table public.equipamentos add column if not exists estado_porta             text;
alter table public.equipamentos add column if not exists estado_visor             text;
alter table public.equipamentos add column if not exists possui_mangueira         text;
alter table public.equipamentos add column if not exists possui_esguicho          text;
alter table public.equipamentos add column if not exists possui_chave_storz       text;
alter table public.equipamentos add column if not exists possui_registro          text;
alter table public.equipamentos add column if not exists tipo_esguicho            text;
alter table public.equipamentos add column if not exists estado_roscas            text;
alter table public.equipamentos add column if not exists estado_vedacao           text;
alter table public.equipamentos add column if not exists compatibilidade_mangueira text;
alter table public.equipamentos add column if not exists local_acondicionamento   text;
alter table public.equipamentos add column if not exists tipo_chave_storz         text;
alter table public.equipamentos add column if not exists diametro_compativel      text;
alter table public.equipamentos add column if not exists estado_fisico            text;
alter table public.equipamentos add column if not exists tipo_acionador           text;
alter table public.equipamentos add column if not exists endereco_zona            text;
alter table public.equipamentos add column if not exists estado_tampa             text;
alter table public.equipamentos add column if not exists estado_botao             text;
alter table public.equipamentos add column if not exists altura_instalacao        text;
alter table public.equipamentos add column if not exists funcionamento_testado    text;
alter table public.equipamentos add column if not exists tipo_alarme              text;
alter table public.equipamentos add column if not exists sirene_audiovisual       text;
alter table public.equipamentos add column if not exists sirene_sonora            text;
alter table public.equipamentos add column if not exists sinalizador_visual       text;
alter table public.equipamentos add column if not exists zona_laco                text;
alter table public.equipamentos add column if not exists fonte_alimentacao        text;
alter table public.equipamentos add column if not exists tipo_central             text;
alter table public.equipamentos add column if not exists quantidade_lacos_zonas   text;
alter table public.equipamentos add column if not exists bateria_backup           text;
alter table public.equipamentos add column if not exists comunicacao_dispositivos  text;
alter table public.equipamentos add column if not exists status_painel            text;
alter table public.equipamentos add column if not exists local_instalacao         text;
alter table public.equipamentos add column if not exists modelo_iluminacao        text;
alter table public.equipamentos add column if not exists funcao_iluminacao        text;
alter table public.equipamentos add column if not exists autonomia                text;
alter table public.equipamentos add column if not exists tipo_instalacao          text;
alter table public.equipamentos add column if not exists potencia                 text;
alter table public.equipamentos add column if not exists tipo_sinalizacao         text;
alter table public.equipamentos add column if not exists codigo_placa             text;
alter table public.equipamentos add column if not exists fotoluminescente         text;
alter table public.equipamentos add column if not exists visibilidade             text;
alter table public.equipamentos add column if not exists estado_conservacao       text;
alter table public.equipamentos add column if not exists fixacao_adequada         text;
alter table public.equipamentos add column if not exists tipo_sprinkler           text;
alter table public.equipamentos add column if not exists temperatura_acionamento  text;
alter table public.equipamentos add column if not exists posicao_instalacao       text;
alter table public.equipamentos add column if not exists estado_bulbo             text;
alter table public.equipamentos add column if not exists obstrucao                text;
alter table public.equipamentos add column if not exists corrosao                 text;
alter table public.equipamentos add column if not exists vazamento                text;
alter table public.equipamentos add column if not exists area_protegida           text;
alter table public.equipamentos add column if not exists tipo_bomba               text;
alter table public.equipamentos add column if not exists vazao                    text;
alter table public.equipamentos add column if not exists alimentacao_eletrica     text;
alter table public.equipamentos add column if not exists painel_comando           text;
alter table public.equipamentos add column if not exists bomba_jockey             text;
alter table public.equipamentos add column if not exists bomba_principal          text;
alter table public.equipamentos add column if not exists bomba_reserva            text;
alter table public.equipamentos add column if not exists tipo_porta               text;
alter table public.equipamentos add column if not exists tempo_resistencia_fogo   text;
alter table public.equipamentos add column if not exists barra_antipanico         text;
alter table public.equipamentos add column if not exists dobradicas               text;
alter table public.equipamentos add column if not exists mola_aerea               text;
alter table public.equipamentos add column if not exists fechamento_automatico    text;
alter table public.equipamentos add column if not exists vedacao                  text;
alter table public.equipamentos add column if not exists tipo_detector_fumaca     text;
alter table public.equipamentos add column if not exists tipo_detector_calor      text;
alter table public.equipamentos add column if not exists nome_modelo              text;
alter table public.equipamentos add column if not exists descricao_tecnica        text;
alter table public.equipamentos add column if not exists data_ultimo_teste        date;
alter table public.equipamentos add column if not exists data_proximo_teste        date;
alter table public.equipamentos add column if not exists data_teste_hidrostatico  date;
alter table public.equipamentos add column if not exists data_validade_teste       date;
alter table public.equipamentos add column if not exists data_ultima_inspecao     date;
