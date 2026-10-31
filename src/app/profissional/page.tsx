import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ProfessionalHome() {
  const supabase = await createClient();
  if (!supabase) redirect("/login");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role, full_name").eq("id", user.id).single();
  if (profile?.role !== "professional") redirect("/");

  const { data: professional } = await supabase.from("professionals").select("id,name").eq("user_id", user.id).single();
  if (!professional) return <main style={{padding:32}}><h1>Área profissional</h1><p>Seu cadastro ainda não está vinculado a uma profissional. Entre em contato com a gestão do salão.</p></main>;

  const [appointmentsResult, commissionsResult] = await Promise.all([
    supabase.from("appointments").select("id,starts_at,status").eq("professional_id", professional.id).order("starts_at", {ascending:false}).limit(30),
    supabase.from("commissions").select("id,amount,status,created_at").eq("professional_id", professional.id).order("created_at", {ascending:false}).limit(30)
  ]);
  const appointments = appointmentsResult.data ?? [];
  const commissions = commissionsResult.data ?? [];
  return <main style={{maxWidth:960,margin:"0 auto",padding:32,fontFamily:"Arial,sans-serif"}}>
    <h1>Área profissional — {professional.name}</h1>
    <p>Você tem acesso somente aos seus agendamentos e comissões.</p>
    <h2>Meus agendamentos</h2>
    {appointments.length ? <ul>{appointments.map(a=><li key={a.id}>{new Date(a.starts_at).toLocaleString("pt-BR",{timeZone:"America/Sao_Paulo"})} — {a.status}</li>)}</ul> : <p>Nenhum agendamento encontrado.</p>}
    <h2>Minhas comissões</h2>
    {commissions.length ? <ul>{commissions.map(c=><li key={c.id}>{new Date(c.created_at).toLocaleDateString("pt-BR",{timeZone:"America/Sao_Paulo"})} — R$ {Number(c.amount).toFixed(2)} — {c.status}</li>)}</ul> : <p>Nenhuma comissão encontrada.</p>}
    <form action={async()=>{"use server";const {logout}=await import("@/lib/actions/auth");await logout();}}><button type="submit">Sair</button></form>
  </main>;
}
