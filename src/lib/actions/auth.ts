"use server";

import { createAdminClient, createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { validateOwnerData } from "@/lib/validation/owner-data.ts";

export async function login(prevState: any, formData: FormData) {
  const email = (formData.get("email") as string)?.trim();
  const password = formData.get("password") as string;
  
  const supabase = await createClient();
  if (!supabase) {
    return { error: "Supabase não configurado" };
  }

  let { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    // If login failed, check if the account is unconfirmed in Supabase and confirm it automatically
    try {
      const { createAdminClient } = await import("@/lib/supabase/server");
      const adminClient = await createAdminClient();
      if (adminClient) {
        const { data: usersData } = await adminClient.auth.admin.listUsers();
        const existingUser = usersData?.users?.find(
          (u) => u.email?.toLowerCase() === email?.toLowerCase()
        );
        if (existingUser && !existingUser.email_confirmed_at) {
          await adminClient.auth.admin.updateUserById(existingUser.id, { email_confirm: true });
          const retry = await supabase.auth.signInWithPassword({ email, password });
          error = retry.error;
        }
      }
    } catch {
      // Ignore fallback errors and return standard user message
    }
  }

  if (error) {
    // Conta bloqueada pela gestão (ban no Supabase): mensagem específica.
    const code = (error as { code?: string }).code;
    if (code === "user_banned" || /banned/i.test(error.message ?? "")) {
      return { error: "Acesso bloqueado. Fale com a gestão do salão." };
    }
    return { error: "Credenciais inválidas. Verifique seu e-mail e senha." };
  }

  redirect("/");
}

export async function logout() {
  const supabase = await createClient();
  if (supabase) {
    await supabase.auth.signOut();
  }
  redirect("/login");
}

export async function register(prevState: any, formData: FormData) {
  const email = (formData.get("email") as string)?.trim();
  const password = formData.get("password") as string;
  const fullName = (formData.get("fullName") as string)?.trim();
  const orgName = (formData.get("orgName") as string)?.trim();
  
  if (!email || !password || !fullName || !orgName) {
    return { error: "Preencha todos os campos." };
  }

  // Dados do responsável e do plano são obrigatórios e validados antes de criar qualquer conta.
  const ownerInput = Object.fromEntries(
    ["whatsapp", "documentType", "cpf", "cnpj", "cep", "logradouro", "numero", "complemento", "bairro", "cidade", "uf", "planCode"]
      .map((key) => [key, String(formData.get(key) ?? "")])
  ) as Record<string, string>;
  const ownerParsed = validateOwnerData({ ...ownerInput, fullName });
  if ("error" in ownerParsed) return { error: ownerParsed.error };
  const owner = ownerParsed.value;

  const supabase = await createClient();
  if (!supabase) return { error: "Supabase não configurado" };

  const planAdmin = await createAdminClient();
  if (!planAdmin) return { error: "Serviço indisponível. Tente novamente." };
  const { data: plan } = await planAdmin
    .from("platform_plans")
    .select("code")
    .eq("code", owner.planCode)
    .eq("active", true)
    .maybeSingle();
  if (!plan) return { error: "Escolha um plano válido." };

  // 1. Create the user using standard client
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      }
    }
  });

  if (authError) {
    return { error: "Erro ao criar conta: " + authError.message };
  }

  const user = authData.user;
  if (!user) {
    return { error: "Não foi possível criar o usuário." };
  }

  // 2. We use admin client to set up Org and Profile bypassing RLS, and confirm user email
  const adminClient = await createAdminClient();
  
  if (adminClient) {
    // Auto-confirm user email so login works immediately without requiring email confirmation link
    await adminClient.auth.admin.updateUserById(user.id, { email_confirm: true });

    // Identificador público do salão (usado no link de agendamento). Se já existir, acrescenta um número.
    const baseSlug = orgName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') || 'salao';
    let slug = baseSlug;
    for (let i = 2; i < 100; i++) {
      const { data: taken } = await adminClient.from('organizations').select('id').eq('slug', slug).maybeSingle();
      if (!taken) break;
      slug = `${baseSlug}-${i}`;
    }

    // Create new organization. Nasce aguardando a aprovação do master, com os dados do dono já preenchidos.
    const { data: org } = await adminClient.from('organizations').insert([{
      name: orgName,
      slug,
      timezone: 'America/Sao_Paulo',
      access_status: 'aguardando_aprovacao',
      requested_plan_code: owner.planCode,
    }]).select('id').single();

    if (org?.id) {
      const { error: ownerError } = await adminClient.from('organization_owner_data').insert([{
        organization_id: org.id,
        full_name: owner.fullName,
        whatsapp: owner.whatsapp,
        document_type: owner.documentType,
        cpf: owner.cpf,
        cnpj: owner.cnpj,
        cep: owner.cep,
        logradouro: owner.logradouro,
        numero: owner.numero,
        complemento: owner.complemento,
        bairro: owner.bairro,
        cidade: owner.cidade,
        uf: owner.uf,
        // updated_by referencia profiles, que só é criado logo depois. Na criação inicial fica nulo.
        updated_by: null,
      }]);
      if (ownerError) {
        return { error: "Não foi possível salvar os dados do responsável. Tente novamente." };
      }

      // Check if profile exists (from trigger)
      const { data: existingProfile } = await adminClient.from('profiles').select('id').eq('id', user.id).single();
      
      if (existingProfile) {
        // Update
        await adminClient.from('profiles').update({
          organization_id: org.id,
          full_name: fullName,
          role: 'owner'
        }).eq('id', user.id);
      } else {
        // Insert
        await adminClient.from('profiles').insert([{
          id: user.id,
          organization_id: org.id,
          full_name: fullName,
          role: 'owner'
        }]);
      }
    }
  }

  redirect("/");
}
