-- Klycx/Cakto webhook reconciliation (homologation)
-- Read-only projection: NEVER activate subscriptions based on unlinked events.
create or replace view public.cakto_webhook_reconciliation
with (security_invoker = true) as
select
  e.id as event_id,
  e.event_type,
  e.received_at,
  e.processed_at,
  e.payload #>> '{data,offer,id}' as offer_id,
  e.payload #>> '{data,subscription,id}' as cakto_subscription_id,
  p.plan_code,
  l.organization_id,
  case
    when e.processed_at is not null then 'processed'
    when p.offer_id is null then 'unknown_offer'
    when nullif(e.payload #>> '{data,subscription,id}', '') is null then 'missing_subscription_id'
    when l.cakto_subscription_id is null then 'unlinked_subscription'
    when l.plan_code <> p.plan_code then 'plan_mismatch'
    else 'ready_for_review'
  end as reconciliation_status
from public.cakto_webhook_events e
left join public.cakto_plan_offers p
  on p.offer_id = e.payload #>> '{data,offer,id}' and p.active
left join public.cakto_subscription_links l
  on l.cakto_subscription_id = e.payload #>> '{data,subscription,id}';

revoke all on public.cakto_webhook_reconciliation from anon, authenticated;
grant select on public.cakto_webhook_reconciliation to service_role;
