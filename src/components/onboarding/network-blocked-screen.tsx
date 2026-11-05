import { Ban } from "lucide-react";
import { MyOrganizationsCard } from "@/components/dashboard/my-organizations-card";
import { NetworkCard } from "@/components/dashboard/network-card";

/**
 * Tela do dono da rede quando o salão ativo está bloqueado (pela rede ou pela Bellaris).
 * Mostra o motivo, a fatura da rede e a lista de salões, para ele escolher outro ou liberar.
 * Não carrega dados de atendimento do salão bloqueado.
 */
export function NetworkBlockedScreen({ email, platformBlocked, logout }: { email: string; platformBlocked: boolean; logout: () => Promise<void> }) {
  return (
    <div className="min-h-screen bg-bg p-4 sm:p-8">
      <header className="mx-auto flex max-w-2xl items-center justify-between pb-4">
        <span className="text-sm text-muted">{email}</span>
        <form action={logout}>
          <button type="submit" className="inline-flex h-10 items-center rounded-lg border border-[#E8D9C7] bg-[#FFFCF8] px-5 text-sm font-semibold">Sair</button>
        </form>
      </header>
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="rounded-lg border border-[#DBE3EC] bg-white p-8 text-center shadow-card">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-rose-100">
            <Ban size={24} className="text-rose-700" />
          </div>
          <h1 className="mt-5 text-xl font-bold text-ink">
            {platformBlocked ? "Rede bloqueada pela Bellaris" : "Este salão está bloqueado pela rede"}
          </h1>
          <p className="mt-2 text-sm text-muted">
            {platformBlocked
              ? "Nenhum salão da rede acessa o sistema enquanto o bloqueio estiver ativo. Veja a fatura abaixo e fale com a Bellaris para regularizar."
              : "Os usuários deste salão não acessam o sistema nele. Escolha outro salão abaixo ou libere este."}
          </p>
        </div>
        <MyOrganizationsCard />
        <NetworkCard />
      </div>
    </div>
  );
}
