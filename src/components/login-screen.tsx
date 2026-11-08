"use client";

import { useActionState } from "react";
import { ArrowRight } from "lucide-react";
import { login } from "@/lib/actions/auth";
import Link from "next/link";
import { BellarisMark } from "@/components/brand/bellaris-mark";
import { SalonMark } from "@/components/salon-mark";

export function LoginScreen({
  title = "Bellaris",
  logoUrl = null,
}: {
  title?: string;
  logoUrl?: string | null;
}) {
  const [state, formAction, pending] = useActionState(login, undefined);

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg p-4 sm:p-8">
      <div className="w-full max-w-sm rounded-lg border border-[#DBE3EC] bg-white p-6 shadow-card sm:p-8">
        <div className="flex flex-col items-center text-center">
          <SalonMark
            logoUrl={logoUrl}
            boxClassName="h-14 w-14"
            fallback={<BellarisMark size={56} />}
          />
          <h1 className="mt-5 text-xl font-bold text-ink">{title}</h1>
          <p className="mt-1 text-sm text-muted">Acesso ao painel administrativo</p>
        </div>

        <form action={formAction} className="mt-8 space-y-4">
          <div>
            <label className="field-label" htmlFor="email">
              E-mail
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              placeholder="seu@email.com"
              className="field-input"
            />
          </div>

          <div>
            <label className="field-label" htmlFor="password">
              Senha
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              placeholder="••••••••"
              className="field-input"
            />
          </div>

          {state?.error && (
            <div className="rounded-md bg-rose-50 p-3 text-sm text-danger">
              {state.error}
            </div>
          )}

          <button
            type="submit"
            disabled={pending}
            className="btn-primary mt-6 w-full justify-center"
          >
            {pending ? "Entrando..." : "Acessar painel"} <ArrowRight size={16} />
          </button>
        </form>
        <p className="mt-4 text-center text-sm"><Link href="/recuperar-senha" className="text-primary hover:underline font-medium">Esqueci minha senha</Link></p>
        <p className="mt-4 text-center text-xs text-muted"><a href="/privacidade" className="underline">Política de privacidade</a></p>

        <div className="mt-6 text-center text-sm text-muted">
          Não tem uma conta? <Link href="/cadastro" className="text-primary hover:underline font-medium">Cadastre seu Salão</Link>
        </div>
      </div>
    </div>
  );
}
