export const dynamic = 'force-dynamic';
import { NailStudioApp } from "@/components/nail-studio-app";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrganizationId } from "@/lib/auth/current-organization";
import { getSalonLogoUrl } from "@/lib/salon-logo";
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
import { AccessSuspendedScreen } from "@/components/onboarding/access-suspended-screen";
import { AccessDeactivatedScreen } from "@/components/onboarding/access-deactivated-screen";
import { NetworkBlockedScreen } from "@/components/onboarding/network-blocked-screen";

export default async function Page() {
  const supabase = await createClient();

  // Protect route
  let tenantContext: { profileName: string; orgName: string; email: string; orgSlug: string; logoUrl: string | null } = { profileName: "Usuário", orgName: "Studio", email: "", orgSlug: "", logoUrl: null };
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
    viewerOrg = await getCurrentOrganizationId(supabase);
    // Perfil com salão mas sem salão ativo: vínculo desativado. Não carrega nenhum dado do salão.
    if (!viewerOrg && profile.organization_id) {
      const logoutAction = async () => { "use server"; const { logout } = await import("@/lib/actions/auth"); await logout(); };
      const { data: orgs } = await supabase.rpc("my_organizations");
      const rows = (orgs ?? []) as { organization_id: string; accessible: boolean; can_manage: boolean; network_platform_blocked: boolean }[];
      // Dono da rede: troca para um salão liberado e abre o sistema normal. Só mostra o bloqueio
      // se não houver nenhum salão liberado (rede bloqueada pela Bellaris, ou todos os salões bloqueados).
      if (rows.some((r) => r.can_manage)) {
        const target = rows.find((r) => r.accessible);
        if (target) {
          const { error: switchError } = await supabase.rpc("switch_active_organization", { p_organization_id: target.organization_id });
          // Se a troca falhar, não redireciona: evita laço entre as duas páginas.
          if (!switchError) redirect("/");
        }
        return (
          <NetworkBlockedScreen
            email={user.email ?? ""}
            platformBlocked={rows.some((r) => r.network_platform_blocked)}
            logout={logoutAction}
          />
        );
      }
      return <AccessDeactivatedScreen email={user.email ?? ""} logout={logoutAction} />;
    }
    let organization = { name: "Nail Studio" };
    tenantContext.profileName = profile?.full_name || "Usuário";
    if (viewerOrg) {
      const { data: org } = await supabase.from('organizations').select('name, slug, logo_path').eq('id', viewerOrg).single();
      if (org) {
        tenantContext.orgName = org.name;
        tenantContext.orgSlug = org.slug || "";
        tenantContext.logoUrl = getSalonLogoUrl(org.logo_path);
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

  // Situação da mensalidade do salão: cancelado ou sem plano perde o acesso; aviso e somente leitura mostram banner.
  const { data: billingStatus } = supabase
    ? await supabase.rpc("salon_billing_status")
    : { data: null as string | null };
  if (billingStatus === "cancelada" || billingStatus === "sem_plano") {
    return (
      <AccessSuspendedScreen
        email={tenantContext.email}
        logout={async () => { "use server"; const { logout } = await import("@/lib/actions/auth"); await logout(); }}
      />
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

  // Mensalidade em atraso: mês, vencimento, valor e dias de atraso (só o próprio salão lê).
  const { data: overdueRows } = supabase && (billingStatus === "aviso" || billingStatus === "somente_leitura")
    ? await supabase.rpc("salon_billing_details")
    : { data: null as unknown };
  const overdue = Array.isArray(overdueRows) ? (overdueRows[0] as { plan_name: string; reference_month: string; due_date: string; amount: number; days_late: number } | undefined) : undefined;
  const overdueText = overdue
    ? ` Mensalidade de ${overdue.reference_month.slice(5, 7)}/${overdue.reference_month.slice(0, 4)} (plano ${overdue.plan_name}, ${Number(overdue.amount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}) venceu em ${overdue.due_date.split("-").reverse().join("/")}, há ${overdue.days_late} ${overdue.days_late === 1 ? "dia" : "dias"}.`
    : "";
  const bellarisContact = (
    <a href="https://wa.me/5511932208384" target="_blank" rel="noopener noreferrer" className="font-semibold underline">(11) 93220-8384</a>
  );

  const billingBanner = billingStatus === "somente_leitura" ? (
    <div className="mx-4 mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
      <strong>Assinatura em atraso.</strong>{overdueText} O salão está em modo somente leitura. Você pode consultar agenda, clientes e histórico, mas não pode criar nem alterar atendimentos, pagamentos, comissões, clientes, despesas, estoque ou pacotes. Regularize a mensalidade para liberar o sistema. Fale com a Bellaris pelo WhatsApp {bellarisContact}.
    </div>
  ) : billingStatus === "cancelada" ? (
    <div className="mx-4 mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
      <strong>Assinatura cancelada.</strong> Não é possível alterar dados deste salão. Fale com a Bellaris pelo WhatsApp {bellarisContact}.
    </div>
  ) : billingStatus === "sem_plano" ? (
    <div className="mx-4 mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
      <strong>Sem plano ativo.</strong> Não é possível alterar dados deste salão. Fale com a Bellaris pelo WhatsApp {bellarisContact}.
    </div>
  ) : billingStatus === "aviso" ? (
    <div className="mx-4 mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <strong>Mensalidade vencida.</strong>{overdueText} Regularize para evitar o bloqueio de alterações. Fale com a Bellaris pelo WhatsApp {bellarisContact}.
    </div>
  ) : null;

  return <>{billingBanner ? <div className="lg:pl-60">{billingBanner}</div> : null}<NailStudioApp
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
