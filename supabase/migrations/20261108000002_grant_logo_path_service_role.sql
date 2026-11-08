-- O servidor grava o logo com o papel service_role. Libera leitura e escrita só dessa coluna.
grant select (logo_path) on public.organizations to service_role;
grant update (logo_path) on public.organizations to service_role;
