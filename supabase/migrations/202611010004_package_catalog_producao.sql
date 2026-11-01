-- Catálogo de pacotes: tabelas, políticas e validação, como estão na homologação.
-- Idempotente: pode ser executada mais de uma vez sem duplicar objetos.
-- Acesso: somente owner e admin (mesma regra da matriz de permissões).

create table if not exists public.package_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  name text not null,
  price numeric not null check (price > 0),
  validity_days integer,
  active boolean not null default true,
  created_at timestamptz default now(),
  constraint package_templates_id_organization_id_key unique (id, organization_id)
);

create table if not exists public.package_template_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  template_id uuid not null,
  service_id uuid not null references public.services(id),
  sessions integer not null check (sessions > 0),
  constraint package_template_items_template_id_organization_id_fkey
    foreign key (template_id, organization_id) references public.package_templates(id, organization_id) on delete cascade,
  constraint package_template_items_template_id_service_id_key unique (template_id, service_id)
);

alter table public.package_templates enable row level security;
alter table public.package_template_items enable row level security;

drop policy if exists rbac_package_templates_manage on public.package_templates;
create policy rbac_package_templates_manage on public.package_templates
  for all to authenticated
  using (organization_id = (select private.current_organization_id())
         and (select private.current_user_role()) = any (array['owner'::text, 'admin'::text]))
  with check (organization_id = (select private.current_organization_id())
         and (select private.current_user_role()) = any (array['owner'::text, 'admin'::text]));

drop policy if exists rbac_package_template_items_manage on public.package_template_items;
create policy rbac_package_template_items_manage on public.package_template_items
  for all to authenticated
  using (organization_id = (select private.current_organization_id())
         and (select private.current_user_role()) = any (array['owner'::text, 'admin'::text]))
  with check (organization_id = (select private.current_organization_id())
         and (select private.current_user_role()) = any (array['owner'::text, 'admin'::text]));

create or replace function public.validate_package_template_item()
returns trigger
language plpgsql
as $function$ begin if not exists(select 1 from public.services where id=new.service_id and organization_id=new.organization_id and active=true) then raise exception 'Serviço inválido para este salão'; end if; return new; end $function$;

drop trigger if exists package_template_item_validate on public.package_template_items;
create trigger package_template_item_validate before insert or update on public.package_template_items
  for each row execute function public.validate_package_template_item();
