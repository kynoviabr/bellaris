-- Homologação somente (aplicada em pnvhqvspziujrpagsclx em 2026-11-04).
-- Dono da rede lista os salões da própria rede e desvincula um deles (o salão não é apagado).
-- Funções: my_network_salons() e unlink_salon_from_network(uuid).
create or replace function public.my_network_salons()
returns table(organization_id uuid, name text)
language sql stable security definer set search_path to ''
as $function$
  select o.id, o.name
  from public.organizations o
  join public.networks n on n.id = o.network_id
  where n.owner_user_id = (select auth.uid())
  order by o.name;
$function$;

create or replace function public.unlink_salon_from_network(p_organization_id uuid)
returns void
language plpgsql security definer set search_path to ''
as $function$
declare
  v_caller uuid := (select auth.uid());
  v_net uuid;
begin
  if v_caller is null then raise exception 'Não autenticado'; end if;
  select id into v_net from public.networks where owner_user_id = v_caller;
  if v_net is null then raise exception 'Você não é dono de uma rede'; end if;
  if not exists (select 1 from public.organizations where id = p_organization_id and network_id = v_net) then
    raise exception 'Este salão não faz parte da sua rede';
  end if;
  update public.organizations set network_id = null where id = p_organization_id;
end
$function$;

revoke execute on function public.my_network_salons() from public, anon;
grant execute on function public.my_network_salons() to authenticated;
revoke execute on function public.unlink_salon_from_network(uuid) from public, anon;
grant execute on function public.unlink_salon_from_network(uuid) to authenticated;
