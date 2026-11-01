-- Bloqueio de escrita por situação do salão.
-- Salão fora de 'ativo' (cadastro pendente) ou com assinatura em somente leitura não consegue
-- gravar nas tabelas de operação. Leitura continua liberada.
-- Fora do bloqueio, de propósito:
--   organizations, profiles, organization_owner_data  (cadastro e liberação precisam gravar)
--   role_permissions                                  (seed automático ao criar o salão)
--   platform_*                                        (áreas do master)
-- Isento e 'aviso' não bloqueiam.

-- Decide o motivo do bloqueio. Roda como dono da função para ler platform_subscriptions
-- mesmo quando quem escreve é o dono do salão.
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
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke execute on function private.salon_write_block_reason(uuid) from public, anon, authenticated;
revoke execute on function private.guard_salon_writable() from public, anon, authenticated;

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
    execute format('drop trigger if exists trg_salon_writable on public.%I', t);
    execute format(
      'create trigger trg_salon_writable before insert or update or delete on public.%I '
      'for each row execute function private.guard_salon_writable()', t);
  end loop;
end $$;
