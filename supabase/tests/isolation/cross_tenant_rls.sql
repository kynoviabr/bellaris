-- =====================================================================
-- A2: suíte de isolamento entre salões (RLS e grants)
--
-- SOMENTE HOMOLOGAÇÃO (pnvhqvspziujrpagsclx). Nunca executar em produção.
--
-- Como rodar: SQL editor do Supabase (homologação) ou psql no banco de homologação.
-- Tudo roda em uma única transação que termina com RAISE EXCEPTION de propósito:
-- nenhuma linha é gravada. A mensagem de erro é o relatório.
--
-- Resultado esperado: "violacoes=0". Qualquer linha "VIOLACAO" bloqueia o avanço.
--   - VIOLACAO: a sessão do usuário conseguiu ler/alterar/inserir dado de outro salão.
--   - bloqueadas-por-rls-ou-grant: tentativa negada pela RLS ou por falta de GRANT (esperado).
--   - bloqueadas-por-outra-regra: negada por trigger de regra de negócio (esperado).
--     Não prova sozinha que a RLS bloqueia; registrar como OUTRA-REGRA.
--   - INCONCLUSIVO: tentativa que não pôde ser classificada. Deve ser investigada.
--
-- Usuários simulados (homologação):
--   7e…0001  dona do salão 1111…  (owner)
--   7e…0002  recepção do salão 1111… (staff)
--   7e…0003  profissional do salão 1111… (professional)
--   3ace…    dona de outro salão (21434d…, owner)
--
-- Para cada tabela com organization_id e cada usuário:
--   1) SELECT de linhas de outro salão
--   2) UPDATE (no-op) de linhas de outro salão
--   3) DELETE de linhas de outro salão
--   4) INSERT de cópia de linha PRÓPRIA apontando para o outro salão
--   5) UPDATE movendo linha PRÓPRIA para o outro salão
-- Controle positivo: a dona consegue inserir cópia no PRÓPRIO salão.
-- =====================================================================
DO $t$
DECLARE
  users uuid[] := array['7e000000-0000-4000-8000-000000000001','7e000000-0000-4000-8000-000000000002','7e000000-0000-4000-8000-000000000003','3ace7ddf-5648-4e46-abee-db943ef0fb0c']::uuid[];
  tables text[] := array['appointment_items','appointments','checkout_corrections','client_anamnesis','client_blacklist','client_consents','client_deposit_whitelist','client_photos','clients','commissions','data_processing_log','expense_templates','expenses','import_batches','message_jobs','message_templates','organization_owner_data','package_service_balances','package_sessions','package_template_items','package_templates','packages','payments','platform_payments','platform_subscriptions','products','professional_availability','professional_services','professionals','profiles','role_permissions','service_consumables','services','specialties','stock_movements'];
  u uuid; org uuid; other uuid; t text; n bigint; rep text := ''; viol int := 0; checks int := 0; bloq int := 0; outras int := 0; testados int := 0; semlinhas int := 0; ctrl_ok int := 0; ctrl_fail text := '';
