-- Homologação: o código já grava modelos de despesa, especialidades e pacotes pelo usuário autenticado; faltava a permissão.
grant insert, update, delete on public.expense_templates to authenticated;
grant insert, update, delete on public.specialties to authenticated;
grant insert, update, delete on public.packages to authenticated;
