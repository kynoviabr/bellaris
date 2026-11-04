-- Fase D (rede): o dono cria a rede a partir do salão ativo, e cria salão novo dentro dela.
-- Aplicada na HOMOLOGAÇÃO (pnvhqvspziujrpagsclx) em 2026-11-04. Produção não foi tocada.
-- Salão criado pela rede: nasce ligado à rede, com acesso liberado, o franqueador como dono
-- (vínculo owner) e assinatura copiada do salão de origem. Cobrança por rede é da fase E.
-- Testes em transação com rollback: criar rede ok; criar salão ok (vínculo e assinatura criados);
-- slug repetido e slug inválido bloqueados; conta sem rede bloqueada.

create or replace function public.create_network(p_name text)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_caller uuid := (select auth.uid());
  v_role text;
  v_org uuid := private.current_organization_id();
  v_net uuid;
begin
  if v_caller is null then raise exception 'Não autenticado'; end if;
  select role into v_role from public.profiles where id = v_caller;
  if v_role <> 'owner' or v_org is null then raise exception 'Apenas o dono do salão pode criar a rede'; end if;
  if trim(coalesce(p_name, '')) = '' then raise exception 'Informe o nome da rede'; end if;
  if exists (select 1 from public.networks where owner_user_id = v_caller) then
    raise exception 'Você já tem uma rede';
  end if;
  if exists (select 1 from public.organizations where id = v_org and network_id is not null) then
    raise exception 'Este salão já pertence a uma rede';
  end if;

  insert into public.networks (name, owner_user_id) values (trim(p_name), v_caller) returning id into v_net;
  update public.organizations set network_id = v_net where id = v_org;
  return v_net;
end
$function$;

create or replace function public.create_salon_in_network(p_name text, p_slug text)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_caller uuid := (select auth.uid());
  v_net uuid;
  v_src uuid := private.current_organization_id();
  v_new uuid;
  v_name text := trim(coalesce(p_name, ''));
  v_slug text := lower(trim(coalesce(p_slug, '')));
  v_sub public.platform_subscriptions%rowtype;
begin
  if v_caller is null then raise exception 'Não autenticado'; end if;
  select id into v_net from public.networks where owner_user_id = v_caller;
  if v_net is null then raise exception 'Você não é dono de uma rede'; end if;
  if v_name = '' then raise exception 'Informe o nome do salão'; end if;
  if v_slug !~ '^[a-z0-9-]{3,60}$' then raise exception 'Endereço (slug) inválido: use de 3 a 60 letras minúsculas, números ou hífen'; end if;
  if exists (select 1 from public.organizations where slug = v_slug) then raise exception 'Este endereço (slug) já está em uso'; end if;

  select * into v_sub from public.platform_subscriptions where organization_id = v_src;
  if not found then raise exception 'O salão de origem não tem assinatura configurada'; end if;

  insert into public.organizations (name, slug, network_id)
  values (v_name, v_slug, v_net)
  returning id into v_new;

  insert into public.memberships (user_id, organization_id, role, active)
  values (v_caller, v_new, 'owner', true);

  insert into public.platform_subscriptions (organization_id, plan_code, billing_mode, due_business_day, current_period_end, cancelled, notes)
  values (v_new, v_sub.plan_code, v_sub.billing_mode, v_sub.due_business_day, v_sub.current_period_end, false, 'Criado pela rede ' || v_net::text);

  return v_new;
end
$function$;

revoke execute on function public.create_network(text) from public, anon;
grant execute on function public.create_network(text) to authenticated;
revoke execute on function public.create_salon_in_network(text, text) from public, anon;
grant execute on function public.create_salon_in_network(text, text) to authenticated;
