-- Fase F (correção): a aplicação usa o mesmo critério do banco para o salão do usuário.
-- Antes, o app lia só profiles.active_organization_id e não via o bloqueio por salão ou por rede,
-- então o salão bloqueado aparecia com dados zerados em vez da tela de bloqueio.
-- Esta função devolve o salão que o banco libera agora (null se bloqueado ou sem vínculo ativo).
-- Aplicar primeiro na HOMOLOGAÇÃO (pnvhqvspziujrpagsclx). Produção não é tocada por este arquivo.
--
-- Rollback: remover a função my_current_organization e voltar o app a ler profiles.active_organization_id.

create or replace function public.my_current_organization()
returns uuid
language sql
stable
security definer
set search_path to ''
as $function$
  select private.current_organization_id()
$function$;

revoke execute on function public.my_current_organization() from public, anon;
grant execute on function public.my_current_organization() to authenticated;
