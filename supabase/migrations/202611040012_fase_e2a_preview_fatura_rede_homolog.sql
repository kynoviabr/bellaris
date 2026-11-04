-- Homologação somente (aplicada em pnvhqvspziujrpagsclx em 2026-11-04).
-- E2a: prévia da fatura única da rede (somente leitura).
-- Desconto por salão, definido pela plataforma (padrão 0%), sobre a mensalidade do salão.
alter table public.platform_subscriptions
  add column if not exists discount_percent numeric(5,2) not null default 0
  check (discount_percent >= 0 and discount_percent <= 100);

create or replace function public.network_billing_preview(p_month text)
returns table(organization_id uuid, salon_name text, plan_name text, monthly_price numeric, discount_percent numeric, amount numeric, due_business_day integer, included boolean)
language plpgsql stable security definer set search_path to ''
as $function$
declare
  v_caller uuid := (select auth.uid());
  v_net uuid;
begin
  if v_caller is null then raise exception 'Não autenticado'; end if;
  if p_month !~ '^\d{4}-(0[1-9]|1[0-2])$' then raise exception 'Mês inválido. Use o formato AAAA-MM'; end if;
  select id into v_net from public.networks where owner_user_id = v_caller;
  if v_net is null then raise exception 'Você não é dono de uma rede'; end if;

  return query
  select
    o.id, o.name, p.name, p.monthly_price, s.discount_percent,
    case when inc.ok then round(p.monthly_price * (1 - s.discount_percent / 100), 2) else 0::numeric end,
    s.due_business_day,
    inc.ok
  from public.organizations o
  left join public.platform_subscriptions s on s.organization_id = o.id
  left join public.platform_plans p on p.code = s.plan_code
  cross join lateral (
    select coalesce(
      s.billing_mode = 'mensalidade' and s.cancelled = false and p.monthly_price is not null
      and exists (select 1 from public.memberships m where m.organization_id = o.id and m.active),
      false) as ok
  ) inc
  where o.network_id = v_net
  order by o.name;
end
$function$;

revoke execute on function public.network_billing_preview(text) from public, anon;
grant execute on function public.network_billing_preview(text) to authenticated;
