"use server";

import { createClient } from "@/lib/supabase/server";

export type PlatformNetwork = { networkId: string; name: string; ownerUserId: string; platformBlocked: boolean; salonCount: number };

// Master da Bellaris: redes da plataforma e se cada uma está bloqueada. O banco confere o papel.
export async function listPlatformNetworks(): Promise<{ data?: PlatformNetwork[]; error?: string }> {
  const supabase = await createClient();
  if (!supabase) return { error: "Supabase não configurado" };

  const { data, error } = await supabase.rpc("platform_list_networks");
  if (error) {
    if (error.message.includes("Apenas o master")) return { error: "Apenas o master da plataforma pode ver as redes." };
    return { error: "Não foi possível carregar as redes." };
  }
  return {
    data: (data ?? []).map((r: { network_id: string; name: string; owner_user_id: string; platform_blocked: boolean; salon_count: number | string }) => ({
      networkId: r.network_id,
      name: r.name,
      ownerUserId: r.owner_user_id,
      platformBlocked: r.platform_blocked,
      salonCount: Number(r.salon_count),
    })),
  };
}

// Master da Bellaris: bloqueia ou libera a rede inteira. Nenhum salão da rede acessa enquanto estiver bloqueada.
export async function setPlatformNetworkBlocked(networkId: string, blocked: boolean): Promise<{ error?: string }> {
  const supabase = await createClient();
  if (!supabase) return { error: "Supabase não configurado" };

  const { error } = await supabase.rpc("platform_set_network_blocked", { p_network_id: networkId, p_blocked: blocked });
  if (error) {
    if (error.message.includes("Apenas o master")) return { error: "Apenas o master da plataforma pode bloquear redes." };
    if (error.message.includes("não encontrada")) return { error: "Rede não encontrada." };
    return { error: "Não foi possível alterar o bloqueio da rede. Tente novamente." };
  }
  return {};
}
