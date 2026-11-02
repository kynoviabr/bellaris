-- Consentimento para anamnese e fotos, registro de operações e retenção após cancelamento.
-- Homologação. Não aplicar na produção sem aprovação.

-- 1. Consentimentos registrados por cliente e tipo.
create table if not exists public.client_consents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  client_id uuid not null references public.clients(id) on delete cascade,
  kind text not null check (kind in ('anamnesis','photos')),
  text_version text not null default 'v1',
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create unique index if not exists client_consents_one_active
  on public.client_consents (client_id, kind) where revoked_at is null;
create index if not exists client_consents_org_idx on public.client_consents (organization_id);

alter table public.client_consents enable row level security;

drop policy if exists "client_consents_select" on public.client_consents;
create policy "client_consents_select" on public.client_consents for select to authenticated
  using (organization_id = private.current_organization_id());

drop policy if exists "client_consents_insert" on public.client_consents;
create policy "client_consents_insert" on public.client_consents for insert to authenticated
  with check (organization_id = private.current_organization_id());

drop policy if exists "client_consents_update" on public.client_consents;
create policy "client_consents_update" on public.client_consents for update to authenticated
  using (organization_id = private.current_organization_id())
  with check (organization_id = private.current_organization_id());

revoke all on public.client_consents from anon, authenticated;
grant select, insert, update on public.client_consents to authenticated;
grant all on public.client_consents to service_role;

-- 2. Registro das operações de tratamento (exportação, exclusão, consentimento, retenção).
create table if not exists public.data_processing_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  client_id uuid,
  action text not null,
  detail jsonb not null default '{}'::jsonb,
  actor uuid,
  created_at timestamptz not null default now()
);

create index if not exists data_processing_log_org_idx on public.data_processing_log (organization_id, created_at);

alter table public.data_processing_log enable row level security;

drop policy if exists "data_processing_log_select" on public.data_processing_log;
create policy "data_processing_log_select" on public.data_processing_log for select to authenticated
  using (organization_id = private.current_organization_id());

drop policy if exists "data_processing_log_insert" on public.data_processing_log;
create policy "data_processing_log_insert" on public.data_processing_log for insert to authenticated
  with check (organization_id = private.current_organization_id());

revoke all on public.data_processing_log from anon, authenticated;
grant select, insert on public.data_processing_log to authenticated;
grant all on public.data_processing_log to service_role;

-- 3. Data do cancelamento da assinatura.
alter table public.platform_subscriptions add column if not exists cancelled_at timestamptz;

create or replace function private.track_cancelled_at()
returns trigger
language plpgsql
set search_path = public, private
as $$
begin
  if new.cancelled then
    if tg_op = 'INSERT' or not coalesce(old.cancelled, false) then
      new.cancelled_at := coalesce(new.cancelled_at, now());
    end if;
  else
    new.cancelled_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_track_cancelled_at on public.platform_subscriptions;
create trigger trg_track_cancelled_at before insert or update on public.platform_subscriptions
  for each row execute function private.track_cancelled_at();

update public.platform_subscriptions
   set cancelled_at = coalesce(cancelled_at, updated_at)
 where cancelled and cancelled_at is null;

-- 4. Trava de escrita aceita a retenção, e somente ela, quando ativada pela função abaixo.
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
  if coalesce(current_setting('app.retention_purge', true), '') = 'on' then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

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

drop trigger if exists trg_salon_writable on public.client_consents;
create trigger trg_salon_writable before insert or update or delete on public.client_consents
  for each row execute function private.guard_salon_writable();

-- 5. Retenção: só para salão cancelado há 90 dias ou mais. Executada pelo servidor (service_role).
-- Apaga anamnese e fotos (registros), anonimiza os clientes e devolve os caminhos das fotos
-- para o servidor remover os arquivos do armazenamento.
create or replace function public.retention_purge_salon(p_org uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_cancelled_at timestamptz;
  v_paths text[];
  v_photos int := 0;
  v_anamnesis int := 0;
  v_clients int := 0;
begin
  select s.cancelled_at into v_cancelled_at
    from public.platform_subscriptions s
   where s.organization_id = p_org and s.cancelled;

  if v_cancelled_at is null or v_cancelled_at > now() - interval '90 days' then
    return jsonb_build_object('purged', false, 'reason', 'nao_vencido');
  end if;

  perform set_config('app.retention_purge', 'on', true);

  select coalesce(array_agg(storage_path), '{}') into v_paths
    from public.client_photos where organization_id = p_org;

  delete from public.client_photos where organization_id = p_org;
  get diagnostics v_photos = row_count;

  delete from public.client_anamnesis where organization_id = p_org;
  get diagnostics v_anamnesis = row_count;

  update public.clients
     set name = 'Cliente excluída',
         phone = 'excluida',
         phone_normalized = 'excluida-' || id::text,
         birth_date = null,
         email = null,
         instagram = null,
         notes = null,
         preferences = '{}'::jsonb,
         marketing_consent = false,
         status = 'archived'
   where organization_id = p_org;
  get diagnostics v_clients = row_count;

  insert into public.data_processing_log (organization_id, action, detail)
  values (p_org, 'retencao_cancelamento',
          jsonb_build_object('fotos', v_photos, 'anamneses', v_anamnesis, 'clientes_anonimizadas', v_clients));

  return jsonb_build_object(
    'purged', true,
    'photo_paths', to_jsonb(v_paths),
    'fotos', v_photos, 'anamneses', v_anamnesis, 'clientes', v_clients
  );
end;
$$;

revoke execute on function public.retention_purge_salon(uuid) from public, anon, authenticated;
grant execute on function public.retention_purge_salon(uuid) to service_role;

-- Salões cancelados que já estão na lista de retenção, para o job diário.
create or replace function public.retention_due_salons()
returns table (organization_id uuid)
language sql
security definer
set search_path = public
as $$
  select s.organization_id
    from public.platform_subscriptions s
   where s.cancelled and s.cancelled_at is not null and s.cancelled_at <= now() - interval '90 days'
$$;

revoke execute on function public.retention_due_salons() from public, anon, authenticated;
grant execute on function public.retention_due_salons() to service_role;
