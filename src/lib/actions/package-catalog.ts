"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentOrganizationId, getCurrentProfile } from "@/lib/auth/current-organization";
import { revalidatePath } from "next/cache";

export type PackageTemplateInput = {
  name: string;
  price: number;
  validityDays?: number | null;
  items: { serviceId: string; sessions: number }[];
};

function validatePackageInput(name: string | undefined, input: PackageTemplateInput, items: { serviceId: string; sessions: number }[]): string | null {
  if (!name) return "Informe o nome do pacote.";
  if (name.length > 120) return "O nome do pacote pode ter no máximo 120 caracteres.";
  if (!Number.isFinite(input.price) || input.price <= 0) return "Informe um preço de venda maior que zero.";
  if (input.validityDays != null && (!Number.isInteger(input.validityDays) || input.validityDays < 1)) return "A validade precisa ser um número inteiro de dias, maior que zero. Deixe em branco se o pacote não tiver validade.";
  if (!items.length) return "Adicione pelo menos um serviço ao pacote.";
  if (items.some(i => !i.serviceId)) return "Selecione o serviço em todas as linhas ou remova as linhas vazias.";
  if (items.some(i => !Number.isInteger(i.sessions) || i.sessions < 1 || i.sessions > 1000)) return "Informe de 1 a 1000 sessões em cada serviço.";
  if (new Set(items.map(i => i.serviceId)).size !== items.length) return "Remova os serviços repetidos do pacote.";
  return null;
}

export async function getPackageTemplates() {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return [];
  const orgId = await getCurrentOrganizationId(supabase);
  if (!orgId) return [];
  const { data, error } = await supabase.from("package_templates")
    .select("id,name,price,validity_days,active,package_template_items(service_id,sessions)")
    .eq("organization_id", orgId).order("name");
  if (error) {
    console.error("getPackageTemplates", error.code);
    return [];
  }
  return data ?? [];
}

export async function createPackageTemplate(input: PackageTemplateInput) {
  const supabase = await createClient();
  if (!supabase) return { success: false, error: "Sem conexão." };
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { success: false, error: "Sessão expirada." };
  const profile = await getCurrentProfile(supabase);
  if (!profile?.organizationId) return { success: false, error: "Organização não encontrada." };
  if (!["admin", "owner", "manager"].includes(profile.role ?? "")) return { success: false, error: "Sem permissão para cadastrar pacotes." };
  const name = input.name?.trim();
  const items = input.items ?? [];
  const validationError = validatePackageInput(name, input, items);
  if (validationError) return { success: false, error: validationError };
  const ids = items.map(i => i.serviceId);
  const { data: services, error: serviceError } = await supabase.from("services")
    .select("id").eq("organization_id", profile.organizationId).eq("active", true).in("id", ids);
  if (serviceError || services?.length !== ids.length) return { success: false, error: "Selecione somente serviços ativos deste salão." };
  const { data: template, error } = await supabase.from("package_templates").insert({
    organization_id: profile.organizationId, name, price: input.price,
    validity_days: input.validityDays ?? null, active: false
  }).select("id").single();
  if (error || !template) return { success: false, error: "Não foi possível criar o pacote." };
  const { error: itemError } = await supabase.from("package_template_items").insert(items.map(i => ({
    organization_id: profile.organizationId, template_id: template.id,
    service_id: i.serviceId, sessions: i.sessions
  })));
  if (itemError) {
    // The draft remains inactive and cannot be sold. Never publish an incomplete package.
    return { success: false, error: "Não foi possível associar os serviços. O pacote permaneceu inativo." };
  }
  const { error: activateError } = await supabase.from("package_templates")
    .update({ active: true }).eq("id", template.id).eq("organization_id", profile.organizationId);
  if (activateError) return { success: false, error: "Pacote criado, mas ainda não foi ativado." };
  revalidatePath("/");
  return { success: true, id: template.id };
}

export async function setPackageTemplateActive(id: string, active: boolean) {
  const supabase = await createClient();
  if (!supabase) return { success: false, error: "Sem conexão." };
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { success: false, error: "Sessão expirada." };
  const profile = await getCurrentProfile(supabase);
  if (!profile?.organizationId || !["admin", "owner", "manager"].includes(profile.role ?? "")) return { success: false, error: "Sem permissão." };
  const { error } = await supabase.from("package_templates").update({ active })
    .eq("id", id).eq("organization_id", profile.organizationId);
  if (error) return { success: false, error: "Não foi possível atualizar o pacote." };
  revalidatePath("/");
  return { success: true };
}

