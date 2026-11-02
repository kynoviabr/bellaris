"use client";

import { useActionState, useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { BellarisMark } from "@/components/brand/bellaris-mark";
import { register } from "@/lib/actions/auth";
import { getActivePlans, type PlanOption } from "@/lib/actions/onboarding";
import { OwnerFormFields, PlanPicker } from "@/components/onboarding/owner-form-fields";
import Link from "next/link";

export default function RegisterPage() {
  const [state, formAction, pending] = useActionState(register, undefined);
  const [plans, setPlans] = useState<PlanOption[]>([]);

  useEffect(() => {
    getActivePlans().then(setPlans).catch(() => setPlans([]));
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg p-4 sm:p-8">
      <div className="w-full max-w-2xl rounded-lg border border-[#DBE3EC] bg-white p-6 shadow-card sm:p-8">
        <div className="flex flex-col items-center text-center">
          <BellarisMark size={56} />
          <h1 className="mt-5 text-xl font-bold text-ink">Crie sua conta</h1>
          <p className="mt-1 text-sm text-muted">
            Preencha os dados do salão e do responsável. O acesso é liberado após a análise.
          </p>
        </div>

        <form action={formAction} className="mt-8 space-y-6">
          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-ink">Salão</h2>
            <div>
              <label className="field-label" htmlFor="orgName">Nome do salão</label>
              <input id="orgName" name="orgName" type="text" required placeholder="Ex: Amanda Beauty Studio" className="field-input" />
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-ink">Responsável</h2>
            <OwnerFormFields />
          </section>

          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-ink">Acesso</h2>
            <div>
              <label className="field-label" htmlFor="email">E-mail</label>
              <input id="email" name="email" type="email" required placeholder="contato@salao.com" className="field-input" />
            </div>
            <div>
              <label className="field-label" htmlFor="password">Senha</label>
              <input id="password" name="password" type="password" required placeholder="••••••••" className="field-input" />
            </div>
          </section>

          <section className="space-y-4">
            <PlanPicker plans={plans} />
          </section>

          {state?.error && (
            <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-danger">
              {state.error}
            </div>
          )}

          <button
            type="submit"
            disabled={pending}
            className="btn-primary mt-6 w-full justify-center border-emerald-600 bg-emerald-600 hover:bg-emerald-700"
          >
            {pending ? "Enviando cadastro..." : "Enviar cadastro"} <ArrowRight size={16} />
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-muted">
          Já tem uma conta? <Link href="/login" className="font-medium text-primary hover:underline">Faça login aqui</Link>
        </div>
      </div>
    </div>
  );
}
