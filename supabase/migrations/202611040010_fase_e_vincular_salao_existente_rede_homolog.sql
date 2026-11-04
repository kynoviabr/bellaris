-- Homologação somente (aplicada em pnvhqvspziujrpagsclx em 2026-11-04).
-- Dono da rede vincula salão existente do qual é dono (owner ativo). Não mexe em salão de outra rede.
-- Funções: my_salons_available_for_network() e link_salon_to_network(uuid).
create or replace function public.my_salons_available_for_network()
returns table(organization_id uuid, name text)
language sql stable security definer set search_path to ''
as $function$
  select o.id, o.name
  from public.organizations o
  join public.memberships m
    on m.organization_id = o.id and m.user_id = (select auth.uid()) and m.role = 'owner' and m.active
  where o.network_id is null
    and exists (select 1 from public.networks n where n.owner_user_id = (select auth.uid()))
  order by o.name;
$function$;

create or replace function public.link_salon_to_network(p_organization_id uuid)
returns uuid
language plpgsql security definer set search_path to ''
as $function$
declare
  v_caller uuid := (select auth.uid());
  v_net uuid;
  v_org_net uuid;
begin
  if v_caller is null then raise exception 'Não autenticado'; end if;
  select id into v_net from public.networks where owner_user_id = v_caller;
  if v_net is null then raise exception 'Você não é dono de uma rede'; end if;
  if not exists (
    select 1 from public.memberships
    where user_id = v_caller and organization_id = p_organization_id and role = 'owner' and active
  ) then
    raise exception 'Você não é dona deste salão';
  end if;
  select network_id into v_org_net from public.organizations where id = p_organization_id for update;
  if not found then raise exception 'Salão não encontrado'; end if;
  if v_org_net is not null then raise exception 'Este salão já pertence a uma rede'; end if;
  update public.organizations set network_id = v_net where id = p_organization_id;
  return v_net;
end
$function$;

revoke execute on function public.my_salons_available_for_network() from public, anon;
grant execute on function public.my_salons_available_for_network() to authenticated;
revoke execute on function public.link_salon_to_network(uuid) from public, anon;
grant execute on function public.link_salon_to_network(uuid) to authenticated;
