-- Cakto webhook inbox (homolog first). No automatic entitlement changes.
create table if not exists public.cakto_webhook_events (
 id uuid primary key default gen_random_uuid(),
 event_key text not null unique,
 event_type text not null,
 order_id text,
 payload jsonb not null,
 received_at timestamptz not null default now(),
 processed_at timestamptz,
 processing_error text
);
alter table public.cakto_webhook_events enable row level security;
revoke all on public.cakto_webhook_events from anon, authenticated;
create index if not exists cakto_webhook_events_pending_idx
 on public.cakto_webhook_events (received_at) where processed_at is null;
