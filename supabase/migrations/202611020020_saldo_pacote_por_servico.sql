-- Saldo de sessões por serviço dentro do pacote.
-- Cada serviço do atendimento que estiver no pacote debita 1 sessão do seu próprio saldo.
-- Serviços fora do pacote são cobrados normalmente.
-- Pacotes antigos (sem saldo por serviço) mantêm o comportamento anterior: 1 sessão por atendimento.

create table if not exists public.package_service_balances (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  package_id uuid not null references public.packages(id) on delete cascade,
  service_id uuid not null references public.services(id),
  total_sessions integer not null check (total_sessions > 0),
  remaining_sessions integer not null check (remaining_sessions >= 0),
  constraint package_service_balances_package_service_key unique (package_id, service_id)
);

alter table public.package_service_balances enable row level security;

drop policy if exists package_service_balances_select on public.package_service_balances;
create policy package_service_balances_select on public.package_service_balances
  for select to authenticated
  using (organization_id = (select private.current_organization_id()));

grant select on public.package_service_balances to authenticated;

-- Venda de pacote a partir de um modelo do catálogo.
create or replace function public.sell_package_from_template(
  p_client_id uuid,
  p_template_id uuid,
  p_payment_method text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_tpl record;
  v_total integer;
  v_pkg uuid;
  v_method text;
  v_expires timestamptz;
begin
  v_org := private.current_organization_id();
  if v_org is null then
    raise exception 'Not authenticated or no organization';
  end if;

  if not exists (select 1 from public.clients where id = p_client_id and organization_id = v_org) then
    raise exception 'Client does not belong to your organization';
  end if;

  select * into v_tpl from public.package_templates
  where id = p_template_id and organization_id = v_org and active = true;
  if not found then
    raise exception 'Pacote do catálogo não encontrado ou inativo';
  end if;

  select coalesce(sum(sessions), 0) into v_total
  from public.package_template_items
  where template_id = p_template_id and organization_id = v_org;
  if v_total <= 0 then
    raise exception 'Pacote do catálogo sem serviços';
  end if;

  v_method := lower(p_payment_method);
  if v_method not in ('pix', 'cash', 'debit', 'credit', 'other') then
    v_method := 'other';
  end if;

  v_expires := case when v_tpl.validity_days is null then null
                    else now() + make_interval(days => v_tpl.validity_days) end;

  insert into public.packages (organization_id, client_id, name, total_sessions, remaining_sessions, price, status, expires_at)
  values (v_org, p_client_id, v_tpl.name, v_total, v_total, v_tpl.price, 'active', v_expires)
  returning id into v_pkg;

  insert into public.package_service_balances (organization_id, package_id, service_id, total_sessions, remaining_sessions)
  select v_org, v_pkg, i.service_id, i.sessions, i.sessions
  from public.package_template_items i
  where i.template_id = p_template_id and i.organization_id = v_org;

  insert into public.payments (organization_id, client_id, amount, method, status, kind, paid_at)
  values (v_org, p_client_id, v_tpl.price, v_method, 'paid', 'payment', now());

  return v_pkg;
end;
$$;

revoke execute on function public.sell_package_from_template(uuid, uuid, text) from public;
grant execute on function public.sell_package_from_template(uuid, uuid, text) to authenticated;

-- Prévia do que o pacote cobre no atendimento (somente leitura).
create or replace function public.preview_package_checkout(
  p_appointment_id uuid,
  p_package_id uuid
) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_client uuid;
  v_covered jsonb;
  v_uncovered jsonb;
  v_charge numeric := 0;
begin
  v_org := private.current_organization_id();
  if v_org is null then
    raise exception 'Not authenticated or no organization';
  end if;

  select client_id into v_client from public.appointments
  where id = p_appointment_id and organization_id = v_org;
  if not found then
    raise exception 'Appointment not found';
  end if;

  if not exists (
    select 1 from public.packages
    where id = p_package_id and organization_id = v_org and client_id = v_client
      and status = 'active' and remaining_sessions > 0
      and (expires_at is null or expires_at > now())
  ) then
    raise exception 'Package is invalid, expired, exhausted, or belongs to another client/org';
  end if;

  if not exists (select 1 from public.package_service_balances where package_id = p_package_id) then
    return jsonb_build_object('legacy', true, 'covered', '[]'::jsonb, 'uncovered', '[]'::jsonb, 'charge', 0);
  end if;

  with it as (
    select ai.id, ai.description, ai.service_id,
           (ai.unit_price * ai.quantity - ai.discount + ai.surcharge) as total
    from public.appointment_items ai
    where ai.appointment_id = p_appointment_id and ai.organization_id = v_org
    order by ai.id
  ),
  simulated as (
    select it.id, it.description, it.total,
           it.service_id is not null and exists (
             select 1 from public.package_service_balances b
             where b.package_id = p_package_id and b.service_id = it.service_id
               and b.remaining_sessions >= (
                 select count(*) from it x
                 where x.service_id = it.service_id and x.id <= it.id
               )
           ) as covered
    from it
  )
  select
    coalesce((select jsonb_agg(jsonb_build_object('id', id, 'description', description)) from simulated where covered), '[]'::jsonb),
    coalesce((select jsonb_agg(jsonb_build_object('id', id, 'description', description, 'total', total)) from simulated where not covered), '[]'::jsonb),
    coalesce((select sum(total) from simulated where not covered), 0)
  into v_covered, v_uncovered, v_charge;

  return jsonb_build_object('legacy', false, 'covered', v_covered, 'uncovered', v_uncovered, 'charge', v_charge);
end;
$$;

revoke execute on function public.preview_package_checkout(uuid, uuid) from public;
grant execute on function public.preview_package_checkout(uuid, uuid) to authenticated;

-- Checkout: com pacote, cada serviço coberto debita 1 sessão do seu saldo;
-- serviços não cobertos são cobrados com a forma de pagamento informada.
create or replace function public.finish_appointment_checkout_full(
    p_appointment_id UUID,
    p_payment_amount NUMERIC,
    p_payment_method TEXT,
    p_package_id UUID DEFAULT NULL,
    p_commissions JSONB DEFAULT '[]'::jsonb,
    p_inventory_deductions JSONB DEFAULT '[]'::jsonb
) RETURNS VOID
SET search_path = ''
AS $$
DECLARE
    v_org_id UUID;
    v_client_id UUID;
    v_status TEXT;
    v_method TEXT;
    v_comm record;
    v_inv record;
    v_item record;
    v_row int;
    v_consumed int := 0;
    v_charge numeric := 0;
    v_pkg_remaining int;
BEGIN
    v_org_id := private.current_organization_id();
    IF v_org_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated or no organization';
    END IF;

    SELECT client_id, status INTO v_client_id, v_status
    FROM public.appointments
    WHERE id = p_appointment_id AND organization_id = v_org_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Appointment not found or access denied';
    END IF;

    IF v_status = 'completed' THEN
        RAISE EXCEPTION 'Appointment is already completed';
    END IF;

    IF p_payment_amount IS NOT NULL AND p_payment_amount < 0 THEN
        RAISE EXCEPTION 'Payment amount cannot be negative';
    END IF;

    v_method := lower(p_payment_method);
    IF v_method NOT IN ('pix', 'cash', 'debit', 'credit', 'other') THEN
        v_method := 'other';
    END IF;

    IF p_package_id IS NOT NULL THEN
        PERFORM 1 FROM public.packages
        WHERE id = p_package_id
          AND organization_id = v_org_id
          AND client_id = v_client_id
          AND status = 'active'
          AND remaining_sessions > 0
          AND (expires_at IS NULL OR expires_at > now())
        FOR UPDATE;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Package is invalid, expired, exhausted, or belongs to another client/org';
        END IF;

        IF NOT EXISTS (SELECT 1 FROM public.package_service_balances WHERE package_id = p_package_id) THEN
            -- Pacote antigo, sem saldo por serviço: 1 sessão por atendimento (comportamento anterior).
            UPDATE public.packages
            SET remaining_sessions = remaining_sessions - 1,
                status = CASE WHEN remaining_sessions - 1 = 0 THEN 'completed' ELSE 'active' END,
                updated_at = now()
            WHERE id = p_package_id AND organization_id = v_org_id;

            INSERT INTO public.package_sessions (organization_id, package_id, appointment_id, status)
            VALUES (v_org_id, p_package_id, p_appointment_id, 'used');
        ELSE
            FOR v_item IN
                SELECT ai.id, ai.service_id,
                       (ai.unit_price * ai.quantity - ai.discount + ai.surcharge) AS total
                FROM public.appointment_items ai
                WHERE ai.appointment_id = p_appointment_id AND ai.organization_id = v_org_id
                ORDER BY ai.id
            LOOP
                v_row := 0;
                IF v_item.service_id IS NOT NULL THEN
                    UPDATE public.package_service_balances
                    SET remaining_sessions = remaining_sessions - 1
                    WHERE package_id = p_package_id AND organization_id = v_org_id
                      AND service_id = v_item.service_id AND remaining_sessions > 0;
                    GET DIAGNOSTICS v_row = ROW_COUNT;
                END IF;

                IF v_row > 0 THEN
                    v_consumed := v_consumed + 1;
                    INSERT INTO public.package_sessions (organization_id, package_id, appointment_id, status)
                    VALUES (v_org_id, p_package_id, p_appointment_id, 'used');
                ELSE
                    v_charge := v_charge + v_item.total;
                END IF;
            END LOOP;

            IF v_consumed = 0 THEN
                RAISE EXCEPTION 'Nenhum serviço do atendimento está coberto por este pacote';
            END IF;

            SELECT remaining_sessions INTO v_pkg_remaining FROM public.packages WHERE id = p_package_id;
            IF v_pkg_remaining < v_consumed THEN
                RAISE EXCEPTION 'Saldo do pacote inconsistente com os serviços';
            END IF;

            UPDATE public.packages
            SET remaining_sessions = remaining_sessions - v_consumed,
                status = CASE WHEN remaining_sessions - v_consumed = 0 THEN 'completed' ELSE 'active' END,
                updated_at = now()
            WHERE id = p_package_id AND organization_id = v_org_id;

            IF v_charge > 0 THEN
                INSERT INTO public.payments (organization_id, appointment_id, client_id, amount, method, status, kind, paid_at)
                VALUES (v_org_id, p_appointment_id, v_client_id, v_charge, v_method, 'paid', 'payment', now());
            END IF;
        END IF;
    ELSIF p_payment_amount > 0 THEN
        INSERT INTO public.payments (organization_id, appointment_id, client_id, amount, method, status, kind, paid_at)
        VALUES (v_org_id, p_appointment_id, v_client_id, p_payment_amount, v_method, 'paid', 'payment', now());
    END IF;

    -- Commissions
    IF p_commissions IS NOT NULL AND jsonb_array_length(p_commissions) > 0 THEN
        FOR v_comm IN SELECT * FROM jsonb_to_recordset(p_commissions) AS x(appointment_item_id UUID, professional_id UUID, amount NUMERIC) LOOP
            IF NOT EXISTS (
                SELECT 1 FROM public.appointment_items
                WHERE id = v_comm.appointment_item_id AND appointment_id = p_appointment_id
            ) THEN
                RAISE EXCEPTION 'Appointment item % does not belong to appointment %', v_comm.appointment_item_id, p_appointment_id;
            END IF;

            IF v_comm.professional_id IS NOT NULL AND NOT EXISTS (
                SELECT 1 FROM public.professionals
                WHERE id = v_comm.professional_id AND organization_id = v_org_id
            ) THEN
                RAISE EXCEPTION 'Professional % does not belong to organization', v_comm.professional_id;
            END IF;

            INSERT INTO public.commissions (organization_id, appointment_item_id, professional_id, amount, status)
            VALUES (v_org_id, v_comm.appointment_item_id, v_comm.professional_id, COALESCE(v_comm.amount, 0), 'generated');
        END LOOP;
    END IF;

    -- Inventory Deductions
    IF p_inventory_deductions IS NOT NULL AND jsonb_array_length(p_inventory_deductions) > 0 THEN
        FOR v_inv IN SELECT * FROM jsonb_to_recordset(p_inventory_deductions) AS x(product_id UUID, quantity NUMERIC, appointment_item_id UUID) LOOP
            IF NOT EXISTS (
                SELECT 1 FROM public.products
                WHERE id = v_inv.product_id AND organization_id = v_org_id
            ) THEN
                RAISE EXCEPTION 'Product % does not belong to organization', v_inv.product_id;
            END IF;

            IF v_inv.appointment_item_id IS NOT NULL AND NOT EXISTS (
                SELECT 1 FROM public.appointment_items
                WHERE id = v_inv.appointment_item_id AND appointment_id = p_appointment_id
            ) THEN
                RAISE EXCEPTION 'Appointment item % does not belong to appointment %', v_inv.appointment_item_id, p_appointment_id;
            END IF;

            INSERT INTO public.stock_movements (organization_id, product_id, movement_type, quantity, source, appointment_item_id)
            VALUES (v_org_id, v_inv.product_id, 'consumption', v_inv.quantity, 'appointment_conclusion', v_inv.appointment_item_id);
        END LOOP;
    END IF;

    UPDATE public.appointments
    SET status = 'completed', actual_end_at = now()
    WHERE id = p_appointment_id AND organization_id = v_org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION public.finish_appointment_checkout_full(UUID, NUMERIC, TEXT, UUID, JSONB, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finish_appointment_checkout_full(UUID, NUMERIC, TEXT, UUID, JSONB, JSONB) TO authenticated;
