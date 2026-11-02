-- Salvar uma assinatura isenta ignorava o checkbox "Assinatura cancelada" e gravava cancelled = false.
-- Agora a cobrança isenta respeita o valor marcado no formulário.
-- Homologação. Não aplicar na produção sem aprovação.

create or replace function public.platform_set_subscription(p_org uuid, p_billing_mode text, p_plan_code text, p_due_business_day integer, p_cancelled boolean, p_notes text)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  s public.platform_subscriptions%rowtype;
  v_month date := date_trunc('month', (now() at time zone 'America/Sao_Paulo'))::date;
begin
  if not private.is_platform_master() then raise exception 'Acesso restrito ao master da plataforma'; end if;
  if not exists (select 1 from public.organizations where id = p_org) then raise exception 'Salão não encontrado'; end if;
  select * into s from public.platform_subscriptions where organization_id = p_org;

  if p_billing_mode = 'isento' then
    insert into public.platform_subscriptions (organization_id, plan_code, billing_mode, due_business_day, current_period_end, cancelled, notes, updated_at)
    values (p_org, p_plan_code, 'isento', null, null, p_cancelled, p_notes, now())
    on conflict (organization_id) do update
      set plan_code = excluded.plan_code, billing_mode = 'isento', due_business_day = null,
          current_period_end = null, cancelled = excluded.cancelled, notes = excluded.notes, updated_at = now();
    return;
  end if;

  if p_plan_code is null or p_due_business_day is null then raise exception 'Plano e dia de vencimento são obrigatórios'; end if;

  if found and s.current_period_end is not null and s.due_business_day is distinct from p_due_business_day then
    insert into public.platform_subscriptions (organization_id, plan_code, billing_mode, due_business_day, current_period_end, cancelled, notes, updated_at)
    values (p_org, p_plan_code, 'mensalidade', p_due_business_day,
            private.nth_business_day(date_trunc('month', s.current_period_end)::date, p_due_business_day),
            p_cancelled, p_notes, now())
    on conflict (organization_id) do update
      set plan_code = excluded.plan_code, billing_mode = 'mensalidade', due_business_day = excluded.due_business_day,
          current_period_end = excluded.current_period_end, cancelled = excluded.cancelled, notes = excluded.notes, updated_at = now();
  else
    insert into public.platform_subscriptions (organization_id, plan_code, billing_mode, due_business_day, current_period_end, cancelled, notes, updated_at)
    values (p_org, p_plan_code, 'mensalidade', p_due_business_day,
            private.nth_business_day(v_month, p_due_business_day), p_cancelled, p_notes, now())
    on conflict (organization_id) do update
      set plan_code = excluded.plan_code, billing_mode = 'mensalidade', due_business_day = excluded.due_business_day,
          current_period_end = coalesce(public.platform_subscriptions.current_period_end, excluded.current_period_end),
          cancelled = excluded.cancelled, notes = excluded.notes, updated_at = now();
  end if;
end $function$;
