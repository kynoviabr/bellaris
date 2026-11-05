-- Fase F (complemento): o dono da rede ativa ou desativa o próprio acesso a cada salão da rede.
-- Aplicar primeiro na HOMOLOGAÇÃO (pnvhqvspziujrpagsclx). Produção não é tocada por este arquivo.
--
-- G1: my_organizations() passa a devolver também vínculos desativados (para a tela mostrar
--     "Desativado" em vez de sumir), e diz se o usuário pode alterar o salão (dono da rede).
-- G2: set_salon_membership_active(salão, ativo): só o dono da rede, só para salões da rede.
--     Não deixa desativar o único salão ativo do usuário (evita ficar sem acesso pela tela).
--     Desativar usa o gatilho da migration 202611050001 para mover o salão ativo.
--
-- Rollback: recriar my_organizations() como na migration 202611040004 e remover a função nova.

drop function if exists public.my_organizations();

create function public.my_organizations()
returns table(organization_id uuid, name text, slug text, is_active boolean, membership_active boolean, can_manage boolean)
language sql
stable
security definer
set search_path to ''
as $function$
  select
    o.id,
    o.name,
    o.slug,
    (p.active_organization_id = o.id and m.active),
    m.active,
    exists (
      select 1 from public.networks n
       where n.id = o.network_id and n.owner_user_id = (select auth.uid())
    )
  from public.memberships m
  join public.organizations o on o.id = m.organization_id
  join public.profiles p on p.id = m.user_id
  where m.user_id = (select auth.uid())
  order by o.name
$function$;

revoke execute on function public.my_organizations() from public, anon;
grant execute on function public.my_organizations() to authenticated;

create or replace function public.set_salon_membership_active(p_organization_id uuid, p_active boolean)
returns boolean
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user uuid := (select auth.uid());
  v_active_count int;
begin
  if v_user is null then raise exception 'Não autenticado'; end if;

  if not exists (
    select 1
      from public.networks n
      join public.organizations o on o.network_id = n.id
     where n.owner_user_id = v_user and o.id = p_organization_id
  ) then
    raise exception 'Só o dono da rede pode alterar o acesso a este salão';
  end if;

  if p_active then
    update public.memberships
       set active = true
     where user_id = v_user and organization_id = p_organization_id;
    -- Se o usuário não tinha salão ativo, este passa a ser o salão ativo.
    update public.profiles
       set active_organization_id = p_organization_id
     where id = v_user and active_organization_id is null;
  else
    select count(*) into v_active_count
      from public.memberships
     where user_id = v_user and active;
    if v_active_count <= 1 and exists (
      select 1 from public.memberships
       where user_id = v_user and organization_id = p_organization_id and active
    ) then
      raise exception 'Não é possível desativar o único salão ativo';
    end if;
    update public.memberships
       set active = false
     where user_id = v_user and organization_id = p_organization_id;
  end if;

  return p_active;
end
$function$;

revoke execute on function public.set_salon_membership_active(uuid, boolean) from public, anon;
grant execute on function public.set_salon_membership_active(uuid, boolean) to authenticated;
