-- Checkout intent is a server-side correlation record; NOT proof of payment.
-- Only service_role may access it. A matching webhook must be verified independently.
create table if not exists public.cakto_checkout_intents (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id),
 plan_code text not null references public.platform_plans(code),
 offer_id text not null references public.cakto_plan_offers(offer_id),
 status text not null default 'pending' check (status in ('pending','matched','expired','cancelled')),
 cakto_subscription_id text unique,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default (now() + interval '24 hours'),
 matched_at timestamptz,
 constraint cakto_checkout_intents_valid_expiry check (expires_at > created_at),
 constraint cakto_checkout_intents_matched_consistency
   check ((status = 'matched') = (cakto_subscription_id is not null))
);
create unique index if not exists cakto_checkout_intents_pending_org_unique
 on public.cakto_checkout_intents (organization_id) where status = 'pending';
alter table public.cakto_checkout_intents enable row level security;
revoke all on public.cakto_checkout_intents from anon, authenticated;
grant select, insert, update on public.cakto_checkout_intents to service_role;
