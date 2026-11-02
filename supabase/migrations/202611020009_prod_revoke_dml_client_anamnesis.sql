-- Produção: anamnese é gravada só pela função save_client_with_anamnesis (security definer). O usuário autenticado só lê.
revoke insert, update, delete on public.client_anamnesis from authenticated;
