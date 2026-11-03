"use server";
import { randomBytes } from "node:crypto";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type TeamRole = "admin" | "staff" | "professional";
const ROLE_LABEL: Record<TeamRole, string> = { admin: "Gestor", staff: "Equipe de atendimento", professional: "Profissional" };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Caller = { id: string; organizationId: string; role: "owner" | "admin" };

// Só owner e gestor (admin) criam usuários. Gestor não cria outro gestor nem owner.
async function getCaller(): Promise<{ caller: Caller; supabase: NonNullable<Awaited<ReturnType<typeof createClient>>> } | { error: string }> {
  const supabase = await createClient();
  if (!supabase) return { error: "Sessão indisponível." };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };
  const { data: profile } = await supabase.from("profiles").select("role,organization_id").eq("id", user.id).single();
  if (!profile?.organization_id || !["owner", "admin"].includes(profile.role)) return { error: "Acesso negado." };
  return { caller: { id: user.id, organizationId: profile.organization_id, role: profile.role }, supabase };
}

export async function listTeamUsers() {
  const ctx = await getCaller();
  if ("error" in ctx) return { error: ctx.error, rows: [] };
  const admin = await createAdminClient();
  if (!admin) return { error: "Acesso administrativo indisponível no servidor.", rows: [] };
  const { data: profiles, error } = await admin.from("profiles").select("id,full_name,role,phone")
    .eq("organization_id", ctx.caller.organizationId).neq("role", "platform_master");
  if (error) return { error: "Não foi possível carregar os usuários.", rows: [] };
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const byId = new Map((list?.users ?? []).map(u => [u.id, u]));
  const now = Date.now();
  return {
    error: "",
    rows: (profiles ?? []).map(p => {
      const u = byId.get(p.id);
      const bannedUntil = (u as { banned_until?: string | null } | undefined)?.banned_until;
      const blocked = Boolean(bannedUntil && new Date(bannedUntil).getTime() > now);
      return { id: p.id, name: p.full_name, email: u?.email ?? "", phone: p.phone ?? "", role: p.role as string, blocked };
    }),
  };
}

export async function createTeamUser(input: { name: string; email: string; phone?: string; role: string; siteUrl: string }) {
  const ctx = await getCaller();
  if ("error" in ctx) return { success: false, error: ctx.error };
  const { caller } = ctx;

  const name = input.name?.trim() ?? "";
  const email = input.email?.trim().toLowerCase() ?? "";
  const phone = input.phone?.trim() || null;
  const role = input.role as TeamRole;
  if (name.length < 2 || name.length > 120) return { success: false, error: "Informe o nome." };
  if (!EMAIL_RE.test(email) || email.length > 255) return { success: false, error: "Informe um e-mail válido." };
  if (!["admin", "staff", "professional"].includes(role)) return { success: false, error: "Perfil de acesso inválido." };
  if (role === "admin" && caller.role !== "owner") return { success: false, error: "Só a proprietária pode criar outro gestor." };
  if (!isAllowedSiteUrl(input.siteUrl)) return { success: false, error: "Endereço do sistema inválido." };

  const admin = await createAdminClient();
  if (!admin) return { success: false, error: "Acesso administrativo indisponível no servidor." };

  // Senha aleatória que ninguém conhece: a pessoa define a própria pelo e-mail de redefinição.
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password: randomBytes(24).toString("base64url"),
    email_confirm: true,
    user_metadata: { full_name: name },
  });
  if (createError || !created.user) {
    const msg = (createError?.message ?? "").toLowerCase();
    if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
      const existingId = await findUserIdByEmail(admin, email);
      const { data: existing } = existingId
        ? await admin.from("profiles").select("organization_id").eq("id", existingId).maybeSingle()
        : { data: null };
      if (existing && existing.organization_id === caller.organizationId) return { success: false, error: "Já existe um usuário com este e-mail neste salão." };
      return { success: false, error: "Este e-mail já está em uso. Use outro e-mail." };
    }
    return { success: false, error: "Não foi possível criar o usuário." };
  }
  const userId = created.user.id;

  // Rollback: se qualquer etapa seguinte falha, o usuário criado é removido.
  const rollback = async () => { await admin.auth.admin.deleteUser(userId); };

  const { error: profileError } = await admin.from("profiles").insert({
    id: userId, organization_id: caller.organizationId, full_name: name, role, phone,
  });
  if (profileError) { await rollback(); return { success: false, error: "Não foi possível criar o perfil do usuário." }; }

  if (role === "professional") {
    const { error: proError } = await admin.from("professionals").insert({
      organization_id: caller.organizationId, user_id: userId, name, email, phone, active: true,
    });
    if (proError) {
      await admin.from("profiles").delete().eq("id", userId);
      await rollback();
      return { success: false, error: "Já existe uma profissional com este e-mail neste salão." };
    }
  }

  // E-mail para a pessoa definir a própria senha (fluxo de redefinição já existente).
  const anon = createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { error: mailError } = await anon.auth.resetPasswordForEmail(email, { redirectTo: `${input.siteUrl}/redefinir-senha` });
  revalidatePath("/");
  if (mailError) return { success: true, warning: `Usuário criado, mas o e-mail não foi enviado (${ROLE_LABEL[role]}). Peça à pessoa para usar "Recuperar senha".` };
  return { success: true, message: `Usuário criado como ${ROLE_LABEL[role]}. Um e-mail foi enviado para ela definir a senha.` };
}

