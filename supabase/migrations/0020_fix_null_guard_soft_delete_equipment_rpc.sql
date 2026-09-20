-- =============================================================================
-- FireCheck · Fix NULL-guard no soft_delete_equipment (Prompt 20 · Pendência D)
-- =============================================================================
-- A migration 0016 adicionou a checagem de autorização
--
--     if not public.is_admin() and v_created_by <> v_user_id then
--       raise exception ... errcode = 'PERMD';
--     end if;
--
-- mas NÃO cobria o caso `v_created_by IS NULL`. Em SQL,
--
--     NULL <> v_user_id  →  NULL (desconhecido)  →  o IF não dispara
--
-- Portanto um equipamento com `created_by = NULL` (importado em lote por um
-- seed/script, ou linha órfã criada antes do vínculo de auth) podia ser
-- soft-deletado por QUALQUER usuário autenticado que não fosse admin.
--
-- Esta migration corrige a guarda aplicando o NULL-guard explícito:
--
--     (v_created_by is null or v_created_by <> v_user_id)
--
--   • admin passa de qualquer forma (public.is_admin());
--   • dono (v_created_by = v_user_id) passa;
--   • TODOS os demais — incluindo o caso v_created_by IS NULL — recebem PERMD.
--
-- Aplica-se SOMENTE ao staging (regra de sempre: produção intocada).
-- =============================================================================

create or replace function public.soft_delete_equipment(p_id text)
returns table (id text, deleted_at timestamptz, deleted_by uuid, updated_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id    uuid;
  v_created_by uuid;
  v_deleted_at timestamptz;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Usuário não autenticado.' using errcode = 'UNAUTH';
  end if;

  select e.created_by, e.deleted_at
    into v_created_by, v_deleted_at
  from public.equipamentos e
  where e.id = p_id;

  if not found then
    raise exception 'Equipamento não encontrado.' using errcode = 'NFOUND';
  end if;

  if v_deleted_at is not null then
    raise exception 'Equipamento já foi excluído.' using errcode = 'ALDEL';
  end if;

  -- NULL-guard explícito: v_created_by IS NULL NÃO autoriza.
  if not public.is_admin() and (v_created_by is null or v_created_by <> v_user_id) then
    raise exception 'Sem permissão para excluir equipamento.' using errcode = 'PERMD';
  end if;

  return query
  update public.equipamentos e
     set deleted_at = now(),
         deleted_by = v_user_id,
         updated_at = now()
   where e.id = p_id
     and e.deleted_at is null
  returning e.id, e.deleted_at, e.deleted_by, e.updated_at;
end;
$$;

revoke all on function public.soft_delete_equipment(text) from public;
grant execute on function public.soft_delete_equipment(text) to authenticated;
