"use client";

import { useEffect, useState } from "react";
import { getNetworkBillingPreview, type BillingPreviewRow, getMyNetwork, createNetwork, createSalonInNetwork, listSalonsToLink, linkSalonToNetwork, listNetworkSalons, unlinkSalonFromNetwork, type MyNetwork, type LinkableSalon, type NetworkSalon } from "@/lib/actions/organizations";
import { appConfirm } from "@/components/ui/app-dialog";
import { NetworkPanelCard } from "./network-panel-card";

// Mês atual (AAAA-MM) no fuso de São Paulo.
function currentMonthSP(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }).slice(0, 7);
}

// Rede de salões (franqueador). Só dono. Criar rede e criar salão dentro dela.
// O salão criado aparece em "Seus salões" para o franqueador trocar para ele.
export function NetworkCard() {
  const [network, setNetwork] = useState<MyNetwork | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [netName, setNetName] = useState("");
  const [salonName, setSalonName] = useState("");
  const [slug, setSlug] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [linkable, setLinkable] = useState<LinkableSalon[]>([]);
  const [linkId, setLinkId] = useState("");
  const [netSalons, setNetSalons] = useState<NetworkSalon[]>([]);
  const [billing, setBilling] = useState<BillingPreviewRow[]>([]);
  const billingMonth = currentMonthSP();

  useEffect(() => {
    let active = true;
    getMyNetwork().then(async (res) => {
      if (!active) return;
      if (res.error) setLoadError(res.error);
      else {
        setNetwork(res.data ?? null);
        if (res.data) {
          const [salons, inNetwork] = await Promise.all([listSalonsToLink(), listNetworkSalons()]);
          if (!active) return;
          if (salons.data) setLinkable(salons.data);
          if (inNetwork.data) setNetSalons(inNetwork.data);
          const prev = await getNetworkBillingPreview(currentMonthSP());
          if (active && prev.data) setBilling(prev.data);
        }
      }
      setLoaded(true);
    });
    return () => { active = false; };
  }, []);

  if (!loaded) return null;

  async function handleCreateNetwork() {
    setSaving(true); setError(""); setDone("");
    const res = await createNetwork(netName.trim());
    setSaving(false);
    if (res.error) { setError(res.error); return; }
    setNetwork({ id: res.networkId as string, name: netName.trim() });
    setDone("Rede criada. Este salão agora faz parte dela.");
  }

  async function handleLinkSalon() {
    setSaving(true); setError(""); setDone("");
    const res = await linkSalonToNetwork(linkId);
    setSaving(false);
    if (res.error) { setError(res.error); return; }
    const name = linkable.find((s) => s.organizationId === linkId)?.name ?? "Salão";
    setLinkable((prev) => prev.filter((s) => s.organizationId !== linkId));
    setLinkId("");
    setDone(`${name} agora faz parte da rede.`);
  }

  async function handleUnlinkSalon(s: NetworkSalon) {
    if (!await appConfirm(`Desvincular "${s.name}" da rede? Ele deixa de aparecer no painel da rede. Os dados do salão não são apagados.`)) return;
    setSaving(true); setError(""); setDone("");
    const res = await unlinkSalonFromNetwork(s.organizationId);
    setSaving(false);
    if (res.error) { setError(res.error); return; }
    setNetSalons((prev) => prev.filter((x) => x.organizationId !== s.organizationId));
    setLinkable((prev) => [...prev, s]);
    setDone(`${s.name} foi desvinculado da rede.`);
  }

  async function handleCreateSalon() {
    setSaving(true); setError(""); setDone("");
    const res = await createSalonInNetwork(salonName.trim(), slug.trim().toLowerCase());
    setSaving(false);
    if (res.error) { setError(res.error); return; }
    setDone("Salão criado na rede. Use o cartão \"Seus salões\" para trocar para ele.");
    setSalonName(""); setSlug("");
  }

  return (
    <>
    <div className="bg-white rounded-lg border shadow-sm p-6 space-y-4">
      <h3 className="font-semibold text-lg text-ink">{network ? `Rede: ${network.name}` : "Rede de salões"}</h3>

      {!network && loadError && (
        <p className="text-sm text-red-600">{loadError}</p>
      )}

      {!network && !loadError && (
        <>
          <p className="text-sm text-muted">Crie uma rede para reunir salões sob a sua gestão. Este salão passa a fazer parte dela.</p>
          <div>
            <label className="field-label" htmlFor="net-name">Nome da rede</label>
            <input id="net-name" className="field-input" maxLength={120} value={netName} onChange={(e) => setNetName(e.target.value)} />
          </div>
          <div className="flex justify-end">
            <button className="btn-primary" disabled={saving || !netName.trim()} onClick={handleCreateNetwork}>{saving ? "Criando..." : "Criar rede"}</button>
          </div>
        </>
      )}

      {network && billing.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-ink">Prévia da fatura da rede ({billingMonth}) — somente leitura</p>
          <p className="text-xs text-muted">Valor = mensalidade do plano menos o desconto definido pela plataforma. Salões isentos ou sem vínculo ativo não entram.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted">
                  <th className="py-1 pr-3">Salão</th>
                  <th className="py-1 pr-3">Plano</th>
                  <th className="py-1 pr-3 text-right">Mensalidade</th>
                  <th className="py-1 pr-3 text-right">Desconto</th>
                  <th className="py-1 pr-3 text-right">Valor</th>
                  <th className="py-1 pr-3">Vencimento</th>
                  <th className="py-1">Entra</th>
                </tr>
              </thead>
              <tbody>
                {billing.map((r) => (
                  <tr key={r.organizationId} className="border-t">
                    <td className="py-1 pr-3 text-ink">{r.salonName}</td>
                    <td className="py-1 pr-3">{r.planName ?? "—"}</td>
                    <td className="py-1 pr-3 text-right">{r.monthlyPrice === null ? "—" : `R$ ${r.monthlyPrice.toFixed(2).replace(".", ",")}`}</td>
                    <td className="py-1 pr-3 text-right">{r.discountPercent}%</td>
                    <td className="py-1 pr-3 text-right">R$ {r.amount.toFixed(2).replace(".", ",")}</td>
                    <td className="py-1 pr-3">{r.dueBusinessDay === null ? "—" : `dia ${r.dueBusinessDay}`}</td>
                    <td className="py-1">{r.included ? "Sim" : "Não"}</td>
                  </tr>
                ))}
                <tr className="border-t font-semibold">
                  <td className="py-1 pr-3 text-ink" colSpan={4}>Total da fatura</td>
                  <td className="py-1 pr-3 text-right">R$ {billing.reduce((t, r) => t + r.amount, 0).toFixed(2).replace(".", ",")}</td>
                  <td colSpan={2} />
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {network && netSalons.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-ink">Salões nesta rede</p>
          {netSalons.map((s) => (
            <div key={s.organizationId} className="flex items-center justify-between gap-3 rounded border px-3 py-2">
              <span className="text-sm text-ink">{s.name}</span>
              <button className="btn-outline text-sm" disabled={saving} onClick={() => handleUnlinkSalon(s)}>Desvincular</button>
            </div>
          ))}
        </div>
      )}

      {network && linkable.length > 0 && (
        <>
          <p className="text-sm text-muted">Vincule um salão que já é seu à rede. Ele passa a aparecer no painel da rede.</p>
          <div>
            <label className="field-label" htmlFor="link-salon">Salão</label>
            <select id="link-salon" className="field-input" value={linkId} onChange={(e) => setLinkId(e.target.value)}>
              <option value="">Escolha um salão</option>
              {linkable.map((s) => <option key={s.organizationId} value={s.organizationId}>{s.name}</option>)}
            </select>
          </div>
          <div className="flex justify-end">
            <button className="btn-primary" disabled={saving || !linkId} onClick={handleLinkSalon}>{saving ? "Vinculando..." : "Vincular à rede"}</button>
          </div>
        </>
      )}

      {network && (
        <>
          <p className="text-sm text-muted">Crie um salão novo dentro da rede. Você será o dono dele, com acesso liberado.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="field-label" htmlFor="salon-name">Nome do salão</label>
              <input id="salon-name" className="field-input" maxLength={120} value={salonName} onChange={(e) => setSalonName(e.target.value)} />
            </div>
            <div>
              <label className="field-label" htmlFor="salon-slug">Endereço (sem espaços)</label>
              <input id="salon-slug" className="field-input" maxLength={60} value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="ex.: salao-centro" />
            </div>
          </div>
          <div className="flex justify-end">
            <button className="btn-primary" disabled={saving || !salonName.trim() || !slug.trim()} onClick={handleCreateSalon}>{saving ? "Criando..." : "Criar salão na rede"}</button>
          </div>
        </>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      {done && <p className="text-sm text-green-700">{done}</p>}
    </div>
    {network && <NetworkPanelCard />}
    </>
  );
}
