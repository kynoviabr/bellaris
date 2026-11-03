-- Profissional deixa de ler a tabela clients diretamente.
-- A agenda recebe somente nome e observações dos clientes dos próprios agendamentos, via função restrita ao usuário logado.
-- Rollback: recriar a política professional_own_clients_read e dropar a função public.professional_agenda_clients().
create or replace function public.professional_agenda_clients()
returns table (client_id uuid, name text, notes text)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct c.id, c.name, c.notes
  from public.clients c
  join public.appointments a on a.client_id = c.id and a.organization_id = c.organization_id
  join public.professionals p on p.id = a.professional_id and p.organization_id = c.organization_id
  where p.user_id = (select auth.uid())
    and (select private.current_user_role()) = 'professional'
    and private.salon_read_allowed(c.organization_id)
$$;

revoke execute on function public.professional_agenda_clients() from public, anon;
grant execute on function public.professional_agenda_clients() to authenticated;

drop policy if exists professional_own_clients_read on public.clients;
