-- Chave Pix do salão, usada nas mensagens de pagamento da Agenda.
-- A coluna não existia no banco, então salvar a chave falhava com "pix_key ... schema cache".
-- A chave é gravada pelo servidor (chave de serviço), que precisa de permissão de UPDATE na coluna.

alter table public.organizations add column if not exists pix_key text;

grant update (pix_key) on public.organizations to service_role;
