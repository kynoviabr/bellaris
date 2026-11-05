-- CNPJ além do CPF no cadastro do responsável pelo salão.
-- Linhas existentes continuam como CPF (default). Cada linha tem CPF ou CNPJ, nunca os dois.

alter table public.organization_owner_data
  add column if not exists document_type text not null default 'cpf',
  add column if not exists cnpj text;

alter table public.organization_owner_data
  alter column cpf drop not null;

alter table public.organization_owner_data
  drop constraint if exists organization_owner_data_document_check;

alter table public.organization_owner_data
  add constraint organization_owner_data_document_check check (
    (document_type = 'cpf' and cpf ~ '^[0-9]{11}$' and cnpj is null)
    or (document_type = 'cnpj' and cnpj ~ '^[0-9]{14}$' and cpf is null)
  );

-- Cadastro do dono (passo do próprio dono).
drop function if exists public.salon_submit_onboarding(text, text, text, text, text, text, text, text, text, text, text);

create or replace function public.salon_submit_onboarding(
  p_full_name text, p_whatsapp text, p_cpf text, p_cep text, p_logradouro text, p_numero text,
  p_complemento text, p_bairro text, p_cidade text, p_uf text, p_plan_code text,
  p_document_type text default 'cpf', p_cnpj text default null
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

  if p_document_type not in ('cpf', 'cnpj') then
    raise exception 'Tipo de documento inválido.';
  end if;

  insert into public.organization_owner_data as d (
    organization_id, full_name, whatsapp, document_type, cpf, cnpj, cep, logradouro, numero,
    complemento, bairro, cidade, uf, updated_at, updated_by
  ) values (
    v_org,
    trim(p_full_name),
    regexp_replace(p_whatsapp, '\D', '', 'g'),
    p_document_type,
    case when p_document_type = 'cpf' then regexp_replace(p_cpf, '\D', '', 'g') end,
    case when p_document_type = 'cnpj' then regexp_replace(p_cnpj, '\D', '', 'g') end,
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
    document_type = excluded.document_type,
    cpf = excluded.cpf,
    cnpj = excluded.cnpj,
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

revoke execute on function public.salon_submit_onboarding(text, text, text, text, text, text, text, text, text, text, text, text, text) from public, anon;
grant execute on function public.salon_submit_onboarding(text, text, text, text, text, text, text, text, text, text, text, text, text) to authenticated;

-- Master corrige os dados do responsável.
drop function if exists public.platform_update_owner_data(uuid, text, text, text, text, text, text, text, text, text, text);

create or replace function public.platform_update_owner_data(
  p_org uuid, p_full_name text, p_whatsapp text, p_cpf text, p_cep text, p_logradouro text,
  p_numero text, p_complemento text, p_bairro text, p_cidade text, p_uf text,
  p_document_type text default 'cpf', p_cnpj text default null
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

  if not exists (select 1 from public.organizations where id = p_org) then
    raise exception 'Salão não encontrado.';
  end if;

  if p_document_type not in ('cpf', 'cnpj') then
    raise exception 'Tipo de documento inválido.';
  end if;

  insert into public.organization_owner_data as d (
    organization_id, full_name, whatsapp, document_type, cpf, cnpj, cep, logradouro, numero,
    complemento, bairro, cidade, uf, updated_at, updated_by
  ) values (
    p_org,
    trim(p_full_name),
    regexp_replace(p_whatsapp, '\D', '', 'g'),
    p_document_type,
    case when p_document_type = 'cpf' then regexp_replace(p_cpf, '\D', '', 'g') end,
    case when p_document_type = 'cnpj' then regexp_replace(p_cnpj, '\D', '', 'g') end,
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
    document_type = excluded.document_type,
    cpf = excluded.cpf,
    cnpj = excluded.cnpj,
    cep = excluded.cep,
    logradouro = excluded.logradouro,
    numero = excluded.numero,
    complemento = excluded.complemento,
    bairro = excluded.bairro,
    cidade = excluded.cidade,
    uf = excluded.uf,
    updated_at = excluded.updated_at,
    updated_by = excluded.updated_by;
end;
$$;

revoke execute on function public.platform_update_owner_data(uuid, text, text, text, text, text, text, text, text, text, text, text, text) from public, anon;
grant execute on function public.platform_update_owner_data(uuid, text, text, text, text, text, text, text, text, text, text, text, text) to authenticated;

-- Lista da área do master: inclui tipo de documento e CNPJ (o CPF continua).
drop function if exists public.platform_salons_admin();

create or replace function public.platform_salons_admin()
returns table (
  organization_id uuid,
  salon_name text,
  slug text,
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
  owner_uf text,
  owner_document_type text,
  owner_cnpj text
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
  select o.id, o.name, o.slug, o.access_status, o.access_note, o.requested_plan_code, o.created_at,
         d.full_name, d.whatsapp, d.cpf, d.cep, d.logradouro, d.numero,
         d.complemento, d.bairro, d.cidade, d.uf, d.document_type, d.cnpj
    from public.organizations o
    left join public.organization_owner_data d on d.organization_id = o.id
   order by o.name;
end;
$$;

revoke execute on function public.platform_salons_admin() from public, anon;
grant execute on function public.platform_salons_admin() to authenticated;
