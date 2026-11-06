-- Liberação pela Cakto: o processador (service_role) grava a assinatura do salão e libera o acesso.
-- Sem estes grants, o INSERT/UPDATE falha e a compra fica como "falha ao atualizar a assinatura".
-- Cadastro também grava a assinatura com service_role, então o grant vale para os dois caminhos.
-- Colunas mínimas: só as que o processador altera em organizations. Não concede DELETE.
grant insert, update on public.platform_subscriptions to service_role;
grant update (access_status, access_note) on public.organizations to service_role;
