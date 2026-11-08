-- Cada serviço escolhe se aparece na lista do agendamento online. Serviços existentes continuam visíveis.
alter table public.services
  add column if not exists show_online boolean not null default true;
