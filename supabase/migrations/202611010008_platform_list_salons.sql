-- Lista de salões para o usuário master da plataforma (somente leitura).
-- Expõe só dados de cadastro do salão: nome, slug, fuso e data de criação.
-- Não expõe clientes, agendas, financeiro nem dados de profissionais.
-- Para qualquer outro perfil, a função retorna vazio.
create or replace function public.platform_list_salons()
returns table (id uuid, name text, slug text, timezone text, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select o.id, o.name, o.slug, o.timezone, o.created_at
  from public.organizations o
  where exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'platform_master'
  )
  order by o.created_at;
$$;

revoke execute on function public.platform_list_salons() from public, anon;
grant execute on function public.platform_list_salons() to authenticated;
