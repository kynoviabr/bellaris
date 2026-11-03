"use client";
import { useCallback, useRef, useState, type ReactNode } from "react";

type Pending =
  | { kind: "notify"; message: string }
  | { kind: "confirm"; message: string; resolve: (ok: boolean) => void }
  | { kind: "prompt"; message: string; resolve: (value: string | null) => void };

type DialogApi = {
  notify: (message: string) => void;
  confirm: (message: string) => Promise<boolean>;
  prompt: (message: string) => Promise<string | null>;
};

// Ponte global: o provedor registra o diálogo e os componentes chamam appNotify / appConfirm / appPrompt.
let bridge: DialogApi | null = null;

export function appNotify(message?: string | null): void {
  if (bridge) bridge.notify(message || "Não foi possível concluir a ação.");
}

export function appConfirm(message: string): Promise<boolean> {
  return bridge ? bridge.confirm(message) : Promise.resolve(false);
}

export function appPrompt(message: string): Promise<string | null> {
  return bridge ? bridge.prompt(message) : Promise.resolve(null);
}

// Substitui alert, confirm e prompt do navegador por um diálogo do próprio sistema.
export function AppDialogProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const notify = useCallback((message: string) => setPending({ kind: "notify", message }), []);

  const confirm = useCallback((message: string) => new Promise<boolean>(resolve => {
    setPending({ kind: "confirm", message, resolve });
  }), []);

  const prompt = useCallback((message: string) => new Promise<string | null>(resolve => {
    setValue("");
    setPending({ kind: "prompt", message, resolve });
    setTimeout(() => inputRef.current?.focus(), 0);
  }), []);

  bridge = { notify, confirm, prompt };

  function close(result: boolean | string | null) {
    if (pending?.kind === "confirm") pending.resolve(result === true);
    if (pending?.kind === "prompt") pending.resolve(typeof result === "string" ? result : null);
    setPending(null);
  }

  return (
    <>
      {children}
      {pending && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-navy-dark/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl space-y-4">
            <p className="text-base text-ink whitespace-pre-line">{pending.message}</p>
            {pending.kind === "prompt" && (
              <input
                ref={inputRef}
                className="field-input"
                value={value}
                onChange={e => setValue(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") close(value.trim() || null); if (e.key === "Escape") close(null); }}
              />
            )}
            <div className="flex justify-end gap-2">
              {pending.kind === "notify" && <button type="button" className="btn-primary" onClick={() => close(null)}>OK</button>}
              {pending.kind === "confirm" && (
                <>
                  <button type="button" className="btn-outline" onClick={() => close(false)}>Cancelar</button>
                  <button type="button" className="btn-primary" onClick={() => close(true)}>Confirmar</button>
                </>
              )}
              {pending.kind === "prompt" && (
                <>
                  <button type="button" className="btn-outline" onClick={() => close(null)}>Cancelar</button>
                  <button type="button" className="btn-primary" onClick={() => close(value.trim() || null)}>Salvar</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
