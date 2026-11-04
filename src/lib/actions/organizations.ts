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

export type MyNetwork = { id: string; name: string; billingMode: "per_salon" | "single_invoice" };

// Rede da qual o usuário é dono (a política de leitura da rede só deixa o dono ver).
export async function getMyNetwork(): Promise<{ data?: MyNetwork | null; error?: string }> {
  const supabase = await createClient();
  if (!supabase) return { error: "Supabase não configurado" };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sua sessão expirou. Entre novamente." };

  const { data, error } = await supabase.from("networks").select("id,name,billing_mode").eq("owner_user_id", user.id).maybeSingle();
  if (error) return { error: "Não foi possível carregar a rede." };
  return { data: data ? { id: data.id, name: data.name, billingMode: data.billing_mode as "per_salon" | "single_invoice" } : null };
}

function translateNetworkError(msg: string) {
  if (msg.includes("Apenas o dono")) return "Apenas o dono do salão pode criar a rede.";
  if (msg.includes("Você já tem uma rede")) return "Você já tem uma rede.";
  if (msg.includes("já pertence a uma rede")) return "Este salão já pertence a uma rede.";
  if (msg.includes("Informe o nome da rede")) return "Informe o nome da rede.";
  if (msg.includes("não é dono de uma rede")) return "Você não é dono de uma rede.";
  if (msg.includes("Informe o nome do salão")) return "Informe o nome do salão.";
  if (msg.includes("slug") && msg.includes("inválido")) return "Endereço inválido: use de 3 a 60 letras minúsculas, números ou hífen.";
  if (msg.includes("já está em uso")) return "Este endereço já está em uso. Escolha outro.";
  if (msg.includes("não tem assinatura")) return "O salão de origem não tem assinatura configurada. Fale com a administração.";
  if (msg.includes("Não autenticado")) return "Sua sessão expirou. Entre novamente.";
  return "Não foi possível concluir a operação. Tente novamente.";
}

export async function createNetwork(name: string): Promise<{ error?: string; networkId?: string }> {
  const supabase = await createClient();
  if (!supabase) return { error: "Supabase não configurado" };
  const { data, error } = await supabase.rpc("create_network", { p_name: name });
  if (error) return { error: translateNetworkError(error.message) };
  return { networkId: data as string };
}

export async function createSalonInNetwork(name: string, slug: string): Promise<{ error?: string; organizationId?: string }> {
  const supabase = await createClient();
  if (!supabase) return { error: "Supabase não configurado" };
  const { data, error } = await supabase.rpc("create_salon_in_network", { p_name: name, p_slug: slug });
  if (error) return { error: translateNetworkError(error.message) };
  return { organizationId: data as string };
}

export type NetworkSalonSummary = {
  orgId: string;
  salonName: string;
  revenue: number;
  expensesPaid: number;
  pendingExpenses: number;
  commissionsTotal: number;
  consumptionCost: number;
  balance: number;
  concludedAppointments: number;
};

// Painel da rede: totais por salão, com a mesma regra do Financeiro de cada salão.
// Só o dono da rede recebe; o banco não devolve linhas de clientes nem de atendimentos.
export async function getNetworkFinancialSummary(month: string): Promise<{ data?: NetworkSalonSummary[]; error?: string }> {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return { error: "Escolha um mês válido." };
  const supabase = await createClient();
  if (!supabase) return { error: "Supabase não configurado" };

  const { data, error } = await supabase.rpc("network_financial_summary", { p_month: month });
  if (error) {
    const msg = error.message ?? "";
    if (msg.includes("não é dono de uma rede")) return { error: "Você não é dono de uma rede." };
    if (msg.includes("Não autenticado")) return { error: "Sua sessão expirou. Entre novamente." };
    return { error: "Não foi possível carregar o painel da rede. Tente novamente." };
  }
  return {
    data: (data ?? []).map((r: any) => ({
      orgId: r.org_id,
      salonName: r.salon_name,
      revenue: Number(r.revenue),
      expensesPaid: Number(r.expenses_paid),
      pendingExpenses: Number(r.pending_expenses),
      commissionsTotal: Number(r.commissions_total),
      consumptionCost: Number(r.consumption_cost),
      balance: Number(r.balance),
      concludedAppointments: Number(r.concluded_appointments),
    })),
  };
}

export type LinkableSalon = { organizationId: string; name: string };

// Salões dos quais o dono da rede é dono e que ainda não pertencem a nenhuma rede.
export async function listSalonsToLink(): Promise<{ data?: LinkableSalon[]; error?: string }> {
  const supabase = await createClient();
  if (!supabase) return { error: "Supabase não configurado" };
  const { data, error } = await supabase.rpc("my_salons_available_for_network");
  if (error) return { error: "Não foi possível carregar os salões disponíveis." };
  return { data: (data ?? []).map((row: { organization_id: string; name: string }) => ({ organizationId: row.organization_id, name: row.name })) };
}

