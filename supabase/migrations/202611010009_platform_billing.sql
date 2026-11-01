-- Assinaturas da plataforma (Bellaris). Cobrança manual: o master registra os pagamentos.
-- Regras:
--   * vencimento = N-ésimo dia útil do mês (dias úteis = seg a sex; feriados ainda não considerados)
--   * aviso começa no 1º dia de atraso; somente leitura a partir do 16º dia de atraso
--   * salão isento (billing_mode = 'isento') não entra em nenhuma cobrança nem bloqueio
-- Dados de assinatura só são lidos pelo master, ou pelo próprio salão via salon_billing_status().

create table if not exists public.platform_plans (
  code text primary key,
  name text not null,
  monthly_price numeric(10,2) not null check (monthly_price > 0),
  max_professionals integer check (max_professionals is null or max_professionals > 0),
  description text,
  active boolean not null default true
);

create table if not exists public.platform_subscriptions (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  plan_code text references public.platform_plans(code),
  billing_mode text not null default 'mensalidade' check (billing_mode in ('mensalidade', 'isento')),
  due_business_day integer check (due_business_day between 1 and 23),
  current_period_end date,
  cancelled boolean not null default false,
  notes text,
  updated_at timestamptz not null default now(),
  check (billing_mode = 'isento' or (plan_code is not null and due_business_day is not null))
);

create table if not exists public.platform_payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  reference_month date not null check (reference_month = date_trunc('month', reference_month)::date),
  amount numeric(10,2) not null check (amount > 0),
  method text not null check (method in ('pix', 'boleto', 'cartao', 'dinheiro', 'outro')),
  paid_at date not null,
  notes text,
  registered_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (organization_id, reference_month)
);

alter table public.platform_plans enable row level security;
alter table public.platform_subscriptions enable row level security;
alter table public.platform_payments enable row level security;

-- Somente o master lê estas tabelas diretamente. Escrita só por função.
revoke all on public.platform_plans, public.platform_subscriptions, public.platform_payments from anon, authenticated;
grant select on public.platform_plans, public.platform_subscriptions, public.platform_payments to authenticated;

create or replace function private.is_platform_master()
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'platform_master') $$;

create policy platform_plans_master_read on public.platform_plans for select to authenticated using (private.is_platform_master());
create policy platform_subscriptions_master_read on public.platform_subscriptions for select to authenticated using (private.is_platform_master());
create policy platform_payments_master_read on public.platform_payments for select to authenticated using (private.is_platform_master());

insert into public.platform_plans (code, name, monthly_price, max_professionals, description) values
  ('essencial', 'Essencial', 79.00, 2, 'Agenda, clientes, atendimentos e cobrança.'),
  ('profissional', 'Profissional', 149.00, 6, 'Essencial + comissões, financeiro, relatórios, pacotes e automações.'),
  ('completo', 'Completo', 249.00, null, 'Profissional + agendamento online e suporte prioritário.')
on conflict (code) do nothing;

-- N-ésimo dia útil (seg a sex) do mês de p_month. Se p_n passar do último dia útil, retorna o último.
create or replace function private.nth_business_day(p_month date, p_n integer)
returns date language plpgsql immutable set search_path = ''
as $$
declare
  first_day date := date_trunc('month', p_month)::date;
  d date;
  cnt integer := 0;
  last_bd date;
begin
  for d in select generate_series(first_day, (first_day + interval '1 month - 1 day')::date, interval '1 day')::date loop
    if extract(isodow from d) < 6 then
      cnt := cnt + 1;
      last_bd := d;
      if cnt = p_n then return d; end if;
    end if;
  end loop;
  return last_bd;
end $$;

-- Situação de cobrança de um salão, calculada na data de São Paulo.
create or replace function public.platform_billing_status_of(p_org uuid)
returns text language sql stable set search_path = ''
as $$
  select case
    when s.organization_id is null then 'sem_cadastro'
    when s.billing_mode = 'isento' then 'isento'
    when s.cancelled then 'cancelada'
    when s.plan_code is null or s.current_period_end is null then 'sem_plano'
    when (now() at time zone 'America/Sao_Paulo')::date <= s.current_period_end then 'em_dia'
    when (now() at time zone 'America/Sao_Paulo')::date < s.current_period_end + 16 then 'aviso'
    else 'somente_leitura'
  end
  from (select 1) x
  left join public.platform_subscriptions s on s.organization_id = p_org
$$;

-- Visão do master: um salão por linha, com situação, vencimento e último pagamento.
create or replace function public.platform_billing_overview()
returns table (
  organization_id uuid, salon_name text, plan_code text, plan_name text, billing_mode text,
  status text, due_date date, days_overdue integer, last_payment_on date, monthly_price numeric
)
language sql stable security definer set search_path = ''
as $$
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
    pl.monthly_price
  from public.organizations o
  left join public.platform_subscriptions s on s.organization_id = o.id
  left join public.platform_plans pl on pl.code = s.plan_code
  where private.is_platform_master()
  order by o.name
