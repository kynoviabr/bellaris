"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { validateOwnerPersonal } from "@/lib/validation/owner-data.ts";

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "");

/** Master aprova o salão: define plano e dia de vencimento. Libera o acesso do dono. */
export async function approveSalon(_prev: unknown, formData: FormData) {
  const org = str(formData, "organizationId");
  const plan = str(formData, "planCode");
  const due = Number(str(formData, "dueBusinessDay"));
  if (!org || !plan) return { error: "Escolha o plano." };
  if (!Number.isInteger(due) || due < 0 || due > 10) return { error: "Escolha o dia de vencimento." };

  const supabase = await createClient();
  if (!supabase) return { error: "Supabase não configurado" };

  const { error } = await supabase.rpc("platform_approve_salon", { p_org: org, p_plan_code: plan, p_due_business_day: due });
  if (error) return { error: error.message };
  revalidatePath("/plataforma");
  return { ok: true as const };
}

/** Master recusa o cadastro com motivo. O dono volta ao formulário para corrigir. */
export async function rejectSalon(_prev: unknown, formData: FormData) {
  const org = str(formData, "organizationId");
  const note = str(formData, "note").trim();
  if (!org) return { error: "Salão não informado." };
  if (!note) return { error: "Informe o motivo da recusa." };

  const supabase = await createClient();
  if (!supabase) return { error: "Supabase não configurado" };

  const { error } = await supabase.rpc("platform_reject_salon", { p_org: org, p_note: note });
  if (error) return { error: error.message };
  revalidatePath("/plataforma");
  return { ok: true as const };
}

/** Master cria ou corrige os dados do responsável (não altera o nome do salão). */
export async function updateSalonOwner(_prev: unknown, formData: FormData) {
  const org = str(formData, "organizationId");
  if (!org) return { error: "Salão não informado." };

  const fields: Record<string, string> = {};
  for (const key of ["fullName", "whatsapp", "cpf", "cep", "logradouro", "numero", "complemento", "bairro", "cidade", "uf"]) {
    fields[key] = str(formData, key);
  }
  const parsed = validateOwnerPersonal(fields);
  if ("error" in parsed) return { error: parsed.error };
  const v = parsed.value;

  const supabase = await createClient();
  if (!supabase) return { error: "Supabase não configurado" };

  const { error } = await supabase.rpc("platform_update_owner_data", {
    p_org: org,
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
  });
  if (error) return { error: error.message };
  revalidatePath("/plataforma");
  return { ok: true as const };
}

/** Master corrige o nome do salão. Só é possível enquanto o cadastro aguarda aprovação. */
export async function updateSalonName(_prev: unknown, formData: FormData) {
  const org = str(formData, "organizationId");
  const name = str(formData, "salonName").trim();
  if (!org) return { error: "Salão não informado." };
  if (name.length < 3) return { error: "Informe um nome com pelo menos 3 caracteres." };

  const supabase = await createClient();
  if (!supabase) return { error: "Supabase não configurado" };

  const { error } = await supabase.rpc("platform_update_salon_name", { p_org: org, p_name: name });
  if (error) return { error: error.message };
  revalidatePath("/plataforma");
  return { ok: true as const };
}
