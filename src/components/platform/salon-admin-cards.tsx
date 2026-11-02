"use client";

import { useActionState, useState } from "react";
import { approveSalon, rejectSalon, updateSalonName, updateSalonOwner } from "@/lib/actions/platform-onboarding";
import { OwnerFormFields } from "@/components/onboarding/owner-form-fields";

export type SalonAdminRow = {
  organization_id: string;
  salon_name: string;
  slug: string;
  access_status: string;
  access_note: string | null;
  requested_plan_code: string | null;
  created_at: string;
  owner_full_name: string | null;
  owner_whatsapp: string | null;
  owner_cpf: string | null;
  owner_cep: string | null;
  owner_logradouro: string | null;
  owner_numero: string | null;
  owner_complemento: string | null;
  owner_bairro: string | null;
  owner_cidade: string | null;
  owner_uf: string | null;
};

export type PlanChoice = { code: string; name: string; monthly_price: number };

const inputClass = "field-input";
const labelClass = "field-label";
const btnPrimary = "btn-primary";
const btnOutline = "btn-outline";

/** WhatsApp para exibição: (11) 93220-8384. */
function formatWhatsappDisplay(value: string | null) {
  const d = (value ?? "").replace(/\D/g, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return value ?? "";
}

/** CPF para exibição: 073.455.368-40. */
function formatCpfDisplay(value: string | null) {
  const d = (value ?? "").replace(/\D/g, "");
  if (d.length !== 11) return value ?? "";
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

/** Nome do salão, editável só enquanto o cadastro aguarda aprovação. */
function SalonNameForm({ row }: { row: SalonAdminRow }) {
  const [state, formAction, pending] = useActionState(updateSalonName, undefined);
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="organizationId" value={row.organization_id} />
      <div className="min-w-[240px] flex-1">
        <label className={labelClass} htmlFor={`name-${row.organization_id}`}>Nome do salão</label>
        <input id={`name-${row.organization_id}`} name="salonName" required minLength={3} defaultValue={row.salon_name} className={inputClass} />
      </div>
      <button type="submit" disabled={pending} className={btnOutline}>{pending ? "Salvando..." : "Salvar nome"}</button>
      {state && "error" in state && state.error && (
        <p className="w-full rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-danger">{state.error}</p>
      )}
      {state && "ok" in state && state.ok && (
        <p className="w-full rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">Nome salvo.</p>
      )}
    </form>
  );
}

/** Dados do responsável como defaults do formulário. */
export function ownerDefaults(row: SalonAdminRow) {
  return {
    fullName: row.owner_full_name ?? "",
    whatsapp: row.owner_whatsapp ?? "",
    cpf: row.owner_cpf ?? "",
    cep: row.owner_cep ?? "",
    logradouro: row.owner_logradouro ?? "",
    numero: row.owner_numero ?? "",
    complemento: row.owner_complemento ?? "",
    bairro: row.owner_bairro ?? "",
    cidade: row.owner_cidade ?? "",
    uf: row.owner_uf ?? "",
  };
}

/** Formulário do master para criar ou corrigir os dados do responsável. O nome do salão não é editável aqui. */
export function OwnerEditForm({ row }: { row: SalonAdminRow }) {
  const [state, formAction, pending] = useActionState(updateSalonOwner, undefined);
  const saved = state && "ok" in state && state.ok;
  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="organizationId" value={row.organization_id} />
      <OwnerFormFields defaults={ownerDefaults(row)} />
      {state && "error" in state && state.error && (
        <p className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-danger">{state.error}</p>
      )}
      {saved && <p className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">Dados salvos.</p>}
      <button type="submit" disabled={pending} className={btnPrimary}>{pending ? "Salvando..." : "Salvar dados do responsável"}</button>
    </form>
  );
}

/** Cartão de um salão para o master: aprovar, recusar, ou editar os dados do responsável. */
export function ApprovalCard({ row, plans }: { row: SalonAdminRow; plans: PlanChoice[] }) {
  const [approveState, approveAction, approving] = useActionState(approveSalon, undefined);
  const [rejectState, rejectAction, rejecting] = useActionState(rejectSalon, undefined);
  const [showReject, setShowReject] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const approveError = approveState && "error" in approveState ? approveState.error : null;
  const rejectError = rejectState && "error" in rejectState ? rejectState.error : null;

  return (
    <article className="card space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-ink">{row.salon_name}</h3>
          <p className="text-xs text-muted">
            Plano escolhido pelo dono: <strong>{plans.find(p => p.code === row.requested_plan_code)?.name ?? "—"}</strong>
          </p>
        </div>
        <span className="badge bg-amber-50 text-amber-800">
          {row.access_status === "aguardando_aprovacao" ? "Aguardando aprovação" : "Aguardando correção"}
        </span>
      </header>

      {row.access_status === "aguardando_aprovacao" && <SalonNameForm row={row} />}

      {row.access_note && (
        <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><strong>Motivo da última recusa:</strong> {row.access_note}</p>
      )}

      {row.owner_full_name ? (
        <dl className="grid gap-x-6 gap-y-4 rounded-md border border-[#EFE6DA] bg-bg p-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-primary">Responsável</dt>
            <dd className="mt-1 font-medium text-ink">{row.owner_full_name}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-primary">WhatsApp</dt>
            <dd className="mt-1 text-ink">{formatWhatsappDisplay(row.owner_whatsapp)}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-primary">CPF</dt>
            <dd className="mt-1 text-ink">{formatCpfDisplay(row.owner_cpf)}</dd>
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <dt className="text-xs font-semibold uppercase tracking-wide text-primary">Endereço</dt>
            <dd className="mt-1 text-ink">
              {row.owner_logradouro}, {row.owner_numero}{row.owner_complemento ? ` - ${row.owner_complemento}` : ""}
              {" · "}{row.owner_bairro ?? ""}{" · "}{row.owner_cidade}/{row.owner_uf}{" · CEP "}{row.owner_cep}
            </dd>
          </div>
        </dl>
      ) : (
        <p className="text-sm text-muted">O dono ainda não enviou os dados do responsável.</p>
      )}

      {row.access_status === "aguardando_aprovacao" ? (
        <form action={approveAction} className="flex flex-wrap items-end gap-3 border-t border-[#EFE6DA] pt-4">
          <input type="hidden" name="organizationId" value={row.organization_id} />
          <div className="min-w-[180px] flex-1">
            <label className={labelClass} htmlFor={`plan-${row.organization_id}`}>Plano</label>
            <select id={`plan-${row.organization_id}`} name="planCode" required defaultValue={row.requested_plan_code ?? ""} className={inputClass}>
              <option value="">Escolha</option>
              {plans.map(p => <option key={p.code} value={p.code}>{p.name} · R$ {Number(p.monthly_price).toFixed(2).replace(".", ",")}</option>)}
            </select>
          </div>
          <div className="min-w-[180px] flex-1">
            <label className={labelClass} htmlFor={`due-${row.organization_id}`}>Vencimento</label>
            <select id={`due-${row.organization_id}`} name="dueBusinessDay" defaultValue="0" className={inputClass}>
              <option value="0">Último dia útil do mês</option>
              {Array.from({ length: 10 }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n}º dia útil do mês</option>)}
            </select>
          </div>
          <button type="submit" disabled={approving} className={`${btnPrimary} whitespace-nowrap`}>{approving ? "Aprovando..." : "Aprovar e liberar"}</button>
          <button type="button" onClick={() => setShowReject(v => !v)} className={`${btnOutline} whitespace-nowrap`}>Recusar cadastro</button>
          <button type="button" onClick={() => setShowEdit(v => !v)} className={`${btnOutline} whitespace-nowrap`}>{showEdit ? "Fechar dados" : "Ver e corrigir dados"}</button>
          {approveError && <p className="w-full rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-danger">{approveError}</p>}
        </form>
      ) : (
        <div className="flex flex-wrap gap-2 border-t border-[#EFE6DA] pt-4">
          <button type="button" onClick={() => setShowEdit(v => !v)} className={btnOutline}>{showEdit ? "Fechar dados" : "Ver e corrigir dados"}</button>
        </div>
      )}

      {showReject && (
        <form action={rejectAction} className="space-y-3 rounded-lg bg-[#FAF6F0] p-4">
          <input type="hidden" name="organizationId" value={row.organization_id} />
          <label className={labelClass} htmlFor={`note-${row.organization_id}`}>Motivo (o dono verá para corrigir)</label>
          <textarea id={`note-${row.organization_id}`} name="note" required rows={2} className="w-full rounded-md border border-[#E8D9C7] bg-white p-3 text-sm" />
          {rejectError && <p className="text-sm text-danger">{rejectError}</p>}
          <button type="submit" disabled={rejecting} className={btnPrimary}>{rejecting ? "Recusando..." : "Confirmar recusa"}</button>
        </form>
      )}

      {showEdit && (
        <div className="rounded-lg bg-[#FAF6F0] p-4">
          <OwnerEditForm row={row} />
        </div>
      )}
    </article>
  );
}
