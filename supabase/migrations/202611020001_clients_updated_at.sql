-- A função save_client_with_anamnesis grava clients.updated_at. A coluna não existia, então
-- toda edição de cliente falhava com "Não foi possível salvar a cliente".
alter table public.clients add column if not exists updated_at timestamptz not null default now();