BEGIN
  FOREACH u IN ARRAY users LOOP
    select organization_id into org from public.profiles where id = u;
    other := case when org = '11111111-1111-4111-8111-111111111111' then '21434d75-566e-4d03-9f1f-61b3f7a27ff4'::uuid else '11111111-1111-4111-8111-111111111111'::uuid end;
    FOREACH t IN ARRAY tables LOOP
      perform set_config('request.jwt.claims', json_build_object('sub',u,'role','authenticated')::text, true);
      perform set_config('request.jwt.claim.sub', u::text, true);

      set local role authenticated; checks := checks + 1;
      begin execute format('select count(*) from public.%I where organization_id is distinct from $1', t) using org into n;
      exception when insufficient_privilege then n := -1; end;
      reset role;
      if n > 0 then viol := viol + 1; rep := rep || format(E'VIOLACAO leitura %s por %s: %s linhas\n', t, u, n); end if;
      if n = -1 then bloq := bloq + 1; end if;

      set local role authenticated; checks := checks + 1;
      begin execute format('update public.%I set organization_id = organization_id where organization_id is distinct from $1', t) using org;
        GET DIAGNOSTICS n = ROW_COUNT;
      exception when insufficient_privilege then n := -1; end;
      reset role;
      if n > 0 then viol := viol + 1; rep := rep || format(E'VIOLACAO update-outro %s por %s: %s linhas\n', t, u, n); end if;

      set local role authenticated; checks := checks + 1;
      begin execute format('delete from public.%I where organization_id is distinct from $1', t) using org;
        GET DIAGNOSTICS n = ROW_COUNT;
      exception when insufficient_privilege then n := -1; end;
      reset role;
      if n > 0 then viol := viol + 1; rep := rep || format(E'VIOLACAO delete-outro %s por %s: %s linhas\n', t, u, n); end if;

      set local role authenticated; checks := checks + 1;
      begin
        execute format('select count(*) from public.%I where organization_id = $1', t) using org into n;
        if n = 0 then semlinhas := semlinhas + 1; end if;
        if n > 0 then
          execute format('insert into public.%I select (jsonb_populate_record(null::public.%I, jsonb_set(to_jsonb(x), ''{id}'', to_jsonb(gen_random_uuid()::text)) || jsonb_build_object(''organization_id'', $1::text))).* from public.%I x where x.organization_id = $2 limit 1', t, t, t) using other, org;
          GET DIAGNOSTICS n = ROW_COUNT;
          if n > 0 then viol := viol + 1; rep := rep || format(E'VIOLACAO insert-outro %s por %s: gravou linha no outro salao\n', t, u); end if;
          testados := testados + 1;
        end if;
      exception
        when insufficient_privilege then bloq := bloq + 1; testados := testados + 1;
        when unique_violation then rep := rep || format(E'INCONCLUSIVO insert %s por %s: chave unica\n', t, u);
        when others then outras := outras + 1; testados := testados + 1; rep := rep || format(E'OUTRA-REGRA insert %s por %s: %s\n', t, u, sqlerrm);
      end;
      reset role;

      set local role authenticated; checks := checks + 1;
      begin
        execute format('update public.%I set organization_id = $1 where organization_id = $2', t) using other, org;
        GET DIAGNOSTICS n = ROW_COUNT;
        if n > 0 then viol := viol + 1; rep := rep || format(E'VIOLACAO mover-para-outro %s por %s: %s linhas\n', t, u, n); end if;
      exception
        when insufficient_privilege then bloq := bloq + 1;
        when others then outras := outras + 1; rep := rep || format(E'OUTRA-REGRA mover %s por %s: %s\n', t, u, sqlerrm);
      end;
      reset role;
    END LOOP;
  END LOOP;

  -- Controle positivo: a dona consegue inserir cópia no PRÓPRIO salão.
  perform set_config('request.jwt.claims', json_build_object('sub','7e000000-0000-4000-8000-000000000001','role','authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', '7e000000-0000-4000-8000-000000000001', true);
  set local role authenticated;
  begin
    execute 'insert into public.services select (jsonb_populate_record(null::public.services, jsonb_set(to_jsonb(x), ''{id}'', to_jsonb(gen_random_uuid()::text)) || jsonb_build_object(''name'', x.name || '' [controle]'') )).* from public.services x where x.organization_id = $1 limit 1' using '11111111-1111-4111-8111-111111111111'::uuid;
    GET DIAGNOSTICS n = ROW_COUNT; ctrl_ok := n;
  exception when others then ctrl_fail := sqlerrm;
  end;
  reset role;

  RAISE EXCEPTION E'%', rep || format(E'RESUMO: verificacoes=%s | violacoes=%s | bloqueadas-por-rls-ou-grant=%s | bloqueadas-por-outra-regra=%s | cenarios-insercao-movimento=%s | tabelas-sem-linhas-proprias=%s | controle-positivo-linhas=%s %s',
    checks, viol, bloq, outras, testados, semlinhas, ctrl_ok, coalesce('erro='||nullif(ctrl_fail,''),''));
END $t$;

-- =====================================================================
-- Isolamento DENTRO do salão (profissional x profissional).
-- Resultado de referência (2026-11-04, homologação): a profissional
-- 7e…0003 vê 40 de 297 atendimentos (só os dela), 0 clientes diretos,
-- 0 pagamentos, 0 movimentos de estoque e 0 anamneses. role_permissions
-- (130 linhas) é visível a ela: configuração do salão, sem dado de cliente.
-- Verificação esperada após qualquer mudança em políticas de agenda:
-- appointments visíveis à profissional = atendimentos com professional_id
-- dela. Conferir manualmente com a consulta abaixo (somente leitura).
--
--   select count(*) from public.appointments
--    where organization_id='11111111-1111-4111-8111-111111111111'
--      and professional_id='7e000000-0000-4000-8000-0000000000aa';   -- esperado: 40
-- =====================================================================
