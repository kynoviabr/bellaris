"use client";
import { useState, useTransition } from "react";
import { registerPlatformPayment, setPlatformSubscription } from "@/lib/actions/platform-billing";

export type SalonBilling = {
  organization_id: string;
  salon_name: string;
  plan_code: string | null;
  plan_name: string | null;
  billing_mode: string;
  status: string;
  due_date: string | null;
  days_overdue: number;
  last_payment_on: string | null;
  monthly_price: number | null;
  due_business_day: number | null;
  cancelled: boolean;
  slug: string | null;
  owner_email: string | null;
};
export type PlanOption = { code: string; name: string; monthly_price: number };

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const todayKey = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());

const inputClass = "h-10 w-full rounded-md border border-[#E8D9C7] bg-[#FFFCF8] px-3 text-sm text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15";
const labelClass = "mb-1 block text-xs font-medium text-muted";
const btnPrimary = "inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-white disabled:opacity-50";
const btnOutline = "inline-flex h-9 items-center justify-center rounded-lg border border-[#E8D9C7] bg-white px-4 text-sm font-semibold text-ink";

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    em_dia: { label: "Em dia", cls: "bg-green-50 text-green-800 border-green-200" },
    aviso: { label: "Aviso de atraso", cls: "bg-amber-50 text-amber-800 border-amber-200" },
    somente_leitura: { label: "Somente leitura", cls: "bg-red-50 text-red-800 border-red-200" },
    isento: { label: "Isento", cls: "bg-[#F4EFE8] text-muted border-[#E8D9C7]" },
    cancelada: { label: "Cancelada", cls: "bg-[#F4EFE8] text-muted border-[#E8D9C7]" },
    sem_plano: { label: "Sem plano", cls: "bg-[#F4EFE8] text-muted border-[#E8D9C7]" },
  };
  const s = map[status] ?? { label: status, cls: "bg-[#F4EFE8] text-muted border-[#E8D9C7]" };
  return <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${s.cls}`}>{s.label}</span>;
}

import { brDate } from "@/lib/platform-format";

export function SalonRowActions({ salon, plans }: { salon: SalonBilling; plans: PlanOption[] }) {
  const [open, setOpen] = useState<null | "pagamento" | "assinatura">(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const owedMonth = salon.due_date ? salon.due_date.slice(0, 7) + "-01" : "";
  const canPay = salon.billing_mode === "mensalidade" && !!salon.due_date;

  const submitPayment = (form: HTMLFormElement) => {
    const fd = new FormData(form);
    start(async () => {
      const res = await registerPlatformPayment({
        organizationId: salon.organization_id,
        referenceMonth: owedMonth,
        amount: Number(String(fd.get("amount")).replace(",", ".")),
        method: String(fd.get("method")),
        paidAt: String(fd.get("paidAt")),
        notes: String(fd.get("notes") ?? ""),
      });
      setMsg(res.success ? { ok: true, text: "Pagamento registrado. Vencimento atualizado." } : { ok: false, text: res.error });
      if (res.success) setOpen(null);
    });
  };

  const submitSubscription = (form: HTMLFormElement) => {
    const fd = new FormData(form);
    const mode = String(fd.get("billingMode"));
    start(async () => {
      const res = await setPlatformSubscription({
        organizationId: salon.organization_id,
        billingMode: mode,
        planCode: mode === "isento" && !fd.get("planCode") ? undefined : String(fd.get("planCode") || "") || undefined,
        dueBusinessDay: mode === "mensalidade" ? Number(fd.get("dueBusinessDay")) : undefined,
        cancelled: fd.get("cancelled") === "on",
        notes: String(fd.get("notes") ?? ""),
      });
      setMsg(res.success ? { ok: true, text: "Assinatura salva." } : { ok: false, text: res.error });
      if (res.success) setOpen(null);
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {canPay && <button type="button" className={btnPrimary} onClick={() => setOpen(open === "pagamento" ? null : "pagamento")}>Registrar pagamento</button>}
        <button type="button" className={btnOutline} onClick={() => setOpen(open === "assinatura" ? null : "assinatura")}>Editar assinatura</button>
      </div>
      {msg && <p className={`text-xs ${msg.ok ? "text-green-800" : "text-red-700"}`}>{msg.text}</p>}

      {open === "pagamento" && canPay && (
        <form className="grid gap-3 rounded-lg border border-[#E8D9C7] bg-[#FAF6F0] p-4 sm:grid-cols-2" onSubmit={e => { e.preventDefault(); submitPayment(e.currentTarget); }}>
          <p className="text-xs text-muted sm:col-span-2">Referente a {owedMonth.slice(5, 7)}/{owedMonth.slice(0, 4)} (vence em {brDate(salon.due_date)}).</p>
          <div><label className={labelClass}>Valor (R$)</label><input name="amount" required defaultValue={salon.monthly_price ?? ""} inputMode="decimal" className={inputClass} /></div>
          <div><label className={labelClass}>Forma</label>
            <select name="method" defaultValue="pix" className={inputClass}>
              <option value="pix">Pix</option><option value="boleto">Boleto</option><option value="cartao">Cartão</option><option value="dinheiro">Dinheiro</option><option value="outro">Outro</option>
            </select></div>
          <div><label className={labelClass}>Data do pagamento</label><input name="paidAt" type="date" required defaultValue={todayKey()} className={inputClass} /></div>
          <div><label className={labelClass}>Observação</label><input name="notes" className={inputClass} /></div>
          <div className="sm:col-span-2 flex gap-2"><button type="submit" disabled={pending} className={btnPrimary}>{pending ? "Salvando..." : "Salvar pagamento"}</button><button type="button" className={btnOutline} onClick={() => setOpen(null)}>Cancelar</button></div>
        </form>
      )}

      {open === "assinatura" && (
        <div className="grid gap-2 rounded-lg border border-[#E8D9C7] bg-white p-4 text-sm">
          <div>
            <span className="block text-xs font-semibold uppercase tracking-wide text-primary">E-mail da proprietária</span>
            <span className="text-ink">{salon.owner_email ?? "Não encontrado"}</span>
          </div>
          {typeof window !== "undefined" && (
            <>
              <div>
                <span className="block text-xs font-semibold uppercase tracking-wide text-primary">Acesso ao sistema</span>
                <a href={`${window.location.origin}/login`} target="_blank" rel="noopener noreferrer" className="break-all text-primary underline">{`${window.location.origin}/login`}</a>
              </div>
              {salon.slug && (
                <div>
                  <span className="block text-xs font-semibold uppercase tracking-wide text-primary">Agendamento online</span>
                  <a href={`${window.location.origin}/agendar/${salon.slug}`} target="_blank" rel="noopener noreferrer" className="break-all text-primary underline">{`${window.location.origin}/agendar/${salon.slug}`}</a>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {open === "assinatura" && (
        <form key={salon.organization_id + salon.billing_mode + (salon.plan_code ?? "")} className="grid gap-3 rounded-lg border border-[#E8D9C7] bg-[#FAF6F0] p-4 sm:grid-cols-2" onSubmit={e => { e.preventDefault(); submitSubscription(e.currentTarget); }}>
          <div><label className={labelClass}>Cobrança</label>
            <select name="billingMode" defaultValue={salon.billing_mode} className={inputClass}>
              <option value="mensalidade">Paga mensalidade</option><option value="isento">Isento (não cobra)</option>
            </select></div>
          <div><label className={labelClass}>Plano</label>
            <select name="planCode" defaultValue={salon.plan_code ?? ""} className={inputClass}>
              <option value="">—</option>
              {plans.map(p => <option key={p.code} value={p.code}>{p.name} · {money.format(p.monthly_price)}/mês</option>)}
            </select></div>
          <div><label className={labelClass}>Vencimento</label>
            <select name="dueBusinessDay" defaultValue={String(salon.due_business_day ?? 0)} className={inputClass}>
              <option value="0">Último dia útil do mês</option>
              {Array.from({ length: 10 }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n}º dia útil do mês</option>)}
            </select></div>
          <label className="flex items-center gap-2 self-end text-sm"><input type="checkbox" name="cancelled" defaultChecked={salon.cancelled} className="h-4 w-4 accent-primary" /> Assinatura cancelada</label>
          <div className="sm:col-span-2"><label className={labelClass}>Observação</label><input name="notes" className={inputClass} /></div>
          <div className="sm:col-span-2 flex gap-2"><button type="submit" disabled={pending} className={btnPrimary}>{pending ? "Salvando..." : "Salvar assinatura"}</button><button type="button" className={btnOutline} onClick={() => setOpen(null)}>Cancelar</button></div>
        </form>
      )}
    </div>
  );
}
