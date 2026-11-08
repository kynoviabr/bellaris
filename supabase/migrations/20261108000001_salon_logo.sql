-- Logo por salão. O arquivo fica num bucket público, porque aparece na página de agendamento e no login do salão.
alter table public.organizations add column if not exists logo_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'salon-logos',
  'salon-logos',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
) on conflict (id) do update set
  public = true,
  file_size_limit = 2097152,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']::text[];
