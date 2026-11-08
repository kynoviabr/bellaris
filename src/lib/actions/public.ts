import "server-only";

import { createAdminClient } from "@/lib/supabase/server";
import { fetchPublicBookingDataBySlug } from "@/lib/services/public-booking.service";
import { getSalonLogoUrl } from "@/lib/salon-logo";

export async function getPublicBookingDataBySlug(slug: string) {
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

