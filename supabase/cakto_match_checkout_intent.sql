create or replace function public.cakto_match_checkout_intent(p_intent_id uuid,p_subscription_id text,p_offer_id text)
returns text language plpgsql security definer set search_path=public as $$
declare i public.cakto_checkout_intents%rowtype; p text;
begin
 if nullif(trim(p_subscription_id),'') is null then return 'missing_subscription_id'; end if;
 select * into i from public.cakto_checkout_intents where id=p_intent_id for update;
 if not found then return 'unknown_intent'; end if;
 if i.status<>'pending' or i.expires_at<=now() then return 'intent_not_pending'; end if;
 if i.offer_id<>p_offer_id then return 'offer_mismatch'; end if;
 select plan_code into p from public.cakto_plan_offers where offer_id=p_offer_id and active;
 if p is null or p<>i.plan_code then return 'plan_mismatch'; end if;
 if exists(select 1 from public.cakto_subscription_links where organization_id=i.organization_id or cakto_subscription_id=p_subscription_id) then return 'already_linked'; end if;
 insert into public.cakto_subscription_links(cakto_subscription_id,organization_id,plan_code) values(p_subscription_id,i.organization_id,i.plan_code);
 update public.cakto_checkout_intents set status='matched',cakto_subscription_id=p_subscription_id,matched_at=now() where id=p_intent_id;
 return 'matched';
exception when unique_violation then return 'already_linked';
end $$;
revoke all on function public.cakto_match_checkout_intent(uuid,text,text) from public,anon,authenticated;
grant execute on function public.cakto_match_checkout_intent(uuid,text,text) to service_role;
