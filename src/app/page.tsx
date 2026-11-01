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
import type { PermissionRow, StudioRole } from "@/lib/authorization/permissions";
import { getActivePlans, getOwnerOnboardingState } from "@/lib/actions/onboarding";
import { OwnerOnboardingScreen } from "@/components/onboarding/owner-onboarding-screen";

export default async function Page() {
  const supabase = await createClient();

  // Protect route
  let tenantContext: { profileName: string; orgName: string; email: string; orgSlug: string } = { profileName: "Usuário", orgName: "Studio", email: "", orgSlug: "" };
  let viewerRole: string = "owner";
  let viewerOrg: string | null = null;
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
    viewerOrg = profile.organization_id ?? null;
    let organization = { name: "Nail Studio" };
    tenantContext.profileName = profile?.full_name || "Usuário";
    if (profile?.organization_id) {
      const { data: org } = await supabase.from('organizations').select('name, slug').eq('id', profile.organization_id).single();
      if (org) {
        tenantContext.orgName = org.name;
        tenantContext.orgSlug = org.slug || "";
      }
    }
    
    // Pass to component (we will add to props)


  }

  // Salão ainda não liberado pelo master: o dono vê só o cadastro (ou a espera). Nenhum dado do salão é carregado.
  const onboarding = await getOwnerOnboardingState();
  if (onboarding && onboarding.accessStatus !== "ativo") {
    const plans = await getActivePlans();
    return (
      <div className="min-h-screen bg-bg p-4 sm:p-8">
        <header className="mx-auto flex max-w-2xl items-center justify-between pb-4">
          <span className="text-sm text-muted">{tenantContext.email}</span>
          <form action={async () => { "use server"; const { logout } = await import("@/lib/actions/auth"); await logout(); }}>
            <button type="submit" className="inline-flex h-10 items-center rounded-lg border border-[#E8D9C7] bg-[#FFFCF8] px-5 text-sm font-semibold">Sair</button>
          </form>
        </header>
        <OwnerOnboardingScreen
          isOwner={onboarding.isOwner}
          accessStatus={onboarding.accessStatus}
          accessNote={onboarding.accessNote}
          requestedPlanCode={onboarding.requestedPlanCode}
          plans={plans}
          owner={onboarding.owner as Record<string, string | null> | null}
        />
      </div>
    );
  }

  // Load real data
  const clients = await getClients();
  const professionals = await getProfessionals();
  const specialties = await getSpecialties();
  const appointments = await getAppointments();
  const services = await getServices();
  // A recepcionista não carrega dados financeiros nem relatórios (somente a gestora).
  // Matriz de permissões da organização (editada pela gestora em Configurações).
  const permissionRows = supabase && viewerOrg
    ? ((await supabase.from("role_permissions").select("role,module,operation,enabled").eq("organization_id", viewerOrg)).data ?? [])
    : [];
  const isStaff = viewerRole === "staff";
  const financialData = isStaff ? { data: [], stats: { revenue: 0, expenses: 0, commissions: 0, balance: 0 } } : await getFinance();
  const inventory = await getInventory();
  const reports = isStaff ? {} : await getReports();

  // Situação da mensalidade do salão: aviso (vencida) ou somente leitura (bloqueio de escrita).
  const { data: billingStatus } = supabase
    ? await supabase.rpc("salon_billing_status")
    : { data: null as string | null };
  const billingBanner = billingStatus === "somente_leitura" ? (
    <div className="mx-4 mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
      <strong>Assinatura em atraso.</strong> O salão está em modo somente leitura. Você pode consultar agenda, clientes e histórico, mas não pode criar nem alterar atendimentos, pagamentos, comissões, clientes, despesas, estoque ou pacotes. Regularize a mensalidade para liberar o sistema.
    </div>
  ) : billingStatus === "aviso" ? (
    <div className="mx-4 mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <strong>Mensalidade vencida.</strong> Regularize para evitar o bloqueio de alterações.
    </div>
  ) : null;

  return <>{billingBanner}<NailStudioApp
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
    permissionRows={permissionRows as PermissionRow[]}
  /></>;
}
