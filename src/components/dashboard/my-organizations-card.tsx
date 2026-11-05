"use client";

import { useEffect, useState } from "react";
import { listMyOrganizations, setSalonNetworkBlocked, switchActiveOrganization, type MyOrganization } from "@/lib/actions/organizations";

// Troca de salão ativo e bloqueio de salão pelo dono da rede.
// Aparece com mais de um vínculo, ou quando algum salão está sem acesso, para o salão não sumir da tela.
export const RETURN_TO_SETTINGS_KEY = "bellaris:return-to-settings";

export function MyOrganizationsCard() {
  const [items, setItems] = useState<MyOrganization[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
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

  if (!loaded || (items.length <= 1 && items.every((org) => org.accessible))) return null;

  async function handleSwitch(organizationId: string) {
    setBusyId(organizationId);
    setError("");
    const res = await switchActiveOrganization(organizationId);
    if (res.error) {
      setError(res.error);
      setBusyId(null);
      return;
    }
    // Marcador de uso único: a próxima carga abre Configurações e apaga o marcador.
    try { sessionStorage.setItem(RETURN_TO_SETTINGS_KEY, "1"); } catch { /* navegador sem sessionStorage */ }
    window.location.reload();
  }

  async function handleBlock(org: MyOrganization) {
    setBusyId(org.organizationId);
    setError("");
    const res = await setSalonNetworkBlocked(org.organizationId, !org.salonBlocked);
    if (res.error) {
      setError(res.error);
      setBusyId(null);
      return;
    }
    window.location.reload();
  }

  return (
    <div className="bg-white rounded-lg border shadow-sm p-6 space-y-3">
      <h3 className="font-semibold text-lg text-ink">Seus salões</h3>
      <p className="text-sm text-muted">Você tem acesso a mais de um salão. O salão marcado é o que aparece no sistema.</p>
      <ul className="divide-y divide-[#DBE3EC]">
        {items.map((org) => {
          const disabled = busyId !== null;
          return (
            <li key={org.organizationId} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className={`text-sm font-medium truncate ${org.accessible ? "text-ink" : "text-muted"}`}>{org.name}</p>
                {org.networkPlatformBlocked && <p className="text-xs font-semibold text-rose-700">Rede bloqueada pela Bellaris</p>}
                {!org.networkPlatformBlocked && org.salonBlocked && <p className="text-xs font-semibold text-rose-700">Bloqueado pela rede</p>}
                {org.accessible && org.isActive && <p className="text-xs text-muted">Salão atual</p>}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {org.accessible && !org.isActive && (
                  <button className="btn-outline" disabled={disabled} onClick={() => handleSwitch(org.organizationId)}>
                    {busyId === org.organizationId ? "Trocando..." : "Usar este salão"}
                  </button>
                )}
                {org.canManage && !org.networkPlatformBlocked && (
                  <button className="btn-outline" disabled={disabled} onClick={() => handleBlock(org)}>
                    {busyId === org.organizationId ? "Salvando..." : org.salonBlocked ? "Liberar salão" : "Bloquear salão"}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
