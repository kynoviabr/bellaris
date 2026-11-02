import type { CsvRow } from "./csv";

export type ImportKind = "services" | "professionals" | "products" | "clients";

export const IMPORT_KINDS: { id: ImportKind; label: string; headers: string[]; example: string[] }[] = [
  {
    id: "services",
    label: "Serviços",
    headers: ["nome", "categoria", "duracao_minutos", "preco", "dias_manutencao"],
    example: ["Manicure tradicional", "Mãos", "45", "60", "0"],
  },
  {
    id: "professionals",
    label: "Profissionais",
    headers: ["nome", "email", "telefone", "comissao_percentual", "especialidades"],
    example: ["Maria Silva", "maria@exemplo.com", "11987654321", "40", "Mãos|Pés"],
  },
  {
    id: "products",
    label: "Produtos",
    headers: ["nome", "categoria", "unidade", "estoque_minimo", "estoque_ideal", "custo_unitario", "saldo_inicial", "fornecedor"],
    example: ["Esmalte gel vermelho", "Esmaltes", "un", "5", "20", "18,50", "12", "Distribuidora Beleza"],
  },
  {
    id: "clients",
    label: "Clientes",
    headers: ["nome", "telefone", "data_nascimento", "observacoes"],
    example: ["Ana Souza", "11987654321", "15/03/1990", "Prefere horário de manhã"],
  },
];

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; error: string };

export type ValidRow = { line: number; raw: CsvRow; data: Record<string, unknown>; label: string };
export type InvalidRow = { line: number; raw: CsvRow; error: string };

const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const onlyDigits = (v: string) => v.replace(/\D/g, "");

/** Aceita "85", "85,00", "1.234,56" e "85.00". */
function parseDecimal(raw: string): number {
  let s = raw.trim();
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  return Number(s);
}

function parseBirthDate(raw: string): string | null {
  let iso: string | null = null;
  const br = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const en = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (br) iso = `${br[3]}-${br[2]}-${br[1]}`;
  else if (en) iso = raw;
  if (!iso) return null;
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== iso) return null;
  if (date.getTime() > Date.now()) return null;
  return iso;
}

/** Unidades aceitas no CSV (em português) e a unidade gravada no banco. */
const UNIT_MAP: Record<string, string> = {
  un: "unit", unidade: "unit", ml: "ml", l: "l", g: "g", kg: "kg", par: "pair", caixa: "box", pacote: "package",
};

