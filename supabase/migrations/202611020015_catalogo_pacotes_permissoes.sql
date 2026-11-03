-- Catálogo de pacotes: o usuário logado pode ler, cadastrar e editar modelos de pacote.
-- A exclusão continua bloqueada. As regras de acesso por organização e papel já estão nas políticas (RLS) existentes.
grant select, insert, update on public.package_templates to authenticated;
grant select, insert, update on public.package_template_items to authenticated;
