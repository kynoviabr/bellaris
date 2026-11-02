-- Mesma revogação já aplicada na produção: remove do usuário anônimo REFERENCES, TRIGGER e TRUNCATE.
revoke references, trigger, truncate on all tables in schema public from anon;
