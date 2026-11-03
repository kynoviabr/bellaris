@AGENTS.md

# Regras do projeto Bellaris (Gabi Ludwig Nails)

As diretrizes globais de engenharia, UX/UI e autonomia estão em `~/.claude/CLAUDE.md`. Esta seção contém o que é específico deste repositório.

## Stack e ambientes
- Next.js 16 (App Router), build com `npx next build --webpack`. Typecheck com `npx tsc --noEmit -p .`.
- Supabase: projeto de homologação `pnvhqvspziujrpagsclx` ("Agenda Gabi Homolog"); projeto de produção `qcltxqnocckbkabcuoqr` ("Agenda Gabi Produção").
- Vercel: projeto `bellaris-homolog` publica a branch `homolog`; projeto `bellaris` publica a branch `main` (produção).

## Fluxo de branches (obrigatório)
- Implemente primeiro em `homolog`. Só depois, e com aprovação explícita, leve para `main`.
- Nunca faça merge de `homolog` em `main`. `main` e `homolog` estão divergentes de propósito. Para produção, faça cherry-pick apenas dos commits aprovados.
- Commits de `feat/*`, `fix/*`, `chore/*` podem ser enviados ao remoto para salvar o trabalho, sem publicar.
- Antes de qualquer push para `main`: typecheck e `next build` passando, e confirmação do responsável.

## Itens que exigem aprovação explícita
- Qualquer alteração em produção (`main`, banco do projeto de produção, template de e-mail de produção, SMTP).
- Migrations e GRANTs em produção. Antes de aplicar, mostrar o SQL e a checagem do estado atual.
- Mudanças de regra de negócio, permissões de perfil e funcionalidades fora da tarefa pedida.

## Fora do escopo sem pedido explícito
- Mudanças em `demo@example.com` ou em outros dados de teste.

## Regras técnicas do código
- Arquivos com `"use client"` devem ter essa diretiva na primeira linha, antes de qualquer import. Caso contrário o build quebra.
- Server actions em `src/lib/actions/*.ts` começam com `"use server"`.
- Operações de leitura e escrita respeitam o isolamento por organização (`organization_id`) e os perfis `owner`, `admin`, `staff`, `professional`.
- Para ações de confirmação e mensagens, use `appNotify`, `appConfirm` e `appPrompt` de `@/components/ui/app-dialog`. Não use `alert`, `confirm` ou `prompt` do navegador.
- Erros do Supabase vêm em inglês e com texto técnico. Traduza para português e não exiba a mensagem original (ver `passwordErrorMessage` em `src/app/redefinir-senha/page.tsx`).

## Design System do projeto
- Classes e tokens existentes: `btn-primary`, `btn-outline`, `field-input`, `field-label`, `text-primary`, `text-ink`, `text-muted`, `bg-bg`, `bg-navy-dark`, `shadow-card`, borda `#DBE3EC`.
- Telas de senha usam a caixa de mensagem com verde-claro para sucesso e vermelho-claro para erro. Ao criar novas mensagens, use a paleta de "Mensagens (padrão)" das diretrizes globais.
- Não altere layouts aprovados (menu lateral, cabeçalho, agenda, financeiro, configurações) sem pedido.

## Verificação antes de declarar pronto
1. `npx tsc --noEmit -p .` sem erros.
2. `npx next build --webpack` concluído.
3. Para mudança visual: verificar a tela em desktop e em celular.
4. Informar o ambiente alterado (homolog ou produção) e o commit.
