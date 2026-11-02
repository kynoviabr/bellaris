-- Histórico das cargas de dados (importação CSV) feitas pelo dono ou administradora do salão.

create table if not exists public.import_batches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  kind text not null check (kind in ('services', 'professionals', 'clients')),
  file_name text,
  total_rows integer not null default 0,
  imported integer not null default 0,
  skipped integer not null default 0,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists import_batches_org_created_idx on public.import_batches (organization_id, created_at desc);

alter table public.import_batches enable row level security;

create policy import_batches_select on public.import_batches
  for select to authenticated
  using (organization_id = private.current_organization_id()
         and private.current_user_role() in ('owner', 'admin'));

create policy import_batches_insert on public.import_batches
  for insert to authenticated
  with check (organization_id = private.current_organization_id()
              and private.current_user_role() in ('owner', 'admin')
              and created_by = auth.uid());

grant select, insert on public.import_batches to authenticated;
grant select, insert on public.import_batches to service_role;
