"use server";

import { getCurrentOrganizationId } from "@/lib/auth/current-organization";
import { revalidatePath } from "next/cache";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { OWNER_FIELD_NAMES, validateOwnerData, type OwnerData } from "@/lib/validation/owner-data.ts";

export type PlanOption = {
  code: string;
  name: string;
  monthly_price: number;
  max_professionals: number | null;
  description: string | null;
};

/** Planos ativos, para o cadastro público (sem login). Usa a chave de serviço no servidor. */
export async function getActivePlans(): Promise<PlanOption[]> {
  const admin = await createAdminClient();
  if (!admin) return [];
  const { data } = await admin
    .from("platform_plans")
    .select("code, name, monthly_price, max_professionals, description")
    .eq("active", true)
    .order("monthly_price");
  return (data ?? []) as PlanOption[];
}

function ownerFormFromFormData(formData: FormData): Record<string, string> {
  const raw: Record<string, string> = {};
  for (const key of OWNER_FIELD_NAMES) raw[key] = String(formData.get(key) ?? "");
  return raw;
}

/** Dono envia os dados do salão e escolhe o plano (somente enquanto aguardando_dados). */
export async function submitOwnerOnboarding(_prev: unknown, formData: FormData) {
  const parsed = validateOwnerData(ownerFormFromFormData(formData));
  if ("error" in parsed) return { error: parsed.error };

  const supabase = await createClient();
  if (!supabase) return { error: "Supabase não configurado" };

  const v: OwnerData = parsed.value;
  const { error } = await supabase.rpc("salon_submit_onboarding", {
    p_full_name: v.fullName,
    p_whatsapp: v.whatsapp,
    p_cpf: v.cpf,
    p_cep: v.cep,
    p_logradouro: v.logradouro,
    p_numero: v.numero,
    p_complemento: v.complemento,
    p_bairro: v.bairro,
    p_cidade: v.cidade,
    p_uf: v.uf,
    p_plan_code: v.planCode,
    p_document_type: v.documentType,
    p_cnpj: v.cnpj,
  });

  if (error) return { error: error.message };
  revalidatePath("/");
  return { ok: true as const };
}

/** Estado de liberação do salão para quem está logado num salão. Null para master ou sem salão. */
export async function getOwnerOnboardingState() {
  const supabase = await createClient();
  if (!supabase) return null;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  const organizationId = await getCurrentOrganizationId(supabase);
  if (!profile || !organizationId) return null;
  const isOwner = profile.role === "owner";

  const { data: org } = await supabase
    .from("organizations")
    .select("access_status, access_note, requested_plan_code")
    .eq("id", organizationId)
    .single();

  // Dados do dono só são lidos pelo próprio dono (RLS).
  const { data: owner } = isOwner
    ? await supabase
        .from("organization_owner_data")
        .select("full_name, whatsapp, document_type, cpf, cnpj, cep, logradouro, numero, complemento, bairro, cidade, uf")
        .eq("organization_id", organizationId)
        .maybeSingle()
    : { data: null };

  return {
    isOwner,
    accessStatus: (org?.access_status ?? "ativo") as "aguardando_dados" | "aguardando_aprovacao" | "ativo",
    accessNote: (org?.access_note ?? null) as string | null,
    requestedPlanCode: (org?.requested_plan_code ?? null) as string | null,
    owner,
  };
}
