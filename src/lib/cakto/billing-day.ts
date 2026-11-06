// Dia útil de cobrança, com a mesma regra de private.nth_business_day no banco: segunda a sexta, sem feriados.
const SAO_PAULO_TZ = "America/Sao_Paulo";

export interface CalendarDate {
  year: number;
  month: number; // 1 a 12
  day: number;
}

/** Data do calendário de São Paulo para um instante. */
export function saoPauloDate(now: Date = new Date()): CalendarDate {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: SAO_PAULO_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const read = (type: string) => Number(parts.find(part => part.type === type)?.value);
  return { year: read("year"), month: read("month"), day: read("day") };
}

function isWeekday(year: number, month: number, day: number): boolean {
  const dow = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return dow >= 1 && dow <= 5;
}

/** Ordinal do dia útil de uma data dentro do mês (1 = primeiro dia útil do mês). */
export function businessDayOrdinal({ year, month, day }: CalendarDate): number {
  let count = 0;
  for (let d = 1; d <= day; d++) {
    if (isWeekday(year, month, d)) count++;
  }
  return count;
}

/** Data (aaaa-mm-dd) do N-ésimo dia útil do mês. Se o mês tiver menos dias úteis, devolve o último. */
export function nthBusinessDay(year: number, month: number, n: number): string {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const pad = (value: number) => String(value).padStart(2, "0");
  let count = 0;
  let lastWeekday = 1;
  for (let d = 1; d <= lastDay; d++) {
    if (!isWeekday(year, month, d)) continue;
    count++;
    lastWeekday = d;
    if (count === n) return `${year}-${pad(month)}-${pad(d)}`;
  }
  return `${year}-${pad(month)}-${pad(lastWeekday)}`;
}
