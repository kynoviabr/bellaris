-- Master: lista todos os salões com os dados do responsável e pode criar/corrigir esses dados
-- (inclusive de salões já ativos, que ainda não têm registro). O nome do salão não é editável aqui.

-- Lista completa para a área do master.
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
  select o.id, o.name, o.slug, o.access_status, o.access_note, o.requested_plan_code, o.created_at,
         d.full_name, d.whatsapp, d.cpf, d.cep, d.logradouro, d.numero,
         d.complemento, d.bairro, d.cidade, d.uf
    from public.organizations o
    left join public.organization_owner_data d on d.organization_id = o.id
   order by o.name;
end;
$$;

-- Criar ou corrigir os dados do responsável (upsert). Não altera o nome do salão.
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

  if not exists (select 1 from public.organizations where id = p_org) then
    raise exception 'Salão não encontrado.';
  end if;

  insert into public.organization_owner_data as d (
    organization_id, full_name, whatsapp, cpf, cep, logradouro, numero,
    complemento, bairro, cidade, uf, updated_at, updated_by
  ) values (
    p_org,
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
end;
$$;

revoke execute on function public.platform_salons_admin() from public, anon;
grant execute on function public.platform_salons_admin() to authenticated;
