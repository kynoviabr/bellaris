-- Fase F: vínculo desativado bloqueia só o salão desativado, não o login inteiro.
-- Aplicar primeiro na HOMOLOGAÇÃO (pnvhqvspziujrpagsclx). Produção não é tocada por este arquivo.
--
-- F1: desativar um vínculo tira o salão ativo do usuário se for esse salão. O salão ativo passa
--     para outro vínculo ativo; se não houver nenhum, fica nulo e o banco não libera dados de salão.
-- F2: o gatilho de salão ativo deixa de recolocar o salão do perfil quando o ativo fica nulo.
--     Antes, um vínculo desativado voltaria a ser o salão ativo.
-- F3: a sincronização do perfil atualiza o papel do vínculo, mas não reativa vínculo desativado.
--
-- Rollback (se precisar): recriar as funções das migrations 202611040004 e remover o gatilho
-- memberships_deactivated.

-- F2: salão ativo acompanha o salão do perfil apenas na criação ou quando o salão do perfil muda.
create or replace function private.profile_set_active_organization()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if new.organization_id is not null
     and (tg_op = 'INSERT'
          or new.organization_id is distinct from old.organization_id) then
    new.active_organization_id := new.organization_id;
  end if;
  return new;
end
$function$;

-- F3: papel acompanha o perfil; vínculo desativado continua desativado.
create or replace function private.profile_sync_membership()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if new.organization_id is not null then
    insert into public.memberships (user_id, organization_id, role, active)
    values (new.id, new.organization_id, new.role, true)
    on conflict (user_id, organization_id)
      do update set role = excluded.role;
  end if;
  return new;
end
$function$;

-- F1: vínculo desativado sai do salão ativo do usuário.
create or replace function private.membership_deactivated()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  update public.profiles p
     set active_organization_id = (
       select m.organization_id
         from public.memberships m
        where m.user_id = new.user_id
          and m.active
          and m.organization_id <> new.organization_id
        order by m.created_at
        limit 1
     )
   where p.id = new.user_id
     and p.active_organization_id = new.organization_id;
  return new;
end
$function$;

drop trigger if exists memberships_deactivated on public.memberships;
create trigger memberships_deactivated
  after update of active on public.memberships
  for each row
  when (old.active and not new.active)
  execute function private.membership_deactivated();
