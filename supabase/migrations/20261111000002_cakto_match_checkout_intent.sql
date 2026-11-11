-- Registra no repositório a função cakto_match_checkout_intent, que já existe em produção
-- mas não estava em nenhuma migração. O corpo abaixo é o que está em produção.
-- Executável só pelo service_role (usado pelo webhook da Cakto).

CREATE OR REPLACE FUNCTION public.cakto_match_checkout_intent(p_intent_id uuid, p_subscription_id text, p_offer_id text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_intent public.cakto_checkout_intents%rowtype; v_plan text;
begin
  if nullif(trim(p_subscription_id),'') is null then return 'missing_subscription_id'; end if;
  select * into v_intent from public.cakto_checkout_intents where id=p_intent_id for update;
  if not found then return 'unknown_intent'; end if;
  if v_intent.status <> 'pending' or v_intent.expires_at <= now() then return 'intent_not_pending'; end if;
  if v_intent.offer_id <> p_offer_id then return 'offer_mismatch'; end if;
  select plan_code into v_plan from public.cakto_plan_offers where offer_id=p_offer_id and active=true;
  if v_plan is null or v_plan <> v_intent.plan_code then return 'plan_mismatch'; end if;
  if exists (select 1 from public.cakto_subscription_links where organization_id=v_intent.organization_id or cakto_subscription_id=p_subscription_id) then return 'already_linked'; end if;
  insert into public.cakto_subscription_links(cakto_subscription_id,organization_id,plan_code) values(p_subscription_id,v_intent.organization_id,v_intent.plan_code);
  update public.cakto_checkout_intents set status='matched',cakto_subscription_id=p_subscription_id,matched_at=now() where id=p_intent_id;
  return 'matched';
exception when unique_violation then return 'already_linked';
end $function$;

revoke execute on function public.cakto_match_checkout_intent(uuid, text, text) from public, anon, authenticated;
grant execute on function public.cakto_match_checkout_intent(uuid, text, text) to service_role;
