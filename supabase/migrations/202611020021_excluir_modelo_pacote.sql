-- Exclusão de modelo do catálogo. Só é permitida se o modelo nunca foi vendido.
-- Como pacotes vendidos não guardam o id do modelo, a checagem usa o nome:
-- se existir qualquer pacote da organização com o mesmo nome, a exclusão é bloqueada.
create or replace function public.delete_package_template(p_template_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_name text;
begin
  v_org := private.current_organization_id();
  if v_org is null then
    raise exception 'Not authenticated or no organization';
  end if;
  if private.current_user_role() not in ('owner', 'admin', 'manager') then
    raise exception 'Sem permissão para excluir modelos de pacote';
  end if;

  select name into v_name from public.package_templates
  where id = p_template_id and organization_id = v_org;
  if not found then
    raise exception 'Modelo de pacote não encontrado';
  end if;

  if exists (select 1 from public.packages where organization_id = v_org and name = v_name) then
    raise exception 'Este modelo já foi vendido. Use Desativar para tirá-lo da venda.';
  end if;

  delete from public.package_template_items where template_id = p_template_id and organization_id = v_org;
  delete from public.package_templates where id = p_template_id and organization_id = v_org;
end;
$$;

revoke execute on function public.delete_package_template(uuid) from public;
grant execute on function public.delete_package_template(uuid) to authenticated;
