export async function markMessageSentService(supabase: any, clientId: string, list: string, appointmentId?: string) {
  if (!supabase) return { success: false, error: "Sem banco de dados" };
  // Resolve the organization from the actual client under the current user's RLS scope.
  // A user profile may be missing or not uniquely selectable in this session.
  const { data: client, error: clientError } = await supabase.from('clients').select('id, organization_id').eq('id', clientId).maybeSingle();
  if (clientError) return { success: false, error: clientError.message };
  if (!client?.organization_id) return { success: false, error: "Cliente não encontrado ou sem acesso à organização" };
  const organizationId = client.organization_id;

  let query = supabase
    .from('message_jobs')
    .select('id, payload')
    .eq('organization_id', organizationId)
    .eq('client_id', clientId)
    .eq('status', 'sent');

  if (appointmentId) {
    query = query.eq('appointment_id', appointmentId);
  }

  const { data: existingJobs } = await query;
  const alreadySent = Array.isArray(existingJobs) && existingJobs.some((j: any) => j.payload?.list === list);

  if (alreadySent) {
    return { success: true, duplicate: true };
  }

  const { error } = await supabase.from('message_jobs').insert([{
    organization_id: organizationId,
    client_id: clientId,
    appointment_id: appointmentId || null,
    channel: 'whatsapp',
    provider: 'manual',
    status: 'sent',
    scheduled_at: new Date().toISOString(),
    sent_at: new Date().toISOString(),
    payload: { list, type: list === 'reminders' ? 'reminder' : 'overdue' }
  }]);

  if (error) return { success: false, error: error.message };
  return { success: true };
}
