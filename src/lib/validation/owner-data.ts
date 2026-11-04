import { formatCepDisplay, isValidCep, isValidCnpj, isValidCpf, isValidUf, isValidWhatsapp, onlyDigits } from "./br.ts";

/** Dados pessoais e de endereço do responsável pelo salão (sem plano). */
export type OwnerPersonal = {
  fullName: string;
  whatsapp: string; // somente dígitos
  documentType: "cpf" | "cnpj";
  cpf: string | null; // somente dígitos; nulo quando o documento é CNPJ
  cnpj: string | null; // somente dígitos; nulo quando o documento é CPF
  cep: string; // 00000-000
  logradouro: string;
  numero: string;
  complemento: string | null;
  bairro: string | null;
  cidade: string;
  uf: string;
};

export type OwnerData = OwnerPersonal & { planCode: string };

export const OWNER_FIELD_NAMES = [
  "fullName", "whatsapp", "documentType", "cpf", "cnpj", "cep", "logradouro", "numero",
  "complemento", "bairro", "cidade", "uf", "planCode",
] as const;

/** Valida os dados pessoais do responsável. Devolve o valor normalizado ou a primeira mensagem de erro. */
export function validateOwnerPersonal(raw: Record<string, string>): { error: string } | { value: OwnerPersonal } {
  const get = (key: string) => (raw[key] ?? "").trim();

  const fullName = get("fullName");
  if (fullName.length < 3) return { error: "Informe o nome completo do responsável." };

  const whatsapp = onlyDigits(get("whatsapp"));
  if (!isValidWhatsapp(whatsapp)) return { error: "Informe um WhatsApp válido, com DDD." };

  const documentType: "cpf" | "cnpj" = get("documentType") === "cnpj" ? "cnpj" : "cpf";
  const document = onlyDigits(get(documentType));
  if (documentType === "cpf" && !isValidCpf(document)) return { error: "CPF inválido. Confira os números." };
  if (documentType === "cnpj" && !isValidCnpj(document)) return { error: "CNPJ inválido. Confira os números." };

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

  return {
    value: {
      fullName,
      whatsapp,
      documentType,
      cpf: documentType === "cpf" ? document : null,
      cnpj: documentType === "cnpj" ? document : null,
      cep: formatCepDisplay(cepDigits),
      logradouro,
      numero,
      complemento: get("complemento") || null,
      bairro: get("bairro") || null,
      cidade,
      uf,
    },
  };
}

/** Valida os dados do dono no cadastro (pessoais + plano escolhido). */
export function validateOwnerData(raw: Record<string, string>): { error: string } | { value: OwnerData } {
  const personal = validateOwnerPersonal(raw);
  if ("error" in personal) return personal;

  const planCode = (raw.planCode ?? "").trim();
  if (!planCode) return { error: "Escolha um plano." };

  return { value: { ...personal.value, planCode } };
}
