-- O dono troca o próprio documento (CPF ou CNPJ). Só ele, só no próprio salão.
create or replace function public.owner_update_document(p_document_type text, p_cpf text, p_cnpj text)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_org uuid := private.current_organization_id();
begin
  if v_org is null or private.current_user_role() <> 'owner' then
    raise exception 'Apenas o dono do salão pode alterar o documento.' using errcode = '42501';
  end if;

  if p_document_type not in ('cpf', 'cnpj') then
    raise exception 'Tipo de documento inválido.';
  end if;

  update public.organization_owner_data
     set document_type = p_document_type,
         cpf = case when p_document_type = 'cpf' then regexp_replace(p_cpf, '\D', '', 'g') end,
         cnpj = case when p_document_type = 'cnpj' then regexp_replace(p_cnpj, '\D', '', 'g') end,
         updated_at = now(),
         updated_by = auth.uid()
   where organization_id = v_org;

  if not found then
    raise exception 'Cadastro do responsável não encontrado. Peça ao master para cadastrar.';
  end if;
end;
$$;

revoke execute on function public.owner_update_document(text, text, text) from public, anon;
grant execute on function public.owner_update_document(text, text, text) to authenticated;
