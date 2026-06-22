-- =============================================================================
-- FireCheck · Soft-delete RPC segura para equipamentos (SECURITY DEFINER)
-- =============================================================================
-- Bypassa RLS quando o UPDATE direto falha silenciosamente (ex.: conflito de
-- owner ou política bloqueando). Usada como fallback em softDeleteEquipment().
-- =============================================================================

create or replace function public.soft_delete_equipment(p_id text)
returns table (id text, deleted_at timestamptz, deleted_by uuid, updated_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Usuário não autenticado' using errcode = 'UNAUTH';
  end if;

  return query
  update public.equipamentos
  set deleted_at = now(),
      deleted_by = auth.uid(),
      updated_at = now()
  where id = p_id
    and deleted_at is null
  returning id, deleted_at, deleted_by, updated_at;
end;
$$;

revoke execute on function public.soft_delete_equipment from public, anon;
grant execute on function public.soft_delete_equipment to authenticated;
