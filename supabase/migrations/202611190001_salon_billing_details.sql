-- Mensalidade em atraso: o próprio salão vê mês, vencimento, valor e dias de atraso.
-- Somente leitura. Não altera a situação (platform_billing_status_of) nem os bloqueios.
-- Homologação. Não aplicar na produção sem aprovação.

create or replace function public.salon_billing_details()
returns table (plan_name text, reference_month date, due_date date, amount numeric, days_late integer)
language sql
stable
security definer
set search_path = ''
as $function$
  select pl.name,
         date_trunc('month', s.current_period_end)::date,
         s.current_period_end,
         pl.monthly_price,
         ((now() at time zone 'America/Sao_Paulo')::date - s.current_period_end)::integer
  from public.platform_subscriptions s
  join public.platform_plans pl on pl.code = s.plan_code
  where s.organization_id = private.current_organization_id()
    and s.billing_mode = 'mensalidade'
    and not s.cancelled
    and s.current_period_end is not null
    and (now() at time zone 'America/Sao_Paulo')::date > s.current_period_end
$function$;

revoke execute on function public.salon_billing_details() from public, anon;
grant execute on function public.salon_billing_details() to authenticated;