export async function updatePackageTemplate(id: string, input: PackageTemplateInput) {
  const supabase = await createClient();
  if (!supabase) return { success: false, error: "Sem conexão." };
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { success: false, error: "Sessão expirada." };
  const profile = await getCurrentProfile(supabase);
  if (!profile?.organizationId) return { success: false, error: "Organização não encontrada." };
  if (!["admin", "owner", "manager"].includes(profile.role ?? "")) return { success: false, error: "Sem permissão para editar pacotes." };
  const orgId = profile.organizationId;
  const name = input.name?.trim();
  const items = input.items ?? [];
  const validationError = validatePackageInput(name, input, items);
  if (validationError) return { success: false, error: validationError };
  const ids = items.map(i => i.serviceId);
  const { data: services, error: serviceError } = await supabase.from("services")
    .select("id").eq("organization_id", orgId).eq("active", true).in("id", ids);
  if (serviceError || services?.length !== ids.length) return { success: false, error: "Selecione somente serviços ativos deste salão." };
  const { data: existing } = await supabase.from("package_templates").select("id")
    .eq("id", id).eq("organization_id", orgId).maybeSingle();
  if (!existing) return { success: false, error: "Pacote não encontrado." };
  // Snapshot dos serviços atuais: se a gravação nova falhar, eles são restaurados.
  const { data: previousItems, error: snapshotError } = await supabase.from("package_template_items")
    .select("service_id, sessions").eq("template_id", id).eq("organization_id", orgId);
  if (snapshotError || !previousItems) return { success: false, error: "Não foi possível ler os serviços atuais do pacote. Nada foi alterado." };
  const newRows = items.map(i => ({ organization_id: orgId, template_id: id, service_id: i.serviceId, sessions: i.sessions }));
  const restoreItems = async () => {
    await supabase.from("package_template_items").delete().eq("template_id", id).eq("organization_id", orgId);
    if (previousItems.length === 0) return null;
    const { error } = await supabase.from("package_template_items").insert(previousItems.map(p => ({
      organization_id: orgId, template_id: id, service_id: p.service_id, sessions: p.sessions
    })));
    return error;
  };
  const { error: deleteError } = await supabase.from("package_template_items").delete()
    .eq("template_id", id).eq("organization_id", orgId);
  const { error: itemError } = deleteError ? { error: deleteError } : await supabase.from("package_template_items").insert(newRows);
  if (itemError) {
    // Restaura os serviços anteriores. O pacote só é desativado se nem a restauração funcionar.
    const restoreError = await restoreItems();
    if (restoreError) {
      await supabase.from("package_templates").update({ active: false }).eq("id", id).eq("organization_id", orgId);
      return { success: false, error: "Não foi possível salvar os serviços e a restauração falhou. O pacote foi desativado; confira e ative de novo." };
    }
    return { success: false, error: "Não foi possível salvar os serviços. Nenhuma alteração foi aplicada ao pacote." };
  }
  const { error: updateError } = await supabase.from("package_templates").update({
    name, price: input.price, validity_days: input.validityDays ?? null
  }).eq("id", id).eq("organization_id", orgId);
  if (updateError) {
    await restoreItems();
    return { success: false, error: "Não foi possível atualizar o pacote. Nenhuma alteração foi aplicada." };
  }
  revalidatePath("/");
  return { success: true, id };
}

export async function deletePackageTemplate(id: string) {
  const supabase = await createClient();
  if (!supabase) return { success: false, error: "Sem conexão." };
  const { error } = await supabase.rpc("delete_package_template", { p_template_id: id });
  if (error) return { success: false, error: error.message };
  revalidatePath("/");
  return { success: true };
}

export async function checkPackageTemplateDeletable(id: string) {
  const supabase = await createClient();
  if (!supabase) return { success: false as const, error: "Sem conexão." };
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { success: false as const, error: "Sessão expirada." };
  const orgId = await getCurrentOrganizationId(supabase);
  if (!orgId) return { success: false as const, error: "Organização não encontrada." };
  const { data: template } = await supabase.from("package_templates").select("name")
    .eq("id", id).eq("organization_id", orgId).maybeSingle();
  if (!template) return { success: false as const, error: "Pacote não encontrado." };
  const { count, error } = await supabase.from("packages").select("id", { count: "exact", head: true })
    .eq("organization_id", orgId).eq("name", template.name);
  if (error) return { success: false as const, error: "Não foi possível verificar o pacote." };
  return { success: true as const, deletable: (count ?? 0) === 0, name: template.name };
}
