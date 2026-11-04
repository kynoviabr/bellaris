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

// Dono ou administradora vincula uma profissional, por e-mail, ao salão ativo.
// O banco confere permissão, papel da conta e duplicidade. A mensagem de "conta não encontrada"
// é a mesma para conta inexistente e conta que não é de profissional, para não revelar mais que isso.
export async function linkProfessionalByEmail(email: string, name: string, defaultCommission: number): Promise<{ error?: string; professionalId?: string }> {
  const supabase = await createClient();
  if (!supabase) return { error: "Supabase não configurado" };

  const { data, error } = await supabase.rpc("link_professional_by_email", {
    p_email: email,
    p_name: name,
    p_default_commission: defaultCommission,
  });
  if (error) {
    const msg = error.message ?? "";
    if (msg.includes("precisa ter uma conta")) return { error: "Não foi possível vincular. A profissional precisa ter uma conta de profissional no sistema." };
    if (msg.includes("já está vinculada")) return { error: "Esta profissional já está vinculada a este salão." };
    if (msg.includes("Apenas o dono")) return { error: "Apenas o dono ou a administradora do salão pode vincular profissionais." };
    if (msg.includes("Informe o nome")) return { error: "Informe o nome da profissional." };
    if (msg.includes("Comissão inválida")) return { error: "A comissão deve estar entre 0 e 100." };
    if (msg.includes("Não autenticado")) return { error: "Sua sessão expirou. Entre novamente." };
    return { error: "Não foi possível vincular a profissional. Tente novamente." };
  }
  return { professionalId: data as string };
}
