-- Profissional marca o serviço como realizado.
-- Não altera status, pagamento nem comissão: o recebimento e a comissão continuam sendo gerados pela recepção no checkout.

alter table public.appointments add column if not exists service_completed_at timestamptz;

drop policy if exists matrix_appointments_professional_service_done on public.appointments;
create policy matrix_appointments_professional_service_done on public.appointments for update to authenticated
  using (organization_id = private.current_organization_id()
    and private.current_user_role() = 'professional'
    and professional_id = private.current_professional_id()
    and status in ('in_progress','arrived'))
  with check (organization_id = private.current_organization_id()
    and professional_id = private.current_professional_id());

create or replace function private.guard_professional_service_done()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if private.current_user_role() = 'professional' then
    if (to_jsonb(new) - 'service_completed_at') is distinct from (to_jsonb(old) - 'service_completed_at') then
      raise exception 'Profissional só pode marcar o serviço como realizado';
    end if;
    if new.service_completed_at is null then
      raise exception 'Data de conclusão do serviço é obrigatória';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_guard_professional_service_done on public.appointments;
create trigger trg_guard_professional_service_done before update on public.appointments
  for each row execute function private.guard_professional_service_done();