$$;

-- Registra o pagamento de um mês e avança o vencimento para o mês seguinte.
create or replace function public.platform_register_payment(
  p_org uuid, p_reference_month date, p_amount numeric, p_method text, p_paid_at date, p_notes text default null
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  s public.platform_subscriptions%rowtype;
  v_id uuid;
  v_owed_month date;
begin
  if not private.is_platform_master() then raise exception 'Acesso restrito ao master da plataforma'; end if;
  select * into s from public.platform_subscriptions where organization_id = p_org for update;
  if not found or s.billing_mode <> 'mensalidade' then raise exception 'Salão sem mensalidade cadastrada'; end if;
  if s.current_period_end is null then raise exception 'Vencimento não definido'; end if;

  -- O mês cobrado é o mês em que vence o período atual.
  v_owed_month := date_trunc('month', s.current_period_end)::date;
  if p_reference_month <> v_owed_month then
    raise exception 'Este pagamento deve referir-se a %', to_char(v_owed_month, 'MM/YYYY');
  end if;

  insert into public.platform_payments (organization_id, reference_month, amount, method, paid_at, notes, registered_by)
  values (p_org, p_reference_month, p_amount, p_method, p_paid_at, p_notes, (select auth.uid()))
  returning id into v_id;

  update public.platform_subscriptions
     set current_period_end = private.nth_business_day((p_reference_month + interval '1 month')::date, s.due_business_day),
         cancelled = false, updated_at = now()
   where organization_id = p_org;

  return v_id;
end $$;

-- Cria ou altera a assinatura de um salão (somente master).
create or replace function public.platform_set_subscription(
  p_org uuid, p_billing_mode text, p_plan_code text, p_due_business_day integer, p_cancelled boolean, p_notes text
) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  s public.platform_subscriptions%rowtype;
  v_month date := date_trunc('month', (now() at time zone 'America/Sao_Paulo'))::date;
begin
  if not private.is_platform_master() then raise exception 'Acesso restrito ao master da plataforma'; end if;
  if not exists (select 1 from public.organizations where id = p_org) then raise exception 'Salão não encontrado'; end if;
  select * into s from public.platform_subscriptions where organization_id = p_org;

  if p_billing_mode = 'isento' then
    insert into public.platform_subscriptions (organization_id, plan_code, billing_mode, due_business_day, current_period_end, cancelled, notes, updated_at)
    values (p_org, p_plan_code, 'isento', null, null, false, p_notes, now())
    on conflict (organization_id) do update
      set plan_code = excluded.plan_code, billing_mode = 'isento', due_business_day = null,
          current_period_end = null, cancelled = false, notes = excluded.notes, updated_at = now();
    return;
  end if;

  if p_plan_code is null or p_due_business_day is null then raise exception 'Plano e dia de vencimento são obrigatórios'; end if;

  if found and s.current_period_end is not null and s.due_business_day is distinct from p_due_business_day then
    -- Mantém o mês cobrado e recalcula o vencimento com o novo dia.
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
end $$;

-- Situação do próprio salão (para o aviso no app). Não expõe outros salões.
create or replace function public.salon_billing_status()
returns text
language sql stable security definer set search_path = ''
as $$
  select public.platform_billing_status_of(p.organization_id)
  from public.profiles p
  where p.id = (select auth.uid())
$$;

revoke execute on function private.is_platform_master() from public, anon;
revoke execute on function private.nth_business_day(date, integer) from public, anon;
revoke execute on function public.platform_billing_status_of(uuid) from public, anon;
revoke execute on function public.platform_billing_overview() from public, anon;
revoke execute on function public.platform_register_payment(uuid, date, numeric, text, date, text) from public, anon;
revoke execute on function public.platform_set_subscription(uuid, text, text, integer, boolean, text) from public, anon;
revoke execute on function public.salon_billing_status() from public, anon;
grant execute on function private.is_platform_master() to authenticated;
grant execute on function private.nth_business_day(date, integer) to authenticated;
grant execute on function public.platform_billing_status_of(uuid) to authenticated;
grant execute on function public.platform_billing_overview() to authenticated;
grant execute on function public.platform_register_payment(uuid, date, numeric, text, date, text) to authenticated;
grant execute on function public.platform_set_subscription(uuid, text, text, integer, boolean, text) to authenticated;
grant execute on function public.salon_billing_status() to authenticated;

-- Gabi Ludwig Nail Studio: plano Profissional, isenta de mensalidade (decisão do Fernando).
insert into public.platform_subscriptions (organization_id, plan_code, billing_mode, notes)
values ('11111111-1111-4111-8111-111111111111', 'profissional', 'isento', 'Não paga mensalidade. Decisão do Fernando.')
on conflict (organization_id) do nothing;
