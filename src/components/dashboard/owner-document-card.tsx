"use client";

import { useEffect, useState, useTransition } from "react";
import { getMyOwnerDocument, updateMyOwnerDocument } from "@/lib/actions/organizations";
import { appNotify } from "@/components/ui/app-dialog";
import { formatCnpjDisplay, formatCpfDisplay } from "@/lib/validation/br.ts";

// Documento do responsável pelo salão (CPF ou CNPJ). Só o dono altera. Vale para a cobrança.
export function OwnerDocumentCard() {
  const [loaded, setLoaded] = useState(false);
  const [visible, setVisible] = useState(false);
  const [documentType, setDocumentType] = useState<"cpf" | "cnpj">("cpf");
  const [value, setValue] = useState("");
  const [saved, setSaved] = useState<{ type: "cpf" | "cnpj"; value: string } | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let active = true;
    getMyOwnerDocument().then((res) => {
      if (!active) return;
      if (res.data) {
        setVisible(true);
        setDocumentType(res.data.documentType);
        setValue(res.data.documentType === "cnpj" ? formatCnpjDisplay(res.data.document) : formatCpfDisplay(res.data.document));
        setSaved({ type: res.data.documentType, value: res.data.document });
      }
      setLoaded(true);
    });
    return () => { active = false; };
  }, []);

  if (!loaded || !visible) return null;

  const onChangeType = (type: "cpf" | "cnpj") => {
    setDocumentType(type);
    setValue("");
  };

  const onChangeValue = (raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, documentType === "cnpj" ? 14 : 11);
    setValue(documentType === "cnpj" ? formatCnpjDisplay(digits) : formatCpfDisplay(digits));
  };

  const onSave = () => {
    const fd = new FormData();
    fd.set("documentType", documentType);
    fd.set("document", value);
    startTransition(async () => {
      const res = await updateMyOwnerDocument(undefined, fd);
      if (res.error) { appNotify(res.error); return; }
      setSaved({ type: documentType, value: value.replace(/\D/g, "") });
      appNotify(documentType === "cnpj" ? "CNPJ salvo." : "CPF salvo.");
    });
  };

  const unchanged = saved !== null && saved.type === documentType && saved.value === value.replace(/\D/g, "");

  return (
    <div className="rounded-xl border border-[#E8D9C7] bg-white p-5">
      <h3 className="text-sm font-semibold text-ink">Documento do responsável</h3>
      <p className="mt-1 text-xs text-muted">Usado na cobrança do salão. Informe CPF ou CNPJ.</p>
      <div role="radiogroup" aria-label="Tipo de documento" className="mt-3 flex gap-5 text-sm text-ink">
        <label className="flex items-center gap-2">
          <input type="radio" name="owner-doc-type" checked={documentType === "cpf"} onChange={() => onChangeType("cpf")} /> CPF
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name="owner-doc-type" checked={documentType === "cnpj"} onChange={() => onChangeType("cnpj")} /> CNPJ
        </label>
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <div className="w-full sm:w-64">
          <label className="field-label" htmlFor="owner-doc-value">{documentType === "cnpj" ? "CNPJ" : "CPF"}</label>
          <input id="owner-doc-value" type="text" inputMode="numeric" className="field-input" value={value}
            placeholder={documentType === "cnpj" ? "00.000.000/0000-00" : "000.000.000-00"}
            onChange={(e) => onChangeValue(e.target.value)} />
        </div>
        <button type="button" className="btn-primary" disabled={pending || !value || unchanged} onClick={onSave}>
          {pending ? "Salvando..." : "Salvar documento"}
        </button>
      </div>
    </div>
  );
}
