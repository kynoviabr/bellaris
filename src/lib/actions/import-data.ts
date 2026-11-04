"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrganizationId } from "@/lib/auth/current-organization";
import { createServiceRecord, getServices } from "@/lib/actions/services";
import { createProfessionalRecord, getProfessionals } from "@/lib/actions/professionals";
import { createClientRecord, getClients } from "@/lib/actions/clients";
import { validateRows, type ImportKind } from "@/lib/import/rules";
import type { CsvRow } from "@/lib/import/csv";

export type ImportResult =
  | { ok: true; imported: number; skipped: { line: number; reason: string }[] }
  | { ok: false; error: string };

const KINDS: ImportKind[] = ["services", "professionals", "products", "clients"];

/**
 * Grava as linhas válidas de um arquivo CSV. As linhas são validadas de novo aqui no servidor.
 * Linhas com erro, repetidas ou que já existem no salão são ignoradas e listadas no resultado.
 */
export async function importRows(kind: ImportKind, rows: CsvRow[], fileName = ""): Promise<ImportResult> {
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

  if (kind === "products") {
    const supabase = await createClient();
    const organizationId = await currentOrganizationId();
    if (!supabase || !organizationId) return { ok: false, error: "Organização não encontrada." };

    const { data: current } = await supabase.from("products").select("name");
    const existing = new Set((current ?? []).map((p: { name: string }) => p.name.trim().toLowerCase()));
    const toInsert = [];
    for (const row of valid) {
      const d = row.data as { name: string; category: string; baseUnit: string; minimum: number; ideal: number; cost: number; initialStock: number; supplier?: string };
      if (existing.has(d.name.toLowerCase())) {
        skipped.push({ line: row.line, reason: "Já existe um produto com este nome." });
        continue;
      }
      toInsert.push({ row, d });
    }

    const CHUNK = 500;
    for (let i = 0; i < toInsert.length; i += CHUNK) {
      const chunk = toInsert.slice(i, i + CHUNK);
      const { data: inserted, error } = await supabase.from("products").insert(chunk.map(({ d }) => ({
        organization_id: organizationId,
        name: d.name,
        category: d.category,
        base_unit: d.baseUnit,
        minimum_stock: d.minimum,
        ideal_stock: d.ideal,
        unit_cost: d.cost,
        supplier: d.supplier ?? null,
      }))).select("id, name");
      if (error || !inserted) {
        for (const { row } of chunk) skipped.push({ line: row.line, reason: error?.message ?? "Erro ao salvar." });
        continue;
      }
      const idByName = new Map(inserted.map((p: { id: string; name: string }) => [p.name, p.id]));
      const movements = chunk
        .filter(({ d }) => d.initialStock > 0 && idByName.has(d.name))
        .map(({ d }) => ({
          organization_id: organizationId,
          product_id: idByName.get(d.name),
          movement_type: "positive_adjustment",
          quantity: d.initialStock,
          unit_cost: d.cost,
          source: "initial_stock",
        }));
      if (movements.length > 0) {
        const { error: stockError } = await supabase.from("stock_movements").insert(movements);
        if (stockError) skipped.push({ line: 0, reason: `Produtos gravados, mas o saldo inicial de ${movements.length} não foi lançado: ${stockError.message}` });
      }
      imported += inserted.length;
      for (const { d } of chunk) existing.add(d.name.toLowerCase());
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

  skipped.sort((a, b) => a.line - b.line);
  await recordImportBatch({ kind, fileName, totalRows: rows.length, imported, skipped: skipped.length });
  revalidatePath("/");
  return { ok: true, imported, skipped };
}

export interface ImportBatch {
  id: string;
  kind: ImportKind;
  fileName: string;
  totalRows: number;
  imported: number;
  skipped: number;
  createdAt: string;
}

async function currentOrganizationId(): Promise<string | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  return getCurrentOrganizationId(supabase);
}

/** Registra a carga no histórico do salão. Falha aqui não desfaz a importação já gravada. */
async function recordImportBatch(batch: { kind: ImportKind; fileName: string; totalRows: number; imported: number; skipped: number }) {
  try {
    const supabase = await createClient();
    const organizationId = await currentOrganizationId();
    if (!supabase || !organizationId) return;
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("import_batches").insert({
      organization_id: organizationId,
      kind: batch.kind,
      file_name: batch.fileName.slice(0, 255) || null,
      total_rows: batch.totalRows,
      imported: batch.imported,
      skipped: batch.skipped,
      created_by: user?.id ?? null,
    });
  } catch {
    // histórico é complementar: ignora erro
  }
}

/** Últimas cargas feitas pelo salão, da mais recente para a mais antiga. */
export async function getImportBatches(limit = 30): Promise<ImportBatch[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("import_batches")
    .select("id, kind, file_name, total_rows, imported, skipped, created_at")
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 100));
  if (error || !data) return [];
  return data.map((row: any) => ({
    id: row.id,
    kind: row.kind as ImportKind,
    fileName: row.file_name ?? "",
    totalRows: row.total_rows,
    imported: row.imported,
    skipped: row.skipped,
    createdAt: row.created_at,
  }));
}
