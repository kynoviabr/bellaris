import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";

type SalonRow = { id: string; name: string; slug: string; timezone: string; created_at: string };

export default async function PlatformHome() {
  const supabase = await createClient();
  if (!supabase) redirect("/login");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "platform_master") redirect("/");

  // Somente cadastro dos salões (nome, slug, fuso, data). Sem clientes, agendas ou financeiro.
  const { data, error } = await supabase.rpc("platform_list_salons");
  const salons: SalonRow[] = (data as SalonRow[] | null) ?? [];

  return <main style={{ maxWidth: 900, margin: "0 auto", padding: 32, fontFamily: "Arial,sans-serif" }}>
    <h1>Administração da plataforma</h1>
    <p>Lista de salões cadastrados. Somente leitura: esta conta não acessa clientes, agendas nem financeiro de nenhum salão.</p>
    {error && <p style={{ color: "#b00020" }}>Não foi possível carregar a lista de salões.</p>}
    <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 16 }}>
      <thead>
        <tr style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>
          <th style={{ padding: 8 }}>Salão</th>
          <th style={{ padding: 8 }}>Endereço (slug)</th>
          <th style={{ padding: 8 }}>Fuso</th>
          <th style={{ padding: 8 }}>Criado em</th>
        </tr>
      </thead>
      <tbody>
        {salons.length === 0 && !error ? (
          <tr><td colSpan={4} style={{ padding: 8, color: "#666" }}>Nenhum salão cadastrado.</td></tr>
        ) : salons.map(s => (
          <tr key={s.id} style={{ borderBottom: "1px solid #eee" }}>
            <td style={{ padding: 8 }}>{s.name}</td>
            <td style={{ padding: 8 }}>{s.slug}</td>
            <td style={{ padding: 8 }}>{s.timezone}</td>
            <td style={{ padding: 8 }}>{new Date(s.created_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</td>
          </tr>
        ))}
      </tbody>
    </table>
    <form action={async () => { "use server"; const { logout } = await import("@/lib/actions/auth"); await logout(); }} style={{ marginTop: 24 }}>
      <button type="submit">Sair</button>
    </form>
  </main>;
}
