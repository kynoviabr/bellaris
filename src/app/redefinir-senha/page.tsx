"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const [valid, setValid] = useState(false);
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("Verificando link...");
  useEffect(() => {
    const client = createClient();
    if (!client) { setMessage("Serviço indisponível."); return; }
    const { data: { subscription } } = client.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" && session) {
        setValid(true);
        setMessage("");
      }
    });
    return () => subscription.unsubscribe();
  }, []);
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password.length < 12) { setMessage("Use pelo menos 12 caracteres."); return; }
    const client = createClient();
    if (!client) return;
    const { error } = await client.auth.updateUser({ password });
    setMessage(error ? error.message : "Senha alterada. Acesse o login.");
    if (!error) setValid(false);
  }
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg p-4">
      <section className="w-full max-w-sm rounded-lg bg-white p-6 shadow-card">
        <h1 className="text-xl font-bold">Redefinir senha</h1>
        <p role="status" className="mt-3 text-sm">{message}</p>
        {valid && <form onSubmit={save} className="mt-6 space-y-4">
          <label className="field-label" htmlFor="password">Nova senha</label>
          <input className="field-input" id="password" type="password" autoComplete="new-password" minLength={12} required value={password} onChange={e => setPassword(e.target.value)} />
          <button className="btn-primary w-full justify-center" type="submit">Salvar senha</button>
        </form>}
        <a href="/login" className="mt-5 block text-sm underline">Voltar ao login</a>
      </section>
    </main>
  );
}
