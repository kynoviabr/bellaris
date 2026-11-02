"use client";

import { useState } from "react";
import { formatCepDisplay, onlyDigits, UFS } from "@/lib/validation/br.ts";
import type { PlanOption } from "@/lib/actions/onboarding";

type Defaults = Partial<Record<
  "fullName" | "whatsapp" | "cpf" | "cep" | "logradouro" | "numero" | "complemento" | "bairro" | "cidade" | "uf",
  string
>>;

const formatWhatsapp = (value: string) => {
  const d = onlyDigits(value).slice(0, 11);
  if (d.length <= 2) return d;
  const split = d.length > 10 ? 7 : 6;
  return d.length <= split ? `(${d.slice(0, 2)}) ${d.slice(2)}` : `(${d.slice(0, 2)}) ${d.slice(2, split)}-${d.slice(split)}`;
};

const formatCpf = (value: string) => {
  const d = onlyDigits(value).slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
};

/**
 * Campos do dono do salão. Ao informar um CEP completo, preenche logradouro, bairro, cidade e UF
 * (consulta ViaCEP). Todos os campos continuam editáveis. Os nomes são usados pelo envio do formulário.
 */
export function OwnerFormFields({ defaults = {} }: { defaults?: Defaults }) {
  const [fullName, setFullName] = useState(defaults.fullName ?? "");
  const [whatsapp, setWhatsapp] = useState(formatWhatsapp(defaults.whatsapp ?? ""));
  const [cpf, setCpf] = useState(formatCpf(defaults.cpf ?? ""));
  const [cep, setCep] = useState(formatCepDisplay(defaults.cep ?? ""));
  const [logradouro, setLogradouro] = useState(defaults.logradouro ?? "");
  const [numero, setNumero] = useState(defaults.numero ?? "");
  const [complemento, setComplemento] = useState(defaults.complemento ?? "");
  const [bairro, setBairro] = useState(defaults.bairro ?? "");
  const [cidade, setCidade] = useState(defaults.cidade ?? "");
  const [uf, setUf] = useState((defaults.uf ?? "").toUpperCase());
  const [loadingCep, setLoadingCep] = useState(false);
  const [cepMessage, setCepMessage] = useState<string | null>(null);

  const handleCep = async (raw: string) => {
    const formatted = formatCepDisplay(raw);
    setCep(formatted);
    setCepMessage(null);
    const digits = onlyDigits(formatted);
    if (digits.length !== 8) return;

    setLoadingCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await res.json();
      if (data.erro) {
        setCepMessage("CEP não encontrado. Preencha o endereço manualmente.");
      } else {
        setLogradouro(data.logradouro || "");
        setBairro(data.bairro || "");
        setCidade(data.localidade || "");
        setUf((data.uf || "").toUpperCase());
        document.getElementById("owner-numero")?.focus();
      }
    } catch {
      setCepMessage("Não foi possível consultar o CEP. Preencha o endereço manualmente.");
    } finally {
      setLoadingCep(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Linha 1: nome (metade da largura) e campos de tamanho fixo (WhatsApp e CPF) */}
      <div className="flex flex-wrap gap-4">
        <div className="w-full sm:w-1/2">
          <label className="field-label" htmlFor="owner-fullName">Nome completo do responsável</label>
          <input id="owner-fullName" name="fullName" type="text" required value={fullName}
            onChange={(e) => setFullName(e.target.value)} className="field-input" placeholder="Ex: Amanda Silva" />
        </div>
        <div className="w-full sm:w-44">
          <label className="field-label" htmlFor="owner-whatsapp">WhatsApp</label>
          <input id="owner-whatsapp" name="whatsapp" type="tel" inputMode="tel" required value={whatsapp}
            onChange={(e) => setWhatsapp(formatWhatsapp(e.target.value))} className="field-input" placeholder="(11) 98765-4321" />
        </div>
        <div className="w-full sm:w-44">
          <label className="field-label" htmlFor="owner-cpf">CPF</label>
          <input id="owner-cpf" name="cpf" type="text" inputMode="numeric" required value={cpf}
            onChange={(e) => setCpf(formatCpf(e.target.value))} className="field-input" placeholder="000.000.000-00" />
        </div>
      </div>

      {/* Linha 2: endereço (CEP, logradouro, número e complemento) */}
      <div className="flex flex-wrap gap-4">
        <div className="w-full sm:w-36">
          <label className="field-label" htmlFor="owner-cep">CEP</label>
          <div className="relative">
            <input id="owner-cep" name="cep" type="text" inputMode="numeric" required value={cep}
              onChange={(e) => handleCep(e.target.value)} className="field-input" placeholder="00000-000" />
            {loadingCep && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">buscando...</span>}
          </div>
        </div>
        <div className="w-full sm:min-w-[12rem] sm:flex-1">
          <label className="field-label" htmlFor="owner-logradouro">Logradouro</label>
          <input id="owner-logradouro" name="logradouro" type="text" required value={logradouro}
            onChange={(e) => setLogradouro(e.target.value)} className="field-input" placeholder="Rua, avenida..." />
        </div>
        <div className="w-full sm:w-24">
          <label className="field-label" htmlFor="owner-numero">Número</label>
          <input id="owner-numero" name="numero" type="text" required value={numero}
            onChange={(e) => setNumero(e.target.value)} className="field-input" />
        </div>
        <div className="w-full sm:w-52">
          <label className="field-label" htmlFor="owner-complemento">Complemento</label>
          <input id="owner-complemento" name="complemento" type="text" value={complemento}
            onChange={(e) => setComplemento(e.target.value)} className="field-input" placeholder="Sala, bloco..." />
        </div>
      </div>
      {cepMessage && <p className="text-xs text-muted">{cepMessage}</p>}

      {/* Linha 3: bairro, cidade e UF */}
      <div className="flex flex-wrap gap-4">
        <div className="w-full sm:min-w-[12rem] sm:flex-1">
          <label className="field-label" htmlFor="owner-bairro">Bairro</label>
          <input id="owner-bairro" name="bairro" type="text" value={bairro}
            onChange={(e) => setBairro(e.target.value)} className="field-input" />
        </div>
        <div className="w-full sm:w-64">
          <label className="field-label" htmlFor="owner-cidade">Cidade</label>
          <input id="owner-cidade" name="cidade" type="text" required value={cidade}
            onChange={(e) => setCidade(e.target.value)} className="field-input" />
        </div>
        <div className="w-full sm:w-24">
          <label className="field-label" htmlFor="owner-uf">UF</label>
          <select id="owner-uf" name="uf" required value={uf} onChange={(e) => setUf(e.target.value)} className="field-input">
            <option value="">UF</option>
            {UFS.map((sigla) => <option key={sigla} value={sigla}>{sigla}</option>)}
          </select>
        </div>
      </div>
    </div>
  );
}

/** Escolha de plano. Mostra o valor mensal e o limite de profissionais de cada plano. */
export function PlanPicker({ plans, defaultCode }: { plans: PlanOption[]; defaultCode?: string | null }) {
  const [selected, setSelected] = useState(defaultCode ?? "");

  if (plans.length === 0) {
    return <p className="text-sm text-muted">Carregando planos...</p>;
  }

  return (
    <fieldset className="space-y-2">
      <legend className="field-label mb-2">Plano</legend>
      {plans.map((plan) => (
        <label key={plan.code}
          className={`flex cursor-pointer items-center justify-between gap-4 rounded-lg border p-4 ${selected === plan.code ? "border-emerald-600 bg-emerald-50" : "border-[#DBE3EC] bg-white"}`}>
          <span className="flex items-center gap-3">
            <input type="radio" name="planCode" value={plan.code} required checked={selected === plan.code}
              onChange={() => setSelected(plan.code)} className="h-4 w-4" />
            <span>
              <span className="block font-semibold text-ink">{plan.name}</span>
              <span className="block text-xs text-muted">
                {plan.max_professionals ? `Até ${plan.max_professionals} profissionais` : "Profissionais ilimitados"}
              </span>
              {plan.description && (
                <span className="mt-1 block text-xs text-muted">{plan.description}</span>
              )}
            </span>
          </span>
          <span className="text-right font-semibold text-ink">
            R$ {Number(plan.monthly_price).toFixed(2).replace(".", ",")}
            <span className="block text-xs font-normal text-muted">/mês</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}
