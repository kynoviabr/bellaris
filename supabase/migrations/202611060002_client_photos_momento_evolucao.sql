-- Momento da foto: acrescenta "evolution" (Evolução) aos tipos já aceitos (antes, depois, outro).
alter table public.client_photos drop constraint if exists client_photos_kind_check;
alter table public.client_photos add constraint client_photos_kind_check check (kind in ('before','after','evolution','other'));
