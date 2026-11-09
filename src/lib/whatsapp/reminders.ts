// Funções puras dos lembretes de WhatsApp. Sem imports do projeto, para rodarem nos testes diretamente.

const SAO_PAULO = "America/Sao_Paulo";

/** Data de hoje em São Paulo, no formato aaaa-mm-dd, somada de `days` dias. */
export function saoPauloDateAfter(now: Date, days: number): string {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: SAO_PAULO, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const [y, m, d] = today.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Janela dos lembretes: do início de hoje até o fim do dia de hoje + `daysAhead`, em horário de Brasília. */
export function reminderWindow(now: Date, daysAhead: number): { start: string; end: string } {
  return {
    start: `${saoPauloDateAfter(now, 0)}T00:00:00-03:00`,
    end: `${saoPauloDateAfter(now, daysAhead + 1)}T00:00:00-03:00`,
  };
}

/** Telefone brasileiro em formato internacional (55 + DDD + número). Retorna null se não for válido. */
export function normalizeBrazilPhone(raw: string | null | undefined): string | null {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) return digits;
  return null;
}

/** Valores do modelo de lembrete: primeiro nome, data dd/mm/aaaa, horário HH:mm e serviços. */
export function reminderParams(input: { clientName: string; startsAt: string; services: string }): string[] {
  const firstName = input.clientName.trim().split(/\s+/)[0] || "Cliente";
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: SAO_PAULO, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(input.startsAt));
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? "";
  return [
    firstName,
    `${get("day")}/${get("month")}/${get("year")}`,
    `${get("hour")}:${get("minute")}`,
    input.services,
  ];
}
