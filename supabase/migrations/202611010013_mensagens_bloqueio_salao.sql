-- Mensagens de bloqueio em linguagem clara. Só muda o texto; a regra é a mesma da 202611010011 e da 202611010012.

create or replace function private.guard_salon_writable()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_org uuid;
  v_reason text;
begin
  if tg_op = 'DELETE' then
    v_org := (to_jsonb(old) ->> 'organization_id')::uuid;
  else
    v_org := (to_jsonb(new) ->> 'organization_id')::uuid;
  end if;

  if v_org is not null then
    v_reason := private.salon_write_block_reason(v_org);
    if v_reason = 'pendente' then
      raise exception 'Este salão ainda não está liberado para uso. O cadastro está em análise.'
        using errcode = '42501';
    elsif v_reason = 'somente_leitura' then
      raise exception 'A mensalidade está em atraso. O salão está em modo somente leitura até a regularização.'
        using errcode = '42501';
    elsif v_reason = 'cancelada' then
      raise exception 'A assinatura deste salão foi cancelada. Não é possível alterar dados. Fale com a Bellaris.'
        using errcode = '42501';
    elsif v_reason = 'sem_plano' then
      raise exception 'Este salão não tem um plano ativo. Não é possível alterar dados. Fale com a Bellaris.'
        using errcode = '42501';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;
