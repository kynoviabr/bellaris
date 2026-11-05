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

  // Validate the payment destination before creating an account.
  const checkoutLinks: Record<string, string | undefined> = {
    essencial: process.env.CAKTO_CHECKOUT_ESSENCIAL_URL,
    profissional: process.env.CAKTO_CHECKOUT_PROFISSIONAL_URL,
    completo: process.env.CAKTO_CHECKOUT_COMPLETO_URL,
  };
  const configuredCheckout = checkoutLinks[owner.planCode];
  if (!configuredCheckout) return { error: "Checkout indisponível para este plano. Tente novamente mais tarde." };
  let checkoutBase: URL;
  try {
    checkoutBase = new URL(configuredCheckout);
    if (checkoutBase.protocol !== "https:" || checkoutBase.hostname !== "pay.cakto.com.br"
      || checkoutBase.username || checkoutBase.password) throw new Error("Invalid checkout");
  } catch {
    return { error: "Checkout não configurado corretamente. Contate o suporte." };
  }
  const { data: mappedOffers, error: mappedOfferError } = await planAdmin.from("cakto_plan_offers")
    .select("offer_id").eq("plan_code", owner.planCode).eq("active", true).limit(2);
  if (mappedOfferError || !mappedOffers || mappedOffers.length !== 1) {
    return { error: "Oferta de pagamento indisponível para o plano escolhido." };
  }

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
  // Supabase can return an obfuscated user with no identities for an already registered email.
  // Never create an orphan salon for that response.
  if (!user.identities?.length) {
    return { error: "Este e-mail já está cadastrado. Entre com sua conta ou procure o suporte para concluir o pagamento." };
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

    if (!org?.id) return { error: "Não foi possível registrar o salão. Contate o suporte." };
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
        const { error: profileUpdateError } = await adminClient.from('profiles').update({
          organization_id: org.id,
          full_name: fullName,
          role: 'owner'
        }).eq('id', user.id);
        if (profileUpdateError) return { error: "Conta criada, mas não foi possível vincular o proprietário ao salão. Contate o suporte." };
      } else {
        // Insert
        const { error: profileInsertError } = await adminClient.from('profiles').insert([{
          id: user.id,
          organization_id: org.id,
          full_name: fullName,
          role: 'owner'
        }]);
        if (profileInsertError) return { error: "Conta criada, mas não foi possível vincular o proprietário ao salão. Contate o suporte." };
      }
    }
  } else {
    return { error: "Serviço indisponível para concluir o cadastro. Contate o suporte." };
  }

  // No payment is accepted as proof of activation: the verified webhook is authoritative.
  // Create the correlation intent only after the salon and owner profile exist.
  const { data: registeredOrg, error: registeredOrgError } = await planAdmin.from("profiles")
    .select("organization_id").eq("id", user.id).maybeSingle();
  if (registeredOrgError || !registeredOrg?.organization_id) {
    return { error: "Conta criada, mas não foi possível preparar o pagamento. Entre em contato com o suporte antes de tentar novo cadastro." };
  }
  const { data: checkoutIntent, error: checkoutError } = await planAdmin.from("cakto_checkout_intents")
    .insert({ organization_id: registeredOrg.organization_id, plan_code: owner.planCode, offer_id: mappedOffers[0].offer_id })
    .select("id").single();
  if (checkoutError || !checkoutIntent) {
    return { error: "Conta criada, mas o checkout não pôde ser iniciado. Entre em contato com o suporte antes de tentar novo cadastro." };
  }
  // Cakto-supported prefill parameters. Keep them only in the HTTPS checkout redirect;
  // never store the resulting URL or include the password.
  checkoutBase.searchParams.set("name", owner.fullName);
  checkoutBase.searchParams.set("email", email);
  checkoutBase.searchParams.set("confirmEmail", email);
  // A Cakto preenche CPF e CNPJ pelo parâmetro document (testado com CPF com zero à esquerda e com CNPJ).
  checkoutBase.searchParams.set("document", owner.documentType === "cnpj" ? owner.cnpj! : owner.cpf!);
  const phoneDigits = owner.whatsapp.replace(/\D/g, "");
  checkoutBase.searchParams.set("phone", phoneDigits.startsWith("55") && phoneDigits.length >= 12
    ? phoneDigits : `55${phoneDigits}`);
  checkoutBase.searchParams.set("utm_source", "klycx");
  checkoutBase.searchParams.set("utm_medium", "saas_checkout");
  checkoutBase.searchParams.set("utm_content", checkoutIntent.id);
  // Devolve o endereço para a tela abrir: redirect() para outro domínio não chega ao navegador de forma confiável.
  return { checkoutUrl: checkoutBase.toString() };
}
