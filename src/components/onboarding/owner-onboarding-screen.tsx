"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Clock } from "lucide-react";
import { BellarisMark } from "@/components/brand/bellaris-mark";
import { submitOwnerOnboarding, type PlanOption } from "@/lib/actions/onboarding";
import { OwnerFormFields, PlanPicker } from "@/components/onboarding/owner-form-fields";

type Props = {
  isOwner: boolean;
  accessStatus: "aguardando_dados" | "aguardando_aprovacao";
  accessNote: string | null;
  requestedPlanCode: string | null;
  plans: PlanOption[];
  owner: Record<string, string | null> | null;
};

/**
 * Tela exibida enquanto o salão não está liberado.
 * Dono + aguardando_dados: formulário com os dados do responsável e o plano.
 * Demais casos: mensagem de espera, sem formulário e sem dados do salão.
 */
export function OwnerOnboardingScreen({ isOwner, accessStatus, accessNote, requestedPlanCode, plans, owner }: Props) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(submitOwnerOnboarding, undefined);

  useEffect(() => {
    if (state && "ok" in state && state.ok) router.refresh();
  }, [state, router]);

  const waiting = !isOwner || accessStatus === "aguardando_aprovacao";

  // Enquanto o cadastro está em análise, a tela confere sozinha se o acesso foi liberado.
  useEffect(() => {
    if (!waiting) return;
    const tick = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const id = window.setInterval(tick, 20000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [waiting, router]);

  if (waiting) {
    return (
      <div className="mx-auto mt-16 max-w-lg rounded-lg border border-[#DBE3EC] bg-white p-8 text-center shadow-card">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-amber-100">
          <Clock size={24} className="text-amber-700" />
        </div>
        <h1 className="mt-5 text-xl font-bold text-ink">Cadastro em análise</h1>
        <p className="mt-2 text-sm text-muted">
          {isOwner
            ? "Recebemos os dados do seu salão. Assim que a análise for concluída, o acesso será liberado por aqui."
            : "Este salão ainda não está liberado para uso, porque o cadastro está em análise. Assim que for liberado, você terá acesso ao sistema."}
        </p>
      </div>
    );
  }

  const defaults = owner
    ? { ...Object.fromEntries(Object.entries(owner).map(([k, v]) => [k, v ?? ""])), documentType: owner.document_type ?? "cpf" }
    : {};

  return (
    <div className="mx-auto mt-8 max-w-2xl rounded-lg border border-[#DBE3EC] bg-white p-6 shadow-card sm:p-8">
      <div className="flex items-center gap-3">
        <BellarisMark size={40} />
        <div>
          <h1 className="text-lg font-bold text-ink">Complete o cadastro do salão</h1>
          <p className="text-sm text-muted">Os dados abaixo são necessários para liberar o acesso.</p>
        </div>
      </div>

      {accessNote && (
        <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <strong>Correção solicitada:</strong> {accessNote}
        </div>
      )}

      <form action={formAction} className="mt-6 space-y-6">
        <OwnerFormFields defaults={defaults} />

        <section className="space-y-4">
          <PlanPicker plans={plans} defaultCode={requestedPlanCode} />
        </section>

        {state && "error" in state && state.error && (
          <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-danger">{state.error}</div>
        )}

        <button type="submit" disabled={pending} className="btn-primary w-full justify-center border-emerald-600 bg-emerald-600 hover:bg-emerald-700">
          {pending ? "Enviando..." : "Enviar para análise"}
        </button>
      </form>
    </div>
  );
}
