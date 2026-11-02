-- Salão cancelado é bloqueado mesmo quando a cobrança é isenta.
-- Antes, 'isento' era verificado antes de 'cancelada', então cancelar um salão isento
-- não gerava bloqueio de escrita. Agora 'cancelada' vem primeiro.
-- Homologação. Não aplicar na produção sem aprovação.

create or replace function public.platform_billing_status_of(p_org uuid)
returns text
language sql
stable
security definer
set search_path to ''
as $function$
  select case
    when s.organization_id is null then 'sem_cadastro'
    when s.cancelled then 'cancelada'
    when s.billing_mode = 'isento' then 'isento'
    when s.plan_code is null or s.current_period_end is null then 'sem_plano'
    when (now() at time zone 'America/Sao_Paulo')::date <= s.current_period_end then 'em_dia'
    when (now() at time zone 'America/Sao_Paulo')::date < s.current_period_end + 16 then 'aviso'
    else 'somente_leitura'
  end
  from (select 1) x
  left join public.platform_subscriptions s on s.organization_id = p_org
$function$;
