# Usuário master da plataforma

- Papel: `platform_master`, sem salão (`profiles.organization_id` nulo).
- Acesso: página `/plataforma`. Não lê dados de nenhum salão: o RLS nega tudo quando `organization_id` é nulo.
- Regra no banco: `platform_master` não pode ter salão, e nenhum outro papel pode ficar sem salão.
- Não há criação automática pela aplicação. Criação é manual, feita por quem administra o projeto.

## Criar um master

1. No painel do Supabase (Authentication > Users), crie o usuário com e-mail e senha. Copie o UUID.
2. No SQL Editor do projeto, execute, trocando o UUID e o nome:

```sql
insert into public.profiles (id, role, organization_id, full_name)
values ('<uuid-do-usuario>', 'platform_master', null, '<nome>');
```

3. Confirme:

```sql
select id, role, organization_id from public.profiles where role = 'platform_master';
```

`organization_id` deve aparecer nulo.

## Observações

- Não atribua `platform_master` a um salão. A constraint `profiles_platform_master_sem_salao` bloqueia.
- Não há ainda tabela de auditoria para ações do master. Registre manualmente quem foi criado e quando, até existir essa tabela.
- Em produção, aplicar esta mudança exige a mesma aprovação da equalização. Não está incluída no script de equalização.
