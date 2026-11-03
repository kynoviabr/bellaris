-- Telefone do usuário do sistema (equipe, gestor). Profissionais continuam com telefone em professionals.
alter table public.profiles add column if not exists phone text;
