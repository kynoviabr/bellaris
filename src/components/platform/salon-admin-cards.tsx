"use client";

import { useActionState, useState } from "react";
import { approveSalon, rejectSalon, updateSalonOwner } from "@/lib/actions/platform-onboarding";
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

const inputClass = "h-10 w-full rounded-md border border-[#E8D9C7] bg-[#FFFCF8] px-3 text-sm text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15";
const labelClass = "mb-1 block text-xs font-medium text-muted";
const btnPrimary = "inline-flex h-10 items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-white disabled:opacity-50";
const btnOutline = "inline-flex h-10 items-center justify-center rounded-lg border border-[#E8D9C7] bg-white px-5 text-sm font-semibold text-ink";

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
    <article className="rounded-xl border border-[#E8D9C7] bg-white p-5 shadow-sm space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-ink">{row.salon_name}</h3>
          <p className="text-xs text-muted">
            Plano escolhido pelo dono: <strong>{plans.find(p => p.code === row.requested_plan_code)?.name ?? "—"}</strong>
          </p>
        </div>
        <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800">
          {row.access_status === "aguardando_aprovacao" ? "Aguardando aprovação" : "Aguardando correção"}
        </span>
      </header>

      {row.access_note && (
        <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><strong>Motivo da última recusa:</strong> {row.access_note}</p>
      )}

      {row.owner_full_name ? (
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div><dt className="text-xs text-muted">Responsável</dt><dd>{row.owner_full_name}</dd></div>
          <div><dt className="text-xs text-muted">WhatsApp</dt><dd>{row.owner_whatsapp}</dd></div>
          <div><dt className="text-xs text-muted">CPF</dt><dd>{row.owner_cpf}</dd></div>
          <div><dt className="text-xs text-muted">Endereço</dt><dd>{row.owner_logradouro}, {row.owner_numero}{row.owner_complemento ? ` - ${row.owner_complemento}` : ""} · {row.owner_bairro ?? ""} · {row.owner_cidade}/{row.owner_uf} · CEP {row.owner_cep}</dd></div>
        </dl>
      ) : (
        <p className="text-sm text-muted">O dono ainda não enviou os dados do responsável.</p>
      )}

      {row.access_status === "aguardando_aprovacao" && (
        <form action={approveAction} className="grid gap-4 border-t border-[#EFE6DA] pt-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <input type="hidden" name="organizationId" value={row.organization_id} />
          <div>
            <label className={labelClass} htmlFor={`plan-${row.organization_id}`}>Plano</label>
            <select id={`plan-${row.organization_id}`} name="planCode" required defaultValue={row.requested_plan_code ?? ""} className={inputClass}>
              <option value="">Escolha</option>
              {plans.map(p => <option key={p.code} value={p.code}>{p.name} · R$ {Number(p.monthly_price).toFixed(2).replace(".", ",")}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor={`due-${row.organization_id}`}>Vencimento</label>
            <select id={`due-${row.organization_id}`} name="dueBusinessDay" defaultValue="0" className={inputClass}>
              <option value="0">Último dia útil do mês</option>
              {Array.from({ length: 10 }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n}º dia útil do mês</option>)}
            </select>
          </div>
          <button type="submit" disabled={approving} className={btnPrimary}>{approving ? "Aprovando..." : "Aprovar e liberar"}</button>
          {approveError && <p className="sm:col-span-3 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-danger">{approveError}</p>}
        </form>
      )}

      <div className="flex flex-wrap gap-2 border-t border-[#EFE6DA] pt-4">
        {row.access_status === "aguardando_aprovacao" && (
          <button type="button" onClick={() => setShowReject(v => !v)} className={btnOutline}>Recusar cadastro</button>
        )}
        <button type="button" onClick={() => setShowEdit(v => !v)} className={btnOutline}>{showEdit ? "Fechar dados" : "Ver e corrigir dados"}</button>
      </div>

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
