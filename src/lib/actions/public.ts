import "server-only";

import { createAdminClient } from "@/lib/supabase/server";
import { fetchPublicBookingDataBySlug } from "@/lib/services/public-booking.service";
import { getSalonLogoUrl } from "@/lib/salon-logo";
import { checkRateLimit } from "@/lib/rate-limit";
import { headers } from "next/headers";

// Leitura pública da página de agendamento: 120 por IP a cada 5 minutos.
const PUBLIC_DATA_LIMIT = 120;
const PUBLIC_DATA_WINDOW_MS = 5 * 60 * 1000;

async function currentIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || h.get("x-real-ip")?.trim() || "unknown";
}

export async function getPublicBookingDataBySlug(slug: string) {
  const limit = checkRateLimit(`public-data:${await currentIp()}`, PUBLIC_DATA_LIMIT, PUBLIC_DATA_WINDOW_MS);
  if (!limit.allowed) {
    console.warn("[PublicBooking] Limite de requisições atingido.");
    return { success: false, services: [], professionals: [], orgName: "", orgId: null, slug: "", logoUrl: null };
  }

  const supabase = await createAdminClient();

  if (!supabase) {
    console.error("[PublicBooking] Supabase admin client not configured.");
    return { success: false, services: [], professionals: [], orgName: "", orgId: null, slug: "", logoUrl: null };
  }

  const result = await fetchPublicBookingDataBySlug(supabase, slug);
  if (!result.success) {
    console.error("[PublicBooking] Error:", result.error);
  }

  return {
    success: result.success,
    professionals: result.professionals,
    services: result.services,
    orgName: result.orgName,
    orgId: result.orgId,
    slug: result.slug,
    logoUrl: getSalonLogoUrl(result.logoPath)
  };
}

