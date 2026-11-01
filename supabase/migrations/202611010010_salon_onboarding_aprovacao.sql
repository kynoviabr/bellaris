-- Onboarding do dono do salão: dados cadastrais obrigatórios e aprovação pelo master.
-- Salões existentes ficam 'ativo' (default), sem nenhuma mudança de acesso.
-- Somente homologação até aprovação explícita do Fernando.

alter table public.organizations
  add column if not exists access_status text not null default 'ativo'
    check (access_status in ('aguardando_dados', 'aguardando_aprovacao', 'ativo')),
  add column if not exists requested_plan_code text references public.platform_plans(code),
  add column if not exists access_note text,
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by uuid references public.profiles(id);

create table if not exists public.organization_owner_data (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  full_name text not null check (length(trim(full_name)) >= 3),
  whatsapp text not null check (whatsapp ~ '^[0-9]{10,11}$'),
  cpf text not null check (cpf ~ '^[0-9]{11}$'),
  cep text not null check (cep ~ '^[0-9]{5}-[0-9]{3}$'),
  logradouro text not null check (length(trim(logradouro)) > 0),
  numero text not null check (length(trim(numero)) > 0),
  complemento text,
  bairro text,
  cidade text not null check (length(trim(cidade)) > 0),
  uf text not null check (uf ~ '^[A-Z]{2}$'),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

alter table public.organization_owner_data enable row level security;

-- Leitura: o dono do próprio salão (para pré-preencher o formulário) e o master.
create policy organization_owner_data_select on public.organization_owner_data
  for select to authenticated
  using (organization_id = private.current_organization_id() or private.is_platform_master());

-- Escrita direta fica bloqueada para todos. Dono grava pela função salon_submit_onboarding;
-- master grava pela função platform_update_owner_data.
revoke all on public.organization_owner_data from anon, authenticated;
grant select on public.organization_owner_data to authenticated;

-- Dono envia (ou reenvia, após recusa) os dados cadastrais e escolhe o plano.
create or replace function public.salon_submit_onboarding(
  p_full_name text,
  p_whatsapp text,
  p_cpf text,
  p_cep text,
  p_logradouro text,
  p_numero text,
  p_complemento text,
  p_bairro text,
  p_cidade text,
  p_uf text,
  p_plan_code text
)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_org uuid := private.current_organization_id();
  v_status text;
begin
  if v_org is null or private.current_user_role() <> 'owner' then
    raise exception 'Apenas o dono do salão pode enviar os dados cadastrais.' using errcode = '42501';
  end if;

  select access_status into v_status from public.organizations where id = v_org for update;
  if v_status is distinct from 'aguardando_dados' then
    raise exception 'Os dados já foram enviados ou o salão já está liberado.';
  end if;

  if not exists (select 1 from public.platform_plans where code = p_plan_code and active) then
    raise exception 'Plano inválido.';
  end if;

  insert into public.organization_owner_data as d (
    organization_id, full_name, whatsapp, cpf, cep, logradouro, numero,
    complemento, bairro, cidade, uf, updated_at, updated_by
  ) values (
    v_org,
    trim(p_full_name),
    regexp_replace(p_whatsapp, '\D', '', 'g'),
    regexp_replace(p_cpf, '\D', '', 'g'),
    trim(p_cep),
    trim(p_logradouro),
    trim(p_numero),
    nullif(trim(p_complemento), ''),
    nullif(trim(p_bairro), ''),
    trim(p_cidade),
    upper(trim(p_uf)),
    now(),
    auth.uid()
  )
  on conflict (organization_id) do update set
    full_name = excluded.full_name,
    whatsapp = excluded.whatsapp,
    cpf = excluded.cpf,
    cep = excluded.cep,
    logradouro = excluded.logradouro,
    numero = excluded.numero,
    complemento = excluded.complemento,
    bairro = excluded.bairro,
    cidade = excluded.cidade,
    uf = excluded.uf,
    updated_at = excluded.updated_at,
    updated_by = excluded.updated_by;

  update public.organizations
     set access_status = 'aguardando_aprovacao',
         requested_plan_code = p_plan_code,
         access_note = null
   where id = v_org;
end;
$$;

-- Master: lista salões que ainda não estão liberados, com os dados do dono.
create or replace function public.platform_list_onboarding()
returns table (
  organization_id uuid,
  salon_name text,
  access_status text,
  access_note text,
  requested_plan_code text,
  created_at timestamptz,
  owner_full_name text,
  owner_whatsapp text,
  owner_cpf text,
  owner_cep text,
  owner_logradouro text,
  owner_numero text,
  owner_complemento text,
  owner_bairro text,
  owner_cidade text,
  owner_uf text
)
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if not private.is_platform_master() then
    raise exception 'Acesso negado.' using errcode = '42501';
  end if;

  return query
  select o.id, o.name, o.access_status, o.access_note, o.requested_plan_code, o.created_at,
         d.full_name, d.whatsapp, d.cpf, d.cep, d.logradouro, d.numero,
         d.complemento, d.bairro, d.cidade, d.uf
    from public.organizations o
    left join public.organization_owner_data d on d.organization_id = o.id
   where o.access_status <> 'ativo'
   order by o.created_at;
end;
$$;

-- Master: corrige os dados do dono de um salão (com ou sem aprovação).
create or replace function public.platform_update_owner_data(
  p_org uuid,
  p_full_name text,
  p_whatsapp text,
  p_cpf text,
  p_cep text,
  p_logradouro text,
  p_numero text,
  p_complemento text,
  p_bairro text,
  p_cidade text,
  p_uf text
)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if not private.is_platform_master() then
    raise exception 'Acesso negado.' using errcode = '42501';
  end if;

  update public.organization_owner_data
     set full_name = trim(p_full_name),
         whatsapp = regexp_replace(p_whatsapp, '\D', '', 'g'),
         cpf = regexp_replace(p_cpf, '\D', '', 'g'),
         cep = trim(p_cep),
         logradouro = trim(p_logradouro),
         numero = trim(p_numero),
         complemento = nullif(trim(p_complemento), ''),
         bairro = nullif(trim(p_bairro), ''),
         cidade = trim(p_cidade),
         uf = upper(trim(p_uf)),
         updated_at = now(),
         updated_by = auth.uid()
   where organization_id = p_org;

  if not found then
    raise exception 'Dados do dono não encontrados para este salão.';
  end if;
end;
$$;

-- Master: aprova o salão, define plano e dia de vencimento e libera o acesso.
create or replace function public.platform_approve_salon(
  p_org uuid,
  p_plan_code text,
  p_due_business_day integer
)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_status text;
begin
  if not private.is_platform_master() then
    raise exception 'Acesso negado.' using errcode = '42501';
  end if;

  select access_status into v_status from public.organizations where id = p_org for update;
  if v_status is null then
    raise exception 'Salão não encontrado.';
  end if;
  if v_status <> 'aguardando_aprovacao' then
    raise exception 'Este salão não está aguardando aprovação.';
  end if;
  if not exists (select 1 from public.organization_owner_data where organization_id = p_org) then
    raise exception 'Dados do dono não encontrados para este salão.';
  end if;

  -- Reaproveita a regra de assinatura já validada (plano, dia útil, período).
  perform public.platform_set_subscription(p_org, 'mensalidade', p_plan_code, p_due_business_day, false, null);

  update public.organizations
     set access_status = 'ativo',
         approved_at = now(),
         approved_by = auth.uid(),
         access_note = null
   where id = p_org;
end;
$$;

-- Master: recusa com motivo. O dono volta a ver o formulário para corrigir e reenviar.
create or replace function public.platform_reject_salon(p_org uuid, p_note text)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if not private.is_platform_master() then
    raise exception 'Acesso negado.' using errcode = '42501';
  end if;
  if nullif(trim(p_note), '') is null then
    raise exception 'Informe o motivo da recusa.';
  end if;

  update public.organizations
     set access_status = 'aguardando_dados',
         access_note = trim(p_note)
   where id = p_org and access_status = 'aguardando_aprovacao';

  if not found then
    raise exception 'Este salão não está aguardando aprovação.';
  end if;
end;
$$;

-- Permissões: somente usuários autenticados, e as funções fazem a checagem de papel.
revoke execute on function public.salon_submit_onboarding(text, text, text, text, text, text, text, text, text, text, text) from public, anon;
revoke execute on function public.platform_list_onboarding() from public, anon;
revoke execute on function public.platform_update_owner_data(uuid, text, text, text, text, text, text, text, text, text, text) from public, anon;
revoke execute on function public.platform_approve_salon(uuid, text, integer) from public, anon;
revoke execute on function public.platform_reject_salon(uuid, text) from public, anon;

grant execute on function public.salon_submit_onboarding(text, text, text, text, text, text, text, text, text, text, text) to authenticated;
grant execute on function public.platform_list_onboarding() to authenticated;
grant execute on function public.platform_update_owner_data(uuid, text, text, text, text, text, text, text, text, text, text) to authenticated;
grant execute on function public.platform_approve_salon(uuid, text, integer) to authenticated;
grant execute on function public.platform_reject_salon(uuid, text) to authenticated;
