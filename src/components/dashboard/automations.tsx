import { appNotify, appConfirm, appPrompt } from "@/components/ui/app-dialog";
import React, { useState, useEffect } from "react";
import { Plus, Search, Mail, MessageCircle, Settings, ChevronRight, Activity, CalendarDays, ArrowRight } from "lucide-react";
import { Badge, SectionTitle, type View, Metric } from "../shared";
import { getRemindersForTomorrow, getOverdueMaintenances } from "@/lib/actions/automations";
import { Check, Calendar, Users, Copy, AlertTriangle } from "lucide-react";

export const initialTemplates = [{ name: "Lembrete 24h", count: "18 agendadas", tone: "success" }, { name: "Sinal pendente", count: "3 aguardando", tone: "warning" }, { name: "Manutenção vencida", count: "7 oportunidades", tone: "danger" }, { name: "Aniversário", count: "2 nesta semana", tone: "primary" }];

export function Automations({ go, tenant }: { go: (v: View) => void, tenant?: any }) {
  const [reminders, setReminders] = useState<any[]>([]);
  const [overdue, setOverdue] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<{phone:string; message:string; clientName:string; list:"reminders"|"overdue"; clientId:string; appointmentId?:string}|null>(null);
  const [confirming, setConfirming] = useState(false);
  const [opened, setOpened] = useState(false);
  const [recordError, setRecordError] = useState("");
  const [tab, setTab] = useState<"reminders" | "retention">("reminders");

  const loadData = React.useCallback(async () => {
    setLoading(true);
    const [remRes, overRes] = await Promise.all([
      getRemindersForTomorrow(tenant?.orgName),
      getOverdueMaintenances(tenant?.orgName)
    ]);
    setReminders(remRes);
    setOverdue(overRes);
    setLoading(false);
  }, [tenant?.orgName]);

  useEffect(() => {
    const run = async () => { await loadData(); };
    run();
  }, [loadData, tenant?.orgName]);

  const openWhatsApp = (phone: string, message: string, list: "reminders" | "overdue", _index: number, clientId: string, appointmentId?: string, clientName = "Cliente") => {
    setDraft({phone, message, list, clientId, appointmentId, clientName});
    setOpened(false);
    setRecordError("");
  };

  const reviewOnWhatsApp = () => {
    if (!draft) return;
    let phone = draft.phone.replace(/\D/g, "");
    if (phone.startsWith("55") && phone.length > 11) phone = phone.slice(2);
    if (phone.length < 10 || phone.length > 11) {
      setRecordError("WhatsApp inválido. Corrija o telefone no cadastro da cliente.");
      return;
    }
    const url = `https://wa.me/55${phone}?text=${encodeURIComponent(draft.message)}`;
    window.open(url, "_blank", "noopener,noreferrer");
    setOpened(true);
  };

  const isHomologation = process.env.NEXT_PUBLIC_GABI_HOMOLOGATION === "true";

  const confirmSent = async () => {
    if (!draft || confirming) return;
    setConfirming(true);
    setRecordError("");
    try {
      if (isHomologation) {
        // Homologation is a safe preview: never register a real sent event.
        setRecordError("Modo de homologação: mensagem revisada, mas envio real e registro como enviada permanecem desabilitados. Use produção para confirmar um envio real.");
        return;
      }
      const { markMessageSent } = await import("@/lib/actions/automations");
      const res = await markMessageSent(draft.clientId, draft.list, draft.appointmentId);
      if (!res.success) {
        setRecordError(res.error || "Não foi possível registrar o envio. Tente novamente.");
        return;
      }
      const update = (items: any[]) => items.map(item => item.clientId === draft.clientId && (draft.list === "overdue" || item.id === draft.appointmentId) ? {...item, sent: true} : item);
      if (draft.list === "reminders") setReminders(update);
      else setOverdue(update);
      setDraft(null);
    } catch {
      setRecordError("Falha ao registrar o envio. A mensagem pode ter sido enviada no WhatsApp.");
    } finally {
      setConfirming(false);
    }
  };

  return (
    <main className="page-content">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy-dark">Disparos e Automações</h1>
          <p className="text-muted">Aumente sua retenção de clientes e evite furos na agenda.</p>
        </div>
        <button onClick={loadData} className="btn-outline">
          <Calendar size={16} /> Atualizar listas
        </button>
      </div>

      <div className="mb-6 border-b border-[#E7EDF3]">
        <div className="flex gap-6">
          <button
            onClick={() => setTab("reminders")}
            className={`pb-3 font-medium border-b-2 transition-colors ${tab === "reminders" ? "border-primary text-primary" : "border-transparent text-muted hover:text-ink"}`}
          >
            Lembretes de Agenda
          </button>
          <button
            onClick={() => setTab("retention")}
            className={`pb-3 font-medium border-b-2 transition-colors ${tab === "retention" ? "border-primary text-primary" : "border-transparent text-muted hover:text-ink"}`}
          >
            Retenção (Manutenção Vencida)
          </button>
        </div>
      </div>

      {tab === "reminders" && (
        <>
          <div className="grid gap-4 sm:grid-cols-3 mb-6">
            <Metric label="Lembretes pendentes" value={reminders.filter(r => !r.sent).length.toString()} detail="Próximos horários marcados" icon={MessageCircle} />
            <Metric label="Já enviados" value={reminders.filter(r => r.sent).length.toString()} detail="Envio confirmado manualmente" icon={Check} />
            <Metric onClick={() => go("agenda")} label="Agendamentos vazios" value="0" detail="Clientes sem celular" icon={Users} />
          </div>

          <section className="card">
            <SectionTitle title="Fila de Mensagens" subtitle="Revise e edite a mensagem antes de abrir o WhatsApp. Confirme manualmente após o envio." />

            {loading ? (
              <div className="py-12 flex justify-center"><div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full"></div></div>
            ) : reminders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-[#E7EDF3] rounded-lg mt-4">
                <p className="text-muted mb-2">A fila está vazia.</p>
                <p className="text-sm text-muted">Não há agendamentos válidos no futuro ou eles já foram confirmados.</p>
              </div>
            ) : (
              <div className="space-y-4 mt-6">
                {reminders.map((r, i) => (
                  <MessageCard key={r.id} item={r} onSend={() => openWhatsApp(r.phone, r.message, "reminders", i, r.clientId, r.id, r.clientName)} />
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {tab === "retention" && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 mb-6">
            <Metric label="Oportunidades de retorno" value={overdue.filter(r => !r.sent).length.toString()} detail="Mais de 20 dias sem voltar" icon={AlertTriangle} tone="warning" />
            <Metric label="Reativações tentadas" value={overdue.filter(r => r.sent).length.toString()} detail="Envio confirmado manualmente" icon={Check} tone="success" />
          </div>

          <section className="card">
            <SectionTitle title="Clientes em Risco" subtitle="Fizeram manutenção/alongamento há mais de 20 dias e não têm retorno agendado." />

            {loading ? (
              <div className="py-12 flex justify-center"><div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full"></div></div>
            ) : overdue.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-[#E7EDF3] rounded-lg mt-4">
                <p className="text-muted mb-2">Nenhuma cliente pendente.</p>
                <p className="text-sm text-muted">A sua retenção está ótima! Todas as clientes de alongamento têm retorno marcado.</p>
              </div>
            ) : (
              <div className="space-y-4 mt-6">
                {overdue.map((r, i) => (
                  <MessageCard
                    key={r.id}
                    item={r}
                    onSend={() => openWhatsApp(r.phone, r.message, "overdue", i, r.clientId, r.id, r.clientName)}
                    badgeText={`Há ${r.daysSince} dias`}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {draft && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" role="presentation" onMouseDown={e => {if(e.target === e.currentTarget) setDraft(null);}}>
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl" role="dialog" aria-modal="true" aria-label="Revisar mensagem">
            <h2 className="text-2xl font-semibold text-ink mb-2">Revisar mensagem</h2>
            <p className="text-muted mb-4">Cliente: {draft.clientName}. Revise o texto antes de abrir o WhatsApp.</p>
            <textarea aria-label="Texto da mensagem" className="w-full rounded-xl border border-[#E7D7C5] p-4 text-ink bg-white min-h-[240px]" value={draft.message} onChange={e=>setDraft({...draft,message:e.target.value})}/>
            {recordError && <p className="text-red-700 text-sm mt-3" role="alert">{recordError}</p>}
            {opened && <p className="text-sm text-muted mt-3">WhatsApp aberto para revisão. Confirme abaixo somente depois de enviar a mensagem à cliente.</p>}
            <div className="flex flex-wrap justify-end gap-3 mt-5">
              <button className="btn-outline" onClick={()=>setDraft(null)}>Fechar</button>
              <button className="btn-outline" onClick={()=>navigator.clipboard.writeText(draft.message)}>Copiar</button>
              <button className="btn-primary" onClick={reviewOnWhatsApp}>Revisar no WhatsApp</button>
              {opened && <button className="btn-outline" disabled={confirming} onClick={confirmSent}>{confirming ? "Registrando..." : "Confirmar que enviei"}</button>}
            </div>
          </div>
        </div>
      )}

    </main>
  );
}

function MessageCard({ item, onSend, badgeText }: { item: any, onSend: () => void, badgeText?: string }) {
  return (
    <div className={`p-4 rounded-lg border ${item.sent ? 'border-emerald-200 bg-emerald-50/50' : 'border-[#E7EDF3] bg-surface'}`}>
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="font-semibold">{item.clientName}</h3>
          <p className="text-xs text-muted">
            {item.lastDate ? `Última visita: ${item.lastDate} · ` : (item.message.includes("amanhã") ? "Amanhã · " : `Dia ${item.message.match(/dia (\d{2}\/\d{2})/)?.[1]} às ${item.time} · `)}
            {item.lastService || item.services}
          </p>
        </div>
        <div className="flex gap-2">
          {badgeText && <Badge tone="danger">{badgeText}</Badge>}
          <Badge tone={item.sent ? "success" : "warning"}>{item.sent ? "Enviado" : "Pendente"}</Badge>
        </div>
      </div>

      <div className="bg-white p-3 rounded border border-[#E7EDF3] text-sm text-ink font-sans relative">
        <div className="absolute top-0 right-0 bottom-0 w-1 bg-green-500 rounded-r"></div>
        {item.message}
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <button onClick={() => {
          navigator.clipboard.writeText(item.message);
          appNotify("Mensagem copiada!");
        }} className="btn-outline py-1.5 px-3 text-xs">
          <Copy size={14} /> Copiar texto
        </button>
        <button
          onClick={onSend}
          className="btn-primary bg-green-600 hover:bg-green-700 border-green-600 py-1.5 px-3 text-xs"
        >
          <MessageCircle size={14} /> {item.sent ? "Revisar novamente" : "Gerar mensagem"}
        </button>
      </div>
    </div>
  );
}
