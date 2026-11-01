import { getServices } from "@/lib/actions/services";
import { getAppointments } from "@/lib/actions/appointments";
import { NailStudioApp } from "@/components/nail-studio-app";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { PermissionRow } from "@/lib/authorization/permissions";
import { getOwnerOnboardingState } from "@/lib/actions/onboarding";
import { OwnerOnboardingScreen } from "@/components/onboarding/owner-onboarding-screen";
import { AccessSuspendedScreen } from "@/components/onboarding/access-suspended-screen";

export const dynamic = "force-dynamic";

export default async function ProfessionalHome() {
  const supabase = await createClient();
  if (!supabase) redirect("/login");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role,full_name,organization_id").eq("id", user.id).single();
  if (profile?.role !== "professional" || !profile.organization_id) redirect("/");

  // Salão ainda não liberado: a profissional vê só a espera. Nenhum dado do salão é carregado.
  const onboarding = await getOwnerOnboardingState();
  if (onboarding && onboarding.accessStatus !== "ativo") {
    return (
      <div className="min-h-screen bg-bg p-4 sm:p-8">
        <header className="mx-auto flex max-w-2xl items-center justify-between pb-4">
          <span className="text-sm text-muted">{user.email}</span>
          <form action={async () => { "use server"; const { logout } = await import("@/lib/actions/auth"); await logout(); }}>
            <button type="submit" className="inline-flex h-10 items-center rounded-lg border border-[#E8D9C7] bg-[#FFFCF8] px-5 text-sm font-semibold">Sair</button>
          </form>
        </header>
        <OwnerOnboardingScreen
          isOwner={false}
          accessStatus={onboarding.accessStatus}
          accessNote={null}
          requestedPlanCode={null}
          plans={[]}
          owner={null}
        />
      </div>
    );
  }

  const { data: billingStatus } = await supabase.rpc("salon_billing_status");
  if (billingStatus === "cancelada" || billingStatus === "sem_plano") {
    return (
      <AccessSuspendedScreen
        email={user.email || ""}
        logout={async () => { "use server"; const { logout } = await import("@/lib/actions/auth"); await logout(); }}
      />
    );
  }

  const { data: professional } = await supabase.from("professionals").select("id,name").eq("user_id", user.id).eq("organization_id", profile.organization_id).maybeSingle();
  if (!professional) return <main className="p-8">Seu usuário ainda não está vinculado a uma profissional deste salão. Solicite o vínculo à administração.</main>;
  const { data: organization } = await supabase.from("organizations").select("name,slug").eq("id", profile.organization_id).maybeSingle();
  const { data: permissionRows } = await supabase.from("role_permissions").select("role,module,operation,enabled").eq("organization_id", profile.organization_id);
  const [services, appointments, commissionResult] = await Promise.all([getServices(), getAppointments(), supabase.from("commissions").select("id,amount,status,created_at").eq("organization_id", profile.organization_id).eq("professional_id", professional.id).order("created_at", {ascending:false}).limit(100)]);
  const commissions = (commissionResult.data || []).map(item => ({id:item.id,amount:Number(item.amount),status:item.status,date:new Date(item.created_at).toLocaleDateString("pt-BR"),service:"Comissão de atendimento"}));
  return <NailStudioApp professionalMode tenant={{ profileName: professional.name || profile.full_name || "Profissional", orgName: organization?.name || "Salão", orgSlug: organization?.slug || "", email: user.email || "" }} initialCommissions={commissions} initialClients={[]} initialProfessionals={[]} initialSpecialties={[]} initialAppointments={appointments} initialServices={services} initialInventory={[]} initialFinancials={[]} initialStats={{revenue:0,expenses:0,commissions:0,balance:0}} initialReports={{}} permissionRows={(permissionRows ?? []) as PermissionRow[]} role="professional" />;
}
