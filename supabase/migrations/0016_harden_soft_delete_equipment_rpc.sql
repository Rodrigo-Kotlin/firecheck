-- =============================================================================
-- FireCheck · Harden soft_delete_equipment RPC com autorização interna
-- =============================================================================
-- A RPC original (0015) permitia que qualquer usuário authenticated excluísse
-- qualquer equipamento. Esta migration adiciona validação de autorização:
--
--   • only admins (public.is_admin()) OR the equipment owner (created_by = auth.uid())
--     may soft-delete.
--   • raises typed errors the client can map: UNAUTH, NFOUND, ALDEL, PERMD.
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

  if not public.is_admin() and v_created_by <> v_user_id then
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
