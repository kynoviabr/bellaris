"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { Sparkles, ArrowLeft, LockKeyhole } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const [valid, setValid] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("Verificando link de recuperação...");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const client = createClient();
    if (!client) { setMessage("Serviço de autenticação indisponível."); return; }
    let active = true;
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const query = new URLSearchParams(window.location.search);
    const isRecovery = hash.get("type") === "recovery" || Boolean(query.get("code"));
    const linkError = hash.get("error_description") || query.get("error_description");
    if (linkError) { setMessage("O link expirou ou é inválido. Solicite um novo e-mail."); return; }
    const { data: { subscription } } = client.auth.onAuthStateChange((event, session) => {
      if (active && event === "PASSWORD_RECOVERY" && session) {
        setValid(true);
        setMessage("");
      }
    });
    async function verify() {
      if (!isRecovery) {
        if (active) setMessage("Abra esta página pelo link de recuperação enviado ao seu e-mail.");
        return;
      }
      const code = query.get("code");
      if (code) {
        const { error } = await client!.auth.exchangeCodeForSession(code);
        if (error) { if (active) setMessage("O link expirou ou é inválido. Solicite outro."); return; }
      }
      const { data, error } = await client!.auth.getSession();
      if (!active) return;
      if (!error && data.session) {
        setValid(true);
        setMessage("");
      } else {
        setMessage("Não foi possível validar o link. Solicite outro e-mail de recuperação.");
      }
    }
    void verify();
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    if (password.length < 12) { setMessage("A senha deve conter pelo menos 12 caracteres."); return; }
    if (password !== confirmation) { setMessage("As senhas não coincidem."); return; }
    setPending(true);
    const client = createClient();
    if (!client) { setMessage("Serviço indisponível."); setPending(false); return; }
    const { error } = await client.auth.updateUser({ password });
    setMessage(error ? "Não foi possível atualizar a senha: " + error.message : "Senha atualizada com sucesso. Volte ao login para entrar.");
    if (!error) {
      setValid(false);
      await client.auth.signOut();
    }
    setPending(false);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg p-4 sm:p-8">
      <section className="w-full max-w-sm rounded-lg border border-[#DBE3EC] bg-white p-6 shadow-card sm:p-8">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary"><Sparkles size={24} className="text-white" /></div>
          <h1 className="mt-5 text-xl font-bold text-ink">Redefinir senha</h1>
          <p className="mt-2 text-sm text-muted">Cadastre uma nova senha para acessar sua conta.</p>
        </div>
        {message && <p role="status" className="mt-6 rounded-md bg-[#F3F6FA] p-3 text-sm text-ink">{message}</p>}
        {valid && <form onSubmit={save} className="mt-8 space-y-4">
          <div><label className="field-label" htmlFor="password">Nova senha</label>
            <input className="field-input" id="password" type="password" autoComplete="new-password" minLength={12} required value={password} onChange={e => setPassword(e.target.value)} />
          </div>
          <div><label className="field-label" htmlFor="confirmation">Confirmar nova senha</label>
            <input className="field-input" id="confirmation" type="password" autoComplete="new-password" minLength={12} required value={confirmation} onChange={e => setConfirmation(e.target.value)} />
          </div>
          <button className="btn-primary mt-6 w-full justify-center" type="submit" disabled={pending}>
            <LockKeyhole size={16} /> {pending ? "Salvando..." : "Salvar nova senha"}
          </button>
        </form>}
        <Link href="/login" className="mt-6 flex items-center justify-center gap-2 text-sm font-medium text-primary hover:underline"><ArrowLeft size={16} /> Voltar ao login</Link>
      </section>
    </main>
  );
}
