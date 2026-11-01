-- Pagamento de comissões escolhidas: p_commission_ids nulo paga todas as pendentes (comportamento anterior).
-- Mantém o cálculo do total no banco e a gravação da despesa na mesma transação.
drop function if exists public.pay_commissions(uuid);

create or replace function public.pay_commissions(p_professional_id uuid, p_commission_ids uuid[] default null)
returns numeric
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_org uuid := private.current_organization_id();
  v_total numeric;
  v_name text;
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if v_org is null then
    raise exception 'Sem salão associado ao usuário';
  end if;

  with updated as (
    update public.commissions
       set status = 'paid', paid_at = now()
     where professional_id = p_professional_id
       and organization_id = v_org
       and status = 'generated'
       and (p_commission_ids is null or id = any(p_commission_ids))
    returning amount
  )
  select coalesce(sum(amount), 0) into v_total from updated;

  if v_total <= 0 then
    raise exception 'Nenhuma comissão pendente selecionada para pagar';
  end if;

  select name into v_name from public.professionals where id = p_professional_id;

  insert into public.expenses (organization_id, description, category, competence_date, due_date, paid_at, amount, status)
  values (v_org, 'Pagamento de comissões - ' || coalesce(v_name, 'Profissional'), 'Comissões', v_today, v_today, v_today, v_total, 'paid');

  return v_total;
end;
$$;

revoke execute on function public.pay_commissions(uuid, uuid[]) from public, anon;
grant execute on function public.pay_commissions(uuid, uuid[]) to authenticated;