const validators: Record<ImportKind, (v: Record<string, string>) => ValidationResult<{ data: Record<string, unknown>; label: string; dedupeKey: string }>> = {
  services(v) {
    if (v.nome.length < 2) return { ok: false, error: "Nome obrigatório." };
    if (!v.categoria) return { ok: false, error: "Categoria obrigatória." };
    const duration = Number(v.duracao_minutos);
    if (!Number.isInteger(duration) || duration < 5 || duration > 600) return { ok: false, error: "Duração deve ser entre 5 e 600 minutos." };
    const price = parseDecimal(v.preco);
    if (!Number.isFinite(price) || price < 0) return { ok: false, error: "Preço inválido." };
    const maintenance = v.dias_manutencao ? Number(v.dias_manutencao) : 0;
    if (!Number.isInteger(maintenance) || maintenance < 0 || maintenance > 365) return { ok: false, error: "Dias de manutenção deve ser entre 0 e 365." };
    return {
      ok: true,
      value: {
        label: v.nome,
        dedupeKey: v.nome.toLowerCase(),
        data: { name: v.nome, category: v.categoria, duration, price, maintenance },
      },
    };
  },
  professionals(v) {
    if (v.nome.length < 2) return { ok: false, error: "Nome obrigatório." };
    if (v.email && !isEmail(v.email)) return { ok: false, error: "E-mail inválido." };
    const phone = onlyDigits(v.telefone);
    if (v.telefone && phone.length !== 10 && phone.length !== 11) return { ok: false, error: "Telefone inválido (use DDD + número)." };
    const commission = v.comissao_percentual ? parseDecimal(v.comissao_percentual) : 0;
    if (!Number.isFinite(commission) || commission < 0 || commission > 100) return { ok: false, error: "Comissão deve ser entre 0 e 100." };
    const specialties = v.especialidades ? v.especialidades.split("|").map(s => s.trim()).filter(Boolean) : [];
    return {
      ok: true,
      value: {
        label: v.nome,
        dedupeKey: v.nome.toLowerCase(),
        data: { name: v.nome, email: v.email || undefined, phone: phone || undefined, default_commission: commission, specialties },
      },
    };
  },
  products(v) {
    if (v.nome.length < 2) return { ok: false, error: "Nome obrigatório." };
    if (!v.categoria) return { ok: false, error: "Categoria obrigatória." };
    const unit = UNIT_MAP[v.unidade.trim().toLowerCase()];
    if (!unit) return { ok: false, error: "Unidade inválida (use un, ml, l, g, kg, par, caixa ou pacote)." };
    const amount = (raw: string): number => (raw.trim() ? parseDecimal(raw) : 0);
    const minimum = amount(v.estoque_minimo);
    const ideal = amount(v.estoque_ideal);
    const cost = amount(v.custo_unitario);
    const initial = amount(v.saldo_inicial);
    if ([minimum, ideal, cost, initial].some(n => !Number.isFinite(n) || n < 0)) {
      return { ok: false, error: "Estoques, custo e saldo devem ser números maiores ou iguais a zero." };
    }
    return {
      ok: true,
      value: {
        label: v.nome,
        dedupeKey: v.nome.toLowerCase(),
        data: {
          name: v.nome,
          category: v.categoria,
          baseUnit: unit,
          minimum,
          ideal,
          cost,
          initialStock: initial,
          supplier: v.fornecedor || undefined,
        },
      },
    };
  },
  clients(v) {
    if (v.nome.length < 2) return { ok: false, error: "Nome obrigatório." };
    const phone = onlyDigits(v.telefone);
    if (phone.length !== 10 && phone.length !== 11) return { ok: false, error: "Telefone obrigatório com DDD (10 ou 11 dígitos)." };
    let birthDate: string | undefined;
    if (v.data_nascimento) {
      const parsed = parseBirthDate(v.data_nascimento);
      if (!parsed) return { ok: false, error: "Data de nascimento inválida (use dd/mm/aaaa, sem data futura)." };
      birthDate = parsed;
    }
    return {
      ok: true,
      value: {
        label: v.nome,
        dedupeKey: phone,
        data: { name: v.nome, phone, birthDate, notes: v.observacoes || undefined },
      },
    };
  },
};

/** Valida as linhas de um arquivo. Repetidas dentro do próprio arquivo são ignoradas. */
export function validateRows(kind: ImportKind, rows: CsvRow[]) {
  const valid: ValidRow[] = [];
  const invalid: InvalidRow[] = [];
  const seen = new Set<string>();

  for (const raw of rows) {
    const result = validators[kind](raw.values);
    if (!result.ok) {
      invalid.push({ line: raw.line, raw, error: result.error });
      continue;
    }
    if (seen.has(result.value.dedupeKey)) {
      invalid.push({ line: raw.line, raw, error: "Repetida neste arquivo." });
      continue;
    }
    seen.add(result.value.dedupeKey);
    valid.push({ line: raw.line, raw, data: result.value.data, label: result.value.label });
  }
  return { valid, invalid };
}

/** Modelo para baixar: cabeçalho e uma linha de exemplo. Usa ";" para abrir direto no Excel brasileiro. */
export function buildTemplate(kind: ImportKind): string {
  const def = IMPORT_KINDS.find(k => k.id === kind)!;
  const esc = (v: string) => (/[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return "﻿" + [def.headers, def.example].map(r => r.map(esc).join(";")).join("\r\n") + "\r\n";
}

/** Lê o arquivo como UTF-8 e, se não for UTF-8 válido, como Windows-1252 (padrão do Excel). */
export function decodeCsvBytes(bytes: ArrayBuffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}
