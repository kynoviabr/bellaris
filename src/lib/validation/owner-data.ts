import { formatCepDisplay, isValidCep, isValidCpf, isValidUf, isValidWhatsapp, onlyDigits } from "./br.ts";

export type OwnerData = {
  fullName: string;
  whatsapp: string; // somente dígitos
  cpf: string; // somente dígitos
  cep: string; // 00000-000
  logradouro: string;
  numero: string;
  complemento: string | null;
  bairro: string | null;
  cidade: string;
  uf: string;
  planCode: string;
};

export const OWNER_FIELD_NAMES = [
  "fullName", "whatsapp", "cpf", "cep", "logradouro", "numero",
  "complemento", "bairro", "cidade", "uf", "planCode",
] as const;

/** Valida os dados do dono. Devolve o valor normalizado ou a primeira mensagem de erro. */
export function validateOwnerData(raw: Record<string, string>): { error: string } | { value: OwnerData } {
  const get = (key: string) => (raw[key] ?? "").trim();

  const fullName = get("fullName");
  if (fullName.length < 3) return { error: "Informe o nome completo do responsável." };

  const whatsapp = onlyDigits(get("whatsapp"));
  if (!isValidWhatsapp(whatsapp)) return { error: "Informe um WhatsApp válido, com DDD." };

  const cpf = onlyDigits(get("cpf"));
  if (!isValidCpf(cpf)) return { error: "CPF inválido. Confira os números." };

  const cepDigits = onlyDigits(get("cep"));
  if (!isValidCep(cepDigits)) return { error: "Informe um CEP válido." };

  const logradouro = get("logradouro");
  if (!logradouro) return { error: "Informe o logradouro (rua, avenida...)." };

  const numero = get("numero");
  if (!numero) return { error: "Informe o número do endereço." };

  const cidade = get("cidade");
  if (!cidade) return { error: "Informe a cidade." };

  const uf = get("uf").toUpperCase();
  if (!isValidUf(uf)) return { error: "Informe uma UF válida." };

  const planCode = get("planCode");
  if (!planCode) return { error: "Escolha um plano." };

  return {
    value: {
      fullName,
      whatsapp,
      cpf,
      cep: formatCepDisplay(cepDigits),
      logradouro,
      numero,
      complemento: get("complemento") || null,
      bairro: get("bairro") || null,
      cidade,
      uf,
      planCode,
    },
  };
}
