# Procedimento de promoção: homologação → produção

Este documento descreve como levar mudanças da homologação (`homolog`) para a produção (`main`, publicado em bellaris.kynovia.com.br). Siga na ordem. Nenhum passo pula a verificação.

## Regras gerais

- Toda mudança é aprovada pela proprietária antes de chegar à produção.
- Produção recebe só código e migrações testados na homologação.
- Dados de teste da homologação (salão do Baigotti, contas de teste) nunca vão para a produção.
- Cada alteração vira um commit com push no ambiente correspondente, logo após ser feita.

## Diferenças intencionais entre homologação e produção

A produção não recebe estes dois itens, que existem só na homologação:

1. **Catálogo de pacotes** (`src/components/dashboard/package-catalog.tsx`, `src/lib/actions/package-catalog.ts`, item de menu e renderização em `src/components/nail-studio-app.tsx`). A produção ainda não tem as tabelas `package_templates` e `package_template_items` com o mesmo estado da homologação.
2. **Bloqueio de envio de WhatsApp.** Trechos marcados com o comentário `branch homolog` nos arquivos:
   - `src/lib/actions/automations.ts` (linha com `if (true /* branch homolog: registro de envio bloqueado */)`)
   - `src/components/online-booking.tsx` (atributos `href`, `onClick` e `aria-disabled` do comprovante)

   Para localizar: `grep -rn "branch homolog" src`

A migração `homolog_role_isolation_and_test_accounts` (cria contas de teste) também nunca vai para a produção.

## Passo a passo

### 1. Preparar o código

1. Garanta que `homolog` está publicado (`git status` sem pendências, `git push` feito).
2. Crie o branch de release a partir da homologação:
   ```bash
   git fetch origin
   git checkout -b release/bellaris-prod origin/homolog
   ```
3. Remova o catálogo de pacotes e os bloqueios de homologação. Confira com `grep -rn "branch homolog\|package-catalog\|pacotes-catalogo" src` antes do commit.
4. Rode a checagem de tipos:
   ```bash
   npx tsc --noEmit -p .
   ```
5. Faça commit separado para cada remoção, com a mensagem descrevendo o que foi retirado.

### 2. Preparar o banco de produção

1. Liste as migrações aplicadas em produção e na homologação (`list_migrations`) e compare.
2. Para cada migração pendente, na ordem do repositório:
   - Leia o arquivo inteiro antes de aplicar.
   - Confirme que não cria contas de teste nem insere dados de homologação.
   - Aplique com `apply_migration`, usando o nome do arquivo sem o número.
   - Se der erro de versão duplicada, reaplique com outro nome (o erro não altera o banco).
3. Confirme o resultado com consultas de verificação: colunas, permissões de `service_role` e `authenticated` nas tabelas alteradas, e funções criadas.
4. Registre cada migração aplicada em produção no repositório, em `supabase/migrations`, no mesmo commit ou em commit próprio.

### 3. Publicar o código

1. Confirme que o `main` no GitHub ainda é ancestral do release (fast-forward):
   ```bash
   git ls-remote --heads origin main
   git merge-base --is-ancestor origin/main HEAD && echo "ok"
   ```
2. Só depois de aprovado, publique:
   ```bash
   git push origin HEAD:main
   ```
   Esse push dispara o deploy de produção automaticamente.
3. Acompanhe o deploy na Vercel (projeto de produção) até o status `READY`.

### 4. Verificar em produção

Teste com a proprietária, com conta real, sem criar dados de teste:

- Login e Agenda abrem sem erro.
- Clientes: editar um cadastro existente salva.
- Automações: revisar e confirmar o envio registra a mensagem como enviada.
- Configurações → Perfis e permissões: a tela abre sem erro de permissão.
- Configurações → Importar dados: a lista de cargas feitas aparece.
- Estoque: a lista de produtos abre.

Se algo falhar, reverta o código com um novo commit no `main` (não force push) e corrija na homologação antes de tentar de novo.

## Checklist rápido

- [ ] Homologação publicada e testada
- [ ] Catálogo de pacotes removido do release
- [ ] Bloqueios `branch homolog` removidos do release
- [ ] `tsc` sem erros
- [ ] Migrações pendentes lidas, aplicadas e verificadas em produção
- [ ] Migrações registradas no repositório
- [ ] Aprovação da proprietária
- [ ] Push para `main` feito
- [ ] Deploy de produção em `READY`
- [ ] Testes do passo 4 feitos
