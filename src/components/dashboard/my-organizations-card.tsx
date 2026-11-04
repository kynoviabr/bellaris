"use client";

import { useEffect, useState } from "react";
import { listMyOrganizations, switchActiveOrganization, type MyOrganization } from "@/lib/actions/organizations";

// Troca de salão ativo. Só aparece quando o usuário tem mais de um salão.
// Ao trocar, a página recarrega para não manter dados do salão anterior na tela.
export function MyOrganizationsCard() {
  const [items, setItems] = useState<MyOrganization[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    listMyOrganizations().then((res) => {
      if (!active) return;
      if (!res.error) setItems(res.data ?? []);
      setLoaded(true);
    });
    return () => { active = false; };
  }, []);

  if (!loaded || items.length <= 1) return null;

  async function handleSwitch(organizationId: string) {
    setSwitchingId(organizationId);
    setError("");
    const res = await switchActiveOrganization(organizationId);
    if (res.error) {
      setError(res.error);
      setSwitchingId(null);
      return;
    }
    window.location.reload();
  }

  return (
    <div className="bg-white rounded-lg border shadow-sm p-6 space-y-3">
      <h3 className="font-semibold text-lg text-ink">Seus salões</h3>
      <p className="text-sm text-muted">Você tem acesso a mais de um salão. O salão marcado é o que aparece no sistema.</p>
      <ul className="divide-y divide-[#DBE3EC]">
        {items.map((org) => (
          <li key={org.organizationId} className="flex items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink truncate">{org.name}</p>
              {org.isActive && <p className="text-xs text-muted">Salão atual</p>}
            </div>
            {!org.isActive && (
              <button className="btn-outline" disabled={switchingId !== null} onClick={() => handleSwitch(org.organizationId)}>
                {switchingId === org.organizationId ? "Trocando..." : "Usar este salão"}
              </button>
            )}
          </li>
        ))}
      </ul>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
