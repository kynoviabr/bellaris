export const dynamic = 'force-dynamic';
import { NailStudioApp } from "@/components/nail-studio-app";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getClients } from "@/lib/actions/clients";
import { getProfessionals } from "@/lib/actions/professionals";
import { getSpecialties } from "@/lib/actions/specialties";
import { getAppointments } from "@/lib/actions/appointments";
import { getServices } from "@/lib/actions/services";
import { getFinance } from "@/lib/actions/finance";
import { getInventory } from "@/lib/actions/inventory";
import { getReports } from "@/lib/actions/reports";
import type { StudioRole } from "@/lib/authorization/permissions";

export default async function Page() {
  const supabase = await createClient();

  // Protect route
  let tenantContext = { profileName: "Usuário", orgName: "Studio", email: "" };
  let viewerRole: string = "owner";
  if (supabase) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      redirect("/login");
    }
    tenantContext.email = user.email || "";
    
    // Fetch tenant profile and organization
    const { data: profile } = await supabase.from('profiles').select('full_name, organization_id, role').eq('id', user.id).single();
    if (profile?.role === "professional") redirect("/profissional");
    if (profile?.role === "platform_master") redirect("/plataforma");
    if (!profile || !["owner", "admin", "staff"].includes(profile.role)) redirect("/login");
    viewerRole = profile.role;
    let organization = { name: "Nail Studio" };
    tenantContext.profileName = profile?.full_name || "Usuário";
    if (profile?.organization_id) {
      const { data: org } = await supabase.from('organizations').select('name').eq('id', profile.organization_id).single();
      if (org) tenantContext.orgName = org.name;
    }
    
    // Pass to component (we will add to props)


  }

  // Load real data
  const clients = await getClients();
  const professionals = await getProfessionals();
  const specialties = await getSpecialties();
  const appointments = await getAppointments();
  const services = await getServices();
  // A recepcionista não carrega dados financeiros nem relatórios (somente a gestora).
  const isStaff = viewerRole === "staff";
  const financialData = isStaff ? { data: [], stats: { revenue: 0, expenses: 0, commissions: 0, balance: 0 } } : await getFinance();
  const inventory = await getInventory();
  const reports = isStaff ? {} : await getReports();

  return <NailStudioApp 
    initialClients={clients} 
    initialProfessionals={professionals} 
    initialSpecialties={specialties}
    initialAppointments={appointments}
    initialServices={services}
    initialFinancials={financialData.data}
    initialStats={financialData.stats}
    initialInventory={inventory}
    initialReports={reports}
    tenant={tenantContext}
    role={viewerRole as StudioRole}
  />;
}
