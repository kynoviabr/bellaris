-- Fase B: vínculos usuário↔salão, profissional em N salões e rede (franqueador).
-- Aplicada na HOMOLOGAÇÃO (pnvhqvspziujrpagsclx) em 2026-11-04, após aprovação do Fernando.
-- Não aplicar em produção sem aprovação explícita por escrito.
-- Aditiva: nenhuma política existente é alterada. As 80 políticas continuam lendo
-- profiles.organization_id via private.current_organization_id().
-- Reversão (somente antes da fase C): drop das tabelas novas e das colunas abaixo.

create table if not exists public.networks (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_user_id uuid not null references public.profiles(id),
  billing_mode text not null default 'per_salon'
    check (billing_mode in ('per_salon','single_invoice')),
  created_at timestamptz not null default now()
);

alter table public.organizations
  add column if not exists network_id uuid references public.networks(id);

create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  role text not null check (role in ('owner','admin','staff','professional','platform_master')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, organization_id)
);

create table if not exists public.professional_organizations (
  professional_id uuid not null references public.professionals(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (professional_id, organization_id)
);

alter table public.profiles
  add column if not exists active_organization_id uuid references public.organizations(id);

-- Backfill (idempotente). Homologação: 10 perfis com salão, 11 profissionais.
insert into public.memberships (user_id, organization_id, role)
select p.id, p.organization_id, p.role
from public.profiles p
where p.organization_id is not null
on conflict (user_id, organization_id) do nothing;

update public.profiles p
set active_organization_id = p.organization_id
where p.organization_id is not null and p.active_organization_id is null;

insert into public.professional_organizations (professional_id, organization_id)
select pr.id, pr.organization_id
from public.professionals pr
on conflict do nothing;

alter table public.memberships enable row level security;
alter table public.professional_organizations enable row level security;
alter table public.networks enable row level security;

create policy memberships_own_read on public.memberships
  for select to authenticated using (user_id = auth.uid());
create policy prof_org_salon_read on public.professional_organizations
  for select to authenticated using (
    organization_id = private.current_organization_id()
  );
create policy networks_owner_read on public.networks
  for select to authenticated using (owner_user_id = auth.uid());
