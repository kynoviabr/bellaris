import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ClipboardCheck, Store, Wallet, Tags, LogOut } from "lucide-react";
import { BellarisMark, BellarisWordmark } from "@/components/brand/bellaris-mark";
import { SalonRowActions, StatusBadge, type PlanOption, type SalonBilling } from "@/components/platform/billing-panel";
import { ApprovalCard, OwnerEditForm, type PlanChoice, type SalonAdminRow } from "@/components/platform/salon-admin-cards";
import { brDate } from "@/lib/platform-format";
import { NetworksPanel } from "@/components/platform/networks-panel";
export const dynamic = "force-dynamic";

const SECTIONS = [
  { key: "aprovacoes", label: "Aprovações", icon: ClipboardCheck },
  { key: "saloes", label: "Salões", icon: Store },
  { key: "financeiro", label: "Financeiro", icon: Wallet },
  { key: "planos", label: "Planos", icon: Tags },
] as const;
type SectionKey = (typeof SECTIONS)[number]["key"];

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const monthKey = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date()).slice(0, 7);
const monthLabel = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  const s = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export default async function PlatformHome({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const { s } = await searchParams;
  const section: SectionKey = SECTIONS.find(x => x.key === s)?.key ?? "aprovacoes";

  const supabase = await createClient();
  if (!supabase) redirect("/login");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "platform_master") redirect("/");

  const [overviewRes, plansRes, paymentsRes, adminRes] = await Promise.all([
    supabase.rpc("platform_billing_overview"),
    supabase.from("platform_plans").select("code, name, monthly_price").eq("active", true).order("monthly_price"),
    supabase.from("platform_payments").select("amount, paid_at, organization_id"),
    supabase.rpc("platform_salons_admin"),
  ]);

  const salons: SalonBilling[] = ((overviewRes.data as any[] | null) ?? []).map(r => ({ ...r, monthly_price: r.monthly_price == null ? null : Number(r.monthly_price) }));
  const plans: PlanOption[] = ((plansRes.data as any[] | null) ?? []).map(p => ({ code: p.code, name: p.name, monthly_price: Number(p.monthly_price) }));
  const planChoices: PlanChoice[] = plans;
  const payments = (paymentsRes.data as any[] | null) ?? [];
  const adminRows: SalonAdminRow[] = (adminRes.data as any[] | null) ?? [];
  const pending = adminRows.filter(r => r.access_status === "aguardando_aprovacao");
  const current = monthKey();

  const received = payments.filter(p => String(p.paid_at).startsWith(current)).reduce((sum, p) => sum + Number(p.amount), 0);
  const toReceive = salons.filter(x => x.billing_mode === "mensalidade" && x.due_date?.startsWith(current) && x.status !== "cancelada")
    .reduce((sum, r) => sum + Number(r.monthly_price ?? 0), 0);
  const late = salons.filter(x => x.status === "aviso" || x.status === "somente_leitura");
  const readOnly = salons.filter(x => x.status === "somente_leitura");

  const loadError = overviewRes.error || plansRes.error || paymentsRes.error || adminRes.error;

  const navLink = (item: (typeof SECTIONS)[number]) => {
    const active = item.key === section;
    const Icon = item.icon;
    return (
      <Link
        key={item.key}
        href={`/plataforma?s=${item.key}`}
        aria-current={active ? "page" : undefined}
        className={`flex shrink-0 items-center gap-3 rounded-md px-3 py-2.5 text-[13.5px] transition ${active ? "bg-primary text-white" : "text-white/75 hover:bg-white/10 hover:text-white"}`}
      >
        <Icon size={17} strokeWidth={1.5} />
        {item.label}
        {item.key === "aprovacoes" && pending.length > 0 && (
          <span className="ml-auto rounded-full bg-white/20 px-2 text-[11px]">{pending.length}</span>
        )}
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-bg text-ink">
      <aside className="bg-navy text-white lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:w-60 lg:flex-col">
        <div className="flex h-[65px] items-center gap-3 border-b border-white/10 px-5">
          <BellarisMark size={34} className="shrink-0" />
          <div className="min-w-0">
            <span className="block text-base font-semibold text-white"><BellarisWordmark /></span>
            <span className="block text-[11px] text-white/60">Administração da plataforma</span>
          </div>
        </div>
        <nav aria-label="Menu da plataforma" className="flex gap-1 overflow-x-auto px-3 py-3 lg:flex-1 lg:flex-col lg:space-y-1 lg:overflow-visible lg:py-5">
          <p className="hidden px-3 pb-2 text-[10px] font-medium uppercase tracking-[.12em] text-white/45 lg:block">Gestão</p>
          {SECTIONS.map(navLink)}
        </nav>
        <form action={async () => { "use server"; const { logout } = await import("@/lib/actions/auth"); await logout(); }} className="border-t border-white/10 p-3">
          <button type="submit" className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-xs text-white/65 hover:bg-white/10 hover:text-rose-300">
            <LogOut size={16} /> Sair do sistema
          </button>
        </form>
      </aside>

      <main className="page-content space-y-6 lg:pl-60">
        {loadError && (
          <div className="card border-red-200 bg-red-50 text-sm text-red-800">Não foi possível carregar os dados. Atualize a página.</div>
        )}

        {section === "aprovacoes" && (
          <section aria-labelledby="aprovacoes" className="space-y-4">
            <div>
              <h2 id="aprovacoes" className="text-xl font-semibold">Aprovações pendentes</h2>
              <p className="text-sm text-muted">Confira os dados do responsável, escolha o plano e o vencimento para liberar o salão. Também pode recusar com motivo ou corrigir os dados.</p>
            </div>
            {pending.length === 0 ? (
              <div className="card py-10 text-center text-sm text-muted">Nenhum cadastro aguardando aprovação.</div>
            ) : pending.map(row => (
              <ApprovalCard key={row.organization_id} row={row} plans={planChoices} />
            ))}
          </section>
        )}

        {section === "saloes" && (
          <section aria-labelledby="saloes" className="space-y-4">
            <div>
              <h2 id="saloes" className="text-xl font-semibold">Salões e responsáveis</h2>
              <p className="text-sm text-muted">Abra um salão para ver ou corrigir os dados do responsável. O nome do salão não é editável aqui.</p>
            </div>
            <NetworksPanel />
            {adminRows.length === 0 ? (
              <div className="card py-10 text-center text-sm text-muted">Nenhum salão cadastrado.</div>
            ) : (
              <div className="space-y-3">
                {adminRows.map(row => (
                  <details key={row.organization_id} className="card group">
                    <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3">
                      <span>
                        <span className="block font-semibold">{row.salon_name}</span>
                        <span className="block text-xs text-muted">
                          {row.owner_full_name ? `Responsável: ${row.owner_full_name}` : "Dados do responsável não informados"}
                        </span>
                      </span>
                      <span className="text-xs font-semibold text-primary group-open:hidden">Ver dados</span>
                      <span className="hidden text-xs font-semibold text-primary group-open:inline">Fechar</span>
                    </summary>
                    <div className="mt-4 border-t border-[#E8D9C7] pt-4">
                      <OwnerEditForm row={row} />
                    </div>
                  </details>
                ))}
              </div>
            )}
          </section>
        )}

        {section === "financeiro" && (
          <>
            <section aria-labelledby="resumo" className="space-y-3">
              <h2 id="resumo" className="text-sm font-semibold text-muted">Financeiro · {monthLabel(current)}</h2>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div className="card">
                  <p className="text-xs font-medium text-muted">Recebido no mês</p>
                  <p className="mt-2 text-2xl font-bold text-green-900">{money.format(received)}</p>
                </div>
                <div className="card">
                  <p className="text-xs font-medium text-muted">A receber no mês</p>
                  <p className="mt-2 text-2xl font-bold">{money.format(toReceive)}</p>
                </div>
                <div className="card">
                  <p className="text-xs font-medium text-muted">Em atraso</p>
                  <p className="mt-2 text-2xl font-bold text-amber-900">{late.length} salão(ões)</p>
                  <p className="text-xs text-muted">{money.format(late.reduce((sum, r) => sum + Number(r.monthly_price ?? 0), 0))}</p>
                </div>
                <div className="card">
                  <p className="text-xs font-medium text-muted">Somente leitura</p>
                  <p className="mt-2 text-2xl font-bold text-red-900">{readOnly.length} salão(ões)</p>
                  <p className="text-xs text-muted">Podem consultar, sem registrar atendimentos.</p>
                </div>
              </div>
            </section>

            <section aria-labelledby="assinaturas" className="space-y-3">
              <div>
                <h2 id="assinaturas" className="text-xl font-semibold">Assinaturas e pagamentos</h2>
                <p className="text-sm text-muted">Vencimento, situação e registro de pagamentos. Esta conta não acessa clientes, agendas nem lançamentos dos salões.</p>
              </div>
              <div className="card overflow-x-auto p-0">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th className="px-4 py-3 font-medium">Salão</th>
                      <th className="px-4 py-3 font-medium">Plano</th>
                      <th className="px-4 py-3 font-medium">Vencimento</th>
                      <th className="px-4 py-3 font-medium">Situação</th>
                      <th className="px-4 py-3 font-medium">Último pagamento</th>
                      <th className="px-4 py-3 font-medium">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salons.length === 0 ? (
                      <tr><td colSpan={6} className="px-4 py-8 text-center text-muted">Nenhum salão cadastrado.</td></tr>
                    ) : salons.map(x => (
                      <tr key={x.organization_id} className="align-top">
                        <td className="px-4 py-3 font-medium">{x.salon_name}</td>
                        <td className="px-4 py-3">{x.plan_name ?? "—"}{x.billing_mode === "isento" && <span className="ml-2 text-xs text-muted">(isento)</span>}</td>
                        <td className="px-4 py-3">{x.billing_mode === "isento" ? "—" : brDate(x.due_date)}{x.days_overdue > 0 && <span className="block text-xs text-red-700">{x.days_overdue} dia(s) em atraso</span>}</td>
                        <td className="px-4 py-3"><StatusBadge status={x.status} /></td>
                        <td className="px-4 py-3 text-muted">{brDate(x.last_payment_on)}</td>
                        <td className="px-4 py-3 min-w-[260px]"><SalonRowActions salon={x} plans={plans} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        {section === "planos" && (
          <section aria-labelledby="planos" className="space-y-4">
            <div>
              <h2 id="planos" className="text-xl font-semibold">Planos</h2>
              <p className="text-sm text-muted">Valores vigentes. Alterações de preço ainda são feitas pelo banco.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {plans.map(p => (
                <div key={p.code} className="card">
                  <p className="font-semibold">{p.name}</p>
                  <p className="mt-1 text-xl font-bold">{money.format(p.monthly_price)}<span className="text-xs font-normal text-muted"> /mês</span></p>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
