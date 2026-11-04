-- Fase C (parte 2): funções que liam o salão do perfil passam a usar o salão ativo validado.
-- Aplicada na HOMOLOGAÇÃO (pnvhqvspziujrpagsclx) em 2026-11-04. Produção não foi tocada.
-- Equivalente hoje: private.current_organization_id() devolve o mesmo salão do perfil para os 12 perfis.
-- Suíte A2 após a troca: 700 verificações, 0 violações.
-- Revisadas e NÃO alteradas: public.platform_billing_overview (somente administrador da plataforma;
-- lista todos os salões por design).

create or replace function private.has_permission(p_module text, p_operation text)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select coalesce((
    select case when p.role in ('owner','admin') then true
      else exists (select 1 from public.role_permissions rp
        where rp.organization_id = private.current_organization_id() and rp.role = p.role
          and rp.module = p_module and rp.operation = p_operation and rp.enabled) end
    from public.profiles p where p.id = (select auth.uid())
  ), false)
$function$;

create or replace function public.salon_billing_status()
returns text
language sql
stable
security definer
set search_path to ''
as $function$
  select public.platform_billing_status_of(private.current_organization_id())
$function$;

create or replace function public.correct_package_checkout(p_appointment_id uuid, p_package_id uuid, p_reason text)
returns text
language plpgsql
set search_path to 'public'
as $function$
declare v_org uuid;v_client uuid;v_status text;v_remaining integer;v_pkg_org uuid;v_pkg_client uuid;v_existing uuid;v_actor uuid:=auth.uid();
begin
 if v_actor is null then raise exception 'Não autenticado'; end if;
 if length(trim(coalesce(p_reason,'')))<10 then raise exception 'Informe um motivo com pelo menos 10 caracteres';end if;
 select organization_id,client_id,status::text into v_org,v_client,v_status from public.appointments where id=p_appointment_id for update;
 if v_org is null or v_status<>'completed' then raise exception 'Atendimento inexistente ou não concluído';end if;
 if v_org is distinct from private.current_organization_id() or not exists(select 1 from public.profiles where id=v_actor and role in ('admin','owner','manager')) then raise exception 'Acesso administrativo necessário';end if;
 select organization_id,client_id,remaining_sessions into v_pkg_org,v_pkg_client,v_remaining from public.packages where id=p_package_id for update;
 if v_pkg_org is distinct from v_org or v_pkg_client is distinct from v_client then raise exception 'Pacote não pertence à cliente ou organização';end if;
 if exists(select 1 from public.payments where appointment_id=p_appointment_id and status='paid' and kind in ('payment','deposit','credit')) then raise exception 'Atendimento tem pagamento próprio; revisão manual necessária';end if;
 select id into v_existing from public.package_sessions where appointment_id=p_appointment_id and status='used' limit 1;
 if v_existing is not null then
   if not exists(select 1 from public.package_sessions where id=v_existing and package_id=p_package_id) then raise exception 'Atendimento já consumiu outro pacote';end if;
   return 'already_linked';
 end if;
 if v_remaining<=0 then raise exception 'Pacote sem saldo. Não é seguro consumir outra sessão';end if;
 insert into public.package_sessions(organization_id,package_id,appointment_id,status) values(v_org,p_package_id,p_appointment_id,'used');
 update public.packages set remaining_sessions=remaining_sessions-1,updated_at=now() where id=p_package_id;
 insert into public.checkout_corrections(organization_id,appointment_id,package_id,actor_id,reason,action) values(v_org,p_appointment_id,p_package_id,v_actor,trim(p_reason),'consumed_session');
 return 'corrected';
end $function$;
