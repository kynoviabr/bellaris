# Usuário master da plataforma

- Papel: `platform_master`, sem salão (`profiles.organization_id` nulo).
- Acesso: página `/plataforma`, com menu lateral: Aprovações, Salões, Financeiro e Planos.
  - Aprovações: fila de cadastros aguardando aprovação. Aprova com plano e dia de vencimento, recusa com motivo e corrige os dados do responsável.
  - Salões: lista de salões com os dados do responsável, editáveis. O nome do salão não é editável.
  - Financeiro: resumo do mês, assinaturas e registro de pagamentos.
  - Planos: valores vigentes.
- O master não lê clientes, agendas nem lançamentos de nenhum salão. Isso é garantido pelo RLS, porque o `organization_id` é nulo.
- Regra no banco: `platform_master` não pode ter salão, e nenhum outro papel pode ficar sem salão.
- Não há criação automática pela aplicação. Criação é manual, feita por quem administra o projeto.

## Criar um master

1. No painel do Supabase (Authentication > Users), crie o usuário com e-mail e senha. Copie o UUID.
2. No SQL Editor do projeto, execute, trocando o UUID e o nome (use aspas retas):

```sql
insert into public.profiles (id, role, organization_id, full_name)
values ('<uuid-do-usuario>', 'platform_master', null, '<nome>');
```

3. Confirme:

```sql
select id, role, organization_id from public.profiles where role = 'platform_master';
```

`organization_id` deve aparecer nulo.

## Pré-requisito em banco novo ou produção

O papel `platform_master` só é aceito se a constraint `profiles_role_check` incluir os papéis `professional` e `platform_master`. Antes de criar o master, confira:

```sql
select pg_get_constraintdef(oid) from pg_constraint
 where conrelid = 'public.profiles'::regclass and conname = 'profiles_role_check';
```

Se a definição não incluir `platform_master`, rode:

```sql
alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role = any (array['owner','admin','staff','professional','platform_master']));
```

Esse ajuste é só de ampliação e não altera registros existentes.

## Observações

- Não atribua `platform_master` a um salão. A constraint `profiles_platform_master_sem_salao` bloqueia.
- Não há ainda tabela de auditoria para ações do master. Registre manualmente quem foi criado e quando, até existir essa tabela.
- Em produção, criar master exige a mesma aprovação de qualquer mudança de schema. O ajuste da constraint e as migrations da plataforma foram aprovados pelo Fernando em 01/11/2026.
