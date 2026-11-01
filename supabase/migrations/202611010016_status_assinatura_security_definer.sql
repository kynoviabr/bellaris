-- A situação da assinatura passa a ser lida com privilégio do dono da função.
-- Assim o agendamento público (chave de serviço) consulta sem depender de permissão na tabela
-- platform_subscriptions. A função só devolve um texto de situação e segue restrita ao servidor.

alter function public.platform_billing_status_of(uuid) security definer;
