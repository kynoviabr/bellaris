-- Homologação somente (aplicada em pnvhqvspziujrpagsclx em 2026-11-04).
-- Dono ou gestora do salão ativo vê a própria cobrança (somente leitura).
-- payer: 'isento' | 'rede' (fatura única da rede) | 'salao' (própria mensalidade).
create or replace function public.my_salon_billing()
returns table(salon_name text, plan_name text, monthly_price numeric, discount_percent numeric, amount numeric, due_date date, payer text, network_name text)
language plpgsql stable security definer set search_path to ''
as $function$
declare
  v_caller uuid := (select auth.uid());
  v_org uuid := private.current_organization_id();
  v_role text;
  v_month date := date_trunc('month', (now() at time zone 'America/Sao_Paulo'))::date;
begin
  if v_caller is null or v_org is null then raise exception 'Não autenticado'; end if;
  select m.role into v_role from public.memberships m
   where m.user_id = v_caller and m.organization_id = v_org and m.active;
  if v_role not in ('owner', 'admin') then raise exception 'Apenas o dono ou a gestora pode ver a cobrança'; end if;

  return query
  select
    o.name, p.name, p.monthly_price, s.discount_percent,
    case when s.billing_mode = 'mensalidade' and s.cancelled = false
         then round(p.monthly_price * (1 - s.discount_percent / 100), 2) else 0::numeric end,
    case when s.billing_mode = 'mensalidade' and s.cancelled = false
         then private.nth_business_day(v_month, s.due_business_day) else null end,
    case when s.billing_mode = 'isento' then 'isento'
         when n.billing_mode = 'single_invoice' then 'rede'
         else 'salao' end,
    n.name
  from public.organizations o
  left join public.platform_subscriptions s on s.organization_id = o.id
  left join public.platform_plans p on p.code = s.plan_code
  left join public.networks n on n.id = o.network_id
  where o.id = v_org;
end
$function$;

revoke execute on function public.my_salon_billing() from public, anon;
grant execute on function public.my_salon_billing() to authenticated;