// O link de redefinição só pode apontar para os domínios do sistema, nunca para outro site.
function isAllowedSiteUrl(raw: string | undefined): boolean {
  if (!raw) return false;
  let url: URL;
  try { url = new URL(raw); } catch { return false; }
  const host = url.hostname;
  if (host === "localhost" && url.protocol === "http:") return true;
  if (url.protocol !== "https:") return false;
  return host === "gabiludwignails.com.br" || host.endsWith(".gabiludwignails.com.br")
    || host === "bellaris.kynovia.com.br" || host.endsWith("-braidotti.vercel.app");
}

async function findUserIdByEmail(admin: NonNullable<Awaited<ReturnType<typeof createAdminClient>>>, email: string) {
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  return data?.users.find(u => u.email?.toLowerCase() === email)?.id ?? null;
}

// ---- Edição, bloqueio e exclusão ----

type Target = { id: string; role: string; organization_id: string; full_name: string; phone: string | null };

async function loadTarget(admin: NonNullable<Awaited<ReturnType<typeof createAdminClient>>>, caller: Caller, id: string): Promise<{ target: Target } | { error: string }> {
  if (id === caller.id) return { error: "Você não pode alterar o próprio acesso por esta tela." };
  const { data: target } = await admin.from("profiles").select("id,role,organization_id,full_name,phone").eq("id", id).maybeSingle();
  if (!target || target.organization_id !== caller.organizationId) return { error: "Usuário não encontrado neste salão." };
  if (target.role === "owner" || target.role === "platform_master") return { error: "Esta conta não pode ser alterada por aqui." };
  if (target.role === "admin" && caller.role !== "owner") return { error: "Só a proprietária pode alterar um gestor." };
  return { target: target as Target };
}

