-- Apaga a anamnese de uma cliente quando o consentimento é retirado ou a cliente é excluída.
-- A tabela client_anamnesis não tem DELETE para o usuário autenticado (equalizado com a produção),
-- então a exclusão passa por esta função, que só age sobre clientes da organização do usuário.
create or replace function public.delete_client_anamnesis(p_client_id uuid)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if not exists (
    select 1 from public.clients c
     where c.id = p_client_id and c.organization_id = private.current_organization_id()
  ) then
    raise exception 'Cliente não encontrada ou acesso negado.' using errcode = '42501';
  end if;

  delete from public.client_anamnesis where client_id = p_client_id;
end;
$$;

revoke execute on function public.delete_client_anamnesis(uuid) from public, anon;
grant execute on function public.delete_client_anamnesis(uuid) to authenticated, service_role;
