// Regras de fila para eventos de webhook da Cakto.
// A ativação de assinaturas NÃO está implementada aqui: depende de aprovação
// das regras de negócio e do formato real dos eventos. Fica desligada por padrão.

export const CAKTO_EVENT_TYPES = [
  "purchase_approved",
  "purchase_refused",
  "refund",
  "refund_requested",
  "chargeback",
  "subscription_created",
  "subscription_renewed",
  "subscription_renewal_refused",
  "subscription_paused",
  "subscription_resumed",
  "subscription_late",
  "subscription_late_recovered",
  "subscription_canceled",
] as const;

export function isKnownCaktoEvent(type: string): boolean {
  return (CAKTO_EVENT_TYPES as readonly string[]).includes(type);
}

// Intervalos de retentativa interna, em segundos (5 s, 1 min, 2 min 30 s, 6 min, 30 min).
const RETRY_STEPS_SECONDS = [5, 60, 150, 360, 1800] as const;

export function retryDelaySeconds(attempts: number): number {
  const index = Math.max(0, Math.min(attempts, RETRY_STEPS_SECONDS.length - 1));
  return RETRY_STEPS_SECONDS[index];
}

export function activationEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.CAKTO_ACTIVATION_ENABLED === "true";
}
