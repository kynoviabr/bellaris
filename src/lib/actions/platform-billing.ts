"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type Result = { success: true } | { success: false; error: string };

const METHODS = ["pix", "boleto", "cartao", "dinheiro", "outro"] as const;
const BILLING_MODES = ["mensalidade", "isento"] as const;
const PLAN_CODES = ["essencial", "profissional", "completo"] as const;

function friendly(message: string): string {
  if (message.includes("Acesso restrito")) return "Esta conta não tem acesso à administração da plataforma.";
  if (message.includes("Este pagamento deve referir-se")) return message.replace(/^.*Este pagamento/, "Este pagamento");
  if (message.includes("Salão sem mensalidade")) return "Este salão não tem mensalidade cadastrada.";
  if (message.includes("Vencimento não definido")) return "Defina o vencimento do salão antes de registrar pagamento.";
  if (message.includes("Plano e dia de vencimento")) return "Escolha o plano e o dia de vencimento.";
  if (message.includes("duplicate key")) return "Já existe pagamento registrado para este mês.";
  return "Não foi possível salvar. Tente novamente.";
}

export async function registerPlatformPayment(input: {
  organizationId: string; referenceMonth: string; amount: number; method: string; paidAt: string; notes?: string;
}): Promise<Result> {
  const supabase = await createClient();
  if (!supabase) return { success: false, error: "Sem conexão com o banco" };
  if (!METHODS.includes(input.method as (typeof METHODS)[number])) return { success: false, error: "Forma de pagamento inválida" };
  if (!(input.amount > 0)) return { success: false, error: "Informe um valor maior que zero" };

  const { error } = await supabase.rpc("platform_register_payment", {
    p_org: input.organizationId,
    p_reference_month: input.referenceMonth,
    p_amount: input.amount,
    p_method: input.method,
    p_paid_at: input.paidAt,
    p_notes: input.notes?.trim() || null,
  });
  if (error) return { success: false, error: friendly(error.message) };
  revalidatePath("/plataforma");
  return { success: true };
}

export async function setPlatformSubscription(input: {
  organizationId: string; billingMode: string; planCode?: string; dueBusinessDay?: number; cancelled: boolean; notes?: string;
}): Promise<Result> {
  const supabase = await createClient();
  if (!supabase) return { success: false, error: "Sem conexão com o banco" };
  if (!BILLING_MODES.includes(input.billingMode as (typeof BILLING_MODES)[number])) return { success: false, error: "Modo de cobrança inválido" };
  if (input.planCode && !PLAN_CODES.includes(input.planCode as (typeof PLAN_CODES)[number])) return { success: false, error: "Plano inválido" };
  if (input.dueBusinessDay !== undefined && (input.dueBusinessDay < 0 || input.dueBusinessDay > 10)) return { success: false, error: "Dia de vencimento inválido" };

  const { error } = await supabase.rpc("platform_set_subscription", {
    p_org: input.organizationId,
    p_billing_mode: input.billingMode,
    p_plan_code: input.planCode ?? null,
    p_due_business_day: input.dueBusinessDay ?? null,
    p_cancelled: input.cancelled,
    p_notes: input.notes?.trim() || null,
  });
  if (error) return { success: false, error: friendly(error.message) };
  revalidatePath("/plataforma");
  return { success: true };
}
