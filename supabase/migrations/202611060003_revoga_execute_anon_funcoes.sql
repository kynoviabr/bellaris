-- Segurança: funções SECURITY DEFINER não devem ser chamadas pelo papel anon (sem login).
-- Todas as chamadas do app estão em áreas logadas. Triggers internos não precisam de EXECUTE para usuários.
revoke execute on function public.auto_promote_whitelist(integer) from anon;
revoke execute on function public.finish_appointment_checkout(uuid, numeric, text, uuid) from anon;
revoke execute on function public.save_client_with_anamnesis(uuid, text, text, text, text, date, text, text, text, text, text, text, text, boolean, boolean, boolean, boolean, text) from anon;
revoke execute on function public.sell_package(uuid, text, integer, numeric, text, timestamptz) from anon;
revoke execute on function public.set_client_blacklist(uuid, boolean, text) from anon;
revoke execute on function public.set_client_whitelist(uuid, boolean, text) from anon;
revoke execute on function public.platform_billing_overview() from public, anon;
grant execute on function public.platform_billing_overview() to authenticated, service_role;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
revoke execute on function public.seed_role_permission_defaults_trigger() from public, anon, authenticated;
