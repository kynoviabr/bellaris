-- Cadastro de salão (src/lib/actions/auth.ts e onboarding.ts) grava organizations e
-- organization_owner_data com a chave de serviço. Sem o privilégio de INSERT, o insert
-- falhava em silêncio e a conta ficava sem salão.
grant insert on public.organizations to service_role;
grant select, insert, update on public.organization_owner_data to service_role;

-- A reserva pública (rota /api/booking/hold) chama create_booking_transaction com a chave de
-- serviço. Ninguém mais precisa executar essa função: não ficar exposta a anon nem a PUBLIC.
revoke execute on function public.create_booking_transaction(uuid, text, text, text, uuid, uuid, timestamptz, integer)
  from public, anon, authenticated;
grant execute on function public.create_booking_transaction(uuid, text, text, text, uuid, uuid, timestamptz, integer)
  to service_role;
