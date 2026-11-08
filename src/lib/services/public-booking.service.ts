import type { SupabaseClient } from "@supabase/supabase-js";

/** Situações da assinatura que impedem o agendamento online. */
const BOOKING_BLOCKED_BILLING = ["somente_leitura", "cancelada", "sem_plano"];

export async function getOrgBySlug(supabase: SupabaseClient, slug: string) {
  if (!slug || !supabase) return null;
  const { data: org, error } = await supabase
    .from("organizations")
    .select("id, name, slug, access_status, logo_path")
    .eq("slug", slug.toLowerCase().trim())
    .maybeSingle();

  if (error) {
    console.error("[PublicBooking] Organization lookup failed:", { code: error.code, message: error.message, status: error.details });
    return null;
  }
  if (!org) return null;
  // Cadastro ainda em análise: o salão não aparece para o público.
  if (org.access_status && org.access_status !== "ativo") return null;
  return org;
}

/**
 * Salão que pode receber agendamento online: liberado pelo master e com assinatura que permite operar.
 * Em dúvida (erro ao consultar a assinatura), não libera.
 */
export async function getBookableOrgBySlug(supabase: SupabaseClient, slug: string) {
  const org = await getOrgBySlug(supabase, slug);
  if (!org) return null;

  const { data: status, error } = await supabase.rpc("platform_billing_status_of", { p_org: org.id });
  if (error) {
    console.error("[PublicBooking] Billing status lookup failed:", { code: error.code, message: error.message });
    return null;
  }
  if (BOOKING_BLOCKED_BILLING.includes(String(status))) return null;
  return org;
}

export async function fetchPublicBookingDataBySlug(supabase: SupabaseClient, slug: string) {
  if (!slug || !supabase) {
    return { success: false, services: [], professionals: [], orgName: "", orgId: null, slug: "", logoPath: null, error: "Missing configuration" };
  }

  const org = await getBookableOrgBySlug(supabase, slug);
  if (!org) {
    return { success: false, services: [], professionals: [], orgName: "", orgId: null, slug: "", logoPath: null, error: "Organization not found" };
  }

  const result = await fetchPublicBookingData(supabase, org.id);
  return {
    ...result,
    orgName: org.name,
    orgId: org.id,
    slug: org.slug,
    logoPath: org.logo_path ?? null
  };
}

export async function fetchPublicBookingData(supabase: SupabaseClient, orgId?: string | null) {
  if (!orgId) {
    return { success: false, services: [], professionals: [], error: "Missing configuration" };
  }
  
  if (!supabase) {
    return { success: false, services: [], professionals: [], error: "Missing client" };
  }

  try {
    const { data: profData, error: profError } = await supabase
      .from("professionals")
      .select("id, name, specialties")
      .eq("organization_id", orgId)
      .eq("active", true)
      .order("name");

    if (profError) {
      return { success: false, services: [], professionals: [], error: "Database error" };
    }

    const { data: srvData, error: srvError } = await supabase
      .from("services")
      .select("id, name, category, duration_minutes, price")
      .eq("organization_id", orgId)
      .eq("active", true)
      .eq("show_online", true)
      .order("name");

    if (srvError) {
      return { success: false, services: [], professionals: [], error: "Database error" };
    }

    return {
      success: true,
      professionals: profData.map((p) => ({
        id: p.id,
        name: p.name,
        initials: p.name.split(" ").map((part: string) => part[0]).join("").slice(0, 2).toUpperCase(),
        specialty: p.specialties && p.specialties.length > 0 ? p.specialties.join(", ") : "Geral"
      })),
      services: srvData.map((s) => ({
        id: s.id,
        name: s.name,
        category: s.category,
        duration: s.duration_minutes,
        price: s.price
      }))
    };
  } catch (error) {
    return { success: false, services: [], professionals: [], error: "Internal error" };
  }
}
