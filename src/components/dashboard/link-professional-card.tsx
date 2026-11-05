"use client";

import { useState } from "react";
import { linkProfessionalByEmail } from "@/lib/actions/organizations";

// Vínculo de profissional já cadastrada na rede, pelo e-mail da conta dela. Só para dono ou administradora.
export function LinkProfessionalCard({ onLinked }: { onLinked?: () => void }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [commission, setCommission] = useState("0");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  async function handleLink() {
    setSaving(true);
    setError("");
    setDone("");
    const res = await linkProfessionalByEmail(email.trim(), name.trim(), Number(commission.replace(",", ".")) || 0);
    setSaving(false);
    if (res.error) { setError(res.error); return; }
    setDone("Profissional vinculada a este salão.");
    setEmail(""); setName(""); setCommission("0");
    onLinked?.();
  }

  return (
    <div className="bg-white rounded-lg border shadow-sm p-6 space-y-3">
      <h3 className="font-semibold text-lg text-ink">Vincular profissional a este salão</h3>
      <p className="text-sm text-muted">Use o e-mail da conta que a profissional já tem no sistema. Ela passa a atender neste salão, sem perder os vínculos que já tem.</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="field-label" htmlFor="link-prof-email">E-mail da profissional</label>
          <input id="link-prof-email" type="email" className="field-input" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label className="field-label" htmlFor="link-prof-name">Nome neste salão</label>
          <input id="link-prof-name" className="field-input" maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="field-label" htmlFor="link-prof-commission">Comissão (%)</label>
          <input id="link-prof-commission" inputMode="decimal" className="field-input" value={commission} onChange={(e) => setCommission(e.target.value)} />
        </div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {done && <p className="text-sm text-green-700">{done}</p>}
      <div className="flex justify-end">
        <button className="btn-primary" disabled={saving || !email.trim() || !name.trim()} onClick={handleLink}>
          {saving ? "Vinculando..." : "Vincular profissional"}
        </button>
      </div>
    </div>
  );
}
