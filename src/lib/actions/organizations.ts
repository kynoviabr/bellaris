"use server";

import { createClient } from "@/lib/supabase/server";

function translateError(msg: string) {
  if (msg.includes("não tem acesso")) return "Você não tem acesso a este salão.";
  if (msg.includes("Não autenticado")) return "Sua sessão expirou. Entre novamente.";
  return "Não foi possível concluir a operação. Tente novamente.";
}

export type MyOrganization = { organizationId: string; name: string; slug: string; isActive: boolean };

// Lista os salões em que o usuário autenticado tem vínculo ativo.
export async function listMyOrganizations(): Promise<{ data?: MyOrganization[]; error?: string }> {
  const supabase = await createClient();
  if (!supabase) return { error: "Supabase não configurado" };

  const { data, error } = await supabase.rpc("my_organizations");
  if (error) return { error: translateError(error.message) };

  return {
    data: (data ?? []).map((row: { organization_id: string; name: string; slug: string; is_active: boolean }) => ({
      organizationId: row.organization_id,
      name: row.name,
      slug: row.slug,
      isActive: row.is_active,
    })),
  };
}

// Troca o salão ativo. O banco confere o vínculo; a interface recarrega para não manter dados do salão anterior.
export async function switchActiveOrganization(organizationId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  if (!supabase) return { error: "Supabase não configurado" };

  const { error } = await supabase.rpc("switch_active_organization", { p_organization_id: organizationId });
  if (error) return { error: translateError(error.message) };

  return {};
}
