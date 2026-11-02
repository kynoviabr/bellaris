-- O histórico de cargas passa a aceitar a carga de produtos e estoque.
alter table public.import_batches drop constraint if exists import_batches_kind_check;
alter table public.import_batches add constraint import_batches_kind_check
  check (kind in ('services', 'professionals', 'products', 'clients'));
