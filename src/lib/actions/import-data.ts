"use server";

import { revalidatePath } from "next/cache";
import { createServiceRecord, getServices } from "@/lib/actions/services";
import { createProfessionalRecord, getProfessionals } from "@/lib/actions/professionals";
import { createClientRecord, getClients } from "@/lib/actions/clients";
import { validateRows, type ImportKind } from "@/lib/import/rules";
import type { CsvRow } from "@/lib/import/csv";

export type ImportResult =
  | { ok: true; imported: number; skipped: { line: number; reason: string }[] }
  | { ok: false; error: string };

const KINDS: ImportKind[] = ["services", "professionals", "clients"];

/**
 * Grava as linhas válidas de um arquivo CSV. As linhas são validadas de novo aqui no servidor.
 * Linhas com erro, repetidas ou que já existem no salão são ignoradas e listadas no resultado.
 */
export async function importRows(kind: ImportKind, rows: CsvRow[]): Promise<ImportResult> {
  if (!KINDS.includes(kind)) return { ok: false, error: "Tipo de importação inválido." };
  if (!Array.isArray(rows) || rows.length === 0) return { ok: false, error: "Nenhuma linha para importar." };
  if (rows.length > 2000) return { ok: false, error: "Importe no máximo 2.000 linhas por vez." };

  const { valid, invalid } = validateRows(kind, rows);
  const skipped: { line: number; reason: string }[] = invalid.map(i => ({ line: i.line, reason: i.error }));
  let imported = 0;

  if (kind === "services") {
    const existing = new Set((await getServices()).map(s => s.name.trim().toLowerCase()));
    for (const row of valid) {
      const d = row.data as { name: string; category: string; duration: number; price: number; maintenance: number };
      if (existing.has(d.name.toLowerCase())) {
        skipped.push({ line: row.line, reason: "Já existe um serviço com este nome." });
        continue;
      }
      const res = await createServiceRecord(d as never);
      if (res.success) { imported++; existing.add(d.name.toLowerCase()); }
      else skipped.push({ line: row.line, reason: res.error ?? "Erro ao salvar." });
    }
  }

  if (kind === "professionals") {
    const existing = new Set((await getProfessionals()).map(p => p.name.trim().toLowerCase()));
    for (const row of valid) {
      const d = row.data as { name: string; email?: string; phone?: string; specialties: string[]; default_commission: number };
      if (existing.has(d.name.toLowerCase())) {
        skipped.push({ line: row.line, reason: "Já existe uma profissional com este nome." });
        continue;
      }
      const res = await createProfessionalRecord({ ...d, notes: undefined });
      if (res.success) { imported++; existing.add(d.name.toLowerCase()); }
      else skipped.push({ line: row.line, reason: res.error ?? "Erro ao salvar." });
    }
  }

  if (kind === "clients") {
    for (const row of valid) {
      const d = row.data as { name: string; phone: string; birthDate?: string; notes?: string };
      const res = await createClientRecord({ name: d.name, phone: d.phone, birthDate: d.birthDate, notes: d.notes });
      if (res && "success" in res && res.success) imported++;
      else skipped.push({ line: row.line, reason: (res && "error" in res && res.error) || "Cliente já cadastrada ou erro ao salvar." });
    }
  }

  revalidatePath("/");
  skipped.sort((a, b) => a.line - b.line);
  return { ok: true, imported, skipped };
}
