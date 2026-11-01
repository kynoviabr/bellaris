-- A função public.seed_role_permission_defaults é security definer e só deve ser
-- chamada pelo trigger trg_seed_role_permissions. Revoga a execução de public, anon
-- e authenticated. O trigger continua funcionando (roda como dono da função).
-- Idempotente.
revoke execute on function public.seed_role_permission_defaults(uuid) from public, anon, authenticated;