export async function updateTeamUser(input: { id: string; name: string; email: string; phone?: string; role: string; siteUrl: string }) {
  const ctx = await getCaller();
  if ("error" in ctx) return { success: false, error: ctx.error };
  const { caller } = ctx;
  const admin = await createAdminClient();
  if (!admin) return { success: false, error: "Acesso administrativo indisponível no servidor." };
  const loaded = await loadTarget(admin, caller, input.id);
  if ("error" in loaded) return { success: false, error: loaded.error };

  const name = input.name?.trim() ?? "";
  const email = input.email?.trim().toLowerCase() ?? "";
  const phone = input.phone?.trim() || null;
  const role = input.role as TeamRole;
  if (name.length < 2 || name.length > 120) return { success: false, error: "Informe o nome." };
  if (!EMAIL_RE.test(email) || email.length > 255) return { success: false, error: "Informe um e-mail válido." };
  if (!["admin", "staff", "professional"].includes(role)) return { success: false, error: "Perfil de acesso inválido." };
  if (role === "admin" && caller.role !== "owner") return { success: false, error: "Só a proprietária pode dar o perfil de gestor." };

  const { data: authData } = await admin.auth.admin.getUserById(input.id);
  const currentEmail = (authData?.user?.email ?? "").toLowerCase();
  const emailChanged = email !== currentEmail;
  if (emailChanged) {
    const used = await findUserIdByEmail(admin, email);
    if (used) return { success: false, error: "Este e-mail já está em uso. Use outro." };
    const { error: mailErr } = await admin.auth.admin.updateUserById(input.id, { email, email_confirm: true });
    if (mailErr) return { success: false, error: "Não foi possível trocar o e-mail." };
  }

  const { error: profileErr } = await admin.from("profiles").update({ full_name: name, phone, role }).eq("id", input.id);
  if (profileErr) return { success: false, error: "Não foi possível salvar o perfil." };

  const { data: pro } = await admin.from("professionals").select("id").eq("user_id", input.id).maybeSingle();
  if (role === "professional") {
    if (pro) {
      await admin.from("professionals").update({ name, email, phone, active: true }).eq("id", pro.id);
    } else {
      const { error: insErr } = await admin.from("professionals").insert({ organization_id: caller.organizationId, user_id: input.id, name, email, phone, active: true });
      if (insErr) return { success: false, error: "Já existe uma profissional com este e-mail neste salão." };
    }
  } else if (pro) {
    // Saiu do perfil profissional: mantém o cadastro (histórico) e apenas inativa.
    await admin.from("professionals").update({ name, email, phone, active: false }).eq("id", pro.id);
  }

  if (emailChanged) {
    // Quem recebe o novo e-mail precisa definir a senha por ele, o que confirma a posse do endereço.
    const anon = createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    if (isAllowedSiteUrl(input.siteUrl)) await anon.auth.resetPasswordForEmail(email, { redirectTo: `${input.siteUrl}/redefinir-senha` });
  }
  revalidatePath("/");
  return { success: true, message: emailChanged ? "Usuário atualizado. Um e-mail foi enviado para o novo endereço." : "Usuário atualizado." };
}

export async function setTeamUserBlocked(id: string, blocked: boolean) {
  const ctx = await getCaller();
  if ("error" in ctx) return { success: false, error: ctx.error };
  const { caller } = ctx;
  const admin = await createAdminClient();
  if (!admin) return { success: false, error: "Acesso administrativo indisponível no servidor." };
  const loaded = await loadTarget(admin, caller, id);
  if ("error" in loaded) return { success: false, error: loaded.error };

  // Bloqueio impede novos logins e renovação de sessão; a sessão atual expira em até 1 hora.
  const { error } = await admin.auth.admin.updateUserById(id, { ban_duration: blocked ? "876000h" : "none" });
  if (error) return { success: false, error: "Não foi possível alterar o acesso." };
  await admin.from("professionals").update({ active: !blocked }).eq("user_id", id);
  revalidatePath("/");
  return { success: true, message: blocked ? "Acesso bloqueado." : "Acesso reativado." };
}

export async function deleteTeamUser(id: string) {
  const ctx = await getCaller();
  if ("error" in ctx) return { success: false, error: ctx.error };
  const { caller } = ctx;
  const admin = await createAdminClient();
  if (!admin) return { success: false, error: "Acesso administrativo indisponível no servidor." };
  const loaded = await loadTarget(admin, caller, id);
  if ("error" in loaded) return { success: false, error: loaded.error };

  const blockMsg = "Esta pessoa tem histórico no sistema. Use Bloquear em vez de excluir.";
  const { data: pro } = await admin.from("professionals").select("id").eq("user_id", id).maybeSingle();
  if (pro) {
    const [appts, items, comms] = await Promise.all([
      admin.from("appointments").select("id", { count: "exact", head: true }).eq("professional_id", pro.id),
      admin.from("appointment_items").select("id", { count: "exact", head: true }).eq("professional_id", pro.id),
      admin.from("commissions").select("id", { count: "exact", head: true }).eq("professional_id", pro.id),
    ]);
    if ((appts.count ?? 0) + (items.count ?? 0) + (comms.count ?? 0) > 0) return { success: false, error: blockMsg };
    await admin.from("clients").update({ preferred_professional_id: null }).eq("preferred_professional_id", pro.id);
    await admin.from("professional_services").delete().eq("professional_id", pro.id);
    await admin.from("professional_availability").delete().eq("professional_id", pro.id);
    const { error: proDelErr } = await admin.from("professionals").delete().eq("id", pro.id);
    if (proDelErr) return { success: false, error: blockMsg };
  }

  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) return { success: false, error: blockMsg };
  revalidatePath("/");
  return { success: true, message: "Usuário excluído." };
}
