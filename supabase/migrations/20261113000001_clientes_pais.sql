-- Permite cadastrar cliente com endereço e telefone de qualquer país.
-- Clientes já cadastradas ficam como "Brasil".
alter table public.clients add column if not exists country text default 'Brasil';
