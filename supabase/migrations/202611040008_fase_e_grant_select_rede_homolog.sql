-- Homologação somente (já aplicada em pnvhqvspziujrpagsclx em 2026-11-04).
-- Leitura de networks, memberships e professional_organizations pelo papel authenticated.
-- A RLS já restringe as linhas (networks_owner_read, memberships_own_read, prof_org_salon_read).
-- Sem este GRANT a leitura falha com "permission denied" e o card "Rede de salões" mostra erro.
grant select on public.networks, public.memberships, public.professional_organizations to authenticated;
