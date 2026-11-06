// Processa eventos da Cakto gravados em cakto_webhook_events.
// Só age quando CAKTO_ACTIVATION_ENABLED=true (ver webhook-queue.ts). Sem correlação confirmada, nunca ativa.
import { decideSubscriptionAction, type OfferMap, type PlanAction } from "./subscription-plan.ts";

export interface CaktoEventFields {
  eventType: string;
  orderId: string | null;
  offerId: string | null;
  subscriptionId: string | null;
  intentId: string | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACTIVATE_EVENTS = new Set(["purchase_approved", "subscription_created"]);

/** Extrai os campos de correlação do payload da Cakto. Puro. */
export function extractCaktoEventFields(payload: Record<string, unknown>): CaktoEventFields {
  const data = payload.data && typeof payload.data === "object" && !Array.isArray(payload.data)
    ? (payload.data as Record<string, unknown>) : {};
  const offer = data.offer && typeof data.offer === "object" ? (data.offer as Record<string, unknown>) : {};
  const subscription = data.subscription && typeof data.subscription === "object"
    ? (data.subscription as Record<string, unknown>) : {};
  const utm = typeof data.utm_content === "string" ? data.utm_content.trim() : "";
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  return {
    eventType: typeof payload.event === "string" ? payload.event : "",
    orderId: str(data.id),
    offerId: str(offer.id),
    subscriptionId: str(subscription.id),
    intentId: UUID.test(utm) ? utm : null,
  };
}

export type ProcessOutcome = "processed" | "ignored" | "manual_review" | "failed";

// Cliente mínimo, para o processador não depender do tipo do Supabase.
export interface Db {
  from(table: string): any;
  rpc(name: string, args: Record<string, unknown>): Promise<{ data: unknown; error: { message: string } | null }>;
}

/** Libera o salão da intenção e registra a assinatura. Sem vencimento cadastrado, não libera. */
async function activateSalon(db: Db, orgId: string, planCode: string): Promise<ProcessOutcome> {
  const { data: sub } = await db.from("platform_subscriptions")
    .select("organization_id,due_business_day").eq("organization_id", orgId).maybeSingle();
  if (!sub || sub.due_business_day == null) return "manual_review";
  const now = new Date().toISOString();
  const { error: subError } = await db.from("platform_subscriptions")
    .update({ plan_code: planCode, billing_mode: "mensalidade", cancelled: false, cancelled_at: null, updated_at: now })
    .eq("organization_id", orgId);
  if (subError) return "failed";
  const { error: orgError } = await db.from("organizations")
    .update({ access_status: "ativo", access_note: null }).eq("id", orgId);
  return orgError ? "failed" : "processed";
}

/** Bloqueia o salão ligado à assinatura (cancelamento, reembolso ou chargeback). */
async function blockBySubscription(db: Db, subscriptionId: string): Promise<ProcessOutcome> {
  const { data: link } = await db.from("cakto_subscription_links")
    .select("organization_id").eq("cakto_subscription_id", subscriptionId).maybeSingle();
  if (!link) return "manual_review";
  const now = new Date().toISOString();
  const { error } = await db.from("platform_subscriptions")
    .update({ cancelled: true, cancelled_at: now, updated_at: now }).eq("organization_id", link.organization_id);
  return error ? "failed" : "processed";
}

/** Processa um evento. Não lança erro, para não derrubar o webhook. */
export async function processCaktoEvent(
  db: Db,
  eventRow: { id: string; payload: Record<string, unknown> },
  offers: OfferMap,
): Promise<ProcessOutcome> {
  const f = extractCaktoEventFields(eventRow.payload);
  let intentStatus: "pending" | "matched" | "none" = "none";
  let orgId: string | null = null;

  if (f.intentId) {
    const { data: intent } = await db.from("cakto_checkout_intents")
      .select("organization_id,status").eq("id", f.intentId).maybeSingle();
    if (intent) {
      orgId = intent.organization_id;
      intentStatus = intent.status === "matched" ? "matched" : "pending";
    }
  }

  // Intenção pendente: o vínculo é feito antes da decisão, porque a decisão só ativa com correlação confirmada.
  if (intentStatus === "pending" && f.intentId && f.subscriptionId && f.offerId && orgId && ACTIVATE_EVENTS.has(f.eventType)) {
    const { data: linkResult, error: linkError } = await db.rpc("cakto_match_checkout_intent", {
      p_intent_id: f.intentId, p_subscription_id: f.subscriptionId, p_offer_id: f.offerId,
    });
    if (linkError) return "failed";
    if (linkResult !== "matched" && linkResult !== "already_linked") return "manual_review";
    intentStatus = "matched";
  }

  const action: PlanAction = decideSubscriptionAction({ event: f.eventType, offerId: f.offerId, intentStatus }, offers);

  if (action.kind === "activate") {
    if (!orgId) return "manual_review";
    return activateSalon(db, orgId, action.planCode);
  }
  if (action.kind === "block") {
    return f.subscriptionId ? blockBySubscription(db, f.subscriptionId) : "manual_review";
  }
  if (action.kind === "warn_late" || action.kind === "extend") return "processed";
  if (action.kind === "ignore") return "ignored";
  return "manual_review";
}

/** Processa os eventos pendentes, em lote pequeno. Só é chamado com a ativação ligada. */
export async function processPendingCaktoEvents(db: Db, offers: OfferMap, limit = 10): Promise<number> {
  const { data: rows } = await db.from("cakto_webhook_events")
    .select("id,payload").eq("status", "pending").order("received_at").limit(limit);
  let done = 0;
  for (const row of (rows ?? []) as { id: string; payload: Record<string, unknown> }[]) {
    const outcome = await processCaktoEvent(db, row, offers);
    // Status aceitos pelo banco: done, failed, ignored. Revisão manual fica como failed, com motivo.
    const status = outcome === "processed" ? "done" : outcome === "ignored" ? "ignored" : "failed";
    const processingError = outcome === "manual_review" ? "revisão manual: correlação ou dados insuficientes"
      : outcome === "failed" ? "falha ao atualizar a assinatura" : null;
    const { error: updateError } = await db.from("cakto_webhook_events")
      .update({ status, processed_at: new Date().toISOString(), processing_error: processingError }).eq("id", row.id);
    if (updateError) throw new Error("atualização do evento: " + updateError.message);
    done++;
  }
  return done;
}
