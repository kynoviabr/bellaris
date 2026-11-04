-- Fase D (backend): vínculos sincronizados pelo banco, listagem e troca do salão ativo.
-- Aplicada na HOMOLOGAÇÃO (pnvhqvspziujrpagsclx) em 2026-11-04, após aprovação do Fernando
-- para começar pelo backend. Produção não foi tocada.
--
-- D1a: gatilhos em profiles. O salão ativo acompanha o salão do perfil; todo perfil com
--      salão tem vínculo ativo (papel acompanha o perfil). Assim o fluxo atual de criação
--      de usuários grava vínculos sem mudança de código.
-- D1b: public.my_organizations() e public.switch_active_organization(uuid). A troca só aceita
--      salão com vínculo ativo do próprio usuário.
-- D1c: private.current_organization_id() sem fallback para profiles.organization_id.
--
-- Testes (transação com rollback): gatilho cria vínculo e troca o ativo; troca para salão sem
-- vínculo é bloqueada; troca para o próprio salão funciona. Suíte A2: 0 violações.

create or replace function private.profile_set_active_organization()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if new.organization_id is not null
     and (tg_op = 'INSERT'
          or new.organization_id is distinct from old.organization_id
          or new.active_organization_id is null) then
    new.active_organization_id := new.organization_id;
  end if;
  return new;
end
$function$;

create trigger profiles_set_active_organization
  before insert or update of organization_id, active_organization_id on public.profiles
  for each row execute function private.profile_set_active_organization();

create or replace function private.profile_sync_membership()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if new.organization_id is not null then
    insert into public.memberships (user_id, organization_id, role, active)
    values (new.id, new.organization_id, new.role, true)
    on conflict (user_id, organization_id)
      do update set role = excluded.role, active = true;
  end if;
  return new;
end
$function$;

create trigger profiles_sync_membership
  after insert or update of organization_id, role on public.profiles
  for each row execute function private.profile_sync_membership();

create or replace function public.my_organizations()
returns table(organization_id uuid, name text, slug text, is_active boolean)
language sql
stable
security definer
set search_path to ''
as $function$
  select o.id, o.name, o.slug, (p.active_organization_id = o.id)
  from public.memberships m
  join public.organizations o on o.id = m.organization_id
  join public.profiles p on p.id = m.user_id
  where m.user_id = (select auth.uid()) and m.active
  order by o.name
$function$;

create or replace function public.switch_active_organization(p_organization_id uuid)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare v_user uuid := (select auth.uid());
begin
  if v_user is null then raise exception 'Não autenticado'; end if;
  if not exists (
    select 1 from public.memberships m
    where m.user_id = v_user and m.organization_id = p_organization_id and m.active
  ) then
    raise exception 'Você não tem acesso a este salão';
  end if;
  update public.profiles set active_organization_id = p_organization_id where id = v_user;
  return p_organization_id;
end
$function$;

revoke execute on function public.switch_active_organization(uuid) from public, anon;
grant execute on function public.switch_active_organization(uuid) to authenticated;
revoke execute on function public.my_organizations() from public, anon;
grant execute on function public.my_organizations() to authenticated;

create or replace function private.current_organization_id()
returns uuid
language sql
stable
security definer
set search_path to ''
as $function$
  select m.organization_id
  from public.profiles p
  join public.memberships m
    on m.user_id = p.id
   and m.organization_id = p.active_organization_id
   and m.active
  where p.id = (select auth.uid())
$function$;
