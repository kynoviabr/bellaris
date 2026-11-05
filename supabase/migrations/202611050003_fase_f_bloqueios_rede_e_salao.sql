-- Fase F (bloqueios em dois níveis). Aplicar primeiro na HOMOLOGAÇÃO (pnvhqvspziujrpagsclx).
-- Produção não é tocada por este arquivo.
--
-- Bloqueio pela Bellaris (master): networks.platform_blocked bloqueia a rede inteira.
--   Nenhum salão da rede acessa o sistema, nem o dono da rede. O dono continua vendo a
--   fatura da rede e o motivo (funções que dependem só de networks.owner_user_id).
-- Bloqueio pelo dono da rede: organizations.network_blocked bloqueia um salão da rede.
--   Os usuários desse salão não acessam o salão; os outros salões continuam.
-- Prioridade: bloqueio da rede vale por cima do bloqueio de salão.
--
-- Helper private.current_organization_id(): devolve null para salão bloqueado (por salão ou
-- por rede). Como as políticas de RLS usam esse helper, os dados ficam bloqueados em todas as tabelas.
--
-- Rollback: recriar private.current_organization_id() como na migration 202611040004,
-- e remover as colunas e funções novas.

alter table public.networks add column if not exists platform_blocked boolean not null default false;
alter table public.organizations add column if not exists network_blocked boolean not null default false;

-- Helper: salão ativo validado por vínculo ativo, e não bloqueado por salão nem por rede.
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
    join public.organizations o on o.id = m.organization_id
    left join public.networks n on n.id = o.network_id
   where p.id = (select auth.uid())
     and not o.network_blocked
     and not coalesce(n.platform_blocked, false)
$function$;

-- Lista de salões do usuário, com o estado de acesso de cada um.
drop function if exists public.my_organizations();

create function public.my_organizations()
returns table(
  organization_id uuid,
  name text,
  slug text,
  is_active boolean,
  accessible boolean,
  can_manage boolean,
  salon_blocked boolean,
  network_platform_blocked boolean
)
language sql
stable
security definer
set search_path to ''
as $function$
  select
    o.id,
    o.name,
    o.slug,
    (p.active_organization_id = o.id and m.active and not o.network_blocked and not coalesce(n.platform_blocked, false)),
    (m.active and not o.network_blocked and not coalesce(n.platform_blocked, false)),
    coalesce(n.owner_user_id = (select auth.uid()), false),
    o.network_blocked,
    coalesce(n.platform_blocked, false)
  from public.memberships m
  join public.organizations o on o.id = m.organization_id
  join public.profiles p on p.id = m.user_id
  left join public.networks n on n.id = o.network_id
  where m.user_id = (select auth.uid())
  order by o.name
$function$;

revoke execute on function public.my_organizations() from public, anon;
grant execute on function public.my_organizations() to authenticated;

-- Dono da rede bloqueia ou libera um salão da própria rede.
create or replace function public.set_salon_network_blocked(p_organization_id uuid, p_blocked boolean)
returns boolean
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is null then raise exception 'Não autenticado'; end if;
  if not exists (
    select 1 from public.networks n
      join public.organizations o on o.network_id = n.id
     where n.owner_user_id = v_user and o.id = p_organization_id
  ) then
    raise exception 'Só o dono da rede pode bloquear este salão';
  end if;
  update public.organizations set network_blocked = p_blocked where id = p_organization_id;
  return p_blocked;
end
$function$;

revoke execute on function public.set_salon_network_blocked(uuid, boolean) from public, anon;
grant execute on function public.set_salon_network_blocked(uuid, boolean) to authenticated;

-- Master da Bellaris: lista as redes e o estado de bloqueio de cada uma.
create or replace function public.platform_list_networks()
returns table(network_id uuid, name text, owner_user_id uuid, platform_blocked boolean, salon_count bigint)
language plpgsql
stable
security definer
set search_path to ''
as $function$
begin
  if not exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'platform_master') then
    raise exception 'Apenas o master da plataforma';
  end if;
  return query
    select n.id, n.name, n.owner_user_id, n.platform_blocked,
           (select count(*) from public.organizations o where o.network_id = n.id)
      from public.networks n
     order by n.name;
end
$function$;

revoke execute on function public.platform_list_networks() from public, anon;
grant execute on function public.platform_list_networks() to authenticated;

-- Master da Bellaris: bloqueia ou libera uma rede inteira.
create or replace function public.platform_set_network_blocked(p_network_id uuid, p_blocked boolean)
returns boolean
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if not exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'platform_master') then
    raise exception 'Apenas o master da plataforma';
  end if;
  update public.networks set platform_blocked = p_blocked where id = p_network_id;
  if not found then raise exception 'Rede não encontrada'; end if;
  return p_blocked;
end
$function$;

revoke execute on function public.platform_set_network_blocked(uuid, boolean) from public, anon;
grant execute on function public.platform_set_network_blocked(uuid, boolean) to authenticated;
