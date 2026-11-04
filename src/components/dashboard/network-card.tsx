"use client";

import { useEffect, useState } from "react";
import { getMyNetwork, createNetwork, createSalonInNetwork, type MyNetwork } from "@/lib/actions/organizations";
import { NetworkPanelCard } from "./network-panel-card";

// Rede de salões (franqueador). Só dono. Criar rede e criar salão dentro dela.
// O salão criado aparece em "Seus salões" para o franqueador trocar para ele.
export function NetworkCard() {
  const [network, setNetwork] = useState<MyNetwork | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [netName, setNetName] = useState("");
  const [salonName, setSalonName] = useState("");
  const [slug, setSlug] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  useEffect(() => {
    let active = true;
    getMyNetwork().then((res) => {
      if (!active) return;
      if (!res.error) setNetwork(res.data ?? null);
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

      {!network && (
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
