"use client";
import { useEffect, useState, type FormEvent } from "react";
import { createTeamUser, deleteTeamUser, listTeamUsers, setTeamUserBlocked, updateTeamUser, type TeamRole } from "@/lib/actions/team-users";

const ROLE_OPTIONS: { value: TeamRole; label: string }[] = [
  { value: "admin", label: "Gestor" },
  { value: "staff", label: "Equipe de atendimento" },
  { value: "professional", label: "Profissional" },
];
const ROLE_NAMES: Record<string, string> = { owner: "Proprietária", admin: "Gestor", staff: "Equipe de atendimento", professional: "Profissional" };

type Row = { id: string; name: string; email: string; phone: string; role: string; blocked: boolean };
type Form = { id?: string; name: string; email: string; phone: string; role: TeamRole };
const EMPTY: Form = { name: "", email: "", phone: "", role: "staff" };

export function TeamUsersManager({ isOwner }: { isOwner: boolean }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Form>(EMPTY);
  const [busy, setBusy] = useState("");

  function load() {
    listTeamUsers().then(r => { setRows(r.rows); setError(r.error || ""); });
  }
  useEffect(load, []);

  function startEdit(r: Row) {
    setForm({ id: r.id, name: r.name, email: r.email, phone: r.phone, role: (r.role as TeamRole) });
    setOpen(true); setError(""); setMessage("");
  }

  function startNew() {
    setForm(EMPTY);
    setOpen(o => !o || Boolean(form.id)); setError(""); setMessage("");
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true); setError(""); setMessage("");
    const siteUrl = window.location.origin;
    const result = form.id
      ? await updateTeamUser({ ...form, id: form.id, siteUrl })
      : await createTeamUser({ ...form, siteUrl });
    setSaving(false);
    if (!result.success) { setError(result.error ?? "Não foi possível salvar."); return; }
    setMessage(("warning" in result && result.warning) || ("message" in result && result.message) || "Salvo.");
    setForm(EMPTY);
    setOpen(false);
    load();
  }

  async function toggleBlock(r: Row) {
    setBusy(r.id); setError(""); setMessage("");
    const result = await setTeamUserBlocked(r.id, !r.blocked);
    setBusy("");
    if (!result.success) setError(result.error ?? "Não foi possível alterar o acesso.");
    else { setMessage(result.message ?? "Acesso alterado."); load(); }
  }

  async function remove(r: Row) {
    if (!window.confirm(`Excluir ${r.name}? Esta ação não pode ser desfeita.`)) return;
    setBusy(r.id); setError(""); setMessage("");
    const result = await deleteTeamUser(r.id);
    setBusy("");
    if (!result.success) setError(result.error ?? "Não foi possível excluir.");
    else { setMessage(result.message ?? "Usuário excluído."); load(); }
  }

  const roleOptions = ROLE_OPTIONS.filter(o => o.value !== "admin" || isOwner);
  const editing = Boolean(form.id);

  return (
    <div className="bg-white rounded-lg border shadow-sm p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-lg text-ink">Usuários do sistema</h3>
          <p className="text-sm text-muted">Crie, edite ou bloqueie o acesso de quem trabalha no salão. Quem é bloqueado não consegue mais entrar.</p>
        </div>
        <button type="button" className="btn-primary" onClick={startNew}>
          {open && !editing ? "Fechar" : "Novo usuário"}
        </button>
      </div>

      {message && <p className="text-sm text-emerald-700">{message}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {open && (
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2 border-t pt-4">
          <p className="sm:col-span-2 text-sm font-medium text-ink">{editing ? "Editar usuário" : "Novo usuário"}</p>
          <label><span className="field-label">Nome</span><input className="field-input" required minLength={2} maxLength={120} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
          <label><span className="field-label">E-mail</span><input className="field-input" type="email" required maxLength={255} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            {editing && <span className="text-xs text-muted">Se trocar, um e-mail é enviado para o novo endereço.</span>}
          </label>
          <label><span className="field-label">Telefone</span><input className="field-input" maxLength={30} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></label>
          <label><span className="field-label">Perfil de acesso</span>
            <select className="field-input" value={form.role} onChange={e => setForm({ ...form, role: e.target.value as TeamRole })}>
              {roleOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          <div className="sm:col-span-2 flex justify-end gap-2">
            <button type="button" className="btn-outline" onClick={() => { setOpen(false); setForm(EMPTY); }}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Salvando..." : editing ? "Salvar alterações" : "Criar usuário"}</button>
          </div>
        </form>
      )}

      <div className="divide-y">
        {rows.map(r => (
          <div key={r.id} className="py-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-medium text-ink">{r.name} {r.blocked && <span className="ml-1 text-xs rounded-full bg-red-50 text-red-700 px-2 py-0.5">Bloqueado</span>}</p>
              <p className="text-xs text-muted">{r.email}{r.phone ? ` · ${r.phone}` : ""}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs rounded-full bg-[#F7F9FC] border px-2.5 py-1 text-muted">{ROLE_NAMES[r.role] ?? r.role}</span>
              {r.role !== "owner" && (
                <>
                  <button type="button" className="btn-outline text-sm" disabled={busy === r.id} onClick={() => startEdit(r)}>Editar</button>
                  <button type="button" className="btn-outline text-sm" disabled={busy === r.id} onClick={() => toggleBlock(r)}>{r.blocked ? "Desbloquear" : "Bloquear"}</button>
                  <button type="button" className="btn-outline text-sm text-red-700" disabled={busy === r.id} onClick={() => remove(r)}>Excluir</button>
                </>
              )}
            </div>
          </div>
        ))}
        {rows.length === 0 && !error && <p className="py-3 text-sm text-muted">Nenhum usuário cadastrado além da proprietária.</p>}
      </div>
    </div>
  );
}
