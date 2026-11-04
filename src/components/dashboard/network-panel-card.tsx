"use client";

import { useEffect, useState } from "react";
import { getNetworkFinancialSummary, type NetworkSalonSummary } from "@/lib/actions/organizations";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

// Painel consolidado da rede, por salão. Só dono. Mesmos números do Financeiro de cada salão.
export function NetworkPanelCard() {
  const [month, setMonth] = useState(currentMonth());
  const [rows, setRows] = useState<NetworkSalonSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    getNetworkFinancialSummary(month).then((res) => {
      if (!active) return;
      if (res.error) { setRows([]); setError(res.error); }
      else setRows(res.data ?? []);
      setLoading(false);
    });
    return () => { active = false; };
  }, [month]);

  const totals = rows.reduce((acc, r) => ({
    revenue: acc.revenue + r.revenue,
    expensesPaid: acc.expensesPaid + r.expensesPaid,
    balance: acc.balance + r.balance,
    concludedAppointments: acc.concludedAppointments + r.concludedAppointments,
  }), { revenue: 0, expensesPaid: 0, balance: 0, concludedAppointments: 0 });

  return (
    <div className="bg-white rounded-lg border shadow-sm p-6 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="font-semibold text-lg text-ink">Painel da rede</h3>
          <p className="text-sm text-muted">Totais por salão, com a mesma regra do Financeiro de cada um. Sem dados de clientes.</p>
        </div>
        <div>
          <label className="field-label" htmlFor="net-month">Mês</label>
          <input id="net-month" type="month" className="field-input" value={month} onChange={(e) => { if (!e.target.value) return; setLoading(true); setError(""); setMonth(e.target.value); }} />
        </div>
      </div>

      {loading && <p className="text-sm text-muted">Carregando...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {!loading && !error && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted border-b border-[#DBE3EC]">
                <th className="py-2 pr-3 font-medium">Salão</th>
                <th className="py-2 pr-3 font-medium text-right">Faturamento</th>
                <th className="py-2 pr-3 font-medium text-right">Despesas pagas</th>
                <th className="py-2 pr-3 font-medium text-right">Saldo</th>
                <th className="py-2 font-medium text-right">Atendimentos</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.orgId} className="border-b border-[#DBE3EC]">
                  <td className="py-2 pr-3 text-ink">{r.salonName}</td>
                  <td className="py-2 pr-3 text-right">{money.format(r.revenue)}</td>
                  <td className="py-2 pr-3 text-right">{money.format(r.expensesPaid)}</td>
                  <td className="py-2 pr-3 text-right">{money.format(r.balance)}</td>
                  <td className="py-2 text-right">{r.concludedAppointments}</td>
                </tr>
              ))}
              {rows.length > 0 && (
                <tr className="font-semibold">
                  <td className="py-2 pr-3 text-ink">Total da rede</td>
                  <td className="py-2 pr-3 text-right">{money.format(totals.revenue)}</td>
                  <td className="py-2 pr-3 text-right">{money.format(totals.expensesPaid)}</td>
                  <td className="py-2 pr-3 text-right">{money.format(totals.balance)}</td>
                  <td className="py-2 text-right">{totals.concludedAppointments}</td>
                </tr>
              )}
            </tbody>
          </table>
          {rows.length === 0 && <p className="text-sm text-muted pt-2">Nenhum salão na rede ainda.</p>}
        </div>
      )}
    </div>
  );
}
