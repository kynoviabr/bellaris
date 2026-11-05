"use client";

import { useEffect, useState } from "react";
import { listPlatformNetworks, setPlatformNetworkBlocked, type PlatformNetwork } from "@/lib/actions/platform-networks";

// Master da Bellaris: bloqueia ou libera redes inteiras. Bloqueio de rede vale para todos os salões dela.
export function NetworksPanel() {
  const [items, setItems] = useState<PlatformNetwork[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    listPlatformNetworks().then((res) => {
      if (!active) return;
      if (res.error) setError(res.error);
      else setItems(res.data ?? []);
      setLoaded(true);
    });
    return () => { active = false; };
  }, []);

  async function handleToggle(net: PlatformNetwork) {
    setBusyId(net.networkId);
    setError("");
    const res = await setPlatformNetworkBlocked(net.networkId, !net.platformBlocked);
    if (res.error) {
      setError(res.error);
      setBusyId(null);
      return;
    }
    window.location.reload();
  }

  if (!loaded || items.length === 0) return null;

  return (
    <div className="card space-y-3">
      <div>
        <h3 className="font-semibold">Redes de salões</h3>
        <p className="text-sm text-muted">Bloquear uma rede impede o acesso de todos os salões dela, inclusive do dono da rede. A fatura continua visível para o dono.</p>
      </div>
      <ul className="divide-y divide-[#E8D9C7]">
        {items.map((net) => (
          <li key={net.networkId} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div>
              <p className="font-medium">{net.name}</p>
              <p className="text-xs text-muted">{net.salonCount} {net.salonCount === 1 ? "salão" : "salões"}</p>
              {net.platformBlocked && <p className="text-xs font-semibold text-rose-700">Rede bloqueada</p>}
            </div>
            <button
              className="btn-outline"
              disabled={busyId !== null}
              onClick={() => handleToggle(net)}
            >
              {busyId === net.networkId ? "Salvando..." : net.platformBlocked ? "Liberar rede" : "Bloquear rede"}
            </button>
          </li>
        ))}
      </ul>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
