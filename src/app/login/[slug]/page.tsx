export const dynamic = 'force-dynamic';
import { notFound } from "next/navigation";
import { LoginScreen } from "@/components/login-screen";
import { createAdminClient } from "@/lib/supabase/server";
import { getOrgBySlug } from "@/lib/services/public-booking.service";
import { getSalonLogoUrl } from "@/lib/salon-logo";

// Login com a marca do salão: /login/[slug] mostra o nome e o logo daquele salão.
export default async function LoginSalonPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createAdminClient();
  if (!supabase || !slug) notFound();

  const org = await getOrgBySlug(supabase, slug);
  if (!org) notFound();

  return <LoginScreen title={org.name} logoUrl={getSalonLogoUrl(org.logo_path)} />;
}
