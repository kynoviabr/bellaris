-- Homologação somente (aplicada em pnvhqvspziujrpagsclx em 2026-11-04).
-- E2b: o dono da rede escolhe o modo de cobrança (per_salon ou single_invoice).
-- Não altera platform_subscriptions.
create or replace function public.set_network_billing_mode(p_mode text)
returns text
language plpgsql security definer set search_path to ''
as $function$
declare
  v_caller uuid := (select auth.uid());
begin
  if v_caller is null then raise exception 'Não autenticado'; end if;
  if p_mode not in ('per_salon', 'single_invoice') then raise exception 'Modo de cobrança inválido'; end if;
  if not exists (select 1 from public.networks where owner_user_id = v_caller) then
    raise exception 'Você não é dono de uma rede';
  end if;
  update public.networks set billing_mode = p_mode where owner_user_id = v_caller;
  return p_mode;
end
$function$;

revoke execute on function public.set_network_billing_mode(text) from public, anon;
grant execute on function public.set_network_billing_mode(text) to authenticated;
