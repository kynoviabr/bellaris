-- Remove TRUNCATE de package_service_balances para authenticated (homolog).
revoke truncate on table public.package_service_balances from authenticated;
