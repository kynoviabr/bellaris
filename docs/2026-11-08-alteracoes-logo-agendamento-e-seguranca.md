# Alterações de 2026-11-06 a 2026-11-08: logo por salão, agendamento, mensagem de pagamento e segurança

Registro do que foi feito nesta rodada. Os commits aparecem com o hash da `homolog` e, quando foram para a produção, com o hash da `main`.

## 1. Logo por salão

### Objetivo

Cada salão envia o próprio logo, que aparece:

- no agendamento online (`/agendar/[slug]`), no cabeçalho;
- na prévia de agendamento dentro do painel;
- no login do salão (`/login/[slug]`).

O painel (menu lateral) e o login geral (`/login`) continuam com a marca da Bellaris.

### Banco de dados

Migrações do repositório:

- `supabase/migrations/20261108000001_salon_logo.sql`: adiciona `organizations.logo_path` e cria o bucket público `salon-logos` (PNG, JPG ou WebP, até 2 MB).
- `supabase/migrations/20261108000002_grant_logo_path_service_role.sql`: libera ao papel `service_role` a leitura e a escrita só da coluna `logo_path`.

Motivo da segunda migração: o servidor grava o logo com `service_role`, e esse papel não tinha permissão sobre a coluna nova. Sem ela, o envio dava `permission denied for table organizations`.

Aplicação:

- Homolog: aplicadas pela proprietária no SQL Editor, em 2026-11-08.
- Produção: a proprietária rodou as duas migrações antes de a `main` receber o código. O resultado da checagem prévia não foi registrado.

### Código

- `src/lib/salon-logo.ts`: monta a URL pública do logo a partir do `logo_path`.
- `src/components/salon-mark.tsx`: mostra o logo do salão ou uma reserva (`fallback`).
- `src/components/login-screen.tsx`: tela de login compartilhada. `/login` usa a marca da Bellaris; `/login/[slug]` usa o logo do salão, com a marca da Bellaris como reserva.
- `src/app/login/[slug]/page.tsx`: busca o salão pelo slug e mostra o nome e o logo.
- `src/lib/actions/settings.ts`: ação `updateSalonLogo`. Usa o salão da sessão (`getCurrentOrganizationId`), valida tipo e tamanho, envia o arquivo ao bucket, grava `logo_path` e remove o logo anterior.
- `src/components/nail-studio-app.tsx`: seção "Logo do salão" em Configurações, com prévia e botão de envio. Depois do envio, chama `router.refresh()` para o painel e a prévia usarem o logo novo sem recarregar a página.
- `src/components/online-booking.tsx`: no cabeçalho do agendamento, o logo aparece sem caixa, com 48 px de altura. Sem logo, fica a estrelinha num quadrado roxo.
- `src/app/page.tsx`, `src/lib/services/public-booking.service.ts`, `src/lib/actions/public.ts`, `src/app/agendar/[slug]/page.tsx`: leem `logo_path` e repassam a URL.

### Aparência do cabeçalho do agendamento

- Com logo: fundo na cor clara de vinho do sistema (`bg-primary-light`, `#F3E8E9`), com nome do salão em cor escura.
- Sem logo: fundo escuro, como antes.
- Houve uma tentativa com fundo na cor primária (`#804663`), que foi publicada em homolog. Use a versão atual do arquivo como referência.

Observação: o logo preto tem contraste fraco sobre roxo escuro. Para fundos escuros, o indicado é a versão branca do logo.

### Commits

| Homolog | Descrição | Main |
|---|---|---|
| `a3b5f16` | Logo do salão no agendamento, painel e login por slug | `4f54c86` (cópia) |
| `95193d9` | Prévia do agendamento no painel e migração de permissão da coluna | `4f54c86` (cópia) |
| `61e7193` | Menu do painel volta a mostrar a marca Bellaris | `4f54c86` (cópia) |
| `3e8e87e` | Logo do agendamento maior e sem recorte | `4f54c86` (cópia) |
| `ff97e8f` | Logo do agendamento sem caixa, com altura fixa | `4f54c86` (cópia) |
| `31445c9` | Cabeçalho claro quando o salão tem logo | `4f54c86` (cópia) |
| `2b33fdf` | Tom claro de vinho do sistema no cabeçalho | `4f54c86` (cópia) |
| `40530b3` | Cor primária do sistema no cabeçalho | `4f54c86` (cópia) |
| `9883902` | Logo novo aparece sem recarregar a página | `4f54c86` (cópia) |

Os nove commits foram para a `main` como cópias (cherry-pick), no último commit `4f54c86`. A `main` não recebeu os demais commits do homolog. O deploy de produção foi disparado com esse push. O status `READY` não foi conferido no registro.

## 2. Mensagem de pagamento antecipado (agenda)

Arquivo: `src/components/dashboard/agenda.tsx`.

A mensagem agora inclui a data e o horário do atendimento, no formato:

> Seu agendamento de {serviço} no dia dd/mm/aaaa às HH:MM está reservado!

- Homolog: `627d177`.
- Main: `079e389` (cópia).

Não houve mudança de banco.

## 3. Operações fora do código

- **Frase de criptografia dos backups:** trocada em 2026-11-06. A frase nova está no Keychain do Mac, com o nome "Bellaris backup GPG passphrase". O segredo `BACKUP_ENCRYPTION_PASSPHRASE` no GitHub foi atualizado. O backup manual rodou com sucesso e o arquivo `.gpg` apareceu no Google Drive. Backups anteriores à troca não abrem com a frase nova, e a frase antiga não foi encontrada.
- **Senha do banco:** `SUPABASE_DB_URL` atualizado em 2026-11-05. O backup de 2026-11-06 rodou depois. Falta confirmar no Supabase que a senha anterior foi invalidada.
- **Chave `service_role`:** uma chave nova (`sb_secret_...`) foi criada para teste, não funcionou (erro 401) e foi apagada. A produção voltou a usar a chave antiga (`service_role`), que continua habilitada.
- **Variável `SUPABASE_SERVICE_ROLE_KEY` no ambiente Preview do projeto `bellaris`:** ainda não foi restrita à branch `homolog`. Risco baixo, sem sinal de uso indevido.
- **Proteção contra senhas vazadas:** exige o plano Pro do Supabase. Decisão pendente.

Detalhes da revisão de segurança estão em `2026-11-08-seguranca-resumo.md`, na pasta do projeto.

## 4. Pendências

- Confirmar `READY` do deploy de produção dos commits `4f54c86` e `079e389` na Vercel.
- Testar o login do salão (`/login/[slug]`) e o agendamento com logo real em produção.
- Restringir a variável `SUPABASE_SERVICE_ROLE_KEY` do Preview à branch `homolog`.
- Decidir sobre a proteção contra senhas vazadas (plano Pro ou aceitar o risco).
- Reaplicar as alterações de `globals.css` e `tailwind.config.ts` que ficaram guardadas numa stash local, se ainda forem necessárias.
- Os demais commits do homolog (privacidade, rede, Cakto, fases de vínculo) continuam só no homolog. Antes de qualquer promoção, seguir `docs/procedimento-promocao-producao.md`.
