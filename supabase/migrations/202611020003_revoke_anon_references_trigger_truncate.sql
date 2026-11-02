-- Remove do usuário anônimo as permissões REFERENCES, TRIGGER e TRUNCATE em todas as tabelas públicas.
-- A API não usa essas permissões; a revogação só fecha uma brecha. Aplicada na produção.
revoke references, trigger, truncate on all tables in schema public from anon;
