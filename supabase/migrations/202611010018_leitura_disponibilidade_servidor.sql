-- A consulta de horários do agendamento público (chave de serviço) precisa ler a agenda
-- das profissionais (bloqueios), os atendimentos marcados e os itens deles, para não oferecer
-- horário já ocupado. Só leitura. A chave de serviço só roda no servidor.

grant select on public.professional_availability to service_role;
grant select on public.appointments to service_role;
grant select on public.appointment_items to service_role;
