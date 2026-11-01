-- Permite que o usuário autenticado use o schema private.
-- A função public.pay_commissions (não security definer) chama private.current_organization_id().
-- Sem este USAGE, o pagamento de comissões falha em produção com
-- "permission denied for schema private". A homologação já tinha esta permissão.
-- Idempotente.
grant usage on schema private to authenticated;
