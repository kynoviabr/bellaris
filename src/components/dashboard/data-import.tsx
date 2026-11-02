"use client";

import { useEffect, useState } from "react";
import { Download, Upload } from "lucide-react";
import { getImportBatches, importRows, type ImportBatch, type ImportResult } from "@/lib/actions/import-data";
import { parseCsv, type CsvRow } from "@/lib/import/csv";
import { IMPORT_KINDS, buildTemplate, decodeCsvBytes, validateRows, type ImportKind, type ValidRow, type InvalidRow } from "@/lib/import/rules";

const PREVIEW_LIMIT = 50;

export function DataImportCard() {
  const [kind, setKind] = useState<ImportKind>("services");
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [valid, setValid] = useState<ValidRow[]>([]);
  const [invalid, setInvalid] = useState<InvalidRow[]>([]);
  const [fileError, setFileError] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [batches, setBatches] = useState<ImportBatch[]>([]);

  async function loadBatches() {
    setBatches(await getImportBatches());
  }

  useEffect(() => {
    loadBatches();
  }, []);

  const def = IMPORT_KINDS.find(k => k.id === kind)!;

  function resetFile() {
    setFileName(""); setRows([]); setValid([]); setInvalid([]); setFileError(""); setResult(null);
  }

  function changeKind(next: ImportKind) {
    setKind(next);
    resetFile();
  }

  function downloadTemplate() {
    const blob = new Blob([buildTemplate(kind)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `modelo-${kind}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleFile(file: File) {
    resetFile();
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setFileError("Envie um arquivo .csv. Se a sua planilha for Excel, use Salvar como > CSV.");
      return;
    }
    const text = decodeCsvBytes(await file.arrayBuffer());
    const parsed = parseCsv(text);
    const missing = def.headers.filter(h => !parsed.headers.includes(h));
    if (parsed.rows.length === 0) {
      setFileError("O arquivo não tem linhas de dados.");
      return;
    }
    if (missing.length > 0) {
      setFileError(`Colunas faltando: ${missing.join(", ")}. Baixe o modelo e use o mesmo cabeçalho.`);
      return;
    }
    const checked = validateRows(kind, parsed.rows);
    setFileName(file.name);
    setRows(parsed.rows);
    setValid(checked.valid);
    setInvalid(checked.invalid);
  }

  async function handleImport() {
    const validLines = new Set(valid.map(v => v.line));
    setBusy(true);
    setResult(null);
    const res = await importRows(kind, rows.filter(r => validLines.has(r.line)), fileName);
    setBusy(false);
    setResult(res);
    loadBatches();
    if (res.ok) {
      setValid([]);
      setInvalid([]);
      setRows([]);
    }
  }

  const previewRows = [
    ...valid.map(v => ({ line: v.line, ok: true as const, text: v.label, error: "" })),
    ...invalid.map(i => ({ line: i.line, ok: false as const, text: i.raw.values.nome || "(sem nome)", error: i.error })),
  ].sort((a, b) => a.line - b.line);

  return (
    <div className="bg-white rounded-lg border shadow-sm p-6">
      <div className="flex items-center gap-3 mb-6 border-b pb-4">
        <div className="bg-primary/10 text-primary p-2 rounded-lg"><Upload size={20} /></div>
        <div>
          <h3 className="font-semibold text-lg text-ink">Importar dados</h3>
          <p className="text-sm text-muted">Carregue serviços, profissionais e clientes de uma planilha CSV. Linhas com erro são ignoradas.</p>
        </div>
      </div>

      <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-semibold">Ordem certa da carga</p>
        <ol className="mt-1 list-decimal pl-5">
          {IMPORT_KINDS.map(k => <li key={k.id}>{k.label}</li>)}
        </ol>
        <p className="mt-2">Importe nessa ordem. Os clientes e os atendimentos dependem de serviços e profissionais já cadastrados. Produtos e estoque podem ser importados depois, mas antes de usar o estoque.</p>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {IMPORT_KINDS.map((k, index) => (
          <button key={k.id} type="button" onClick={() => changeKind(k.id)}
            className={kind === k.id ? "btn-primary" : "btn-outline"}>{index + 1}. {k.label}</button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <button type="button" onClick={downloadTemplate} className="btn-outline inline-flex items-center gap-2">
          <Download size={16} /> Baixar modelo de {def.label.toLowerCase()}
        </button>
        <p className="text-xs text-muted">Colunas: {def.headers.join(", ")}. Use ponto e vírgula (;) como separador.</p>
      </div>

      <input type="file" accept=".csv,text/csv" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
        className="block w-full text-sm text-muted file:mr-3 file:rounded-md file:border-0 file:bg-primary/10 file:px-3 file:py-2 file:text-primary" />

      {fileError && <p className="mt-3 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-danger">{fileError}</p>}

      {fileName && !fileError && (
        <div className="mt-5">
          <p className="text-sm text-ink">
            <strong>{fileName}</strong>: {valid.length} linha(s) válida(s), {invalid.length} com erro.
          </p>

          <div className="mt-3 max-h-72 overflow-auto rounded-md border border-[#E7EDF3]">
            <table className="w-full text-sm">
              <thead className="bg-bg text-left text-xs text-muted">
                <tr><th className="px-3 py-2">Linha</th><th className="px-3 py-2">Nome</th><th className="px-3 py-2">Situação</th></tr>
              </thead>
              <tbody>
                {previewRows.slice(0, PREVIEW_LIMIT).map(r => (
                  <tr key={r.line} className="border-t border-[#E7EDF3]">
                    <td className="px-3 py-2 text-muted">{r.line}</td>
                    <td className="px-3 py-2">{r.text}</td>
                    <td className="px-3 py-2">{r.ok ? <span className="text-emerald-700">OK</span> : <span className="text-danger">{r.error}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {previewRows.length > PREVIEW_LIMIT && (
            <p className="mt-2 text-xs text-muted">Mostrando as primeiras {PREVIEW_LIMIT} linhas de {previewRows.length}.</p>
          )}

          <div className="mt-4 flex justify-end">
            <button type="button" onClick={handleImport} disabled={busy || valid.length === 0} className="btn-primary">
              {busy ? "Importando..." : `Importar ${valid.length} linha(s) válida(s)`}
            </button>
          </div>
        </div>
      )}

      {result && result.ok && (
        <div className="mt-5 rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <p><strong>{result.imported}</strong> {def.label.toLowerCase()} importado(s).</p>
          {result.imported > 0 && (
            <button type="button" onClick={() => window.location.reload()} className="btn-outline mt-3">
              Atualizar a tela para ver os dados
            </button>
          )}
          {result.skipped.length > 0 && (
            <>
              <p className="mt-2 font-medium">{result.skipped.length} linha(s) ignorada(s):</p>
              <ul className="mt-1 list-disc pl-5">
                {result.skipped.map(s => <li key={`${s.line}-${s.reason}`}>Linha {s.line}: {s.reason}</li>)}
              </ul>
            </>
          )}
        </div>
      )}
      {result && !result.ok && (
        <p className="mt-5 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-danger">{result.error}</p>
      )}

      <div className="mt-6 border-t pt-4">
        <h4 className="font-semibold text-ink">Cargas feitas</h4>
        {batches.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Nenhuma carga feita ainda.</p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-md border border-[#E7EDF3]">
            <table className="w-full text-sm">
              <thead className="bg-bg text-left text-xs text-muted">
                <tr>
                  <th className="px-3 py-2">Data e hora</th>
                  <th className="px-3 py-2">Carga</th>
                  <th className="px-3 py-2">Arquivo</th>
                  <th className="px-3 py-2 text-right">No arquivo</th>
                  <th className="px-3 py-2 text-right">Gravados</th>
                  <th className="px-3 py-2 text-right">Ignorados</th>
                </tr>
              </thead>
              <tbody>
                {batches.map(b => (
                  <tr key={b.id} className="border-t border-[#E7EDF3]">
                    <td className="px-3 py-2 whitespace-nowrap">{new Date(b.createdAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</td>
                    <td className="px-3 py-2">{IMPORT_KINDS.find(k => k.id === b.kind)?.label ?? b.kind}</td>
                    <td className="px-3 py-2">{b.fileName || "-"}</td>
                    <td className="px-3 py-2 text-right">{b.totalRows}</td>
                    <td className="px-3 py-2 text-right text-emerald-700">{b.imported}</td>
                    <td className="px-3 py-2 text-right text-muted">{b.skipped}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
