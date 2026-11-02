/** Leitura de CSV simples: aceita separador ";" ou "," e campos entre aspas. */

export type CsvRow = { line: number; values: Record<string, string> };

function splitRecords(text: string, delimiter: string): string[][] {
  const records: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === delimiter) {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      records.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    records.push(row);
  }
  return records.filter(r => r.some(v => v.trim() !== ""));
}

/** Nome de coluna sem acento e sem espaços: "Duração (min)" vira "duracao_(min)". */
export function normalizeHeader(header: string): string {
  return header
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

export function parseCsv(text: string): { headers: string[]; rows: CsvRow[] } {
  const clean = text.replace(/^﻿/, "");
  const firstLine = clean.split(/\r?\n/)[0] ?? "";
  const delimiter = firstLine.includes(";") ? ";" : ",";
  const records = splitRecords(clean, delimiter);
  if (records.length === 0) return { headers: [], rows: [] };

  const headers = records[0].map(normalizeHeader);
  const rows = records.slice(1).map((r, index) => ({
    line: index + 2,
    values: Object.fromEntries(headers.map((h, j) => [h, (r[j] ?? "").trim()])),
  }));
  return { headers, rows };
}
