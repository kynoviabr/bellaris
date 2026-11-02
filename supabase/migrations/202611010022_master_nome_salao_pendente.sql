-- O master pode corrigir o nome do salão enquanto o cadastro estiver aguardando aprovação.
-- Depois de aprovado (ativo), o nome deixa de ser editável pelo master.

create or replace function public.platform_update_salon_name(p_org uuid, p_name text)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if not private.is_platform_master() then
    raise exception 'Acesso negado.' using errcode = '42501';
  end if;

  if length(trim(coalesce(p_name, ''))) < 3 then
    raise exception 'Informe um nome com pelo menos 3 caracteres.';
  end if;

  update public.organizations
     set name = trim(p_name)
   where id = p_org
     and access_status <> 'ativo';

  if not found then
    raise exception 'O nome só pode ser alterado antes da aprovação do salão.';
  end if;
end;
$$;

revoke execute on function public.platform_update_salon_name(uuid, text) from public, anon;
grant execute on function public.platform_update_salon_name(uuid, text) to authenticated;
