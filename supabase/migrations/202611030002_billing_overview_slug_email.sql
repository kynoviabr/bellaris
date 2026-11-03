-- Financeiro da plataforma: inclui o slug do salão (link de acesso) e o e-mail da proprietária.
-- A proprietária é o perfil com papel 'owner' mais antigo da organização.
-- Retorno muda, por isso a função é recriada. Continua restrita ao master pela checagem existente.

drop function if exists public.platform_billing_overview();

create function public.platform_billing_overview()
returns table(
  organization_id uuid,
  salon_name text,
  plan_code text,
  plan_name text,
  billing_mode text,
  status text,
  due_date date,
  days_overdue integer,
  last_payment_on date,
  monthly_price numeric,
  cancelled boolean,
  due_business_day integer,
  slug text,
  owner_email text
)
language sql
stable
security definer
set search_path to ''
as $function$
  select
    o.id,
    o.name,
    s.plan_code,
    pl.name,
    coalesce(s.billing_mode, 'mensalidade'),
    public.platform_billing_status_of(o.id),
    s.current_period_end,
    case when s.current_period_end is null then 0
         else greatest(0, ((now() at time zone 'America/Sao_Paulo')::date - s.current_period_end)) end,
    (select max(p.paid_at) from public.platform_payments p where p.organization_id = o.id),
    pl.monthly_price,
    coalesce(s.cancelled, false),
    s.due_business_day,
    o.slug,
    (select u.email
       from public.profiles pr
       join auth.users u on u.id = pr.id
      where pr.organization_id = o.id and pr.role = 'owner'
      order by u.created_at
      limit 1)
  from public.organizations o
  left join public.platform_subscriptions s on s.organization_id = o.id
  left join public.platform_plans pl on pl.code = s.plan_code
  where private.is_platform_master()
  order by o.name
$function$;
