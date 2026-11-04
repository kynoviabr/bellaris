"use client";

import { useEffect, useState } from "react";
import { getMySalonBilling, type SalonBilling } from "@/lib/actions/organizations";

const money = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;
const date = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

// Cobrança do salão ativo: quem paga, plano, valor e vencimento. Só leitura. Visível a dono e gestora.
export function SalonBillingCard() {
  const [billing, setBilling] = useState<SalonBilling | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    getMySalonBilling().then((res) => {
      if (!active) return;
      if (res.data) setBilling(res.data);
      setLoaded(true);
    });
    return () => { active = false; };
  }, []);

  if (!loaded || !billing) return null;

  const payerLabel = billing.payer === "rede"
    ? `Paga pela rede ${billing.networkName ?? ""} (fatura única)`.trim()
    : billing.payer === "isento" ? "Isento de mensalidade" : "Próprio salão";

  return (
    <div className="bg-white rounded-lg border shadow-sm p-6 space-y-3">
      <h3 className="font-semibold text-lg text-ink">Cobrança deste salão</h3>
      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <div><dt className="text-muted">Quem paga</dt><dd className="text-ink">{payerLabel}</dd></div>
        <div><dt className="text-muted">Plano</dt><dd className="text-ink">{billing.planName ?? "—"}</dd></div>
        <div><dt className="text-muted">Mensalidade</dt><dd className="text-ink">{billing.monthlyPrice === null ? "—" : money(billing.monthlyPrice)}</dd></div>
        <div><dt className="text-muted">Desconto</dt><dd className="text-ink">{billing.discountPercent}%</dd></div>
        <div><dt className="text-muted">Valor deste mês</dt><dd className="text-ink">{billing.payer === "isento" ? "R$ 0,00" : money(billing.amount)}</dd></div>
        <div><dt className="text-muted">Próximo vencimento</dt><dd className="text-ink">{billing.dueDate ? date(billing.dueDate) : "—"}</dd></div>
      </dl>
    </div>
  );
}
