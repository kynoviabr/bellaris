-- Lembretes automáticos de agenda. Usados só pelo job de cron, com service_role.

-- Agendamentos confirmados no período que ainda não receberam lembrete.
create or replace function public.reminder_candidates(p_start timestamptz, p_end timestamptz)
returns table (
  appointment_id uuid,
  organization_id uuid,
  organization_name text,
  client_id uuid,
  client_name text,
  client_phone text,
  starts_at timestamptz,
  services text
)
language sql stable security definer set search_path = '' as $$
  select
    a.id,
    a.organization_id,
    o.name,
    c.id,
    c.name,
    c.phone_normalized,
    a.starts_at,
    coalesce(
      (select string_agg(ai.description, ' e ' order by ai.description)
         from public.appointment_items ai where ai.appointment_id = a.id),
      'seu procedimento'
    )
  from public.appointments a
  join public.organizations o on o.id = a.organization_id
  join public.clients c on c.id = a.client_id
  where a.status = 'scheduled'
    and a.starts_at >= p_start
    and a.starts_at < p_end
    and coalesce(c.phone_normalized, '') <> ''
    and not exists (
      select 1 from public.message_jobs m
      where m.appointment_id = a.id
        and m.payload->>'list' = 'reminders'
        and m.status in ('sent', 'delivered')
    )
  order by a.starts_at
  limit 500
$$;

-- Registra a tentativa de envio do lembrete (enviado ou falhou).
create or replace function public.reminder_record_job(
  p_org uuid,
  p_client uuid,
  p_appointment uuid,
  p_status public.message_status,
  p_provider_message_id text,
  p_error text
)
returns void
language sql security definer set search_path = '' as $$
  insert into public.message_jobs (
    organization_id, client_id, appointment_id, channel, provider,
    scheduled_at, status, payload, sent_at, error
  ) values (
    p_org, p_client, p_appointment, 'whatsapp', 'meta',
    now(), p_status,
    jsonb_build_object('list', 'reminders', 'provider_message_id', p_provider_message_id),
    case when p_status = 'sent' then now() end,
    p_error
  )
$$;

revoke all on function public.reminder_candidates(timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.reminder_record_job(uuid, uuid, uuid, public.message_status, text, text) from public, anon, authenticated;
grant execute on function public.reminder_candidates(timestamptz, timestamptz) to service_role;
grant execute on function public.reminder_record_job(uuid, uuid, uuid, public.message_status, text, text) to service_role;
