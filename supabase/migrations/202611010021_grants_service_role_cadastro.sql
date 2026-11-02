-- O cadastro público (src/lib/actions/auth.ts) e a lista de planos (getActivePlans) usam a chave
-- de serviço. Sem estes privilégios, a lista de planos ficava em "Carregando planos..." e o
-- perfil do dono não era gravado.
grant select on public.platform_plans to service_role;
grant select, insert, update on public.profiles to service_role;
