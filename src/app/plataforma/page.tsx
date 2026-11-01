import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { SalonRowActions, StatusBadge, brDate, type PlanOption, type SalonBilling } from "@/components/platform/billing-panel";
export const dynamic = "force-dynamic";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const monthKey = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date()).slice(0, 7);
const monthLabel = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  const s = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export default async function PlatformHome() {
  const supabase = await createClient();
  if (!supabase) redirect("/login");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "platform_master") redirect("/");

  const [overviewRes, plansRes, paymentsRes] = await Promise.all([
    supabase.rpc("platform_billing_overview"),
    supabase.from("platform_plans").select("code, name, monthly_price").eq("active", true).order("monthly_price"),
    supabase.from("platform_payments").select("amount, paid_at, organization_id"),
  ]);

  const salons: SalonBilling[] = ((overviewRes.data as any[] | null) ?? []).map(r => ({ ...r, monthly_price: r.monthly_price == null ? null : Number(r.monthly_price) }));
  const plans: PlanOption[] = ((plansRes.data as any[] | null) ?? []).map(p => ({ code: p.code, name: p.name, monthly_price: Number(p.monthly_price) }));
  const payments = (paymentsRes.data as any[] | null) ?? [];
  const current = monthKey();

  const received = payments.filter(p => String(p.paid_at).startsWith(current)).reduce((s, p) => s + Number(p.amount), 0);
  const toReceive = salons.filter(s => s.billing_mode === "mensalidade" && s.due_date?.startsWith(current) && s.status !== "cancelada")
    .reduce((s, r) => s + Number(r.monthly_price ?? 0), 0);
  const late = salons.filter(s => s.status === "aviso" || s.status === "somente_leitura");
  const readOnly = salons.filter(s => s.status === "somente_leitura");

  return (
    <div className="min-h-screen bg-bg text-ink">
      <header className="border-b border-[#E8D9C7] bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Bellaris</p>
            <h1 className="font-serif text-xl font-semibold">Administração da plataforma</h1>
          </div>
          <form action={async () => { "use server"; const { logout } = await import("@/lib/actions/auth"); await logout(); }}>
            <button type="submit" className="inline-flex h-10 items-center rounded-lg border border-[#E8D9C7] bg-[#FFFCF8] px-5 text-sm font-semibold">Sair</button>
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6">
        {(overviewRes.error || plansRes.error || paymentsRes.error) && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">Não foi possível carregar os dados. Atualize a página.</div>
        )}

        <section aria-labelledby="resumo" className="space-y-3">
          <h2 id="resumo" className="text-sm font-semibold text-muted">Financeiro · {monthLabel(current)}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-[#E8D9C7] bg-white p-5 shadow-sm">
              <p className="text-xs font-medium text-muted">Recebido no mês</p>
              <p className="mt-2 text-2xl font-bold text-green-900">{money.format(received)}</p>
            </div>
            <div className="rounded-xl border border-[#E8D9C7] bg-white p-5 shadow-sm">
              <p className="text-xs font-medium text-muted">A receber no mês</p>
              <p className="mt-2 text-2xl font-bold">{money.format(toReceive)}</p>
            </div>
            <div className="rounded-xl border border-[#E8D9C7] bg-white p-5 shadow-sm">
              <p className="text-xs font-medium text-muted">Em atraso</p>
              <p className="mt-2 text-2xl font-bold text-amber-900">{late.length} salão(ões)</p>
              <p className="text-xs text-muted">{money.format(late.reduce((s, r) => s + Number(r.monthly_price ?? 0), 0))}</p>
            </div>
            <div className="rounded-xl border border-[#E8D9C7] bg-white p-5 shadow-sm">
              <p className="text-xs font-medium text-muted">Somente leitura</p>
              <p className="mt-2 text-2xl font-bold text-red-900">{readOnly.length} salão(ões)</p>
              <p className="text-xs text-muted">Bloqueio de escrita entra na próxima etapa.</p>
            </div>
          </div>
        </section>

        <section aria-labelledby="salões" className="overflow-hidden rounded-xl border border-[#E8D9C7] bg-white shadow-sm">
          <div className="border-b border-[#E8D9C7] px-5 py-4">
            <h2 id="salões" className="font-semibold">Salões e assinaturas</h2>
            <p className="text-xs text-muted">Vencimento, situação e registro de pagamentos. Esta conta não acessa clientes, agendas nem lançamentos dos salões.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#FAF6F0] text-left text-xs text-muted">
                <tr>
                  <th className="px-5 py-3 font-medium">Salão</th>
                  <th className="px-5 py-3 font-medium">Plano</th>
                  <th className="px-5 py-3 font-medium">Vencimento</th>
                  <th className="px-5 py-3 font-medium">Situação</th>
                  <th className="px-5 py-3 font-medium">Último pagamento</th>
                  <th className="px-5 py-3 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {salons.length === 0 ? (
                  <tr><td colSpan={6} className="px-5 py-8 text-center text-muted">Nenhum salão cadastrado.</td></tr>
                ) : salons.map(s => (
                  <tr key={s.organization_id} className="border-t border-[#EFE6DA] align-top">
                    <td className="px-5 py-3 font-medium">{s.salon_name}</td>
                    <td className="px-5 py-3">{s.plan_name ?? "—"}{s.billing_mode === "isento" && <span className="ml-2 text-xs text-muted">(isento)</span>}</td>
                    <td className="px-5 py-3">{s.billing_mode === "isento" ? "—" : brDate(s.due_date)}{s.days_overdue > 0 && <span className="block text-xs text-red-700">{s.days_overdue} dia(s) em atraso</span>}</td>
                    <td className="px-5 py-3"><StatusBadge status={s.status} /></td>
                    <td className="px-5 py-3 text-muted">{brDate(s.last_payment_on)}</td>
                    <td className="px-5 py-3 min-w-[260px]"><SalonRowActions salon={s} plans={plans} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section aria-labelledby="planos" className="overflow-hidden rounded-xl border border-[#E8D9C7] bg-white shadow-sm">
          <div className="border-b border-[#E8D9C7] px-5 py-4">
            <h2 id="planos" className="font-semibold">Planos</h2>
            <p className="text-xs text-muted">Valores vigentes. Alterações de preço ainda são feitas pelo banco.</p>
          </div>
          <div className="grid gap-4 p-5 sm:grid-cols-3">
            {plans.map(p => (
              <div key={p.code} className="rounded-lg border border-[#E8D9C7] bg-[#FFFCF8] p-4">
                <p className="font-semibold">{p.name}</p>
                <p className="mt-1 text-xl font-bold">{money.format(p.monthly_price)}<span className="text-xs font-normal text-muted"> /mês</span></p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
