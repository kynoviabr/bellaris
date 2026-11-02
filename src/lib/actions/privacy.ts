"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { CONSENT_KINDS, CONSENT_VERSION, type ConsentKind } from "@/lib/privacy/consent";
import { hasActiveConsent, logOperation, recordConsent } from "@/lib/services/consent.service.ts";
import { deleteClientPhotoService } from "@/lib/services/photos.service.ts";

// A organização vem da própria cliente, lida com as regras de acesso do banco.
async function clientContext(clientId: string) {
  const supabase = await createClient();
  if (!supabase) return { error: "Banco de dados indisponível." } as const;
  const { data: client, error } = await supabase
    .from("clients")
    .select("organization_id")
    .eq("id", clientId)
    .maybeSingle();
  if (error || !client?.organization_id) return { error: "Cliente não encontrada ou sem acesso." } as const;
  return { supabase, organizationId: client.organization_id as string };
}

function isKind(value: unknown): value is ConsentKind {
  return CONSENT_KINDS.includes(value as ConsentKind);
}

export async function getClientPrivacyStatus(clientId: string) {
  const ctx = await clientContext(clientId);
  if ("error" in ctx) return { error: ctx.error };
  const { supabase } = ctx;
  const [anamnesis, photos, consentAnamnesis, consentPhotos] = await Promise.all([
    supabase.from("client_anamnesis").select("client_id").eq("client_id", clientId).limit(1),
    supabase.from("client_photos").select("id").eq("client_id", clientId).limit(1),
    hasActiveConsent(supabase, clientId, "anamnesis"),
    hasActiveConsent(supabase, clientId, "photos"),
  ]);
  return {
    hasAnamnesis: Boolean(anamnesis.data && anamnesis.data.length > 0),
    hasPhotos: Boolean(photos.data && photos.data.length > 0),
    consentAnamnesis,
    consentPhotos,
    textVersion: CONSENT_VERSION,
  };
}

export async function grantClientConsent(clientId: string, kind: string) {
  if (!isKind(kind)) return { success: false, error: "Tipo de consentimento inválido." };
  const ctx = await clientContext(clientId);
  if ("error" in ctx) return { success: false, error: ctx.error };
  const res = await recordConsent(ctx.supabase, ctx.organizationId, clientId, kind);
  if (res.success) revalidatePath("/");
  return res;
}

// Retirar o consentimento para o tratamento e apagar o dado sensível correspondente.
export async function revokeClientConsent(clientId: string, kind: string) {
  if (!isKind(kind)) return { success: false, error: "Tipo de consentimento inválido." };
  const ctx = await clientContext(clientId);
  if ("error" in ctx) return { success: false, error: ctx.error };
  const { supabase, organizationId } = ctx;

  const { error: revokeError } = await supabase
    .from("client_consents")
    .update({ revoked_at: new Date().toISOString() })
    .eq("client_id", clientId)
    .eq("kind", kind)
    .is("revoked_at", null);
  if (revokeError) return { success: false, error: "Não foi possível retirar o consentimento." };

  if (kind === "anamnesis") {
    const { error: anamnesisError } = await supabase.from("client_anamnesis").delete().eq("client_id", clientId);
    if (anamnesisError) return { success: false, error: "Consentimento retirado, mas não foi possível apagar a anamnese." };

    // A anamnese também fica guardada no campo de observações, em JSON. Remove só essa parte.
    const { data: client } = await supabase.from("clients").select("notes").eq("id", clientId).single();
    if (client?.notes && client.notes.startsWith("{")) {
      try {
        const parsed = JSON.parse(client.notes);
        const text = parsed.text || null;
        await supabase.from("clients").update({ notes: text }).eq("id", clientId);
      } catch {
        // Observações que não são JSON não contêm anamnese.
      }
    }
  }

  if (kind === "photos") {
    const { data: photos } = await supabase.from("client_photos").select("id").eq("client_id", clientId);
    for (const photo of photos ?? []) {
      const res = await deleteClientPhotoService(supabase, photo.id);
      if (!res.success) return { success: false, error: "Consentimento retirado, mas não foi possível apagar todas as fotos." };
    }
  }

  await logOperation(supabase, organizationId, clientId, "consentimento_retirado", { kind });
  revalidatePath("/");
  return { success: true };
}

// Exporta, em JSON, tudo o que o sistema guarda sobre a cliente.
export async function exportClientData(clientId: string) {
  const ctx = await clientContext(clientId);
  if ("error" in ctx) return { success: false, error: ctx.error };
  const { supabase, organizationId } = ctx;

  const [client, anamnesis, consents, photos, appointments] = await Promise.all([
    supabase.from("clients").select("*").eq("id", clientId).single(),
    supabase.from("client_anamnesis").select("*").eq("client_id", clientId),
    supabase.from("client_consents").select("kind, text_version, granted_at, revoked_at").eq("client_id", clientId),
    supabase.from("client_photos").select("kind, created_at, storage_path").eq("client_id", clientId),
    supabase.from("appointments").select("id, starts_at, ends_at, status, notes").eq("client_id", clientId),
  ]);

  if (!client.data) return { success: false, error: "Cliente não encontrada." };

  await logOperation(supabase, organizationId, clientId, "exportacao_dados_cliente", {});

  return {
    success: true,
    data: {
      gerado_em: new Date().toISOString(),
      cliente: client.data,
      anamnese: anamnesis.data ?? [],
      consentimentos: consents.data ?? [],
      fotos: photos.data ?? [],
      atendimentos: appointments.data ?? [],
    },
  };
}

// Exclusão: apaga anamnese e fotos e anonimiza o cadastro, mantendo os registros financeiros sem identificação.
export async function anonymizeClientData(clientId: string) {
  const ctx = await clientContext(clientId);
  if ("error" in ctx) return { success: false, error: ctx.error };
  const { supabase, organizationId } = ctx;

  const { data: photos } = await supabase.from("client_photos").select("id").eq("client_id", clientId);
  for (const photo of photos ?? []) {
    const res = await deleteClientPhotoService(supabase, photo.id);
    if (!res.success) return { success: false, error: "Não foi possível apagar todas as fotos. Nada foi anonimizado." };
  }

  for (const kind of CONSENT_KINDS) {
    await supabase
      .from("client_consents")
      .update({ revoked_at: new Date().toISOString() })
      .eq("client_id", clientId)
      .eq("kind", kind)
      .is("revoked_at", null);
  }

  await supabase.from("client_anamnesis").delete().eq("client_id", clientId);

  const { error } = await supabase
    .from("clients")
    .update({
      name: "Cliente excluída",
      phone: "excluida",
      phone_normalized: `excluida-${clientId}`,
      birth_date: null,
      email: null,
      instagram: null,
      notes: null,
      preferences: {},
      marketing_consent: false,
      status: "archived",
    })
    .eq("id", clientId);
  if (error) return { success: false, error: "Não foi possível anonimizar o cadastro." };

  await logOperation(supabase, organizationId, clientId, "exclusao_dados_cliente", {});
  revalidatePath("/");
  return { success: true };
}
