import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";

type SalonRow = { id: string; name: string; slug: string; timezone: string; created_at: string };

const dateFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" });

export default async function PlatformHome() {
  const supabase = await createClient();
  if (!supabase) redirect("/login");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "platform_master") redirect("/");

  // Somente cadastro dos salões (nome, endereço, fuso, data). Sem clientes, agendas ou financeiro.
  const { data, error } = await supabase.rpc("platform_list_salons");
  const salons: SalonRow[] = (data as SalonRow[] | null) ?? [];
  const latest = salons.length ? salons.reduce((a, b) => (a.created_at > b.created_at ? a : b)) : null;

  return (
    <div className="min-h-screen bg-bg text-ink">
      <header className="border-b border-[#E8D9C7] bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Bellaris</p>
            <h1 className="font-serif text-xl font-semibold">Administração da plataforma</h1>
          </div>
          <form action={async () => { "use server"; const { logout } = await import("@/lib/actions/auth"); await logout(); }}>
            <button type="submit" className="btn-outline">Sair</button>
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
        <section className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-[#E8D9C7] bg-white p-5 shadow-sm">
            <p className="text-xs font-medium text-muted">Salões cadastrados</p>
            <p className="mt-2 text-3xl font-bold">{salons.length}</p>
          </div>
          <div className="rounded-xl border border-[#E8D9C7] bg-white p-5 shadow-sm">
            <p className="text-xs font-medium text-muted">Último cadastro</p>
            <p className="mt-2 text-lg font-semibold">{latest ? latest.name : "—"}</p>
            {latest && <p className="text-xs text-muted">{dateFmt.format(new Date(latest.created_at))}</p>}
          </div>
          <div className="rounded-xl border border-[#E8D9C7] bg-white p-5 shadow-sm">
            <p className="text-xs font-medium text-muted">Acesso desta conta</p>
            <p className="mt-2 text-sm font-semibold">Somente leitura</p>
            <p className="text-xs text-muted">Sem acesso a clientes, agendas ou financeiro dos salões.</p>
          </div>
        </section>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            Não foi possível carregar a lista de salões. Tente novamente.
          </div>
        )}

        <section className="overflow-hidden rounded-xl border border-[#E8D9C7] bg-white shadow-sm">
          <div className="border-b border-[#E8D9C7] px-5 py-4">
            <h2 className="font-semibold">Salões</h2>
            <p className="text-xs text-muted">Cadastro de cada salão da plataforma.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#FAF6F0] text-left text-xs text-muted">
                <tr>
                  <th className="px-5 py-3 font-medium">Salão</th>
                  <th className="px-5 py-3 font-medium">Endereço (slug)</th>
                  <th className="px-5 py-3 font-medium">Fuso</th>
                  <th className="px-5 py-3 font-medium">Criado em</th>
                </tr>
              </thead>
              <tbody>
                {salons.length === 0 && !error ? (
                  <tr><td colSpan={4} className="px-5 py-8 text-center text-muted">Nenhum salão cadastrado.</td></tr>
                ) : salons.map(s => (
                  <tr key={s.id} className="border-t border-[#EFE6DA]">
                    <td className="px-5 py-3 font-medium">{s.name}</td>
                    <td className="px-5 py-3 text-muted">{s.slug}</td>
                    <td className="px-5 py-3 text-muted">{s.timezone}</td>
                    <td className="px-5 py-3 text-muted">{dateFmt.format(new Date(s.created_at))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
