/** Presentation masks. Validate and normalize again on the server before persistence. */
export const digitsOnly = (value: string) => value.replace(/\D/g, "");
export function formatBrazilPhone(value: string): string {
  const d = digitsOnly(value).slice(0, 11);
  if (d.length <= 2) return d.length === 2 ? `(${d})` : d;
  const prefix = `(${d.slice(0, 2)}) `;
  const local = d.slice(2);
  if (local.length <= (d.length > 10 ? 5 : 4)) return prefix + local;
  const split = d.length > 10 ? 5 : 4;
  return prefix + local.slice(0, split) + "-" + local.slice(split);
}
export function formatCpf(value: string): string {
  const d = digitsOnly(value).slice(0, 11);
  return d.replace(/^(\d{3})(\d)/, "$1.$2").replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}
export function formatCnpj(value: string): string {
  const d = digitsOnly(value).slice(0, 14);
  return d.replace(/^(\d{2})(\d)/, "$1.$2").replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d)/, ".$1/$2").replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}
export function formatRg(value: string): string {
  const d = value.replace(/[^0-9xX]/g, "").toUpperCase().slice(0, 9);
  return d.replace(/^(\d{2})(\d)/, "$1.$2").replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3").replace(/(\d{3})([0-9X])$/, "$1-$2");
}
export function formatCep(value: string): string {
  const d = digitsOnly(value).slice(0, 8);
  return d.length > 5 ? d.slice(0, 5) + "-" + d.slice(5) : d;
}
export const normalizeEmail = (value: string) => value.trim().toLowerCase();
