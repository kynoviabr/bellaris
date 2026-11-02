-- Leitura de anamnese e modelos de despesa pelo usuário autenticado (o código já usa; faltava na homologação).
-- Remove REFERENCES, TRIGGER e TRUNCATE do autenticado, como na produção.
grant select on public.client_anamnesis to authenticated;
grant select on public.expense_templates to authenticated;
revoke references, trigger, truncate on all tables in schema public from authenticated;
