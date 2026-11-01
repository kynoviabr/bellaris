-- Salão cancelado (ou sem plano) perde o acesso ao sistema, inclusive leitura.
-- Somente leitura por atraso continua lendo. Reativação: desmarcar "cancelada" no formulário.

create or replace function private.salon_read_allowed(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select
    not exists (
      select 1 from public.organizations o
      where o.id = p_org and o.access_status <> 'ativo'
    )
    and coalesce(public.platform_billing_status_of(p_org), '') not in ('cancelada', 'sem_plano')
$$;
