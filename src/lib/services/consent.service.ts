import { CONSENT_VERSION, type ConsentKind } from "../privacy/consent.ts";

export async function hasActiveConsent(supabase: any, clientId: string, kind: ConsentKind): Promise<boolean> {
  const { data } = await supabase
    .from("client_consents")
    .select("id")
    .eq("client_id", clientId)
    .eq("kind", kind)
    .is("revoked_at", null)
    .limit(1);
  return Boolean(data && data.length > 0);
}

export async function logOperation(supabase: any, organizationId: string, clientId: string | null, action: string, detail: Record<string, unknown> = {}) {
  await supabase.from("data_processing_log").insert([{ organization_id: organizationId, client_id: clientId, action, detail }]);
}

export async function recordConsent(supabase: any, organizationId: string, clientId: string, kind: ConsentKind) {
  if (await hasActiveConsent(supabase, clientId, kind)) return { success: true };
  const { error } = await supabase.from("client_consents").insert([{
    organization_id: organizationId,
    client_id: clientId,
    kind,
    text_version: CONSENT_VERSION,
  }]);
  if (error) return { success: false, error: "Não foi possível registrar o consentimento." };
  await logOperation(supabase, organizationId, clientId, "consentimento_concedido", { kind, text_version: CONSENT_VERSION });
  return { success: true };
}
