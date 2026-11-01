-- O agendamento público consulta a situação da assinatura com a chave de serviço.
-- A função não tinha permissão para esse papel, então toda consulta falhava e o salão
-- aparecia como não encontrado. A função fica executável só pelo servidor.
-- As demais funções que a usam (bloqueio de escrita, visão do master, situação do salão)
-- rodam com privilégio do dono, então não dependem dessa permissão.

revoke execute on function public.platform_billing_status_of(uuid) from public, anon, authenticated;
grant execute on function public.platform_billing_status_of(uuid) to service_role;
