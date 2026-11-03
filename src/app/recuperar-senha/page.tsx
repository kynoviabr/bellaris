"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, Mail } from "lucide-react";
import { BellarisMark } from "@/components/brand/bellaris-mark";
import { createClient } from "@/lib/supabase/client";

const SUCCESS_TEXT = "Enviamos um link de redefinição para o seu e-mail, se ele estiver cadastrado. Confira também a caixa de spam.";

function recoveryErrorMessage(error: { code?: string; message?: string }): string {
  const code = error.code ?? "";
  const text = error.message ?? "";
  if (code === "over_email_send_rate_limit" || /rate limit|too many/i.test(text)) return "Você já pediu um link há pouco. Aguarde alguns minutos e tente novamente.";
  return "Não foi possível enviar o link agora. Tente novamente em instantes.";
}

export default function RecoverPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setMessage("");
    try {
      const supabase = createClient();
      if (!supabase) {
        setMessage("Serviço de autenticação indisponível.");
        return;
      }
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.origin + "/redefinir-senha",
      });
      setMessage(error
        ? recoveryErrorMessage(error)
        : SUCCESS_TEXT);
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg p-4 sm:p-8">
      <section className="w-full max-w-sm rounded-lg border border-[#DBE3EC] bg-white p-6 shadow-card sm:p-8">
        <div className="flex flex-col items-center text-center">
          <BellarisMark size={56} />
          <h1 className="mt-5 text-xl font-bold text-ink">Recuperar senha</h1>
          <p className="mt-2 text-sm text-muted">Informe seu e-mail para receber um link de recuperação.</p>
        </div>
        <form onSubmit={submit} className="mt-8 space-y-4">
          <div>
            <label htmlFor="email" className="field-label">E-mail</label>
            <input id="email" className="field-input" type="email" autoComplete="email" placeholder="seu@email.com" required value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          {message && <p role="status" className={`rounded-md border p-3 text-sm ${message === SUCCESS_TEXT ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`}>{message}</p>}
          <button className="btn-primary mt-6 w-full justify-center" type="submit" disabled={pending}>
            <Mail size={16} /> {pending ? "Enviando..." : "Enviar link de recuperação"}
          </button>
        </form>
        <Link href="/login" className="mt-6 flex items-center justify-center gap-2 text-sm font-medium text-primary hover:underline">
          <ArrowLeft size={16} /> Voltar ao login
        </Link>
      </section>
    </main>
  );
}
