-- 1) Escrita bloqueada também para salão cancelado ou sem plano ativo.
-- 2) Leitura bloqueada para salão pendente (qualquer usuário do salão).
--    Somente leitura (inadimplência) continua permitindo leitura.
-- 3) Dados do dono (CPF, WhatsApp, endereço) visíveis só para o dono e o master.

create or replace function private.salon_write_block_reason(p_org uuid)
returns text
language sql
stable
security definer
set search_path = public, private
as $$
  select case
    when o.access_status <> 'ativo' then 'pendente'
    when public.platform_billing_status_of(p_org) = 'somente_leitura' then 'somente_leitura'
    when public.platform_billing_status_of(p_org) = 'cancelada' then 'cancelada'
    when public.platform_billing_status_of(p_org) = 'sem_plano' then 'sem_plano'
    else null
  end
  from public.organizations o
  where o.id = p_org
$$;

create or replace function private.guard_salon_writable()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_org uuid;
  v_reason text;
begin
  if tg_op = 'DELETE' then
    v_org := (to_jsonb(old) ->> 'organization_id')::uuid;
  else
    v_org := (to_jsonb(new) ->> 'organization_id')::uuid;
  end if;

  if v_org is not null then
    v_reason := private.salon_write_block_reason(v_org);
    if v_reason = 'pendente' then
      raise exception 'O cadastro do salão ainda não foi liberado. Não é possível alterar dados.'
        using errcode = '42501';
    elsif v_reason = 'somente_leitura' then
      raise exception 'Assinatura em atraso: o salão está em modo somente leitura.'
        using errcode = '42501';
    elsif v_reason in ('cancelada', 'sem_plano') then
      raise exception 'Assinatura cancelada ou sem plano ativo. Não é possível alterar dados.'
        using errcode = '42501';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

-- Leitura liberada só para salão ativo, somente leitura e aviso. Pendente não lê nada.
create or replace function private.salon_read_allowed(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select not exists (
    select 1 from public.organizations o
    where o.id = p_org and o.access_status <> 'ativo'
  )
$$;

revoke execute on function private.salon_read_allowed(uuid) from public, anon;
grant execute on function private.salon_read_allowed(uuid) to authenticated;

do $$
declare
  t text;
begin
  foreach t in array array[
    'appointment_items', 'appointments', 'checkout_corrections', 'client_anamnesis',
    'client_blacklist', 'client_deposit_whitelist', 'client_photos', 'clients',
    'commissions', 'expense_templates', 'expenses', 'message_jobs', 'message_templates',
    'package_sessions', 'package_template_items', 'package_templates', 'packages',
    'payments', 'products', 'professional_availability', 'professional_services',
    'professionals', 'service_consumables', 'services', 'specialties', 'stock_movements'
  ]
  loop
    execute format('drop policy if exists salon_pendente_sem_leitura on public.%I', t);
    execute format(
      'create policy salon_pendente_sem_leitura on public.%I as restrictive for select to authenticated '
      'using (private.salon_read_allowed(organization_id))', t);
  end loop;
end $$;

-- Dados do dono: só o próprio dono (e o master).
drop policy if exists organization_owner_data_select on public.organization_owner_data;
create policy organization_owner_data_select on public.organization_owner_data
  for select to authenticated
  using (
    (organization_id = private.current_organization_id() and private.current_user_role() = 'owner')
    or private.is_platform_master()
  );