// Vincula um salão existente à rede. O banco confere dono da rede, dono do salão e rede já existente.
export async function linkSalonToNetwork(organizationId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  if (!supabase) return { error: "Supabase não configurado" };
  const { error } = await supabase.rpc("link_salon_to_network", { p_organization_id: organizationId });
  if (error) {
    const msg = error.message ?? "";
    if (msg.includes("não é dono de uma rede")) return { error: "Você não é dono de uma rede." };
    if (msg.includes("não é dona deste salão")) return { error: "Você não é dona deste salão." };
    if (msg.includes("já pertence a uma rede")) return { error: "Este salão já pertence a uma rede." };
    if (msg.includes("não encontrado")) return { error: "Salão não encontrado." };
    if (msg.includes("Não autenticado")) return { error: "Sua sessão expirou. Entre novamente." };
    return { error: "Não foi possível vincular o salão. Tente novamente." };
  }
  return {};
}

export type NetworkSalon = { organizationId: string; name: string };

// Salões da rede da qual o usuário é dono.
export async function listNetworkSalons(): Promise<{ data?: NetworkSalon[]; error?: string }> {
  const supabase = await createClient();
  if (!supabase) return { error: "Supabase não configurado" };
  const { data, error } = await supabase.rpc("my_network_salons");
  if (error) return { error: "Não foi possível carregar os salões da rede." };
  return { data: (data ?? []).map((row: { organization_id: string; name: string }) => ({ organizationId: row.organization_id, name: row.name })) };
}

// Remove um salão da rede. O banco confere que o salão pertence à rede do usuário.
export async function unlinkSalonFromNetwork(organizationId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  if (!supabase) return { error: "Supabase não configurado" };
  const { error } = await supabase.rpc("unlink_salon_from_network", { p_organization_id: organizationId });
  if (error) {
    const msg = error.message ?? "";
    if (msg.includes("não é dono de uma rede")) return { error: "Você não é dono de uma rede." };
    if (msg.includes("não faz parte da sua rede")) return { error: "Este salão não faz parte da sua rede." };
    if (msg.includes("Não autenticado")) return { error: "Sua sessão expirou. Entre novamente." };
    return { error: "Não foi possível desvincular o salão. Tente novamente." };
  }
  return {};
}

export type BillingPreviewRow = {
  organizationId: string;
  salonName: string;
  planName: string | null;
  monthlyPrice: number | null;
  discountPercent: number;
  amount: number;
  dueBusinessDay: number | null;
  included: boolean;
};

// Prévia da fatura única da rede do usuário para o mês AAAA-MM. Somente leitura.
export async function getNetworkBillingPreview(month: string): Promise<{ data?: BillingPreviewRow[]; error?: string }> {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return { error: "Mês inválido." };
  const supabase = await createClient();
  if (!supabase) return { error: "Supabase não configurado" };
  const { data, error } = await supabase.rpc("network_billing_preview", { p_month: month });
  if (error) {
    if (error.message.includes("não é dono de uma rede")) return { error: "Você não é dono de uma rede." };
    if (error.message.includes("Não autenticado")) return { error: "Sua sessão expirou. Entre novamente." };
    return { error: "Não foi possível carregar a prévia da fatura." };
  }
  return {
    data: (data ?? []).map((r: { organization_id: string; salon_name: string; plan_name: string | null; monthly_price: string | number | null; discount_percent: string | number; amount: string | number; due_business_day: number | null; included: boolean }) => ({
      organizationId: r.organization_id,
      salonName: r.salon_name,
      planName: r.plan_name,
      monthlyPrice: r.monthly_price === null ? null : Number(r.monthly_price),
      discountPercent: Number(r.discount_percent),
      amount: Number(r.amount),
      dueBusinessDay: r.due_business_day,
      included: r.included,
    })),
  };
}

// Modo de cobrança da rede: por salão ou fatura única. Só o dono da rede. Não altera a assinatura dos salões.
export async function setNetworkBillingMode(mode: "per_salon" | "single_invoice"): Promise<{ error?: string }> {
  const supabase = await createClient();
  if (!supabase) return { error: "Supabase não configurado" };
  const { error } = await supabase.rpc("set_network_billing_mode", { p_mode: mode });
  if (error) {
    if (error.message.includes("não é dono de uma rede")) return { error: "Você não é dono de uma rede." };
    if (error.message.includes("Não autenticado")) return { error: "Sua sessão expirou. Entre novamente." };
    return { error: "Não foi possível salvar o modo de cobrança." };
  }
  return {};
}
