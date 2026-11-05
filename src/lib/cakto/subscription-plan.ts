// Decide, sem tocar no banco, qual mudança de assinatura um evento da Cakto deve gerar.
// Só é usada quando CAKTO_ACTIVATION_ENABLED=true (ver webhook-queue.ts).
// Regra geral: sem correlação confirmada com uma oferta mapeada, nunca ativa.

export type PlanAction =
  | { kind: "activate"; planCode: string; reason: string }
  | { kind: "extend"; reason: string }
  | { kind: "warn_late"; reason: string }
  | { kind: "block"; reason: string }
  | { kind: "ignore"; reason: string }
  | { kind: "manual_review"; reason: string };

export interface CaktoEventInput {
  event: string;
  offerId: string | null;
  intentStatus: "pending" | "matched" | "none";
}

export interface OfferMap {
  [offerId: string]: string; // offer_id -> plan_code
}

const ACTIVATE_EVENTS = new Set(["purchase_approved", "subscription_created"]);
const EXTEND_EVENTS = new Set(["subscription_renewed", "subscription_late_recovered"]);
const LATE_EVENTS = new Set(["subscription_late"]);
const BLOCK_EVENTS = new Set(["subscription_canceled", "refund", "chargeback"]);

export function decideSubscriptionAction(input: CaktoEventInput, offers: OfferMap): PlanAction {
  const { event, offerId, intentStatus } = input;

  if (BLOCK_EVENTS.has(event)) {
    return { kind: "block", reason: `${event}: bloqueio de acesso` };
  }
  if (LATE_EVENTS.has(event)) {
    return { kind: "warn_late", reason: "assinatura em atraso: aviso" };
  }
  if (EXTEND_EVENTS.has(event)) {
    return { kind: "extend", reason: `${event}: estender período` };
  }
  if (ACTIVATE_EVENTS.has(event)) {
    if (!offerId || !(offerId in offers)) {
      return { kind: "manual_review", reason: "oferta não mapeada: revisão manual" };
    }
    if (intentStatus !== "matched") {
      return { kind: "manual_review", reason: "pagamento sem correlação confirmada com o salão" };
    }
    return { kind: "activate", planCode: offers[offerId], reason: `${event}: ativar plano` };
  }
  return { kind: "ignore", reason: `evento sem ação: ${event}` };
}
