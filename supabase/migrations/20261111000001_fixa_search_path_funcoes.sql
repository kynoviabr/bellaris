-- Fixa o search_path de três funções que o Security Advisor marcou como "Function Search Path Mutable".
-- Sem search_path fixo, uma função pode resolver nomes no schema de quem chama.
-- Só altera a configuração: o corpo das funções não muda.
-- Mesmo padrão já usado em delete_client_anamnesis: public e private.

alter function public.validate_package_template_item() set search_path = public, private;
alter function public.create_booking_transaction(uuid, text, text, text, uuid, uuid, timestamptz, integer) set search_path = public, private;
alter function public.finish_appointment_checkout(uuid, numeric, text, uuid) set search_path = public, private;
