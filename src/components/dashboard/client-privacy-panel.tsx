"use client";

import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { CONSENT_LABELS, CONSENT_TEXTS, type ConsentKind } from "@/lib/privacy/consent";
import {
  anonymizeClientData,
  exportClientData,
  getClientPrivacyStatus,
  grantClientConsent,
  revokeClientConsent,
} from "@/lib/actions/privacy";

type Status = {
  hasAnamnesis: boolean;
  hasPhotos: boolean;
  consentAnamnesis: boolean;
  consentPhotos: boolean;
};

export function ClientPrivacyPanel({ clientId, clientName }: { clientId: string; clientName: string }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [accepted, setAccepted] = useState<Record<ConsentKind, boolean>>({ anamnesis: false, photos: false });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [loadError, setLoadError] = useState("");

  async function load() {
    try {
      const res = await getClientPrivacyStatus(clientId);
      if (res && !("error" in res)) setStatus(res);
      else setLoadError("Privacidade indisponível: " + (res && "error" in res ? res.error : "resposta vazia do servidor."));
    } catch (err) {
      setLoadError("Erro ao carregar privacidade: " + (err instanceof Error ? err.message : String(err)));
    }
  }

  useEffect(() => {
    if (clientId && !clientId.startsWith("demo-")) load();
  }, [clientId]);

  if (!clientId || clientId.startsWith("demo-")) return null;
  if (!status) {
    return (
      <section className="card p-5 text-sm text-muted">
        {loadError || "Carregando privacidade e consentimento..."}
      </section>
    );
  }

  async function grant(kind: ConsentKind) {
    setBusy(true); setMessage("");
    const res = await grantClientConsent(clientId, kind);
    setBusy(false);
    if (!res.success) return setMessage(res.error ?? "Não foi possível registrar o consentimento.");
    setAccepted(a => ({ ...a, [kind]: false }));
    await load();
  }

  async function revoke(kind: ConsentKind) {
    const what = kind === "anamnesis" ? "a anamnese (dados de saúde)" : "as fotos";
    if (!window.confirm(`Retirar o consentimento e apagar ${what} desta cliente? Essa ação não pode ser desfeita.`)) return;
    setBusy(true); setMessage("");
    const res = await revokeClientConsent(clientId, kind);
    setBusy(false);
    if (!res.success) return setMessage(res.error ?? "Não foi possível retirar o consentimento.");
    setMessage("Consentimento retirado. Os dados correspondentes foram apagados.");
    await load();
  }

  async function exportData() {
    setBusy(true); setMessage("");
    const res = await exportClientData(clientId);
    setBusy(false);
    if (!res.success || !res.data) return setMessage(res.error ?? "Não foi possível exportar os dados.");
    const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dados-${clientName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function anonymize() {
    if (!window.confirm(`Excluir os dados de ${clientName}? Anamnese e fotos serão apagadas e o cadastro será anonimizado. Essa ação não pode ser desfeita.`)) return;
    setBusy(true); setMessage("");
    const res = await anonymizeClientData(clientId);
    setBusy(false);
    if (!res.success) return setMessage(res.error ?? "Não foi possível excluir os dados.");
    setMessage("Dados excluídos. Feche esta ficha e atualize a lista.");
  }

  const rows: { kind: ConsentKind; has: boolean; consent: boolean }[] = [
    { kind: "anamnesis", has: status.hasAnamnesis, consent: status.consentAnamnesis },
    { kind: "photos", has: status.hasPhotos, consent: status.consentPhotos },
  ];

  return (
    <section className="card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <ShieldCheck size={18} className="text-primary" />
        <h4 className="font-semibold text-ink">Privacidade e consentimento</h4>
      </div>

      {rows.map(row => (
        <div key={row.kind} className="rounded-md border border-[#E7EDF3] p-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <strong className="text-ink">{CONSENT_LABELS[row.kind]}</strong>
            <span className={row.consent ? "text-emerald-700" : "text-muted"}>
              {row.consent ? "Autorizado" : "Sem consentimento registrado"}
            </span>
          </div>

          {row.has && !row.consent && (
            <p className="mt-2 text-xs text-danger">
              Há dados desta cliente sem consentimento registrado. Registre o consentimento abaixo ou exclua os dados.
            </p>
          )}

          {!row.consent && (
            <div className="mt-3 space-y-2">
              <label className="flex items-start gap-2 text-xs text-muted">
                <input type="checkbox" className="mt-0.5 h-4 w-4 accent-primary" checked={accepted[row.kind]}
                  onChange={e => setAccepted(a => ({ ...a, [row.kind]: e.target.checked }))} />
                <span>{CONSENT_TEXTS[row.kind]}</span>
              </label>
              <button type="button" className="btn-outline" disabled={busy || !accepted[row.kind]} onClick={() => grant(row.kind)}>
                Registrar consentimento
              </button>
            </div>
          )}

          {row.consent && (
            <button type="button" className="btn-outline mt-3" disabled={busy} onClick={() => revoke(row.kind)}>
              Retirar consentimento e apagar
            </button>
          )}
        </div>
      ))}

      <div className="flex flex-wrap gap-2 border-t pt-4">
        <button type="button" className="btn-outline" disabled={busy} onClick={exportData}>Exportar dados (JSON)</button>
        <button type="button" className="btn-outline text-danger" disabled={busy} onClick={anonymize}>Excluir dados desta cliente</button>
        <a href="/privacidade" target="_blank" rel="noreferrer" className="self-center text-xs text-muted underline">Política de privacidade</a>
      </div>

      {message && <p role="status" className="text-sm text-ink">{message}</p>}
    </section>
  );
}
