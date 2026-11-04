-- Fase D (profissional em N salões): dono ou administradora vincula uma profissional, pelo e-mail
-- da conta dela, ao salão ativo. Cria o vínculo (memberships, papel professional), o cadastro de
-- profissional neste salão e o vínculo profissional↔salão.
-- Aplicada na HOMOLOGAÇÃO (pnvhqvspziujrpagsclx) em 2026-11-04. Produção não foi tocada.
-- Testes em transação com rollback: vínculo por dono ok; duplicado bloqueado; conta que não é
-- de profissional bloqueada; chamada por profissional bloqueada.
-- Observação: a mensagem de conta inexistente é a mesma de conta sem papel de profissional.

create or replace function public.link_professional_by_email(p_email text, p_name text, p_default_commission numeric default 0)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_caller uuid := (select auth.uid());
  v_role text;
  v_org uuid := private.current_organization_id();
  v_user uuid;
  v_user_role text;
  v_pro uuid;
  v_name text := trim(coalesce(p_name, ''));
begin
  if v_caller is null then raise exception 'Não autenticado'; end if;
  select role into v_role from public.profiles where id = v_caller;
  if v_org is null or v_role not in ('owner','admin') then
    raise exception 'Apenas o dono ou a administradora do salão pode vincular profissionais';
  end if;
  if v_name = '' then raise exception 'Informe o nome da profissional'; end if;
  if p_default_commission is null or p_default_commission < 0 or p_default_commission > 100 then
    raise exception 'Comissão inválida';
  end if;

  select u.id, pr.role into v_user, v_user_role
    from auth.users u
    join public.profiles pr on pr.id = u.id
   where lower(u.email) = lower(trim(coalesce(p_email, '')));

  if v_user is null or v_user_role <> 'professional' then
    raise exception 'Não foi possível vincular. A profissional precisa ter uma conta de profissional no sistema.';
  end if;
  if exists (select 1 from public.professionals where user_id = v_user and organization_id = v_org) then
    raise exception 'Esta profissional já está vinculada a este salão';
  end if;

  insert into public.memberships (user_id, organization_id, role, active)
  values (v_user, v_org, 'professional', true)
  on conflict (user_id, organization_id) do update set active = true;

  insert into public.professionals (organization_id, user_id, name, default_commission)
  values (v_org, v_user, v_name, p_default_commission)
  returning id into v_pro;

  insert into public.professional_organizations (professional_id, organization_id)
  values (v_pro, v_org)
  on conflict do nothing;

  return v_pro;
end
$function$;

revoke execute on function public.link_professional_by_email(text, text, numeric) from public, anon;
grant execute on function public.link_professional_by_email(text, text, numeric) to authenticated;
