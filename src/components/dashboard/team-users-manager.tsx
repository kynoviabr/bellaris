"use client";
import { useEffect, useState, type FormEvent } from "react";
import { createTeamUser, listTeamUsers, type TeamRole } from "@/lib/actions/team-users";

const ROLE_OPTIONS: { value: TeamRole; label: string }[] = [
  { value: "admin", label: "Gestor" },
  { value: "staff", label: "Equipe de atendimento" },
  { value: "professional", label: "Profissional" },
];
const ROLE_NAMES: Record<string, string> = { owner: "Proprietária", admin: "Gestor", staff: "Equipe de atendimento", professional: "Profissional" };

type Row = { id: string; name: string; email: string; phone: string; role: string };

export function TeamUsersManager({ isOwner }: { isOwner: boolean }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({ name: "", email: "", phone: "", role: "staff" as TeamRole });

  function load() {
    listTeamUsers().then(r => { setRows(r.rows); setError(r.error || ""); });
  }
  useEffect(load, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true); setError(""); setMessage("");
    const result = await createTeamUser({ ...form, siteUrl: window.location.origin });
    setSaving(false);
    if (!result.success) { setError(result.error ?? "Não foi possível criar o usuário."); return; }
    setMessage(("warning" in result && result.warning) || ("message" in result && result.message) || "Usuário criado.");
    setForm({ name: "", email: "", phone: "", role: "staff" });
    setOpen(false);
    load();
  }

  const roleOptions = ROLE_OPTIONS.filter(o => o.value !== "admin" || isOwner);

  return (
    <div className="bg-white rounded-lg border shadow-sm p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-lg text-ink">Usuários do sistema</h3>
          <p className="text-sm text-muted">Crie o acesso de quem trabalha no salão. A pessoa recebe um e-mail para definir a própria senha.</p>
        </div>
        <button type="button" className="btn-primary" onClick={() => { setOpen(o => !o); setError(""); setMessage(""); }}>
          {open ? "Fechar" : "Novo usuário"}
        </button>
      </div>

      {message && <p className="text-sm text-emerald-700">{message}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {open && (
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2 border-t pt-4">
          <label><span className="field-label">Nome</span><input className="field-input" required minLength={2} maxLength={120} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
          <label><span className="field-label">E-mail</span><input className="field-input" type="email" required maxLength={255} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></label>
          <label><span className="field-label">Telefone</span><input className="field-input" maxLength={30} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></label>
          <label><span className="field-label">Perfil de acesso</span>
            <select className="field-input" value={form.role} onChange={e => setForm({ ...form, role: e.target.value as TeamRole })}>
              {roleOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          <div className="sm:col-span-2 flex justify-end gap-2">
            <button type="button" className="btn-outline" onClick={() => setOpen(false)}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Criando..." : "Criar usuário"}</button>
          </div>
        </form>
      )}

      <div className="divide-y">
        {rows.map(r => (
          <div key={r.id} className="py-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-medium text-ink">{r.name}</p>
              <p className="text-xs text-muted">{r.email}{r.phone ? ` · ${r.phone}` : ""}</p>
            </div>
            <span className="text-xs rounded-full bg-[#F7F9FC] border px-2.5 py-1 text-muted">{ROLE_NAMES[r.role] ?? r.role}</span>
          </div>
        ))}
        {rows.length === 0 && !error && <p className="py-3 text-sm text-muted">Nenhum usuário cadastrado além da proprietária.</p>}
      </div>
    </div>
  );
}
