-- Teste gratuito vencido e agendamento online por plano.
-- 1. Teste vencido recebe mensagem própria no bloqueio de escrita (antes dizia "mensalidade em atraso").
-- 2. Agendamento online só para o plano Completo (platform_booking_allowed).
-- 3. Dono vê a data de fim do teste (salon_trial_ends_at) para mostrar o aviso.
-- Homologação. Não aplicar na produção sem aprovação.

-- 1a. Motivo do bloqueio: teste vencido tem motivo próprio.
create or replace function private.salon_write_block_reason(p_org uuid)
returns text
language sql
stable
security definer
set search_path to 'public', 'private'
as $function$
  select case
    when o.access_status <> 'ativo' then 'pendente'
    when public.platform_billing_status_of(p_org) = 'somente_leitura'
         and exists (
           select 1 from public.platform_subscriptions s
            where s.organization_id = p_org
              and s.trial_ends_at is not null
              and s.current_period_end is null
         ) then 'teste_vencido'
    when public.platform_billing_status_of(p_org) = 'somente_leitura' then 'somente_leitura'
    when public.platform_billing_status_of(p_org) = 'cancelada' then 'cancelada'
    when public.platform_billing_status_of(p_org) = 'sem_plano' then 'sem_plano'
    else null
  end
  from public.organizations o
  where o.id = p_org
$function$;

-- 1b. Mensagem do trigger com o caso do teste vencido.
create or replace function private.guard_salon_writable()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'private'
as $function$
declare
  v_org uuid;
  v_reason text;
begin
  if coalesce(current_setting('app.retention_purge', true), '') = 'on' then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    v_org := (to_jsonb(old) ->> 'organization_id')::uuid;
  else
    v_org := (to_jsonb(new) ->> 'organization_id')::uuid;
  end if;

  if v_org is not null then
    v_reason := private.salon_write_block_reason(v_org);
    if v_reason = 'pendente' then
      raise exception 'Este salão ainda não está liberado para uso. O cadastro está em análise.'
        using errcode = '42501';
    elsif v_reason = 'teste_vencido' then
      raise exception 'O teste gratuito terminou. Para continuar alterando dados, escolha um plano. Fale com a Bellaris.'
        using errcode = '42501';
    elsif v_reason = 'somente_leitura' then
      raise exception 'A mensalidade está em atraso. O salão está em modo somente leitura até a regularização.'
        using errcode = '42501';
    elsif v_reason = 'cancelada' then
      raise exception 'A assinatura deste salão foi cancelada. Não é possível alterar dados. Fale com a Bellaris.'
        using errcode = '42501';
    elsif v_reason = 'sem_plano' then
      raise exception 'Este salão não tem um plano ativo. Não é possível alterar dados. Fale com a Bellaris.'
        using errcode = '42501';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$function$;

-- 2. Agendamento online liberado só no plano Completo. Usado pelo servidor (service_role).
create or replace function public.platform_booking_allowed(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select coalesce(s.plan_code = 'completo', false)
  from (select 1) x
  left join public.platform_subscriptions s on s.organization_id = p_org
$function$;

revoke execute on function public.platform_booking_allowed(uuid) from public, anon, authenticated;
grant execute on function public.platform_booking_allowed(uuid) to service_role;

-- 3. Data de fim do teste, só enquanto não houver primeiro pagamento. Lida pelo dono do salão.
create or replace function public.salon_trial_ends_at()
returns date
language sql
stable
security definer
set search_path to ''
as $function$
  select s.trial_ends_at
  from public.platform_subscriptions s
  where s.organization_id = private.current_organization_id()
    and s.current_period_end is null
$function$;

revoke execute on function public.salon_trial_ends_at() from public, anon;
grant execute on function public.salon_trial_ends_at() to authenticated;
