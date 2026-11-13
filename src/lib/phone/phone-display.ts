import { detectDialCode } from "./countries.ts";

const digitsOnly = (v: string) => v.replace(/\D/g, "");

/** Máscara do telefone brasileiro (sem o 55). */
export function formatBrazilLocal(value: string): string {
  const d = digitsOnly(value).slice(0, 11);
  if (d.length <= 2) return d.length === 2 ? `(${d})` : d;
  const prefix = `(${d.slice(0, 2)}) `;
  const local = d.slice(2);
  if (local.length <= (d.length > 10 ? 5 : 4)) return prefix + local;
  const split = d.length > 10 ? 5 : 4;
  return prefix + local.slice(0, split) + "-" + local.slice(split);
}

/** Texto mostrado no campo: Brasil com máscara; outros países com + e código. */
export function displayFor(dial: string, localDigits: string): string {
  if (dial === "55") return formatBrazilLocal(localDigits);
  return localDigits ? `+${dial} ${localDigits}` : `+${dial} `;
}

/** Interpreta o que foi digitado. Se começar com +, detecta o país pelo código. */
export function applyPhoneInput(typed: string, currentDial: string): { dial: string; display: string; detected: boolean } {
  const t = typed.trim();
  if (t.startsWith("+")) {
    const digits = digitsOnly(t);
    const dial = detectDialCode(digits) ?? currentDial;
    const local = digits.startsWith(dial) ? digits.slice(dial.length) : digits;
    return { dial, display: displayFor(dial, local), detected: true };
  }
  const local = digitsOnly(typed);
  return { dial: currentDial, display: displayFor(currentDial, local), detected: false };
}

/** Lê o telefone salvo (ex.: "(11) 99999-8888" ou "+1 555 123 4567") e devolve o código e o texto. */
export function parseStoredPhone(stored: string | null | undefined): { dial: string; display: string } {
  const s = (stored ?? "").trim();
  if (s.startsWith("+")) {
    const digits = digitsOnly(s);
    const dial = detectDialCode(digits) ?? "55";
    const local = digits.startsWith(dial) ? digits.slice(dial.length) : digits;
    return { dial, display: displayFor(dial, local) };
  }
  return { dial: "55", display: formatBrazilLocal(s) };
}

/** Só os dígitos do número local (sem código), para trocar o país sem perder o número. */
export function localDigitsOf(display: string, dial: string): string {
  const d = digitsOnly(display);
  return dial !== "55" && display.trim().startsWith("+") && d.startsWith(dial) ? d.slice(dial.length) : d;
}
