-- Fase C (parte 1): private.current_organization_id() passa a devolver o salão ATIVO
-- validado por vínculo ativo em public.memberships.
-- Fallback para profiles.organization_id enquanto o código não grava memberships
-- (novos usuários criados pelo fluxo atual ainda não têm vínculo). Remover o fallback
-- só após o código gravar vínculos, na fase D.
-- Aplicada na HOMOLOGAÇÃO (pnvhqvspziujrpagsclx). Produção não foi tocada.
-- Verificado antes: resultado idêntico ao atual para os 12 perfis.
-- Suíte A2 após a troca: 700 verificações, 0 violações.

create or replace function private.current_organization_id()
returns uuid
language sql
stable
security definer
set search_path to ''
as $function$
  select coalesce(
    (select m.organization_id
       from public.profiles p
       join public.memberships m
         on m.user_id = p.id
        and m.organization_id = p.active_organization_id
        and m.active
      where p.id = (select auth.uid())),
    (select p.organization_id from public.profiles p where p.id = (select auth.uid()))
  )
$function$;
