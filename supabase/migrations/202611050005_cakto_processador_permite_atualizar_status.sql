-- Processador de eventos da Cakto: o papel service_role precisa atualizar o status dos eventos.
-- Sem este grant, o UPDATE falha em silêncio e os eventos ficam pendentes.
-- Colunas mínimas: só as que o processador altera. Não concede DELETE nem UPDATE de payload.
grant update (status, processed_at, processing_error, attempts, next_attempt_at) on public.cakto_webhook_events to service_role;
