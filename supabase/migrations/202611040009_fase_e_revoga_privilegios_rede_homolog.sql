-- Homologação somente (aplicada em pnvhqvspziujrpagsclx em 2026-11-04).
-- TRUNCATE ignora RLS; TRIGGER e REFERENCES não são usados pelo app.
-- Resultado: authenticated mantém só SELECT; anon não tem privilégio nessas tabelas.
revoke truncate, trigger, references on public.networks, public.memberships, public.professional_organizations from authenticated, anon;
