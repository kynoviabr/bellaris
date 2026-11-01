/** Validações de documentos e contatos brasileiros. Puras: usadas no cliente e no servidor. */

export const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;

export const onlyDigits = (value: string) => value.replace(/\D/g, "");

/** CPF com verificação dos dígitos. Aceita com ou sem máscara. */
export function isValidCpf(value: string): boolean {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

  const checkDigit = (length: number) => {
    let sum = 0;
    for (let i = 0; i < length; i++) sum += Number(cpf[i]) * (length + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };

  return checkDigit(9) === Number(cpf[9]) && checkDigit(10) === Number(cpf[10]);
}

/** WhatsApp: DDD (2 dígitos) + 8 dígitos (fixo) ou 9 dígitos (celular). */
export function isValidWhatsapp(value: string): boolean {
  return /^[1-9][1-9]9?\d{8}$/.test(onlyDigits(value));
}

export function isValidCep(value: string): boolean {
  return /^\d{8}$/.test(onlyDigits(value));
}

export function formatCepDisplay(value: string): string {
  const d = onlyDigits(value).slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

export function isValidUf(value: string): boolean {
  return (UFS as readonly string[]).includes(value.trim().toUpperCase());
}
