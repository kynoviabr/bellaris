-- Fase E (painel da rede): totais por salão da rede, no mês escolhido.
-- Aplicada na HOMOLOGAÇÃO (pnvhqvspziujrpagsclx) em 2026-11-04. Produção não foi tocada.
-- Regra igual à do Financeiro de cada salão (src/lib/actions/finance.ts):
--   receita = pagamentos pagos (depósito, pagamento, crédito) − estornos/chargebacks
--           + serviços de atendimentos concluídos acima do que já foi pago
--   despesas pagas (paid_at no mês); pendentes (due_date no mês) à parte
--   comissões (created_at no mês); consumo de estoque (custo, no mês)
--   saldo = receita − despesas pagas − comissões − consumo
-- Só o dono da rede recebe; devolve somente totais, sem linhas de clientes ou atendimentos.
-- Testes em transação com rollback: dono recebe 1 linha (Demo); conta sem rede bloqueada;
-- mês inválido bloqueado. Revisão dos números pelo Fernando é o gate da fase E.

create or replace function public.network_financial_summary(p_month text)
returns table(
  org_id uuid,
  salon_name text,
  revenue numeric,
  expenses_paid numeric,
  pending_expenses numeric,
  commissions_total numeric,
  consumption_cost numeric,
  balance numeric,
  concluded_appointments bigint
)
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_caller uuid := (select auth.uid());
  v_net uuid;
  v_start date;
  v_end date;
  v_start_ts timestamptz;
  v_end_ts timestamptz;
begin
  if v_caller is null then raise exception 'Não autenticado'; end if;
  select n.id into v_net from public.networks n where n.owner_user_id = v_caller;
  if v_net is null then raise exception 'Você não é dono de uma rede'; end if;
  if p_month is null or p_month !~ '^\d{4}-\d{2}$' then raise exception 'Mês inválido'; end if;

  v_start := (p_month || '-01')::date;
  v_end := (v_start + interval '1 month')::date;
  v_start_ts := v_start::timestamp at time zone 'America/Sao_Paulo';
  v_end_ts := v_end::timestamp at time zone 'America/Sao_Paulo';

  return query
  with salons as (
    select o.id as sid, o.name as sname from public.organizations o where o.network_id = v_net
  ),
  pay_month as (
    select p.organization_id as oid,
      sum(case
            when p.status = 'paid' and p.kind in ('deposit','payment','credit') then p.amount
            when p.status in ('paid','refunded') and p.kind in ('refund','chargeback') then -p.amount
            else 0 end) as v
    from public.payments p
    where p.organization_id in (select sid from salons)
      and p.paid_at >= v_start_ts and p.paid_at < v_end_ts
    group by p.organization_id
  ),
  apps as (
    select a.id as aid, a.organization_id as oid,
      coalesce((select sum(i.unit_price * coalesce(i.quantity, 1) - coalesce(i.discount, 0) + coalesce(i.surcharge, 0))
                  from public.appointment_items i where i.appointment_id = a.id), 0) as items_total,
      coalesce((select sum(p2.amount) from public.payments p2
                  where p2.appointment_id = a.id and p2.status = 'paid' and p2.kind in ('deposit','payment','credit')), 0) as pmts_total
    from public.appointments a
    where a.organization_id in (select sid from salons)
      and a.status = 'completed'
      and a.starts_at >= v_start_ts and a.starts_at < v_end_ts
  ),
  svc as (
    select oid, sum(greatest(0, items_total - pmts_total)) as v, count(*) as n from apps group by oid
  ),
  exp_paid as (
    select e.organization_id as oid, sum(e.amount) as v from public.expenses e
    where e.organization_id in (select sid from salons) and e.status = 'paid'
      and e.paid_at >= v_start and e.paid_at < v_end
    group by e.organization_id
  ),
  exp_pend as (
    select e.organization_id as oid, sum(e.amount) as v from public.expenses e
    where e.organization_id in (select sid from salons) and e.status = 'pending'
      and e.due_date >= v_start and e.due_date < v_end
    group by e.organization_id
  ),
  comm as (
    select c.organization_id as oid, sum(c.amount) as v from public.commissions c
    where c.organization_id in (select sid from salons)
      and c.created_at >= v_start_ts and c.created_at < v_end_ts
    group by c.organization_id
  ),
  cons as (
    select sm.organization_id as oid, sum(sm.quantity * coalesce(pr.unit_cost, 0)) as v
    from public.stock_movements sm
    join public.products pr on pr.id = sm.product_id
    where sm.organization_id in (select sid from salons)
      and sm.movement_type = 'consumption'
      and sm.created_at >= v_start_ts and sm.created_at < v_end_ts
    group by sm.organization_id
  )
  select s.sid,
         s.sname,
         (coalesce(pm.v, 0) + coalesce(sv.v, 0))::numeric,
         coalesce(ep.v, 0)::numeric,
         coalesce(epd.v, 0)::numeric,
         coalesce(cm.v, 0)::numeric,
         coalesce(cs.v, 0)::numeric,
         (coalesce(pm.v, 0) + coalesce(sv.v, 0) - coalesce(ep.v, 0) - coalesce(cm.v, 0) - coalesce(cs.v, 0))::numeric,
         coalesce(sv.n, 0)::bigint
  from salons s
  left join pay_month pm on pm.oid = s.sid
  left join svc sv on sv.oid = s.sid
  left join exp_paid ep on ep.oid = s.sid
  left join exp_pend epd on epd.oid = s.sid
  left join comm cm on cm.oid = s.sid
  left join cons cs on cs.oid = s.sid
  order by s.sname;
end
$function$;

revoke execute on function public.network_financial_summary(text) from public, anon;
grant execute on function public.network_financial_summary(text) to authenticated;
