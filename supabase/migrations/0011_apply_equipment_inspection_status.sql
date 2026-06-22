-- =============================================================================
-- FireCheck · RPC segura para aplicar status de inspeção
-- =============================================================================
-- Cria uma função SECURITY DEFINER que permite a qualquer usuário autenticado
-- atualizar apenas os campos operacionais do equipamento (status, datas de
-- inspeção) sem precisar de permissão de UPDATE geral na tabela.
--
-- A policy atual de UPDATE exige created_by = auth.uid() ou admin, mas o
-- fluxo de inspeção precisa permitir que qualquer inspetor autenticado
-- registre o resultado da vistoria no status do equipamento.
--
-- Esta RPC resolve o problema sem abrir a policy de UPDATE:
--   • SECURITY DEFINER → executa como owner da função (supera RLS)
--   • Altera APENAS campos operacionais (status, data_ultima_inspecao,
--     data_proxima_inspecao)
--   • Bloqueia alteração de dados cadastrais (id, tipo, local, etc.)
--   • Exige autenticação
--   • Valida status permitido
--   • Retorna erro se equipamento não existir ou estiver excluído
-- =============================================================================

create or replace function public.apply_equipment_inspection_status(
  p_equipment_id          text,
  p_status                text,
  p_inspection_date       date default current_date,
  p_next_inspection_date  date default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated_at timestamptz;
  v_status     text;
  v_ultima     date;
  v_proxima    date;
begin
  -- 1. Autenticação obrigatória
  if auth.uid() is null then
    raise exception 'Usuário nao autenticado.' using errcode = 'UNAUTH';
  end if;

  -- 2. Validar status
  if p_status not in (
    'regular', 'pendente', 'vencido', 'observacao',
    'em_manutencao', 'inativo', 'substituido', 'extraviado'
  ) then
    raise exception 'Status invalido: %', p_status using errcode = 'INVSTT';
  end if;

  -- 3. Atualizar SOMENTE campos operacionais
  update public.equipamentos
     set status               = p_status,
         data_ultima_inspecao = p_inspection_date,
         data_proxima_inspecao = coalesce(p_next_inspection_date, data_proxima_inspecao)
   where id = p_equipment_id
     and deleted_at is null
   returning updated_at, status, data_ultima_inspecao, data_proxima_inspecao
   into v_updated_at, v_status, v_ultima, v_proxima;

  -- 4. Se nenhuma linha foi atualizada, equipamento não existe ou foi excluído
  if not found then
    raise exception 'Equipamento nao encontrado ou excluido: %', p_equipment_id using errcode = 'NFOUND';
  end if;

  -- 5. Retornar os campos alterados
  return jsonb_build_object(
    'id', p_equipment_id,
    'status', v_status,
    'updated_at', v_updated_at,
    'data_ultima_inspecao', v_ultima,
    'data_proxima_inspecao', v_proxima
  );
end;
$$;

-- Revogar execução pública e conceder apenas a usuários autenticados
revoke all on function public.apply_equipment_inspection_status(text, text, date, date) from public;
grant  execute on function public.apply_equipment_inspection_status(text, text, date, date) to authenticated;

-- Notificar PostgREST para recarregar o schema
notify pgrst, 'reload schema';
