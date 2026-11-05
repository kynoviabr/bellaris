"use client";

import { useEffect, useState } from "react";
import { listMyOrganizations, setSalonMembershipActive, switchActiveOrganization, type MyOrganization } from "@/lib/actions/organizations";

// Troca de salão ativo. Só aparece quando o usuário tem mais de um salão.
// Ao trocar, a página recarrega para não manter dados do salão anterior na tela.
export const RETURN_TO_SETTINGS_KEY = "bellaris:return-to-settings";

export function MyOrganizationsCard() {
  const [items, setItems] = useState<MyOrganization[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    // Consome o marcador de volta para Configurações: a próxima carga abre o Painel normalmente.
    try { sessionStorage.removeItem(RETURN_TO_SETTINGS_KEY); } catch { /* sem sessionStorage */ }
  }, []);

  useEffect(() => {
    let active = true;
    listMyOrganizations().then((res) => {
      if (!active) return;
      if (!res.error) setItems(res.data ?? []);
      setLoaded(true);
    });
    return () => { active = false; };
  }, []);

  // Aparece com mais de um vínculo, ou quando algum salão está desativado (para não sumir da tela).
  if (!loaded || (items.length <= 1 && items.every((org) => org.membershipActive))) return null;

  async function handleSwitch(organizationId: string) {
    setSwitchingId(organizationId);
    setError("");
    const res = await switchActiveOrganization(organizationId);
    if (res.error) {
      setError(res.error);
      setSwitchingId(null);
      return;
    }
    // Marcador de uso único: a próxima carga abre Configurações e apaga o marcador.
    try { sessionStorage.setItem(RETURN_TO_SETTINGS_KEY, "1"); } catch { /* navegador sem sessionStorage */ }
    window.location.reload();
  }

  async function handleToggle(org: MyOrganization) {
    setTogglingId(org.organizationId);
    setError("");
    const res = await setSalonMembershipActive(org.organizationId, !org.membershipActive);
    if (res.error) {
      setError(res.error);
      setTogglingId(null);
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
              <p className={`text-sm font-medium truncate ${org.membershipActive ? "text-ink" : "text-muted"}`}>{org.name}</p>
              {!org.membershipActive && <p className="text-xs font-semibold text-rose-700">Desativado</p>}
              {org.membershipActive && org.isActive && <p className="text-xs text-muted">Salão atual</p>}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {org.membershipActive && !org.isActive && (
                <button className="btn-outline" disabled={switchingId !== null || togglingId !== null} onClick={() => handleSwitch(org.organizationId)}>
                  {switchingId === org.organizationId ? "Trocando..." : "Usar este salão"}
                </button>
              )}
              {org.canManage && (
                <button className="btn-outline" disabled={switchingId !== null || togglingId !== null} onClick={() => handleToggle(org)}>
                  {togglingId === org.organizationId ? "Salvando..." : org.membershipActive ? "Desativar acesso" : "Ativar acesso"}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
