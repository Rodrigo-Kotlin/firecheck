-- =============================================================================
-- FireCheck · Normalize equipment qr_code / qrcode fields
-- =============================================================================
-- Idempotent: safe to re-run.
--
-- Garante que o campo qr_code (DB) sempre reflita o id (TAG oficial).
-- Corrige divergências de dados legados onde qr_code diferia de id.
-- A partir de agora o backend sempre escreve id em qr_code via mappers.ts.
-- =============================================================================

-- Atualiza linhas onde qr_code é nulo, vazio ou diferente de id
update public.equipamentos
set
  qr_code = id,
  updated_at = now()
where
  qr_code is null
  or qr_code = ''
  or qr_code <> id;

-- =============================================================================
-- Nota: a coluna legada `qrcode` (sem underscore) não existe no schema SQL
-- do Supabase. Ela só existe na interface TypeScript para compatibilidade
-- com dados antigos que porventura tenham sido salvos com esse nome.
-- A coluna real no banco é `qr_code` (com underscore), adicionada em
-- 0009_add_dados_tecnicos_equipamentos.sql.
-- =============================================================================
