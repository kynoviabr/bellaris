import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";

export default async function PlatformHome() {
  const supabase = await createClient();
  if (!supabase) redirect("/login");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id",user.id).single();
  if (profile?.role !== "platform_master") redirect("/");
  return <main style={{maxWidth:900,margin:"0 auto",padding:32,fontFamily:"Arial,sans-serif"}}>
    <h1>Administração da plataforma</h1>
    <p>Conta Master autenticada. O gerenciamento global de salões será habilitado somente após a implementação das operações administrativas auditadas.</p>
    <p>Por segurança, esta conta não possui acesso direto aos dados financeiros, clientes ou agendas de cada salão.</p>
    <form action={async()=>{"use server";const {logout}=await import("@/lib/actions/auth");await logout();}}><button type="submit">Sair</button></form>
  </main>;
}
