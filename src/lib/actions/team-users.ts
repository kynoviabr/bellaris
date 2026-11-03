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
  const emails = new Map((list?.users ?? []).map(u => [u.id, u.email ?? ""]));
  return {
    error: "",
    rows: (profiles ?? []).map(p => ({ id: p.id, name: p.full_name, email: emails.get(p.id) ?? "", phone: p.phone ?? "", role: p.role as string })),
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
