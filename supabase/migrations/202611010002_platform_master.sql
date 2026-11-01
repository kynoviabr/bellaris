-- Usuário master da plataforma: perfil sem salão (organization_id nulo).
-- Salões continuam exigindo organization_id. O RLS já nega dados de salão
-- quando organization_id é nulo (comparações com nulo não são verdadeiras).

alter table public.profiles alter column organization_id drop not null;

update public.profiles set organization_id = null where role = 'platform_master';

alter table public.profiles add constraint profiles_platform_master_sem_salao
  check (role <> 'platform_master' or organization_id is null);

alter table public.profiles add constraint profiles_salao_obrigatorio
  check (role = 'platform_master' or organization_id is not null);
