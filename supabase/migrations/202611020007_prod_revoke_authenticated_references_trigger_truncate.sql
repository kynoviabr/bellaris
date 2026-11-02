-- Produção: remove REFERENCES, TRIGGER e TRUNCATE do usuário autenticado em todas as tabelas públicas.
revoke references, trigger, truncate on all tables in schema public from authenticated;
