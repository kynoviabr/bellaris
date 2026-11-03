"use client";
import { appNotify, appConfirm, appPrompt, AppDialogProvider } from "@/components/ui/app-dialog";
/* eslint-disable react-hooks/set-state-in-effect */
import NextImage from "next/image";
import { formatBrazilPhone, formatCep, normalizeEmail, digitsOnly } from "@/lib/utils/input-masks";
import { View, EntityKind, EntityModalState, Badge, statusTone, Metric, RowActions, SectionTitle, SmallMetricLink, SystemAlertModal } from "./shared";
import { formatAgeInYearsAndMonths } from "@/lib/utils/age";
import { Professionals } from "./dashboard/professionals";
import { Attendance } from "./dashboard/attendance";
import { BellarisMark, BellarisWordmark } from "./brand/bellaris-mark";
import { Finance } from "./dashboard/finance";
import { Inventory } from "./dashboard/inventory";
import { Automations } from "./dashboard/automations";
import { Reports } from "./dashboard/reports";
import { Clients } from "./dashboard/clients";
import { Services } from "./dashboard/services";
import { PackageCatalogContent } from "./dashboard/package-catalog";
import { Agenda } from "./dashboard/agenda";
import { ProfessionalClients } from "./dashboard/professional-clients";
import { listMyClientBirthdays } from "@/lib/actions/professional-clients";
import { canOpenView, type PermissionRow, type StudioRole } from "@/lib/authorization/permissions";
import { RolePermissionsManager } from "./dashboard/role-permissions-manager";
import { TeamUsersManager } from "./dashboard/team-users-manager";
import { updateAppointmentRecord, addServiceToAppointment, removeServiceFromAppointment } from "@/lib/actions/appointments";

import { useState, useEffect, useRef } from "react";
import {
  Archive, ArrowRight, Calendar, BarChart3, Bell, CalendarDays, Check, ChevronDown, CircleDollarSign,
  ClipboardCheck, Clock3, CreditCard, Download, Gift, HeartHandshake, Home, Menu, MessageCircle,
  MoreHorizontal, Package, Plus, Search, Settings, ShieldCheck, ShoppingBag, Sparkles, TrendingUp,
  Eye, Pencil, Trash2, UserRound, Users, Wallet, WandSparkles, X, Database, Copy
} from "lucide-react";
import { appointments as demoAppointments, clients as demoClients, inventory, money, professionals as demoProfessionals, recovery, services as demoServices, type Appointment, type AppointmentStatus } from "@/lib/demo-data";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { logout } from "@/lib/actions/auth";
import { createClientRecord, updateClientRecord, archiveClientRecord, type ClientItem } from "@/lib/actions/clients";
import { getClientPrivacyStatus } from "@/lib/actions/privacy";
import { ClientPrivacyPanel } from "@/components/dashboard/client-privacy-panel";
import { CONSENT_TEXTS } from "@/lib/privacy/consent";
import { createProfessionalRecord, updateProfessionalRecord, archiveProfessionalRecord, getProfessionals, type ProfessionalItem } from "@/lib/actions/professionals";
import { createSpecialtyRecord } from "@/lib/actions/specialties";
import { createServiceRecord, type ServiceItem } from "@/lib/actions/services";
import { createAppointmentRecord, cancelAppointmentRecord, updateAppointmentStatus, getAppointments, toggleBlockDayRecord, markServiceCompleted } from "@/lib/actions/appointments";
import { finishAppointment } from "@/lib/actions/attendance";
import { createExpense } from "@/lib/actions/finance";
import { getProfessionalCommissions, payCommissions } from "@/lib/actions/commissions";
import { getClientDetails, uploadClientPhoto, deleteClientPhoto, getClients, toggleClientWhitelist, toggleClientBlacklist, runAutoPromoteWhitelist } from "@/lib/actions/clients";
import { OnlineBooking } from "./online-booking";
import { DataImportCard } from "./dashboard/data-import";
import { getRemindersForTomorrow } from "@/lib/actions/automations";
import { createProduct, updateProduct, addStockMovement, getInventory } from "@/lib/actions/inventory";
import { updateServiceConsumables, getServices, deleteServiceRecord, updateServiceRecord } from "@/lib/actions/services";


const nav: { id: View; label: string; icon: typeof Home }[] = [
  { id: "dashboard", label: "Painel", icon: Home }, { id: "agenda", label: "Agenda", icon: CalendarDays },
  { id: "clients", label: "Clientes", icon: Users }, { id: "services", label: "Serviços", icon: Sparkles },
  { id: "professionals", label: "Profissionais", icon: UserRound }, { id: "attendance", label: "Atendimentos", icon: ClipboardCheck },
  { id: "finance", label: "Financeiro", icon: Wallet }, { id: "commissions", label: "Comissões", icon: CircleDollarSign }, { id: "packages", label: "Catálogo de Pacotes", icon: Package }, { id: "inventory", label: "Estoque", icon: Package },
  { id: "automations", label: "Automações", icon: WandSparkles }, { id: "reports", label: "Relatórios", icon: BarChart3 }, { id: "online", label: "Agendamento online", icon: ShoppingBag }
];

const titles: Record<View, [string, string]> = {
  commissions: ["Minhas comissões", "Acompanhe suas comissões."],
  settings: ["Configurações", "Gerencie os dados e o acesso do seu salão."],
  dashboard: ["Painel", "Acompanhe o ritmo do salão hoje."], agenda: ["Agenda", "Gerencie seus agendamentos"],
  clients: ["Clientes", "Relacionamento, histórico e recorrência."], services: ["Serviços", "Catálogo, preços e consumo de insumos."],
  professionals: ["Profissionais", "Equipe, jornadas e indicadores."], attendance: ["Atendimentos", "Conduza cada atendimento até o recebimento."],
  finance: ["Financeiro", "Faturamento, recebimentos, despesas e comissões."], packages: ["Catálogo de Pacotes e Combos", "Cadastre e gerencie os pacotes de serviços do salão."], inventory: ["Estoque", "Saldo por movimentação e previsão de consumo."],
  automations: ["Automações", "Comunicações programadas e receita recuperada."], reports: ["Relatórios", "Desempenho, clientes e consumo."], online: ["Agendamento online", "Prévia do fluxo público para suas clientes."]
};





const entityLabels: Record<EntityKind, string> = { client: "cliente", service: "serviço", professional: "profissional", product: "produto", automation: "automação", appointment: "agendamento", financial: "lançamento", service_consumables: "consumo" };


function AppointmentModal({ mode, appointment, clients, professionals, services, close, save }: { mode: "view" | "edit"; appointment: any; clients: any[]; professionals: any[]; services: any[]; close: () => void; save: (id: string, rawData: any) => void }) {
  const [clientId, setClientId] = useState(appointment?.client_id || clients.find(c => c.name === appointment?.client)?.id || clients[0]?.id || "");
  const [profId, setProfId] = useState(appointment?.professional_id || professionals.find(p => p.name === appointment?.professional)?.id || professionals[0]?.id || "");

  // Try to parse services from the joined string or fallback to empty array (not perfect, but works for MVP since we don't have the full raw item easily available without refetching)
  const initialServiceNames = appointment?.service ? appointment.service.split(" + ") : [];
  const initialServiceIds = initialServiceNames.map((name: string) => services.find((s: any) => s.name === name)?.id).filter(Boolean);

  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>(initialServiceIds.length > 0 ? initialServiceIds : [services[0]?.id || ""]);

  // Date parsing
  // the 'time' is just HH:MM, date is not stored in demo Appointment struct cleanly, we'll just use today if unknown.
  // Actually, we need to extract date from the real db starts_at if we had it. For now, use today.
  const [dateStr, setDateStr] = useState(appointment?.dateStr || new Date().toISOString().split("T")[0]);
  const [timeStr, setTimeStr] = useState(appointment?.time || "09:00");
  const [submitting, setSubmitting] = useState(false);
  const readOnly = mode === "view";
  const selectedClient = clients.find(c => c.id === clientId);
  const selectedProf = professionals.find(p => p.id === profId);
  const selectedSvcs = selectedServiceIds.map((id: string) => services.find((s: any) => s.id === id)).filter(Boolean);
  const totalDuration = selectedSvcs.reduce((acc: number, s: any) => acc + s.duration, 0);
  const totalPrice = selectedSvcs.reduce((acc: number, s: any) => acc + s.price, 0);

  return <div className="fixed inset-0 z-[70] flex items-end justify-center bg-navy-dark/45 p-0 sm:items-center sm:p-4"><form onSubmit={async e => {
    e.preventDefault();
    if (!selectedClient || !selectedProf || selectedSvcs.length === 0) return;
    setSubmitting(true);
    await save(appointment.id, {
      clientId,
      professionalId: profId,
      services: selectedSvcs.map((s: any) => ({ id: s.id, price: s.price, durationMinutes: s.duration })),
      dateStr,
      timeStr,
      durationMinutes: totalDuration,
      price: totalPrice
    });
    setSubmitting(false);
  }} className="w-full max-w-xl rounded-t-lg bg-white p-5 shadow-xl sm:rounded-lg"><div className="flex items-center justify-between"><div><Badge tone="primary">{mode === "view" ? "Detalhes" : "Editar Agendamento"}</Badge><h2 className="mt-2 text-lg font-semibold">{appointment?.client || "Agendamento"}</h2></div><button type="button" onClick={close} className="rounded-md p-2 text-muted hover:bg-bg"><X size={18} /></button></div><div className="mt-5 grid gap-4 sm:grid-cols-2">
    <label><span className="field-label">Cliente</span><select disabled={readOnly} value={clientId} onChange={e => setClientId(e.target.value)} className="field-input" required>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
    <label><span className="field-label">Profissional</span><select disabled={readOnly} value={profId} onChange={e => setProfId(e.target.value)} className="field-input" required>{professionals.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
    <div className="sm:col-span-2 space-y-2"><span className="field-label">Serviços</span>
            {selectedServiceIds.map((srvId: string, index: number) => (
              <div key={index} className="flex gap-2">
                <select disabled={readOnly} value={srvId} onChange={e => {
                  const newIds = [...selectedServiceIds];
                  newIds[index] = e.target.value;
                  setSelectedServiceIds(newIds);
                }} className="field-input flex-1" required>
                  {services.map((s: any) => <option key={s.id} value={s.id}>{s.name} ({s.duration} min - R$ {s.price})</option>)}
                </select>
                {selectedServiceIds.length > 1 && !readOnly && (
                  <button type="button" onClick={() => setSelectedServiceIds(selectedServiceIds.filter((_, i) => i !== index))} className="btn-outline !px-3 !min-h-0"><X size={16}/></button>
                )}
              </div>
            ))}
            {!readOnly && <button type="button" onClick={() => setSelectedServiceIds([...selectedServiceIds, services[0]?.id])} className="text-sm font-medium text-primary hover:underline">+ Adicionar outro serviço</button>}
          </div>
    <label><span className="field-label">Data</span><input disabled={readOnly} className="field-input" type="date" value={dateStr} onChange={e=>setDateStr(e.target.value)} required /></label>
    <label><span className="field-label">Horário</span><input disabled={readOnly} className="field-input" type="time" step="900" value={timeStr} onChange={e=>setTimeStr(e.target.value)} required /></label>
  </div><div className="mt-5 flex justify-end gap-2"><button type="button" disabled={submitting} onClick={close} className="btn-outline">{readOnly ? "Fechar" : "Cancelar"}</button>{!readOnly && <button disabled={submitting} className="btn-primary">{submitting ? "Salvando..." : "Salvar alterações"}</button>}</div></form></div> }



function ServiceConsumablesModal({ service, inventory, close, save, createProduct }: { service: any; inventory: any[]; close: () => void; save: (consumables: any[]) => Promise<void>; createProduct: () => void }) {
  const [items, setItems] = useState<any[]>(service.consumables || []);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false); const [isSaving, setIsSaving] = useState(false);
  const availableProducts = inventory.filter(product => !items.some(item => item.product_id === product.id));

  const addItem = () => {
    const parsedQuantity = Number(quantity);
    if (!selectedProductId) {
      setError("Selecione um produto.");
      return;
    }
    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      setError("Informe uma quantidade maior que zero.");
      return;
    }
    setItems(current => [...current, { product_id: selectedProductId, estimated_quantity: parsedQuantity }]);
    setSelectedProductId("");
    setQuantity("");
    setError("");
    setAdding(false);
  };

  return <div className="fixed inset-0 z-[60] flex items-center justify-center p-4"><button onClick={close} className="absolute inset-0 bg-navy-dark/40" /><div className="relative w-full max-w-lg rounded-xl bg-white p-5 shadow-2xl sm:p-7"><div className="mb-6 flex items-start justify-between"><div><Badge tone="primary">Consumo Automático</Badge><h2 className="mt-2 text-xl font-bold">{service.name}</h2></div><button onClick={close} className="rounded-md p-1.5 text-muted hover:bg-bg hover:text-ink"><X size={20} /></button></div>
  <p className="mb-1 text-sm text-muted">Defina quanto de cada produto é usado em uma execução deste serviço.</p>
  <p className="mb-4 text-xs text-muted">Ao concluir um atendimento, o sistema baixa essas quantidades do estoque uma vez para cada serviço realizado.</p>

  <div className="space-y-3 mb-4">
    {items.map((it, idx) => {
      const prod = inventory.find(p => p.id === it.product_id);
      return <div key={it.product_id} className="flex justify-between items-center bg-bg p-3 rounded-md">
        <p className="font-medium text-sm">{prod?.product || 'Produto desconhecido'}</p>
        <div className="flex items-center gap-3">
          <span className="text-sm">{it.estimated_quantity} {prod?.unit || 'un'}</span>
          <button type="button" aria-label={`Remover ${prod?.product || "produto"}`} onClick={() => setItems(curr => curr.filter((_, i) => i !== idx))} className="text-red-500"><Trash2 size={15}/></button>
        </div>
      </div>
    })}
    {items.length === 0 && <p className="text-xs text-muted">Nenhum produto vinculado a este serviço.</p>}
  </div>

  {adding ? (
    <div className="mb-4 rounded-md border border-[#E7EDF3] bg-bg p-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <select aria-label="Produto" value={selectedProductId} onChange={event => { setSelectedProductId(event.target.value); setError(""); }} className="field-input flex-1 !h-9 !py-1 text-sm"><option value="">Selecione o produto</option>{availableProducts.map(p => <option key={p.id} value={p.id}>{p.product} ({p.unit})</option>)}</select>
        <input aria-label="Quantidade consumida" value={quantity} onChange={event => { setQuantity(event.target.value); setError(""); }} type="number" min="0.001" step="0.001" placeholder="Qtd." className="field-input w-full !h-9 !py-1 text-sm sm:w-24" />
        <button type="button" aria-label="Adicionar produto" onClick={addItem} className="btn-primary !h-9 !px-3"><Check size={16}/></button>
        <button type="button" aria-label="Cancelar adição" onClick={() => { setAdding(false); setError(""); }} className="btn-outline !h-9 !px-3"><X size={16}/></button>
      </div>
      {error && <p role="alert" className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  ) : (
    <button type="button" disabled={availableProducts.length === 0 || inventory.length === 0} onClick={() => setAdding(true)} className="btn-ghost mb-4 disabled:cursor-not-allowed disabled:opacity-50"><Plus size={15}/> Adicionar produto</button>
  )}

  {inventory.length === 0 && <div className="mb-4 rounded-md bg-amber-50 p-3 text-xs text-amber-900"><p>Cadastre ao menos um produto antes de configurar o consumo.</p><button type="button" onClick={createProduct} className="mt-2 font-semibold underline">Cadastrar primeiro produto</button></div>}
  {inventory.length > 0 && <button type="button" onClick={createProduct} className="mb-4 text-xs font-medium text-primary hover:underline">O produto não está na lista? Cadastrar novo produto</button>}

  <div className="mt-6 flex justify-end gap-3"><button onClick={close} className="btn-outline">Cancelar</button><button disabled={isSaving} onClick={async () => { setIsSaving(true); await save(items); setIsSaving(false); }} className="btn-primary disabled:opacity-50"><Check size={16} />{isSaving ? "Salvando..." : "Salvar configuração"}</button></div></div></div>;
}

function ProductModal({ product, close, save }: { product?: any; close: () => void; save: (data: any) => Promise<void> }) {
  const [name, setName] = useState(product?.product || "");
  const [unit, setUnit] = useState(product?.unit || "unit");
  const [min, setMin] = useState(product?.minimum ?? "");
  const [ideal, setIdeal] = useState(product?.ideal ?? "");
  const [cost, setCost] = useState(product?.cost ?? "");
  const [stock, setStock] = useState(product?.stock ?? ""); const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!name.trim()) {
      setError("Informe o nome do produto.");
      return;
    }
    const values = [min, ideal, cost, stock].map(value => Number(value));
    if (values.some(value => !Number.isFinite(value) || value < 0)) {
      setError("Use somente valores iguais ou maiores que zero.");
      return;
    }
    setError("");
    setIsSaving(true);
    await save({ name: name.trim(), unit, minimum: values[0], ideal: values[1], cost: values[2], stock: values[3] });
    setIsSaving(false);
  };

  return <div className="fixed inset-0 z-[60] flex items-center justify-center p-4"><button onClick={close} className="absolute inset-0 bg-navy-dark/40" /><div className="relative w-full max-w-lg rounded-xl bg-white p-5 shadow-2xl sm:p-7"><div className="mb-6 flex items-start justify-between"><div><Badge tone="primary">{product ? "Produto" : "Novo produto"}</Badge><h2 className="mt-2 text-xl font-bold">{product ? "Editar produto" : "Cadastrar produto"}</h2></div><button onClick={close} className="rounded-md p-1.5 text-muted hover:bg-bg hover:text-ink"><X size={20} /></button></div><div className="space-y-4">
    <div><label htmlFor="product-name" className="field-label">Nome do produto</label><input id="product-name" className="field-input" value={name} onChange={e => { setName(e.target.value); setError(""); }} placeholder="Ex: Esmalte Risqué Vermelho" /></div>
    <div className="grid grid-cols-2 gap-4">
      <div><label className="field-label">Unidade</label><select className="field-input" value={unit} onChange={e => setUnit(e.target.value)}>
        <option value="unit">Unidade</option><option value="ml">Mililitros (ml)</option><option value="g">Gramas (g)</option><option value="pair">Par</option>
      </select></div>
      <div><label className="field-label">Custo unitário (R$)</label><input className="field-input" type="number" min="0" step="0.01" value={cost} onChange={e => setCost(e.target.value)} /></div>
    </div>
    <div className="grid grid-cols-2 gap-4">
      <div><label className="field-label">Estoque mínimo</label><input className="field-input" type="number" min="0" step="0.001" value={min} onChange={e => setMin(e.target.value)} /></div>
      <div><label className="field-label">Estoque ideal</label><input className="field-input" type="number" min="0" step="0.001" value={ideal} onChange={e => setIdeal(e.target.value)} /></div>
    </div>
    <div><label className="field-label">Saldo inicial (quantidade atual)</label><input className="field-input" type="number" min="0" step="0.001" value={stock} onChange={e => setStock(e.target.value)} /></div>
    {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
  </div><div className="mt-6 flex justify-end gap-3"><button onClick={close} className="btn-outline">Cancelar</button><button disabled={isSaving} onClick={submit} className="btn-primary disabled:opacity-50"><Check size={16} />{isSaving ? "Salvando..." : "Salvar produto"}</button></div></div></div>;
}



function ClientDetailsModal({ client, close }: { client: any; close: () => void }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (client?.id) {
      getClientDetails(client.id).then(res => {
        if (!res) { setData(null);

      setLoading(false); return; }
        setData(res);
        setLoading(false);
      });
    } else {
      setLoading(false);
    }

  }, [client]);


  const handleDeletePhoto = async (photoId: string) => {
    if (!await appConfirm("Tem certeza que deseja apagar esta foto?")) return;
    if (photoId.startsWith("mock-")) {
      setData((curr: any) => ({ ...curr, photos: curr.photos.filter((p: any) => p.id !== photoId) }));
      return;
    }
    const res = await deleteClientPhoto(photoId);
    if (res.success) {
      setData((curr: any) => ({ ...curr, photos: curr.photos.filter((p: any) => p.id !== photoId) }));
    } else {
      appNotify("Erro ao excluir foto: " + ("error" in res ? res.error : "Erro desconhecido"));
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !client?.id) return;

    setUploading(true);

    try {
      if (client.id.startsWith("demo-")) {
        const reader = new FileReader();
        await new Promise(resolve => {
          reader.onloadend = () => {
            const base64 = reader.result as string;
            setData((curr: any) => ({
              ...curr,
              photos: [{ id: "mock-" + Date.now(), kind: "other", url: base64, storage_path: base64, created_at: new Date().toISOString() }, ...(curr?.photos || [])]
            }));
            resolve(true);
          };
          reader.readAsDataURL(file);
        });
        return;
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('clientId', client.id);
      formData.append('kind', 'other');

      const res = await uploadClientPhoto(formData);
      if (res.success) {
        const fresh = await getClientDetails(client.id);
        setData(fresh);
      } else {
        appNotify("Erro ao salvar foto: " + ("error" in res ? res.error : "Erro desconhecido"));
      }
    } catch (err) {
      console.error(err);
      appNotify("Ocorreu um erro inesperado ao enviar a foto.");
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <button onClick={close} className="absolute inset-0 bg-navy-dark/40" />
      <div className="relative w-full max-w-4xl rounded-xl bg-white p-5 shadow-2xl sm:p-7 max-h-[90vh] flex flex-col">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <Badge tone="primary">Ficha da Cliente</Badge>
            <h2 className="mt-2 text-2xl font-bold">{client.name}</h2>
            <p className="text-muted">{client.phone}</p>
          </div>
          <button onClick={close} className="rounded-md p-1.5 text-muted hover:bg-bg hover:text-ink"><X size={20} /></button>
        </div>

        {loading ? (
          <div className="py-12 flex justify-center"><div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full"></div></div>
        ) : !data ? (
          <div className="py-12 text-center text-muted">Cliente não encontrada no banco de dados.</div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-6 pr-2">

            <div className="grid gap-4 sm:grid-cols-3">
              <Metric label="Visitas totais" value={(data?.stats?.visits || 0).toString()} detail="Soma de atendimentos concluídos" icon={Calendar} />
              <Metric label="Total recebido" value={money.format(data?.stats?.spent || 0)} detail="Soma dos pagamentos registrados" icon={CircleDollarSign} />
              <Metric label="Cliente desde" value={data?.stats?.memberSince || "-"} detail="Data do cadastro" icon={Check} />
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Histórico */}
              <section className="card p-5">
                <SectionTitle title="Histórico de Agendamentos" />
                <div className="space-y-4 mt-4">
                  {data.history.length === 0 ? (
                    <p className="text-sm text-muted">Nenhum agendamento registrado.</p>
                  ) : (
                    (data.history || []).map((h: any) => (
                      <div key={h.id} className="flex justify-between items-center border-b border-[#E7EDF3] pb-3 last:border-0">
                        <div>
                          <p className="font-medium text-sm">{h.date} às {h.time}</p>
                          <p className="text-xs text-muted mt-0.5">{h.services} com {h.professional}</p>
                        </div>
                        <div className="text-right">
                          <Badge tone={h.status === 'Concluído' ? 'success' : h.status === 'Cancelado' ? 'danger' : 'warning'}>{h.status}</Badge>
                          <p className="text-xs font-semibold mt-1 text-navy-dark">Valor: {money.format(h.price)}</p>
                          <p className="text-[11px] text-muted mt-0.5">
                            {h.paid > 0 ? `Recebido: ${money.format(h.paid)}` : "Pagamento pendente"}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>

              <ClientPrivacyPanel clientId={client.id} clientName={client.name} />

              {/* Fotos e Galeria */}
              <section className="card p-5 flex flex-col">
                <div className="flex justify-between items-center mb-4">
                  <SectionTitle title="Galeria Antes & Depois" />
                  <input type="file" accept=".jpg,.jpeg,.png,.webp" className="hidden" ref={fileInputRef} onChange={handlePhotoUpload} />
                  <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="btn-primary text-xs py-1.5 px-3">
                    <Plus size={14} /> {uploading ? "Enviando..." : "Adicionar foto"}
                  </button>
                </div>

                {!data.photos || data.photos.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-[#E7EDF3] rounded-lg p-6 bg-bg/50">
                    <p className="text-sm text-muted text-center">Nenhuma foto registrada para esta cliente.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {(data.photos || []).map((p: any) => (

                      <div key={p.id} className="relative aspect-square rounded-md overflow-hidden border border-[#E7EDF3] group">
                        {p.url ? (
    <NextImage src={p.url} alt="Unhas" fill className="object-cover" unoptimized={p.url.startsWith("data:image/")} />
  ) : (
    <div className="flex items-center justify-center w-full h-full bg-[#F5F8FA] text-[#869AB8] text-xs">Sem foto</div>
  )}
                        <button onClick={() => handleDeletePhoto(p.id)} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 shadow-md">
                          <Trash2 size={12} />
                        </button>
                        <div className="absolute bottom-0 inset-x-0 bg-black/50 p-1 text-[10px] text-white text-center opacity-0 group-hover:opacity-100 transition-opacity">

                          {new Date(p.created_at).toLocaleDateString('pt-BR')}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}

function ProfessionalCommissionsModal({ professional, close, onPaid }: { professional: any; close: () => void; onPaid?: () => void }) {
  const [data, setData] = useState<{ commissions: any[], stats: { pending: number, paid: number } }>({ commissions: [], stats: { pending: 0, paid: 0 } });
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [monthFilter, setMonthFilter] = useState<string>("all");
  const [paidMessage, setPaidMessage] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<"all" | "generated" | "paid">("all");

  useEffect(() => {
    if (professional?.id) {
      getProfessionalCommissions(professional.id).then(res => {
        setData(res);
        // Por padrão, todas as pendentes vêm marcadas; a gestora desmarca o que não for pagar agora.
        setSelectedIds(res.commissions.filter((c: any) => c.status === "generated").map((c: any) => c.id));
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, [professional]);

  // Data da comissão vem como dd/mm/aaaa; a chave do mês é aaaa-mm.
  const monthKeyOf = (c: any) => {
    const [dd, mm, yyyy] = String(c.date || "").split("/");
    return dd && mm && yyyy ? `${yyyy}-${mm}` : "";
  };
  const monthLabelOf = (key: string) => {
    const [yyyy, mm] = key.split("-").map(Number);
    const label = new Date(Date.UTC(yyyy, mm - 1, 1)).toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
    return label.charAt(0).toUpperCase() + label.slice(1);
  };

  const pendingRows = data.commissions.filter(c => c.status === "generated");
  const months = Array.from(new Set(data.commissions.map(monthKeyOf).filter(Boolean))).sort().reverse();
  const monthSummary = (key: string) => {
    const pend = pendingRows.filter(c => monthKeyOf(c) === key);
    return { count: pend.length, total: pend.reduce((sum, c) => sum + Number(c.amount || 0), 0) };
  };

  // Lista exibida: filtra por mês e por status (todas, pendentes ou pagas). Não altera pagamentos.
  const visibleRows = data.commissions
    .filter(c => monthFilter === "all" || monthKeyOf(c) === monthFilter)
    .filter(c => statusFilter === "all" || c.status === statusFilter);
  const visiblePending = visibleRows.filter(c => c.status === "generated");
  const allVisibleSelected = visiblePending.length > 0 && visiblePending.every(c => selectedIds.includes(c.id));
  const selectedTotal = pendingRows.filter(c => selectedIds.includes(c.id)).reduce((sum, c) => sum + Number(c.amount || 0), 0);

  const toggle = (id: string) => setSelectedIds(current => current.includes(id) ? current.filter(x => x !== id) : [...current, id]);
  const toggleVisible = () => {
    const ids = visiblePending.map(c => c.id);
    setSelectedIds(current => allVisibleSelected
      ? current.filter(id => !ids.includes(id))
      : Array.from(new Set([...current, ...ids])));
  };
  // Escolhe um mês: mostra só as comissões dele e marca apenas as pendentes desse mês.
  const pickMonth = (key: string) => {
    setMonthFilter(key);
    setSelectedIds(pendingRows.filter(c => monthKeyOf(c) === key).map(c => c.id));
  };
  const showAll = () => setMonthFilter("all");

  const handlePay = async () => {
    if (!professional?.id || selectedIds.length === 0) return;
    setPaying(true);
    const res = await payCommissions(professional.id, selectedIds);
    if (!res.success) {
      setPaying(false);
      appNotify("Erro ao pagar comissões: " + ("error" in res ? res.error : "Erro desconhecido"));
      return;
    }
    // Mantém a tela aberta: recarrega as comissões e atualiza o painel da profissional.
    const fresh = await getProfessionalCommissions(professional.id);
    setData(fresh);
    setSelectedIds(fresh.commissions.filter((c: any) => c.status === "generated").map((c: any) => c.id));
    setPaidMessage(`Pagamento registrado: ${money.format(Number(res.total || 0))}.`);
    setPaying(false);
    onPaid?.();
  };

  const chipClass = (active: boolean) => `rounded-full border px-3 py-1.5 text-xs transition-colors ${active ? "border-primary bg-primary text-white" : "border-[#E8D9C7] bg-white text-ink hover:bg-bg"}`;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <button onClick={close} className="absolute inset-0 bg-navy-dark/40" />
      <div className="relative w-full max-w-2xl rounded-xl bg-white p-5 shadow-2xl sm:p-7 max-h-[90vh] flex flex-col">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <Badge tone="primary">Acerto de Comissões</Badge>
            <h2 className="mt-2 text-xl font-bold">{professional.name}</h2>
          </div>
          <button onClick={close} className="rounded-md p-1.5 text-muted hover:bg-bg hover:text-ink"><X size={20} /></button>
        </div>

        {loading ? (
          <div className="py-12 flex justify-center"><div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full"></div></div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="p-4 rounded-lg bg-amber-50 border border-amber-100">
                <p className="text-sm text-amber-800">Saldo Pendente</p>
                <p className="text-2xl font-bold text-amber-900">{money.format(data.stats.pending)}</p>
              </div>
              <div className="p-4 rounded-lg bg-green-50 border border-green-100">
                <p className="text-sm text-green-800">Total já pago</p>
                <p className="text-2xl font-bold text-green-900">{money.format(data.stats.paid)}</p>
              </div>
            </div>

            {months.length > 0 && (
              <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Fechamento por mês">
                <button type="button" onClick={showAll} aria-pressed={monthFilter === "all"} className={chipClass(monthFilter === "all")}>Todos os meses</button>
                {months.map(key => {
                  const sum = monthSummary(key);
                  return (
                    <button key={key} type="button" onClick={() => pickMonth(key)} aria-pressed={monthFilter === key}
                      className={chipClass(monthFilter === key)} disabled={sum.count === 0}>
                      {monthLabelOf(key)}{sum.count > 0 ? ` · ${money.format(sum.total)}` : " · pago"}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Filtro por status">
              <button type="button" onClick={() => setStatusFilter("all")} aria-pressed={statusFilter === "all"} className={chipClass(statusFilter === "all")}>Todas</button>
              <button type="button" onClick={() => setStatusFilter("generated")} aria-pressed={statusFilter === "generated"} className={chipClass(statusFilter === "generated")}>Pendentes</button>
              <button type="button" onClick={() => setStatusFilter("paid")} aria-pressed={statusFilter === "paid"} className={chipClass(statusFilter === "paid")}>Pagas</button>
            </div>

            <div className="overflow-y-auto flex-1 border rounded-lg border-[#E7EDF3]">
              <table className="data-table !min-w-0 table-fixed">
                <thead className="sticky top-0 bg-white">
                  <tr>
                    <th className="w-[8%]">
                      <input type="checkbox" aria-label="Selecionar todas as pendentes exibidas" checked={allVisibleSelected} disabled={visiblePending.length === 0} onChange={toggleVisible} className="h-4 w-4 accent-primary" />
                    </th>
                    <th className="w-[20%]">Data</th>
                    <th>Serviço</th>
                    <th className="w-[18%]">Status</th>
                    <th className="w-[20%] text-right">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-8 text-muted">Nenhuma comissão registrada.</td></tr>
                  ) : visibleRows.map((c: any) => (
                    <tr key={c.id}>
                      <td>
                        {c.status === "generated" && (
                          <input type="checkbox" aria-label={`Selecionar comissão de ${c.service}`} checked={selectedIds.includes(c.id)} onChange={() => toggle(c.id)} className="h-4 w-4 accent-primary" />
                        )}
                      </td>
                      <td>{c.date}</td>
                      <td>{c.service}</td>
                      <td><Badge tone={c.status === 'paid' ? 'success' : 'warning'}>{c.status === 'paid' ? 'Pago' : 'Pendente'}</Badge></td>
                      <td className="font-medium text-right">{money.format(c.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-muted">{selectedIds.length} de {pendingRows.length} pendente(s) selecionada(s)</p>
            {paidMessage && <p className="mt-1 text-xs font-medium text-green-800">{paidMessage}</p>}
          </>
        )}

        <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-[#E7EDF3]">
          <button onClick={close} className="btn-outline">Fechar</button>
          <button
            onClick={handlePay}
            disabled={paying || loading || selectedIds.length === 0}
            className="btn-primary disabled:opacity-50"
          >
            <Check size={16} />{paying ? "Processando..." : `Pagar selecionadas · ${money.format(selectedTotal)}`}
          </button>
        </div>
      </div>
    </div>
  );
}


function ClientModal({ mode, client, close, save }: { mode: "create" | "edit" | "view"; client?: any; close: () => void; save: (data: any) => Promise<void> }) {
  const [tab, setTab] = useState<"info"|"anamnese"|"pacotes">("info");
  const [anamnesisConsent, setAnamnesisConsent] = useState(false);
  useEffect(() => {
    if (client?.id && !String(client.id).startsWith("demo-")) {
      getClientPrivacyStatus(client.id).then(st => { if (st?.consentAnamnesis) setAnamnesisConsent(true); });
    }
  }, [client?.id]);
  const [name, setName] = useState(client?.name || "");
  const [phone, setPhone] = useState(formatBrazilPhone(client?.phone || ""));
  const [birthDate, setBirthDate] = useState(client?.birthDate || "");
  const [email, setEmail] = useState(client?.email || "");
  const [cep, setCep] = useState(client?.cep || "");
  const [street, setStreet] = useState(client?.street || "");
  const [number, setNumber] = useState(client?.number || "");
  const [complement, setComplement] = useState(client?.complement || "");
  const [neighborhood, setNeighborhood] = useState(client?.neighborhood || "");
  const [city, setCity] = useState(client?.city || "");
  const [state, setState] = useState(client?.state || "");
  const [loadingCep, setLoadingCep] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Anamnesis state
  const rawNotes = client?.notes || "";
  let initialNotes = rawNotes;
  let initialAnamnesis = { diabetes: false, gestante: false, alergias: "", roeUnha: false };
  let initialPackages = [];
  try {
    if (rawNotes.startsWith("{")) {
      const parsed = JSON.parse(rawNotes);
      if (parsed.anamnesis) {
        initialNotes = parsed.text || "";
        initialAnamnesis = { ...initialAnamnesis, ...parsed.anamnesis };
      }
    }
  } catch(e) {}

  // Prefer relational anamnesis if it exists
  if (client?.client_anamnesis && client.client_anamnesis.length > 0) {
    const an = client.client_anamnesis[0];
    initialAnamnesis = {
      diabetes: an.diabetes,
      gestante: an.pregnant,
      roeUnha: an.nail_biting,
      alergias: an.allergies || ""
    };
  }

  const [notes, setNotes] = useState(initialNotes);
  const [anamnesis, setAnamnesis] = useState(initialAnamnesis);
  const [packages, setPackages] = useState<any[]>([]);
  const [isAddingPackage, setIsAddingPackage] = useState(false);
  const [catalogTemplates, setCatalogTemplates] = useState<any[]>([]);
  const [catalogChoice, setCatalogChoice] = useState("");

  useEffect(() => {
    if (client?.id && !client.id.startsWith("demo-")) {
      import('@/lib/actions/packages').then(m => {
        m.getActivePackages(client.id).then(pkgs => {
          setPackages(pkgs);
        });
      });
      import('@/lib/actions/clients').then(m => {
        m.getClientAnamnesis(client.id).then(an => {
          if (an) {
            setAnamnesis({
              diabetes: Boolean(an.diabetes),
              gestante: Boolean(an.pregnant),
              roeUnha: Boolean(an.nail_biting),
              alergias: an.allergies || ""
            });
          }
        });
      });
    }
  }, [client?.id]);
  const [newPkg, setNewPkg] = useState({ name: "", total: 4, price: 120, method: "PIX" });
  const [editingPkgId, setEditingPkgId] = useState<string | null>(null);
  const [editPkg, setEditPkg] = useState({ name: "", total: 0, used: 0, price: 0 });

  const readOnly = mode === "view";
  const clientAge = formatAgeInYearsAndMonths(birthDate);

  const handlePhone = (v: string) => setPhone(formatBrazilPhone(v));

  const handleCep = async (v: string) => {
    setCep(formatCep(v));
    const cleanCep = digitsOnly(v);
    if (cleanCep.length === 8) {
      setLoadingCep(true);
      try {
        const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
        const data = await res.json();
        if (!data.erro) {
          setStreet(data.logradouro || "");
          setNeighborhood(data.bairro || "");
          setCity(data.localidade || "");
          setState(data.uf || "");
          document.getElementById("address-number")?.focus();
        }
      } catch (e) { console.error(e); }
      setLoadingCep(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
      <button onClick={close} className="fixed inset-0 bg-navy-dark/40" />
      <div className="relative w-full max-w-2xl rounded-t-xl sm:rounded-xl bg-white p-4 sm:p-7 my-0 sm:my-8 max-h-[92vh] flex flex-col shadow-2xl z-10">
        <div className="mb-4 flex-shrink-0 flex items-start justify-between">
          <div>
            <Badge tone="primary">{mode === "create" ? "Nova Cliente" : mode === "view" ? "Detalhes" : "Edição"}</Badge>
            <h2 className="mt-1 text-xl font-bold">{name || "Novo registro"}</h2>
          </div>
          <button onClick={close} className="rounded-md p-1.5 text-muted hover:bg-bg hover:text-ink"><X size={20} /></button>
        </div>

        <div className="flex gap-4 border-b border-[#E7EDF3] mb-4 overflow-x-auto flex-shrink-0">
          <button type="button" onClick={() => setTab("info")} className={`whitespace-nowrap pb-2 font-medium border-b-2 transition-colors ${tab === "info" ? "border-primary text-primary" : "border-transparent text-muted hover:text-ink"}`}>Dados Pessoais</button>
          <button type="button" onClick={() => setTab("anamnese")} className={`whitespace-nowrap pb-2 font-medium border-b-2 transition-colors ${tab === "anamnese" ? "border-primary text-primary" : "border-transparent text-muted hover:text-ink"}`}>Saúde (Anamnese)</button>
          <button type="button" onClick={() => setTab("pacotes")} className={`whitespace-nowrap pb-2 font-medium border-b-2 transition-colors ${tab === "pacotes" ? "border-primary text-primary" : "border-transparent text-muted hover:text-ink"}`}>Pacotes e Combos</button>
        </div>

        <form onSubmit={async (e) => {
          e.preventDefault();
          setSubmitting(true);
          const finalNotes = JSON.stringify({ text: notes, anamnesis });
          await save({ name, phone, birthDate, cep, street, number, complement, neighborhood, city, state, notes: finalNotes, email, anamnesisConsent });
          setSubmitting(false);
        }} className="flex-1 min-h-0 flex flex-col overflow-hidden">

          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            {tab === "info" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div><label className="field-label">Nome Completo</label><input className="field-input" value={name} onChange={e => setName(e.target.value)} required disabled={readOnly} /></div>
                <div><label className="field-label">WhatsApp</label><input className="field-input" value={phone} onChange={e => handlePhone(e.target.value)} placeholder="(11) 99999-9999" maxLength={15} required disabled={readOnly} /></div>
                <div>
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3">
                    <label className="field-label">Data de Nascimento</label>
                    <span className="field-label w-[7.75rem]">Idade</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <input type="date" className="field-input min-w-0 flex-1" value={birthDate} onChange={e => setBirthDate(e.target.value)} disabled={readOnly} />
                    <output className="w-[7.75rem] shrink-0 whitespace-nowrap text-xs font-medium text-muted" aria-live="polite">
                      {clientAge || "—"}
                    </output>
                  </div>
                </div>
                <div><label className="field-label">E-mail</label><input type="email" className="field-input" value={email} onChange={e => setEmail(e.target.value.replace(/\s/g, ""))} onBlur={() => setEmail(normalizeEmail(email))} placeholder="cliente@email.com" disabled={readOnly} /></div>
                <div className="sm:col-span-2 border-t border-[#E7EDF3] pt-4 mt-2">
                  <h3 className="text-sm font-semibold mb-3">Endereço</h3>
                  <div className="grid gap-4 sm:grid-cols-6">
                    <div className="sm:col-span-2"><label className="field-label">CEP {loadingCep && <span className="text-xs text-primary animate-pulse">(Buscando...)</span>}</label><input className="field-input" value={cep} onChange={e => handleCep(e.target.value)} disabled={readOnly} maxLength={9} placeholder="00000-000" /></div>
                    <div className="sm:col-span-4"><label className="field-label">Rua</label><input className="field-input" value={street} onChange={e => setStreet(e.target.value)} disabled={readOnly} /></div>
                    <div className="sm:col-span-2"><label className="field-label">Número</label><input id="address-number" className="field-input" value={number} onChange={e => setNumber(e.target.value)} disabled={readOnly} /></div>
                    <div className="sm:col-span-4"><label className="field-label">Complemento</label><input className="field-input" value={complement} onChange={e => setComplement(e.target.value)} disabled={readOnly} /></div>
                    <div className="sm:col-span-2"><label className="field-label">Bairro</label><input className="field-input" value={neighborhood} onChange={e => setNeighborhood(e.target.value)} disabled={readOnly} /></div>
                    <div className="sm:col-span-3"><label className="field-label">Cidade</label><input className="field-input" value={city} onChange={e => setCity(e.target.value)} disabled={readOnly} /></div>
                    <div className="sm:col-span-1"><label className="field-label">UF</label><input className="field-input" value={state} onChange={e => setState(e.target.value)} disabled={readOnly} maxLength={2} /></div>
                  </div>
                </div>
              </div>
            )}

            {tab === "anamnese" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2 rounded-md border border-[#E7EDF3] bg-bg p-3 text-sm space-y-2">
                  <label className="flex items-start gap-2"><input type="checkbox" checked={anamnesisConsent} onChange={e => setAnamnesisConsent(e.target.checked)} disabled={readOnly} className="mt-1 h-4 w-4 accent-primary" /><span>{CONSENT_TEXTS.anamnesis}</span></label>
                  {!anamnesisConsent && <p className="text-xs text-muted">Sem este consentimento, as informações de saúde não são salvas.</p>}
                </div>
                <div className="sm:col-span-2 bg-rose-50 border border-rose-100 p-3 rounded text-sm text-rose-800">
                  <strong>Atenção:</strong> Respostas de saúde gerarão alertas visuais automáticos na tela da Agenda.
                </div>

                <div className="flex items-center gap-3 p-3 border rounded-md">
                  <input type="checkbox" id="diabetes" checked={anamnesis.diabetes} onChange={e => setAnamnesis({...anamnesis, diabetes: e.target.checked})} disabled={readOnly} className="w-5 h-5 text-primary" />
                  <label htmlFor="diabetes" className="font-medium cursor-pointer">Paciente Diabética</label>
                </div>

                <div className="flex items-center gap-3 p-3 border rounded-md">
                  <input type="checkbox" id="gestante" checked={anamnesis.gestante} onChange={e => setAnamnesis({...anamnesis, gestante: e.target.checked})} disabled={readOnly} className="w-5 h-5 text-primary" />
                  <label htmlFor="gestante" className="font-medium cursor-pointer">Gestante</label>
                </div>

                <div className="flex items-center gap-3 p-3 border rounded-md">
                  <input type="checkbox" id="roeUnha" checked={anamnesis.roeUnha} onChange={e => setAnamnesis({...anamnesis, roeUnha: e.target.checked})} disabled={readOnly} className="w-5 h-5 text-primary" />
                  <label htmlFor="roeUnha" className="font-medium cursor-pointer">Roe unhas (Onicofagia)</label>
                </div>

                <div className="sm:col-span-2 pt-2">
                  <label className="field-label text-danger">Alergias conhecidas (Descreva)</label>
                  <input className="field-input border-rose-200 focus:border-rose-400" value={anamnesis.alergias} onChange={e => setAnamnesis({...anamnesis, alergias: e.target.value})} placeholder="Ex: Esmalte comum, látex, etc." disabled={readOnly} />
                </div>

                <div className="sm:col-span-2 border-t border-[#E7EDF3] pt-4 mt-2">
                  <label className="field-label">Observações Gerais (Texto livre)</label>
                  <textarea className="field-input h-24" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Preferências, formato de unha favorito..." disabled={readOnly} />
                </div>
              </div>
            )}

            {tab === "pacotes" && (
              <div className="space-y-4">
                {client?.id && !client.id.startsWith("demo-") ? (
                  <>
                    {!isAddingPackage && (
                      <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-lg flex justify-between items-center">
                        <div>
                          <h4 className="font-semibold text-emerald-900">Vender Novo Pacote</h4>
                          <p className="text-xs text-emerald-700">O valor entrará no financeiro como receita hoje.</p>
                        </div>
                        <button type="button" onClick={() => { setIsAddingPackage(true); setCatalogChoice(""); import("@/lib/actions/package-catalog").then(m => m.getPackageTemplates()).then(list => setCatalogTemplates((list ?? []).filter((t: any) => t.active))).catch(() => setCatalogTemplates([])); }} className="btn-primary bg-emerald-600 hover:bg-emerald-700 border-emerald-600 text-xs py-1.5">
                          + Adicionar Pacote
                        </button>
                      </div>
                    )}

                    {isAddingPackage && (
                      <div className="border border-emerald-200 bg-white p-4 rounded-lg shadow-sm">
                        <h4 className="font-medium text-emerald-900 mb-3 text-sm">Dados do Novo Pacote</h4>
                        <div className="mb-3">
                          <label className="field-label">Pacote do catálogo</label>
                          {catalogTemplates.length === 0 ? (
                            <p className="text-sm text-muted">Nenhum pacote ativo no catálogo. Cadastre em Catálogo de Pacotes.</p>
                          ) : (
                            <select className="field-input" value={catalogChoice} onChange={e => setCatalogChoice(e.target.value)}>
                              <option value="">Selecione um pacote</option>
                              {catalogTemplates.map((t: any) => <option key={t.id} value={t.id}>{t.name} · R$ {Number(t.price).toFixed(2).replace(".", ",")}</option>)}
                            </select>
                          )}
                        </div>
                        {catalogChoice && (() => {
                          const t = catalogTemplates.find((x: any) => x.id === catalogChoice);
                          if (!t) return null;
                          const sessions = (t.package_template_items ?? []).reduce((sum: number, i: any) => sum + Number(i.sessions || 0), 0);
                          return (
                            <div className="grid grid-cols-3 gap-3 mb-3 text-sm">
                              <div><span className="field-label block">Sessões</span><span>{sessions}</span></div>
                              <div><span className="field-label block">Valor</span><span>R$ {Number(t.price).toFixed(2).replace(".", ",")}</span></div>
                              <div>
                                <label className="field-label">Pagamento</label>
                                <select className="field-input" value={newPkg.method} onChange={e => setNewPkg({...newPkg, method: e.target.value})}>
                                  <option value="PIX">PIX</option><option value="Crédito">Crédito</option><option value="Débito">Débito</option><option value="Dinheiro">Dinheiro</option>
                                </select>
                              </div>
                            </div>
                          );
                        })()}
                        <div className="flex justify-end gap-2 mt-4 pt-3 border-t">
                          <button type="button" onClick={() => setIsAddingPackage(false)} className="px-3 py-1.5 text-sm text-muted hover:text-ink">Cancelar</button>
                          <button type="button" onClick={async (e) => {
                            if (!catalogChoice) return appNotify("Selecione um pacote do catálogo");
                            const btn = e.target as HTMLButtonElement; btn.disabled = true; btn.innerText = "Processando...";
                            try {
                              await save({ name, phone, birthDate, cep, street, number, complement, neighborhood, city, state, notes: JSON.stringify({ text: notes, anamnesis }), email, anamnesisConsent });
                              const { sellPackageFromTemplate, getActivePackages } = await import("@/lib/actions/packages");
                              const res = await sellPackageFromTemplate(client.id, catalogChoice, newPkg.method);
                              if (res.success) {
                                const pkgs = await getActivePackages(client.id);
                                setPackages(pkgs);
                                setIsAddingPackage(false);
                                setCatalogChoice("");
                                setNewPkg({ name: "", total: 4, price: 120, method: "PIX" });
                              } else {
                                appNotify("Erro ao vender pacote: " + res.error);
                              }
                            } catch(err: any) { appNotify("Erro: " + err.message); }
                            btn.disabled = false; btn.innerText = "Confirmar Venda";
                          }} className="btn-primary bg-emerald-600 border-emerald-600 hover:bg-emerald-700 text-sm py-1.5">Confirmar Venda</button>
                        </div>
                      </div>
                    )}

                    <div className="mt-4">
                      <h3 className="font-semibold text-sm mb-3">Pacotes Ativos</h3>
                      {packages.length === 0 ? (
                        <p className="text-sm text-muted bg-bg p-4 rounded-md text-center">Nenhum pacote ativo no momento.</p>
                      ) : (
                        <div className="grid gap-3">
                          {packages.map((p: any) => (
                            <div key={p.id} className="border border-[#E7EDF3] p-4 rounded-lg bg-white relative">
                              <div className="absolute top-4 right-4 bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-1 rounded-full">
                                {p.remaining_sessions} / {p.total_sessions} restantes
                              </div>

                              {editingPkgId === p.id ? (
                                <div className="space-y-3 pt-2">
                                  <input className="field-input text-sm font-semibold" value={editPkg.name} onChange={e => setEditPkg({...editPkg, name: e.target.value})} />
                                  <div className="grid grid-cols-2 gap-2">
                                    <label><span className="text-xs text-muted block mb-1">Total de Sessões</span><input type="number" className="field-input" value={editPkg.total} onChange={e => setEditPkg({...editPkg, total: Number(e.target.value)})} /></label>
                                    <label><span className="text-xs text-muted block mb-1">Sessões Restantes</span><input type="number" className="field-input" value={editPkg.used} onChange={e => setEditPkg({...editPkg, used: Number(e.target.value)})} /></label>
                                  </div>
                                  <div className="flex gap-3 justify-end pt-2">
                                    <button type="button" onClick={() => setEditingPkgId(null)} className="text-xs text-muted hover:text-ink">Cancelar</button>
                                    <button type="button" onClick={async () => {
                                      if (editPkg.used < 0 || editPkg.used > editPkg.total) {
                                        appNotify("O número de sessões restantes não pode ser negativo nem maior que o total.");
                                        return;
                                      }
                                      const { updatePackage, getActivePackages } = await import("@/lib/actions/packages");
                                      await updatePackage(p.id, editPkg.name, editPkg.total, editPkg.used);
                                      const pkgs = await getActivePackages(client.id);
                                      setPackages(pkgs);
                                      setEditingPkgId(null);
                                    }} className="text-xs text-primary font-medium hover:underline">Salvar Edição</button>
                                  </div>
                                </div>
                              ) : (
                                <div>
                                  <h4 className="font-medium">{p.name}</h4>
                                  <p className="text-xs text-muted mt-1">Vendido por {money.format(p.price)}</p>
                                  <div className="mt-2 flex gap-2">
                                    <button type="button" onClick={() => { setEditPkg({ name: p.name, total: p.total_sessions, used: p.remaining_sessions, price: p.price }); setEditingPkgId(p.id); }} className="text-xs text-primary hover:underline">Editar</button>
                                    <button type="button" onClick={async () => {
                                      if(await appConfirm("Tem certeza que deseja apagar este pacote? O financeiro não será estornado automaticamente.")) {
                                        const { deletePackage, getActivePackages } = await import("@/lib/actions/packages");
                                        await deletePackage(p.id);
                                        const pkgs = await getActivePackages(client.id);
                                        setPackages(pkgs);
                                      }
                                    }} className="text-xs text-danger hover:underline">Excluir</button>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="bg-amber-50 text-amber-800 p-4 rounded-md text-sm border border-amber-200">
                    Você precisa salvar este cliente pela primeira vez antes de vender pacotes.
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="mt-4 flex-shrink-0 flex justify-end gap-3 border-t border-[#E7EDF3] pt-3">
            <button type="button" onClick={close} className="btn-outline">Cancelar</button>
            {!readOnly && <button disabled={submitting} type="submit" className="btn-primary">{submitting ? "Salvando..." : <><Check size={16} />Salvar</>}</button>}
          </div>
        </form>
      </div>
    </div>
  );
}
function EntityModal({ state, close, save }: { state: EntityModalState; close: () => void; save: (name: string, detail: string) => void }) {
  const [name, setName] = useState(state.name); const [detail, setDetail] = useState(state.detail); const readOnly = state.mode === "view";
  const detailLabel = state.kind === "client" ? "WhatsApp" : state.kind === "service" || state.kind === "financial" ? "Valor" : state.kind === "professional" ? "Especialidade" : state.kind === "product" ? "Estoque atual" : state.kind === "automation" ? "Canal" : "Horário";



  return <div className="fixed inset-0 z-[60] flex items-center justify-center p-4"><button onClick={close} className="absolute inset-0 bg-navy-dark/40" /><div className="relative w-full max-w-lg rounded-xl bg-white p-5 shadow-2xl sm:p-7"><div className="mb-6 flex items-start justify-between"><div><Badge tone="primary">{state.mode === "create" ? "Novo cadastro" : state.mode === "view" ? "Detalhes" : "Edição"}</Badge><h2 className="mt-2 text-xl font-bold">{state.name || "Novo registro"}</h2></div><button onClick={close} className="rounded-md p-1.5 text-muted hover:bg-bg hover:text-ink"><X size={20} /></button></div><div className="space-y-4"><div><label className="field-label">Nome</label><input className="field-input" value={name} onChange={e => setName(e.target.value)} disabled={readOnly} /></div><div><label className="field-label">{detailLabel}</label><input className="field-input" value={detail} onChange={e => setDetail(e.target.value)} disabled={readOnly} /></div><div><label className="field-label">Observações</label><textarea className="field-input h-24" placeholder="Informações adicionais do cadastro" disabled={readOnly} /></div></div><div className="mt-6 flex justify-end gap-3"><button onClick={close} className="btn-outline">Cancelar</button>{!readOnly && <button onClick={() => save(name, detail)} className="btn-primary"><Check size={16} />Salvar alterações</button>}</div></div></div>;
}

function ProfessionalModal({ mode, professional, specialtiesList = [], close, save }: { mode: "create" | "view" | "edit"; professional?: ProfessionalItem; specialtiesList?: {id: string, name: string}[]; close: () => void; save: (data: any) => void }) {
  const [formData, setFormData] = useState({
    name: professional?.name || "",
    email: professional?.email || "",
    phone: professional?.phone || "",
    specialties: professional?.specialty ? professional.specialty.split(",").map(s=>s.trim()).filter(Boolean) : [],
    default_commission: professional?.default_commission || 0,
    notes: professional?.notes || ""
  });
  const readOnly = mode === "view";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button onClick={close} className="absolute inset-0 bg-navy-dark/40" />
      <div className="relative w-full max-w-lg rounded-xl bg-white p-5 shadow-2xl sm:p-7">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <Badge tone="primary">{mode === "create" ? "Nova Profissional" : mode === "view" ? "Detalhes" : "Edição"}</Badge>
            <h2 className="mt-2 text-xl font-bold">{formData.name || "Profissional"}</h2>
          </div>
          <button onClick={close} className="rounded-md p-1.5 text-muted hover:bg-bg hover:text-ink"><X size={20} /></button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="field-label">Nome completo</label>
            <input className="field-input" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} disabled={readOnly} />
          </div>
          <div>
            <label className="field-label">Telefone / WhatsApp</label>
            <input className="field-input" value={formData.phone} onChange={e => setFormData({ ...formData, phone: formatBrazilPhone(e.target.value) })} disabled={readOnly} />
          </div>
          <div>
            <label className="field-label">E-mail</label>
            <input className="field-input" type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} disabled={readOnly} />
          </div>
          <div className="sm:col-span-2">
            <label className="field-label mb-2">Especialidades</label>
            <div className="flex flex-wrap gap-2">
              {specialtiesList.map(s => {
                const active = formData.specialties.includes(s.name);
                return (
                  <button
                    key={s.id}
                    type="button"
                    disabled={readOnly}
                    onClick={() => {
                      if (active) setFormData({ ...formData, specialties: formData.specialties.filter(x => x !== s.name) });
                      else setFormData({ ...formData, specialties: [...formData.specialties, s.name] });
                    }}
                    className={`rounded-full border px-3 py-1.5 text-xs transition ${active ? "border-primary bg-primary text-white" : "border-[#DBE3EC] bg-white text-ink hover:border-primary/50"}`}
                  >
                    {s.name}
                  </button>
                );
              })}
              {specialtiesList.length === 0 && <span className="text-xs text-muted">Nenhuma especialidade cadastrada.</span>}
              {!readOnly && (
                <button
                  type="button"
                  onClick={async () => {
                    const name = await appPrompt("Nome da nova especialidade:");
                    if (name && name.trim()) {
                      const res = await createSpecialtyRecord(name.trim());
                      if (res.success && res.data) {
                         // We reload the page to get the updated specialties
                         window.location.reload();
                      }
                    }
                  }}
                  className="rounded-full border border-dashed border-[#DBE3EC] px-3 py-1.5 text-xs text-muted hover:border-primary hover:text-primary transition"
                >
                  + Nova
                </button>
              )}
            </div>
          </div>
          <div className="sm:col-span-2">
            <label className="field-label">Comissão Padrão (%)</label>
            <input className="field-input" type="number" min="0" max="100" value={formData.default_commission} onChange={e => setFormData({ ...formData, default_commission: Number(e.target.value) })} disabled={readOnly} />
          </div>
          <div className="sm:col-span-2">
            <label className="field-label">Observações</label>
            <textarea className="field-input min-h-[80px]" value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} disabled={readOnly} />
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button onClick={close} className="btn-outline">Cancelar</button>
          {!readOnly && <button onClick={() => save(formData)} className="btn-primary"><Check size={16} />Salvar alterações</button>}
        </div>
      </div>
    </div>
  );
}




const HEADER_ROLE_LABELS: Record<string, string> = { owner: "Proprietária", admin: "Gestor", staff: "Equipe de atendimento", professional: "Profissional" };

function Header({ view, onMenu, tenant, professionalMode = false, role = "owner" }: { view: View; onMenu: () => void; tenant: any; professionalMode?: boolean; role?: string }) {
  const [headerTitle, headerSubtitle] = professionalMode && view === "reports" ? ["Financeiro", "Seus atendimentos, produção e comissões."] : titles[view];
  const configured = isSupabaseConfigured();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  return <header className="sticky top-0 z-30 flex min-h-[65px] items-center justify-between border-b border-[#DBE3EC] bg-white/95 px-4 backdrop-blur sm:px-7"><div className="flex min-w-0 items-center gap-3"><button onClick={onMenu} className="rounded-md p-2 text-muted hover:bg-bg lg:hidden" aria-label="Abrir menu"><Menu size={20} /></button><div className="min-w-0"><h1 className="truncate text-base font-semibold text-ink sm:text-lg">{view === "dashboard" ? `Bom dia, ${tenant.profileName.split(" ")[0]}` : headerTitle}</h1><p className="hidden text-xs text-muted sm:block">{headerSubtitle}</p></div></div><div className="flex items-center gap-2.5"><div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border border-[#DBE3EC] bg-[#F7F9FC]"><Database size={13} className={configured ? "text-emerald-600" : "text-amber-600"} /><span className="text-[11px] text-muted">{configured ? "Supabase Conectado" : "Modo Demonstração"}</span></div><div className="relative hidden border-l border-[#DBE3EC] pl-3 sm:block"><button type="button" onClick={() => setProfileMenuOpen(open => !open)} className="flex items-center gap-2 rounded-md px-1 py-1 text-left hover:bg-bg" aria-expanded={profileMenuOpen} aria-haspopup="menu"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white">{tenant.profileName.substring(0,2).toUpperCase()}</div><div><p className="text-xs font-medium line-clamp-1">{tenant.profileName}</p><p className="text-[10px] text-muted">{HEADER_ROLE_LABELS[role] ?? "Profissional"}</p></div><ChevronDown size={14} className="text-muted" /></button>{profileMenuOpen && <div role="menu" className="absolute right-0 top-full z-50 mt-2 w-44 rounded-md border border-[#DBE3EC] bg-white p-1 shadow-lg"><button type="button" role="menuitem" onClick={() => logout()} className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50"><Trash2 size={15} />Sair do sistema</button></div>}</div></div></header>;
}

// Ordem dos status na tela de atendimentos da profissional: chegou, em atendimento, concluído.
function professionalStatusOrder(status: string) {
  return status === "Cliente chegou" ? 0 : status === "Em atendimento" ? 1 : 2;
}

function Sidebar({ view, setView, open, close, tenant, professionalMode = false, role = "owner", permissionRows }: { view: View; setView: (v: View) => void; open: boolean; close: () => void; tenant: any; professionalMode?: boolean; role?: StudioRole; permissionRows?: PermissionRow[] }) {
  // Para a profissional, "Financeiro" já mostra as próprias comissões: o item "Comissões" não aparece duplicado.
  const visibleNav = nav
    .filter(item => canOpenView(role, item.id, permissionRows) && !(role === "professional" && (item.id === "commissions" || item.id === "finance")))
    .map(item => role === "professional" && item.id === "reports" ? { ...item, label: "Financeiro", icon: Wallet } : item);
  return <>{open && <button onClick={close} aria-label="Fechar menu" className="fixed inset-0 z-40 bg-navy-dark/40 lg:hidden" />}<aside className={`fixed inset-y-0 left-0 z-50 flex w-[min(250px,calc(100vw-36px))] flex-col bg-navy text-white transition-transform lg:w-60 lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}><div className="flex h-[65px] items-center justify-between border-b border-white/10 px-5"><button onClick={() => setView("dashboard")} className="flex items-center gap-3 text-left"><BellarisMark size={34} className="shrink-0" /><div className="min-w-0"><span className="block text-base font-semibold text-white line-clamp-1"><BellarisWordmark /></span><span className="block text-[11px] text-white/60 line-clamp-1">{tenant.orgName}</span></div></button><button onClick={close} className="text-white/70 lg:hidden"><X size={19} /></button></div><nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4"><p className="px-3 pb-2 text-[10px] font-medium uppercase tracking-[.12em] text-white/45">Operação</p>{visibleNav.slice(0, 6).map(({ id, label, icon: Icon }) => <button key={id} onClick={() => { setView(id); close(); }} className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-[13.5px] transition ${view === id ? "bg-primary text-white" : "text-white/75 hover:bg-white/10 hover:text-white"}`}><Icon size={17} strokeWidth={1.5} />{label}</button>)}<p className="px-3 pb-2 pt-5 text-[10px] font-medium uppercase tracking-[.12em] text-white/45">Gestão</p>{visibleNav.slice(6).map(({ id, label, icon: Icon }) => <button key={id} onClick={() => { setView(id); close(); }} className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-[13.5px] transition ${view === id ? "bg-primary text-white" : "text-white/75 hover:bg-white/10 hover:text-white"}`}><Icon size={17} strokeWidth={1.5} />{label}</button>)}</nav><div className="border-t border-white/10 p-3">{<button onClick={() => setView("settings")} className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-xs text-white/65 hover:bg-white/10"><Settings size={16} />Configurações</button>}<button onClick={() => logout()} className="mt-1 flex w-full items-center gap-3 rounded-md px-3 py-2 text-xs text-white/65 hover:bg-white/10 hover:text-rose-400 transition-colors"><Trash2 size={16} />Sair do sistema</button></div></aside></>;
}

function Dashboard({ go, stats, onAttendance, appointments = [], clients = [], tenant }: { go: (v: View) => void, stats?: any, onAttendance?: (a: Appointment) => void, appointments?: Appointment[], clients?: any[], tenant: any }) {
  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const todayAppointments = appointments.filter(a => (a as any).dateStr === todayStr);
  const activeTodayAppointments = todayAppointments.filter(a => a.status !== "Concluído" && a.status !== "Cancelado");
  const todayRevenue = todayAppointments.filter(a => a.status === "Concluído").reduce((acc, a) => acc + (a.price || 0), 0);
  const todayReceived = todayAppointments.reduce((acc, a) => acc + (a.paid || 0), 0);

  // Calculate dynamic metrics
  const completedThisMonth = appointments.filter(a => a.status === "Concluído" && a.price && a.price > 0);
  const averageTicket = completedThisMonth.length > 0 ? (completedThisMonth.reduce((acc, a) => acc + (a.price || 0), 0) / completedThisMonth.length) : 0;

  // New clients (visits === 1) or no visits yet but registered
  const newClientsCount = clients.filter(c => c.visits <= 1).length;

  // Retention (visits > 1)
  const returningClients = clients.filter(c => c.visits > 1).length;
  const totalActiveClients = clients.filter(c => c.status !== "Inativa").length;
  const retentionRate = totalActiveClients > 0 ? Math.round((returningClients / totalActiveClients) * 100) : 0;

  // Occupation should not count cancelled appointments as they free up the slot
  const occupiedToday = todayAppointments.filter(a => a.status !== "Cancelado").length;
  const occupation = Math.min(100, Math.round((occupiedToday / 15) * 100));

  return <main className="page-content space-y-7"><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric onClick={() => go("agenda")} label="Agendamentos hoje" value={activeTodayAppointments.length.toString()} detail="Agendamentos pendentes" icon={CalendarDays} /><Metric onClick={() => go("finance")} label="Faturamento do dia" value={money.format(todayRevenue)} detail="Faturamento bruto" icon={TrendingUp} /><Metric onClick={() => go("finance")} label="Recebido hoje" value={money.format(todayReceived)} detail="Recebimentos no caixa" icon={Wallet} /><Metric onClick={() => go("agenda")} label="Ocupação" value={`${occupation}%`} detail="Lotação do dia" icon={Clock3} /></div><div className="grid gap-5 xl:grid-cols-[1.45fr_.8fr]"><section className="card"><SectionTitle title="Agenda de hoje" subtitle="Agendamentos de hoje (ativos e próximos)" action={<button onClick={() => go("agenda")} className="btn-outline">Ver agenda <ArrowRight size={15} /></button>} /><div className="space-y-2">{activeTodayAppointments.length === 0 ? <p className="text-sm text-muted py-4 text-center">Nenhum agendamento ativo.</p> : activeTodayAppointments.slice(0, 4).map((a, i) => <button onClick={() => { if(a.status === "Em atendimento" || a.status === "Cliente chegou") { if (onAttendance) onAttendance(a); } else go("agenda"); }} key={a.id} className="flex w-full items-center gap-3 rounded-md border border-[#E7EDF3] p-3 text-left transition hover:border-primary/40 hover:bg-bg"><div className="w-12 shrink-0 text-center"><p className="text-sm font-semibold">{a.time}</p><p className="text-[10px] text-muted">{a.end}</p></div><div className={`h-10 w-1 rounded-full ${statusTone(a.status) === "primary" || statusTone(a.status) === "success" ? "bg-primary" : statusTone(a.status) === "warning" ? "bg-warning" : statusTone(a.status) === "danger" ? "bg-danger" : "bg-navy/25"}`} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{a.client}</p><p className="truncate text-xs text-muted">{a.service} · {a.professional}</p></div><Badge tone={statusTone(a.status)}>{a.status}</Badge></button>)}</div></section><section className="card"><SectionTitle title="Próxima cliente" subtitle="Acompanhamento rápido" /><div className="rounded-md bg-primary-light p-4"><p className="text-sm text-center text-primary-dark">Nenhum atendimento próximo.</p></div><div className="mt-4 grid grid-cols-2 gap-3"><SmallMetricLink go={go} label="Faturamento mensal" value={stats ? money.format(stats.revenue) : "R$ 0,00"} target="finance" /><SmallMetricLink go={go} label="Ticket médio" value={averageTicket > 0 ? money.format(averageTicket) : "R$ 0,00"} target="finance" /><SmallMetricLink go={go} label="Clientes novas" value={newClientsCount.toString()} target="clients" /><SmallMetricLink go={go} label="Taxa de retorno" value={`${retentionRate}%`} target="clients" /></div></section></div></main>;
}







function BookingModal({ initialDate, clients, professionals, services, close, save, onClientCreated }: { initialDate: string; clients: any[]; professionals: any[]; services: any[]; close: () => void; save: (a: Appointment, rawData?: any) => void; onClientCreated: (client: any) => void }) {
  const [clientId, setClientId] = useState(clients[0]?.id || "");
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");
  const [newClientEmail, setNewClientEmail] = useState("");
  const [clientSaving, setClientSaving] = useState(false);
  const [clientError, setClientError] = useState("");
  const [profId, setProfId] = useState(professionals[0]?.id || "");
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([services[0]?.id || ""]);
  const [dateStr, setDateStr] = useState(initialDate);
  const [timeStr, setTimeStr] = useState("09:00");
  const [submitting, setSubmitting] = useState(false);
  const [dateError, setDateError] = useState("");

  const selectedClient = clients.find(c => c.id === clientId);
  const selectedProf = professionals.find(p => p.id === profId);
  const selectedSvcs = selectedServiceIds.map((id: string) => services.find((s: any) => s.id === id)).filter(Boolean);
  const totalDuration = selectedSvcs.reduce((acc: number, s: any) => acc + s.duration, 0);
  const totalPrice = selectedSvcs.reduce((acc: number, s: any) => acc + s.price, 0);
  const serviceNames = selectedSvcs.map((s: any) => s.name).join(" + ");

  const newClientForm = showNewClient ? <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/55 p-4"><form className="w-full max-w-md space-y-4 rounded-xl bg-white p-5 shadow-2xl" onSubmit={async e => {e.preventDefault();if(clientSaving)return;if(digitsOnly(newClientPhone).length < 10){setClientError("Informe um WhatsApp válido com DDD (10 ou 11 dígitos).");return;}setClientSaving(true);setClientError("");try{const res=await createClientRecord({name:newClientName.trim(),phone:formatBrazilPhone(newClientPhone)});if(!res.success){setClientError("error" in res ? String(res.error) : "Não foi possível cadastrar a cliente.");return;}const fresh=await getClients();const created=(res.data?.id && fresh.find((c:any)=>c.id===res.data.id)) || fresh.find((c:any)=>c.name===newClientName.trim() && c.phone.replace(/\\D/g,"")===newClientPhone.replace(/\\D/g,""));if(!created){setClientError("Cliente cadastrada, mas não foi possível selecioná-la. Feche e abra o agendamento novamente.");return;}onClientCreated(created);setClientId(created.id);setShowNewClient(false);setNewClientName("");setNewClientPhone("");setNewClientEmail("");}catch{setClientError("Erro de conexão ao cadastrar cliente.");}finally{setClientSaving(false);}}}><h3 className="text-lg font-semibold">Cadastrar nova cliente</h3><p className="text-sm text-muted">Após salvar, você continuará neste agendamento.</p><label className="block"><span className="field-label">Nome completo</span><input className="field-input" value={newClientName} onChange={e=>setNewClientName(e.target.value)} required autoFocus /></label><label className="block"><span className="field-label">WhatsApp</span><input className="field-input" value={newClientPhone} onChange={e=>setNewClientPhone(formatBrazilPhone(e.target.value))} placeholder="(11) 99999-9999" inputMode="tel" maxLength={15} minLength={14} required /></label><label className="block"><span className="field-label">E-mail (opcional)</span><input type="email" className="field-input" value={newClientEmail} onChange={e=>setNewClientEmail(e.target.value.replace(/\s/g, ""))} onBlur={()=>setNewClientEmail(normalizeEmail(newClientEmail))} /></label>{clientError&&<p role="alert" className="text-sm text-red-700">{clientError}</p>}<div className="flex justify-end gap-2"><button type="button" className="btn-outline" disabled={clientSaving} onClick={()=>setShowNewClient(false)}>Voltar</button><button type="submit" className="btn-primary" disabled={clientSaving}>{clientSaving?"Salvando...":"Salvar e selecionar"}</button></div></form></div> : null;

  return <>{newClientForm}<div className="fixed inset-0 z-[70] flex items-end justify-center bg-navy-dark/45 p-0 sm:items-center sm:p-4"><form onSubmit={async e => {
    e.preventDefault();
    if (!selectedClient || !selectedProf || selectedSvcs.length === 0) return;
    const selectedStart = new Date(`${dateStr}T${timeStr}:00-03:00`);
    if (!Number.isFinite(selectedStart.getTime()) || selectedStart.getTime() <= Date.now()) {
      setDateError("Não é permitido agendar em datas ou horários passados. Selecione um horário futuro.");
      return;
    }
    setDateError("");
    setSubmitting(true);
    await save({
      id: `temp-${Date.now()}`,
      time: timeStr,
      end: "—",
      client: selectedClient.name,
      phone: selectedClient.phone,
      professional: selectedProf.name,
      service: serviceNames,
      status: "Aguardando sinal",
      price: totalPrice,
      source: "Interno",
      items: selectedSvcs.map((s: any) => ({ id: "temp-" + Date.now() + Math.random(), name: s.name, price: s.price }))
    }, {
      clientId,
      professionalId: profId,
      services: selectedSvcs.map((s: any) => ({ id: s.id, price: s.price, durationMinutes: s.duration })),
      dateStr,
      timeStr,
      durationMinutes: totalDuration,
      price: totalPrice
    });
    setSubmitting(false);
  }} className="w-full max-w-xl rounded-t-lg bg-white p-5 shadow-xl sm:rounded-lg"><div className="flex items-center justify-between"><div><h2 className="text-lg font-semibold">Novo agendamento</h2><p className="text-xs text-muted">Selecione os dados reais do banco.</p></div><button type="button" onClick={close} className="rounded-md p-2 text-muted hover:bg-bg"><X size={18} /></button></div><div className="mt-5 grid gap-4 sm:grid-cols-2">
    <div><div className="flex items-center justify-between gap-2"><label htmlFor="booking-client" className="field-label">Cliente</label><button type="button" className="text-xs font-semibold text-primary hover:underline" onClick={() => {setClientError("");setShowNewClient(true);}}>+ Nova cliente</button></div><select id="booking-client" value={clientId} onChange={e => setClientId(e.target.value)} className="field-input" required><option value="" disabled>Selecione uma cliente</option>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
    <label><span className="field-label">Profissional</span><select value={profId} onChange={e => setProfId(e.target.value)} className="field-input" required>{professionals.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
    <div className="sm:col-span-2 space-y-2"><span className="field-label">Serviços</span>
            {selectedServiceIds.map((srvId: string, index: number) => (
              <div key={index} className="flex gap-2">
                <select value={srvId} onChange={e => {
                  const newIds = [...selectedServiceIds];
                  newIds[index] = e.target.value;
                  setSelectedServiceIds(newIds);
                }} className="field-input flex-1" required>
                  {services.map((s: any) => <option key={s.id} value={s.id}>{s.name} ({s.duration} min - R$ {s.price})</option>)}
                </select>
                {selectedServiceIds.length > 1 && (
                  <button type="button" onClick={() => setSelectedServiceIds(selectedServiceIds.filter((_, i) => i !== index))} className="btn-outline !px-3 !min-h-0"><X size={16}/></button>
                )}
              </div>
            ))}
            <button type="button" onClick={() => setSelectedServiceIds([...selectedServiceIds, services[0]?.id])} className="text-sm font-medium text-primary hover:underline">+ Adicionar outro serviço</button>
          </div>
    <label><span className="field-label">Data</span><input className="field-input" type="date" value={dateStr} onChange={e=>{setDateStr(e.target.value);setDateError("");}} required /></label>
    <label><span className="field-label">Horário</span><input className="field-input" type="time" step="900" value={timeStr} onChange={e=>{setTimeStr(e.target.value);setDateError("");}} required /></label>
  </div>{dateError && <p role="alert" className="mt-3 text-sm text-red-700">{dateError}</p>}<div className="mt-5 flex justify-end gap-2"><button type="button" disabled={submitting} onClick={close} className="btn-outline">Cancelar</button><button disabled={submitting} className="btn-primary">{submitting ? "Salvando..." : "Criar agendamento"}</button></div></form></div></>;
}


function ServiceModal({ mode, service, close, save }: { mode: "create" | "view" | "edit"; service?: ServiceItem; close: () => void; save: (data: Omit<ServiceItem, 'id' | 'active'>) => void }) {
  const [formData, setFormData] = useState({
    name: service?.name || "",
    category: service?.category || "Geral",
    duration: service?.duration || 60,
    price: service?.price || 0,
    maintenance: service?.maintenance || 0
  });
  const readOnly = mode === "view";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 overflow-y-auto">
      <button onClick={close} className="fixed inset-0 bg-navy-dark/40" />
      <div className="relative w-full max-w-lg rounded-xl bg-white p-5 shadow-2xl sm:p-7">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <Badge tone="primary">{mode === "create" ? "Novo Serviço" : mode === "view" ? "Detalhes do Serviço" : "Editar Serviço"}</Badge>
            <h2 className="mt-2 text-xl font-bold">{formData.name || "Novo Serviço"}</h2>
          </div>
          <button onClick={close} className="rounded-md p-1.5 text-muted hover:bg-bg hover:text-ink"><X size={20} /></button>
        </div>

        <form onSubmit={e => {
          e.preventDefault();
          save(formData);
        }}>
          <div className="space-y-4">
            <div>
              <label className="field-label">Nome do Serviço *</label>
              <input required className="field-input" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} disabled={readOnly} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="field-label">Categoria</label>
                <input className="field-input" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} disabled={readOnly} />
              </div>
              <div>
                <label className="field-label">Preço (R$) *</label>
                <input required type="number" step="0.01" min="0" className="field-input" value={formData.price || ''} onChange={e => setFormData({...formData, price: Number(e.target.value)})} disabled={readOnly} />
              </div>
              <div>
                <label className="field-label">Duração (minutos) *</label>
                <input required type="number" min="1" className="field-input" value={formData.duration || ''} onChange={e => setFormData({...formData, duration: Number(e.target.value)})} disabled={readOnly} />
              </div>
              <div>
                <label className="field-label">Manutenção sugerida (dias)</label>
                <input type="number" min="0" className="field-input" value={formData.maintenance || ''} onChange={e => setFormData({...formData, maintenance: Number(e.target.value)})} disabled={readOnly} placeholder="0 = Sem manutenção" />
              </div>
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-3">
            <button type="button" onClick={close} className="btn-outline">Cancelar</button>
            {!readOnly && <button type="submit" className="btn-primary"><Check size={16} />Salvar serviço</button>}
          </div>
        </form>
      </div>
    </div>
  );
}



function Toast({ text }: { text: string }) { return <div className="fixed bottom-5 right-5 z-[80] flex max-w-sm items-center gap-3 rounded-md bg-navy-dark px-4 py-3 text-sm text-white shadow-xl"><div className="rounded-full bg-primary p-1"><Check size={12} /></div>{text}</div> }


function SettingsView({ tenant, updateToast, role }: { tenant: any; updateToast: (t: string) => void; role: string }) {
  const [orgName, setOrgName] = useState(tenant?.orgName || "");
  const [pixKey, setPixKey] = useState("");
  const [savingPix, setSavingPix] = useState(false);
  const [pixError, setPixError] = useState("");
  useEffect(() => { import("@/lib/actions/settings").then(({getOrganizationPixKey}) => getOrganizationPixKey()).then(r => { if (!r.error) setPixKey(r.pixKey); }); }, []);
  const [fullName, setFullName] = useState(tenant?.profileName || "");
  const [email, setEmail] = useState(tenant?.email || "");
  const [password, setPassword] = useState("");
  const [savingOrg, setSavingOrg] = useState(false);
  const [savingAccess, setSavingAccess] = useState(false);
  const [orgError, setOrgError] = useState("");
  const [accessError, setAccessError] = useState("");

  async function handleSaveOrg() {
    setSavingOrg(true);
    setOrgError("");
    const { updateOrganization, updateProfile } = await import("@/lib/actions/settings");
    await updateOrganization(orgName);
    await updateProfile(fullName);
    updateToast("Dados da empresa salvos! Atualize a página para ver os novos nomes no menu.");
    setSavingOrg(false);
  }

  async function handleSaveAccess() {
    if (!email) return setAccessError("O e-mail não pode ficar vazio.");
    setSavingAccess(true);
    setAccessError("");
    const { updateAuthCredentials } = await import("@/lib/actions/settings");
    const res = await updateAuthCredentials(email, password || undefined);
    if (res.error) {
      setAccessError(res.error);
    } else {
      updateToast(res.message || "Acesso atualizado!");
      setPassword("");
    }
    setSavingAccess(false);
  }

  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-6 space-y-6">

      {(role === "owner" || role === "admin") && <TeamUsersManager isOwner={role === "owner"} />}
      <RolePermissionsManager />
      <div className="bg-white rounded-lg border shadow-sm p-6 space-y-3">
        <h3 className="font-semibold text-lg text-ink">Chave Pix para mensagens</h3>
        <p className="text-sm text-muted">Essa chave será incluída nas mensagens de pagamento geradas pela Agenda. Você pode alterá-la quando quiser.</p>
        <label className="field-label" htmlFor="pix-key">Chave Pix</label>
        <input id="pix-key" className="field-input" maxLength={255} value={pixKey} onChange={e=>setPixKey(e.target.value)} placeholder="CPF, CNPJ, e-mail, telefone ou chave aleatória" />
        {pixError && <p className="text-sm text-red-600">{pixError}</p>}
        <div className="flex justify-end"><button className="btn-primary" disabled={savingPix} onClick={async()=>{setSavingPix(true);setPixError("");try{const {updateOrganizationPixKey}=await import("@/lib/actions/settings");const result=await updateOrganizationPixKey(pixKey);if(result.error)setPixError(result.error);else updateToast("Chave Pix salva com sucesso.");}catch{setPixError("Não foi possível salvar a chave Pix.");}finally{setSavingPix(false);}}}>{savingPix?"Salvando...":"Salvar chave Pix"}</button></div>
      </div>

      <div className="bg-white rounded-lg border shadow-sm p-6">
        <div className="flex items-center gap-3 mb-6 border-b pb-4">
          <div className="bg-primary/10 text-primary p-2 rounded-lg"><Settings size={20} /></div>
          <div>
            <h3 className="font-semibold text-lg text-ink">Dados do Salão</h3>
            <p className="text-sm text-muted">Informações públicas que aparecem no sistema</p>
          </div>
        </div>

        {orgError && <div className="bg-red-50 text-red-600 p-3 rounded-md mb-4 text-sm border border-red-100">{orgError}</div>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="field-label">Nome do Salão (SaaS)</label>
            <input className="field-input" value={orgName} onChange={e => setOrgName(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Seu Nome (Proprietário/a)</label>
            <input className="field-input" value={fullName} onChange={e => setFullName(e.target.value)} />
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button onClick={handleSaveOrg} disabled={savingOrg} className="btn-primary">
            {savingOrg ? "Salvando..." : "Salvar Dados do Salão"}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg border shadow-sm p-6">
        <div className="flex items-center gap-3 mb-6 border-b pb-4">
          <div className="bg-emerald-100 text-emerald-700 p-2 rounded-lg"><Settings size={20} /></div>
          <div>
            <h3 className="font-semibold text-lg text-ink">Segurança e Acesso</h3>
            <p className="text-sm text-muted">Credenciais para login na plataforma</p>
          </div>
        </div>

        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm p-4 rounded-lg mb-6">
          <strong>Livre:</strong> Você pode alterar o e-mail de acesso livremente (inclusive usar e-mails fictícios para sua equipe). A mudança é imediata e não exige confirmação externa.
        </div>

        {accessError && <div className="bg-red-50 text-red-600 p-3 rounded-md mb-4 text-sm border border-red-100">{accessError}</div>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="field-label">E-mail de Login</label>
            <input type="email" className="field-input" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Nova Senha (Deixe em branco para não alterar)</label>
            <input type="password" placeholder="••••••••" className="field-input" value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" />
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button onClick={handleSaveAccess} disabled={savingAccess} className="btn-primary bg-emerald-600 border-emerald-600 hover:bg-emerald-700">
            {savingAccess ? "Salvando..." : "Atualizar Acesso"}
          </button>
        </div>
      </div>


      <DataImportCard />
    </div>
  );
}

function NailStudioAppInner({ tenant = { profileName: "Usuária", orgName: "Salão" }, initialClients = demoClients, initialProfessionals = demoProfessionals, initialSpecialties = [], initialAppointments = [], initialInventory = [], initialServices = demoServices as any[], initialFinancials = [], initialStats = { revenue: 0, expenses: 0, commissions: 0, balance: 0 }, initialReports = {}, initialCommissions = [], professionalMode = false, role = professionalMode ? "professional" : "owner", permissionRows }: { initialCommissions?: {id:string;amount:number;status:string;date:string;service:string}[]; professionalMode?: boolean; role?: StudioRole; permissionRows?: PermissionRow[]; tenant?: { profileName: string; orgName: string; email?: string; orgSlug?: string; }; initialClients?: ClientItem[]; initialProfessionals?: ProfessionalItem[]; initialSpecialties?: {id: string, name: string}[]; initialAppointments?: Appointment[]; initialServices?: any[]; initialInventory?: any[]; initialFinancials?: any[]; initialStats?: any; initialReports?: any }) {
  const [view, setView] = useState<View>(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("view") === "packages" ? "packages" : canOpenView(role, "dashboard", permissionRows) ? "dashboard" : "agenda"); const [menu, setMenu] = useState(false); const [booking, setBooking] = useState(false); const [bookingDate, setBookingDate] = useState(() => new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" })); const [finish, setFinish] = useState(false); const [activeAppointment, setActiveAppointment] = useState<Appointment | null>(null); const [toast, setToast] = useState(""); const [rows, setRows] = useState(initialAppointments);
  const [cancelPending, setCancelPending] = useState<{ id: string; client: string; date: string; time: string } | null>(null);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [systemAlertMessage, setSystemAlertMessage] = useState<string | null>(null);

  // Catch native alert calls and display styled SystemAlertModal instead
  useEffect(() => {
    const originalAlert = window.alert;
    window.alert = (msg?: any) => {
      setSystemAlertMessage(String(msg || "Aviso do sistema"));
    };
    return () => {
      window.alert = originalAlert;
    };
  }, []);

  // Auto-refresh appointments when looking at the agenda
  useEffect(() => {
    if (view === "agenda" && !professionalMode) {
      const interval = setInterval(() => {
        getAppointments().then(fresh => setRows(fresh));
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [view]);

  // Auto-promoção: ao abrir a tela de clientes, promove automaticamente
  // quem tem >= 3 visitas e ainda não está na whitelist
  useEffect(() => {
    if (view === "clients" && !professionalMode) {
      runAutoPromoteWhitelist(3).then(res => {
        if (res.success && res.promoted > 0) {
          // Recarregar a lista para refletir as promoções
          getClients().then(fresh => setClientRows(fresh));
        }
      });
    }
  }, [view]);

  const [clientRows, setClientRows] = useState(() => [...initialClients]); const [serviceRows, setServiceRows] = useState(() => [...initialServices]);
  // Recarrega serviços, profissionais e clientes ao abrir essas telas, para refletir cargas feitas em Configurações
  useEffect(() => {
    if (view === "services" && !professionalMode) getServices().then(fresh => setServiceRows(fresh));
    if (view === "professionals" && !professionalMode) getProfessionals().then(fresh => setProfessionalRows(fresh));
    if (view === "clients" && !professionalMode) getClients().then(fresh => setClientRows(fresh));
    if (view === "inventory" && !professionalMode) import("@/lib/actions/inventory").then(({ getInventory }) => getInventory()).then(fresh => setProductRows(fresh));
  }, [view, professionalMode]);
  const [professionalRows, setProfessionalRows] = useState(() => [...initialProfessionals]); const [productRows, setProductRows] = useState<any[]>(initialInventory);
  const initialTemplates = [{ name: "Lembrete 24h", count: "18 agendadas", tone: "success" }, { name: "Sinal pendente", count: "3 aguardando", tone: "warning" }, { name: "Manutenção vencida", count: "7 oportunidades", tone: "danger" }, { name: "Aniversário", count: "2 nesta semana", tone: "primary" }];
const [automationRows, setAutomationRows] = useState(() => [...initialTemplates]); const [specialtyList, setSpecialtyList] = useState(() => [...initialSpecialties]); const [financialRows, setFinancialRows] = useState(() => [...initialFinancials]);
const [reportsData] = useState(() => initialReports); const [entityModal, setEntityModal] = useState<EntityModalState | null>(null);
  const [returnToConsumablesIndex, setReturnToConsumablesIndex] = useState<number | null>(null);
  const [closingCommissionFor, setClosingCommissionFor] = useState<any>(null);
  const [viewingClient, setViewingClient] = useState<any>(null);
  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(""), 3200); };
  const openEntity = (kind: EntityKind, mode: "view" | "edit" | "create", index?: number) => {
    if (mode === "create") { setEntityModal({ kind, mode, name: "", detail: kind === "service" ? "R$ 0,00" : "" }); return; }
    if (index === undefined) return;
    if (kind === "client") { const item = clientRows[index]; setEntityModal({ kind, mode, index, name: item.name, detail: item.phone }); }
    if (kind === "service") { const item = serviceRows[index]; setEntityModal({ kind, mode, index, name: item.name, detail: item.duration.toString() }); }
    if (kind === "service_consumables") { const item = serviceRows[index]; setEntityModal({ kind, mode, index, name: item.name, detail: "" }); }
    if (kind === "professional") { const item = professionalRows[index]; setEntityModal({ kind, mode, index, name: item.name, detail: item.specialty }); }
    if (kind === "product") { const item = productRows[index]; setEntityModal({ kind, mode, index, name: item.product, detail: `${item.stock} ${item.unit}` }); }
    if (kind === "automation") { const item = automationRows[index]; setEntityModal({ kind, mode, index, name: item.name, detail: "WhatsApp" }); }
    if (kind === "appointment") { const item = rows[index]; setEntityModal({ kind, mode, index, name: item.client, detail: item.time, fullItem: item }); }
    if (kind === "financial") { const item = financialRows[index]; setEntityModal({ kind, mode, index, name: item.name, detail: money.format(Math.abs(item.value)) }); }
  };

  const saveClient = async (data: any) => {
    if (!entityModal) return;
    const creating = entityModal.mode === "create";
    if (creating) {
      const res = await createClientRecord(data);
      if (res.success) {
        // Fetch fresh list from DB to ensure correct alphabetical order and data
        const fresh = await getClients();
        setClientRows(fresh);
      } else {
        const message: string = ("error" in res && typeof res.error === "string" && res.error) ? res.error : "Não foi possível salvar o cadastro.";
        if (message.startsWith("WhatsApp já cadastrado")) {
          setSystemAlertMessage("Este número já está vinculado a outra cliente deste salão. Confira o telefone informado ou consulte o cadastro existente.");
        } else {
          setSystemAlertMessage(message);
        }
        return;
      }
    } else if (entityModal.index !== undefined) {
      const item = clientRows[entityModal.index];
      if (!item.id) {
        appNotify("Não foi possível identificar a cliente para atualização.");
        return;
      }
      const res = await updateClientRecord(item.id, data);
      if (!res.success) {
        const message: string = ("error" in res && typeof res.error === "string" && res.error) ? res.error : "Não foi possível salvar o cadastro.";
        if (message.startsWith("WhatsApp já cadastrado")) {
          setSystemAlertMessage("Este número já está vinculado a outra cliente deste salão. Confira o telefone informado ou consulte o cadastro existente.");
        } else {
          setSystemAlertMessage(message);
        }
        return;
      }
      // Recarregar dados persistidos, evitando exibir valores que o banco recusou.
      const fresh = await getClients();
      setClientRows(fresh);
    }
    setEntityModal(null); notify(creating ? "Cliente cadastrada." : "Cliente atualizada.");
  };

  const saveEntity = async (name: string, detail: string) => {

    if (!entityModal) return; const { kind, mode, index } = entityModal; const creating = mode === "create";

    if (kind === "service") {
    if (creating) {
      const res = await createServiceRecord({ name, category: "Geral", duration: parseInt(detail) || 60, price: 100, maintenance: 0 });
      if (res.success) setServiceRows(current => [...current, { id: res.data?.id || "tmp", name, category: "Geral", duration: parseInt(detail) || 60, price: 100, maintenance: 0, active: true }]);
    }
  }
    if (kind === "professional") setProfessionalRows(current => creating ? [...current, { name, initials: name.split(" ").map(part => part[0]).join("").slice(0, 2).toUpperCase(), specialty: detail, today: 0, production: 0, occupation: 0, commission: 0 }] : current.map((item, i) => i === index ? { ...item, name, specialty: detail } : item));
    if (kind === "product") { const stock = Number(detail.replace(/[^0-9,]/g, "").replace(",", ".")) || 0; setProductRows(current => creating ? [...current, { product: name, unit: "un", stock, minimum: 10, ideal: 30, forecast: 0, cost: 0 }] : current.map((item, i) => i === index ? { ...item, product: name, stock } : item)); }
    if (kind === "automation") setAutomationRows(current => creating ? [...current, { name, count: "0 agendadas", tone: "primary" }] : current.map((item, i) => i === index ? { ...item, name } : item));
    if (kind === "appointment" && index !== undefined) setRows(current => current.map((item, i) => i === index ? { ...item, client: name, time: detail } : item));
    if (kind === "financial") {
      const value = Number(detail.replace(/[^0-9,]/g, "").replace(",", ".")) || 0;
      if (creating) {
        const res = await createExpense(name, value);
        if (res.success) window.location.reload();
      }
    }
    setEntityModal(null); notify(creating ? "Cadastro criado com sucesso." : "Alterações salvas com sucesso.");
  };
  const saveService = async (data: any) => {
    if (!entityModal) return;
    if (entityModal.mode === "create") {
      const res = await createServiceRecord(data);
      if (res.success) {
        setServiceRows(current => [...current, { ...data, id: res.data?.id || "tmp", active: true }]);
        notify("Serviço salvo com sucesso.");
      } else {
        appNotify(("error" in res ? res.error : "Erro desconhecido"));
      }
    } else {
      if (typeof entityModal.index !== "number") return;
      const itemToUpdate = serviceRows[entityModal.index];
      if (itemToUpdate && itemToUpdate.id && !itemToUpdate.id.startsWith("demo-")) {
        const res = await updateServiceRecord(itemToUpdate.id, data);
        if (!res.success) { appNotify(("error" in res ? res.error : "Erro desconhecido")); return; }
      }
      setServiceRows(current => current.map((item, i) => i === entityModal.index ? { ...item, ...data } : item));
      notify("Serviço atualizado com sucesso.");
    }
    setEntityModal(null);
  };
  const saveProfessional = async (formData: any) => {
    if (!entityModal) return;
    const { mode, index } = entityModal;
    const creating = mode === "create";

    const dataToSave = { ...formData, specialty: formData.specialties.join(", "), specialties: formData.specialties };

    if (creating) {
      const res = await createProfessionalRecord(dataToSave);
      if (res.success && res.data) {
        setProfessionalRows(current => [...current, {
          id: res.data.id,
          name: formData.name,
          initials: formData.name.split(" ").map((p: string) => p[0]).join("").slice(0,2).toUpperCase(),
          specialty: formData.specialty,
          email: formData.email,
          phone: formData.phone,
          default_commission: formData.default_commission,
          notes: formData.notes,
          today: 0, production: 0, occupation: 0, commission: 0
        }]);
      }
    } else if (index !== undefined) {
      const item = professionalRows[index];
      if (item.id) await updateProfessionalRecord(item.id, dataToSave);
      setProfessionalRows(current => current.map((p, i) => i === index ? {
        ...p,
        name: formData.name,
        specialty: formData.specialty,
        email: formData.email,
        phone: formData.phone,
        default_commission: formData.default_commission,
        notes: formData.notes
      } : p));
    }

    setEntityModal(null);
    notify(creating ? "Profissional criada com sucesso." : "Alterações salvas com sucesso.");
  };

  const confirmAction = async (message: string, action: () => void) => { if (await appConfirm(message)) action(); };
  const executeCancellation = async () => {
    if (!cancelPending || cancelBusy) return;
    setCancelBusy(true);
    try {
      const result = await cancelAppointmentRecord(cancelPending.id);
      if (result.success) {
        setRows(current => current.map(item => item.id === cancelPending.id ? { ...item, status: "Cancelado" } : item));
        setCancelPending(null);
        notify("Agendamento cancelado. Horário liberado e histórico preservado.");
      } else appNotify(("error" in result ? result.error : "Não foi possível cancelar o agendamento."));
    } finally { setCancelBusy(false); }
  };
  const content = (() => {
    if (!canOpenView(role, view, permissionRows)) return <main className="page-content"><div className="card"><h2 className="text-lg font-semibold">Acesso restrito</h2><p className="mt-2 text-sm text-muted">Este módulo não está liberado para o seu perfil. Fale com a gestora do salão.</p></div></main>;
    if (professionalMode && !["dashboard", "agenda", "services", "attendance", "clients", "packages", "reports", "automations", "commissions", "professionals", "finance", "inventory", "settings", "online"].includes(view)) return <main className="page-content"><div className="card"><h2 className="text-lg font-semibold">Acesso restrito</h2><p className="mt-2 text-sm text-muted">Este módulo está visível no menu, mas o acesso aos dados e às operações depende das permissões do seu perfil. Nenhum dado de outras profissionais ou salões será exibido.</p></div></main>;
    if (view === "dashboard" && professionalMode) return <ProfessionalDashboard rows={rows} services={serviceRows} commissions={initialCommissions} onOpen={setView} onAgenda={() => setView("agenda")} onAttendances={() => setView("attendance")} />;
    if (view === "dashboard") return <Dashboard stats={initialStats} go={setView} appointments={rows} clients={clientRows} tenant={tenant} onAttendance={(a) => { setActiveAppointment(a); setView("attendance"); }} />;
    if (view === "settings" && professionalMode) return <main className="page-content"><h2 className="text-xl font-semibold">Configurações</h2><p className="mt-2 text-sm text-muted">Tela administrativa visível para avaliação. Alterações de gestão estão reservadas à proprietária.</p></main>;
    if (view === "settings") return <SettingsView tenant={tenant} role={role} updateToast={(t) => { setToast(t); setTimeout(() => setToast(""), 3000); }} />;
    if (view === "agenda") return <Agenda readOnly={professionalMode} rows={rows} onPaymentsUpdated={(fresh) => setRows(fresh)} onNew={(dateStr) => { setBookingDate(dateStr); setBooking(true); }} onAttendance={(a) => { setActiveAppointment(a); setView("attendance"); }} onAction={(mode, index) => openEntity("appointment", mode, index)} onToggleBlockDay={async (dateStr) => {
      const res = await toggleBlockDayRecord(dateStr);
      if (res.success) {
        const fresh = await getAppointments();
        if (fresh) {
          setRows(fresh);
        }
        const dateFormatted = dateStr.split("-").reverse().join("/");
        notify(res.action === "blocked" ? `Agenda do dia ${dateFormatted} bloqueada para ausência.` : `Agenda do dia ${dateFormatted} desbloqueada.`);
      } else {
        appNotify("Erro ao alterar bloqueio de agenda: " + (res.error || "Erro desconhecido"));
      }
    }} onStatusChange={async (a, statusUI) => {
    if (statusUI === "Concluído") {
      // Intercept to open payment/checkout modal
      setActiveAppointment(a);
      setFinish(true);
      return;
    }

    const map: Record<string, string> = {
      "Aguardando sinal": "awaiting_deposit",
      "Agendado": "scheduled",
      "Confirmado": "confirmed",
      "Cliente chegou": "arrived",
      "Em atendimento": "in_progress",
      "Concluído": "completed"
    };
    const dbStatus = map[statusUI];
    if (dbStatus) {
      setRows(current => current.map(item => item.id === a.id ? { ...item, status: statusUI as any } : item));
      updateAppointmentStatus(a.id, dbStatus); // Don't block UI waiting for this

      if (statusUI === "Em atendimento" || statusUI === "Cliente chegou") {
        setActiveAppointment(a);
        setView("attendance");
      }
    }
  }}
  onCancel={(_index, id) => { const item = rows.find(row => row.id === id); if (item) setCancelPending({ id, client: item.client, date: bookingDate, time: item.time }); }} />;
    if (view === "clients" && professionalMode) return <ProfessionalClients />;
    if (view === "clients") return <Clients
      data={clientRows}
      onNew={() => openEntity("client", "create")}
      onAction={(mode, index) => {
        if (mode === "view") { setViewingClient(clientRows[index]); }
        else { openEntity("client", mode, index); }
      }}
      onArchive={index => confirmAction("Arquivar esta cliente? O histórico será preservado.", async () => {
        const item = clientRows[index];
        if (item.id) await archiveClientRecord(item.id);
        setClientRows(current => current.map((c, i) => i === index ? { ...c, status: "Inativa" } : c));
        notify("Cliente arquivada; histórico preservado.");
      })}
      onRestore={async (index) => {
        const item = clientRows[index];
        if (item.id) await updateClientRecord(item.id, { ...item, status: "active" } as any);
        setClientRows(current => current.map((c, i) => i === index ? { ...c, status: "Ativa" } : c));
        notify("Cliente reativada.");
      }}
      onToggleWhitelist={async (index, add) => {
        const item = clientRows[index];
        // Optimistic update
        setClientRows(current => current.map((c, i) => i === index
          ? { ...c, whitelist: add, blacklist: add ? false : c.blacklist, autoPromoted: false, tag: add ? "VIP" : "Cadastrada" }
          : c
        ));
        if (item.id) {
          const res = await toggleClientWhitelist(item.id, add);
          if (!res.success) {
            // Reverter
            setClientRows(current => current.map((c, i) => i === index ? { ...c, whitelist: !add } : c));
            notify("Erro ao atualizar White List: " + (res.error || ""));
          } else {
            notify(add ? `${item.name} adicionada à White List ⭐` : `${item.name} removida da White List`);
          }
        }
      }}
      onToggleBlacklist={async (index, add) => {
        const item = clientRows[index];
        // Optimistic update
        setClientRows(current => current.map((c, i) => i === index
          ? { ...c, blacklist: add, whitelist: add ? false : c.whitelist, tag: add ? "Bloqueada" : "Cadastrada" }
          : c
        ));
        if (item.id) {
          const res = await toggleClientBlacklist(item.id, add);
          if (!res.success) {
            setClientRows(current => current.map((c, i) => i === index ? { ...c, blacklist: !add } : c));
            notify("Erro ao atualizar Black List: " + (res.error || ""));
          } else {
            notify(add ? `${item.name} adicionada à Black List 🚫` : `${item.name} removida da Black List`);
          }
        }
      }}
    />;
    if (view === "services") return <Services readOnly={professionalMode} data={serviceRows} inventory={productRows} onNew={() => openEntity("service", "create")} onAction={(mode, index) => openEntity("service", mode, index)} onDelete={index => confirmAction("Excluir este serviço?", async () => { const item = serviceRows[index]; if (item.id && !item.id.startsWith("demo-")) { await deleteServiceRecord(item.id); } setServiceRows(current => current.filter((_, i) => i !== index)); notify("Serviço removido."); })} onConsumables={(index) => openEntity("service_consumables" as any, "edit", index)} />;
    if (view === "professionals" && professionalMode) return <main className="page-content"><h2 className="text-xl font-semibold">Profissionais</h2><p className="mt-2 text-sm text-muted">Cadastro e gestão da equipe exclusivos da gestora do salão.</p></main>;
    if (view === "professionals") return <Professionals data={professionalRows} onCommissions={index => setClosingCommissionFor(professionalRows[index])} onNew={() => openEntity("professional", "create")} onAction={(mode, index) => openEntity("professional", mode, index)} onDelete={index => confirmAction("Arquivar esta profissional? Agendamentos anteriores serão preservados.", async () => { const item = professionalRows[index]; if (item.id) await archiveProfessionalRecord(item.id); setProfessionalRows(current => current.filter((_, i) => i !== index)); notify("Profissional arquivada."); })} />;
    if (view === "attendance" && professionalMode) return <ProfessionalAttendances rows={rows} onCompleted={async (id) => { const res = await markServiceCompleted(id); if (!res.success) { notify(res.error || "Não foi possível marcar o serviço."); return; } setRows(current => current.map(r => r.id === id ? { ...r, serviceCompletedAt: new Date().toISOString() } : r)); notify("Serviço marcado como finalizado."); }} />;
    if (view === "attendance") return (
      <Attendance
        appointment={activeAppointment}
        services={serviceRows}
        allAppointments={rows}
        onSelect={(a) => setActiveAppointment(a)}
        onAddExtra={async (svc) => {
          if (!activeAppointment) return;
          const profId = professionalRows.find(p => p.name === activeAppointment.professional)?.id;
          if (profId) {
            const tempId = "temp-" + Date.now();
            const newPrice = activeAppointment.price + svc.price;
            const newService = activeAppointment.service + " + " + svc.name;
            const newItems = [...(activeAppointment.items || []), { id: tempId, name: svc.name, price: svc.price }];

            setRows(current => current.map(item => item.id === activeAppointment.id ? { ...item, price: newPrice, service: newService, items: newItems } : item));
            setActiveAppointment({ ...activeAppointment, price: newPrice, service: newService, items: newItems });

            const res = await addServiceToAppointment(activeAppointment.id, profId, svc.id, svc.price, svc.duration);
            if (res.success && res.id) {
              // Update with real ID so they can remove it
              const finalItems = newItems.map(i => i.id === tempId ? { ...i, id: res.id } : i);
              setRows(current => current.map(item => item.id === activeAppointment.id ? { ...item, items: finalItems } : item));
              setActiveAppointment(curr => curr ? { ...curr, items: finalItems } : null);
            }
          }
        }}
        onRemoveItem={async (itemId) => {
          if (!activeAppointment) return;
          const removedItem = activeAppointment.items?.find(i => i.id === itemId);
          if (!removedItem) return;

          const newPrice = activeAppointment.price - removedItem.price;
          const newItems = activeAppointment.items?.filter(i => i.id !== itemId) || [];
          const newService = newItems.map(i => i.name).join(" + ");

          setRows(current => current.map(item => item.id === activeAppointment.id ? { ...item, price: newPrice, service: newService, items: newItems } : item));
          setActiveAppointment({ ...activeAppointment, price: newPrice, service: newService, items: newItems });

          await removeServiceFromAppointment(itemId);
        }}
        onStatusChange={(newStatus) => {
          if (!activeAppointment) return;
          const map: Record<string, string> = {
            "Cliente chegou": "arrived",
            "Em atendimento": "in_progress",
          };
          const dbStatus = map[newStatus];
          if (dbStatus) {
            setRows(current => current.map(item => item.id === activeAppointment.id ? { ...item, status: newStatus as any } : item));
            setActiveAppointment({ ...activeAppointment, status: newStatus as any });
            updateAppointmentStatus(activeAppointment.id, dbStatus);
          }
        }}
        onFinish={() => setFinish(true)}
      />
    ); if (view === "commissions") return <main className="page-content"><h2 className="text-xl font-semibold">Minhas comissões</h2><div className="mt-4 grid gap-3">{initialCommissions.map(item => <div className="card" key={item.id}><p className="font-medium">{item.service}</p><p className="mt-1 text-sm text-muted">{item.date} · {item.status === 'paid' ? 'Pago' : item.status === 'generated' ? 'Pendente' : item.status}</p><p className="mt-2 font-semibold">{money.format(item.amount)}</p></div>)}{initialCommissions.length === 0 && <p className="text-sm text-muted">Nenhuma comissão registrada.</p>}</div></main>;
    if (view === "finance" && professionalMode) return <main className="page-content"><h2 className="text-xl font-semibold">Financeiro</h2><p className="mt-2 text-sm text-muted">Somente as suas comissões.</p><div className="mt-4 grid gap-3">{initialCommissions.map(item => <div className="card" key={item.id}><p className="font-medium">{item.service}</p><p className="mt-1 text-sm text-muted">{item.date} · {item.status === 'paid' ? 'Pago' : item.status === 'generated' ? 'Pendente' : item.status}</p><p className="mt-2 font-semibold">{money.format(item.amount)}</p></div>)}{initialCommissions.length === 0 && <p className="text-sm text-muted">Nenhuma comissão registrada.</p>}</div></main>;
    if (view === "finance") return <Finance stats={initialStats} data={financialRows} onNew={() => openEntity("financial", "create")} onAction={(mode, index) => openEntity("financial", mode, index)} onReverse={index => confirmAction("Estornar este movimento? Um lançamento de compensação será registrado.", () => { setFinancialRows(current => current.map((item, i) => i === index ? { ...item, status: "Estornado" } : item)); notify("Movimento estornado por compensação; registro original preservado."); })} />;
    if (view === "packages" && professionalMode) return <main className="page-content"><h2 className="text-xl font-semibold">Pacotes das minhas clientes</h2><p className="mt-2 text-sm text-muted">Acompanhamento individual de pacotes em preparação. Dados financeiros de outras profissionais não são exibidos.</p></main>;
    if (view === "packages") return <PackageCatalogContent />;
    if (view === "inventory" && professionalMode) return <main className="page-content"><h2 className="text-xl font-semibold">Estoque</h2><p className="mt-2 text-sm text-muted">Gestão de estoque reservada à gestora até a definição de permissões.</p></main>;
    if (view === "inventory") return <Inventory data={productRows} onNew={() => openEntity("product", "create")} onAction={(mode, index) => openEntity("product", mode, index)} onDelete={(index) => { openEntity("product", "edit", index); notify("Atualize o campo \"Saldo atual\" para corrigir o estoque."); }} />;
    if (view === "automations" && professionalMode) return <main className="page-content"><h2 className="text-xl font-semibold">Recuperação de clientes</h2><p className="mt-2 text-sm text-muted">O envio de mensagens será liberado após validação da lista de clientes vinculadas, consentimento e permissões de comunicação.</p></main>;
    if (view === "automations") return <Automations go={setView} tenant={tenant} />;
    if (view === "reports" && professionalMode) return <ProfessionalReport rows={rows} commissions={initialCommissions} />;
    if (view === "reports") return <Reports data={reportsData} />;
    if (view === "online") return tenant?.orgSlug ? <OnlineBooking slug={tenant.orgSlug} orgName={tenant?.orgName || "Salão"} services={serviceRows} professionals={professionalRows} /> : <main className="page-content"><div className="card"><p className="text-sm text-muted">O agendamento online deste salão ainda não está configurado.</p></div></main>;
  })();

  return (
    <div className="min-h-screen bg-bg">
      <Sidebar view={view} setView={setView} open={menu} close={() => setMenu(false)} tenant={tenant} professionalMode={professionalMode} role={role} permissionRows={permissionRows} />
      <div className="min-w-0 lg:ml-60">
        <Header view={view} onMenu={() => setMenu(true)} tenant={tenant} professionalMode={professionalMode} role={role} />
        {content}
      </div>
      {viewingClient && <ClientDetailsModal client={viewingClient} close={() => setViewingClient(null)} />}
      {closingCommissionFor && <ProfessionalCommissionsModal professional={closingCommissionFor} close={() => setClosingCommissionFor(null)} onPaid={() => getProfessionals().then(fresh => setProfessionalRows(fresh as any[]))} />}
      {entityModal && (
        entityModal.kind === "appointment" ? (
          <AppointmentModal
            mode={entityModal.mode as any}
            appointment={entityModal.fullItem}
            clients={clientRows}
            professionals={professionalRows}
            services={serviceRows}
            close={() => setEntityModal(null)}
            save={async (id, rawData) => {
              const res = await updateAppointmentRecord(id, rawData);
              if (res.success) {
                // Optimistic UI update
                setRows(current => current.map(r => r.id === id ? { ...r, time: rawData.timeStr, professional: professionalRows.find(p => p.id === rawData.professionalId)?.name || "", service: rawData.services.map((s:any)=>serviceRows.find((sr:any)=>sr.id===s.id)?.name).join(" + "), price: rawData.price } : r));
                setEntityModal(null);
                notify("Agendamento atualizado!");
              } else {
                appNotify(("error" in res ? res.error : "Erro desconhecido"));
              }
            }}
          />
        ) : entityModal.kind === "service" ? (
          <ServiceModal
            mode={entityModal.mode}
            service={entityModal.index !== undefined ? serviceRows[entityModal.index] : undefined}
            close={() => setEntityModal(null)}
            save={saveService}
          />
        ) : entityModal.kind === "professional" ? (
          <ProfessionalModal
            mode={entityModal.mode}
            professional={entityModal.index !== undefined ? professionalRows[entityModal.index] : undefined}
            close={() => setEntityModal(null)}
            save={saveProfessional}
          />
        ) : (
          entityModal.kind === "client" ? <ClientModal mode={entityModal.mode} client={entityModal.index !== undefined ? clientRows[entityModal.index] : undefined} close={() => setEntityModal(null)} save={saveClient} /> : (entityModal.kind !== "product" && entityModal.kind !== "service_consumables" ? <EntityModal key={`${entityModal.kind}-${entityModal.mode}-${entityModal.index ?? "new"}`} state={entityModal} close={() => setEntityModal(null)} save={saveEntity} /> : null)
        )
      )}

      {entityModal && entityModal.kind === "product" && (
        <ProductModal
          product={entityModal.mode !== "create" && entityModal.index !== undefined ? productRows[entityModal.index] : undefined}
          close={() => {
            if (returnToConsumablesIndex !== null) {
              const service = serviceRows[returnToConsumablesIndex];
              setEntityModal({ kind: "service_consumables", mode: "edit", index: returnToConsumablesIndex, name: service.name, detail: "" });
              setReturnToConsumablesIndex(null);
            } else {
              setEntityModal(null);
            }
          }}
          save={async (data) => {
            let res;
            if (entityModal.mode === "create") {
              res = await createProduct(data);
            } else {
              const p = productRows[entityModal.index!];
              res = await updateProduct(p.id, { ...data, currentStock: p.stock });
            }
            if (res.success) {
              const fresh = await getInventory();
              setProductRows(fresh);
              if (returnToConsumablesIndex !== null) {
                const service = serviceRows[returnToConsumablesIndex];
                setEntityModal({ kind: "service_consumables", mode: "edit", index: returnToConsumablesIndex, name: service.name, detail: "" });
                setReturnToConsumablesIndex(null);
              } else {
                setEntityModal(null);
              }
              notify(entityModal.mode === "create" ? "Produto cadastrado com sucesso." : "Produto atualizado com sucesso.");
            } else {
              appNotify("Erro ao salvar produto: " + ("error" in res ? res.error : "Erro desconhecido"));
            }
          }}
        />
      )}
      {entityModal && entityModal.kind === "service_consumables" && (
        <ServiceConsumablesModal
          service={serviceRows[entityModal.index!]}
          inventory={productRows}
          close={() => setEntityModal(null)}
          createProduct={() => {
            setReturnToConsumablesIndex(entityModal.index!);
            setEntityModal({ kind: "product", mode: "create", name: "", detail: "" });
          }}
          save={async (items) => {
            const svc = serviceRows[entityModal.index!];
            const res = await updateServiceConsumables(svc.id, items.map(i => ({ product_id: i.product_id, quantity: i.estimated_quantity })));
            if (res.success) {
              const freshServices = await getServices();
              setServiceRows(freshServices as any[]);
              setEntityModal(null);
              notify("Consumo de insumos atualizado.");
            } else {
              appNotify("Erro ao salvar: " + (res as any).error);
            }
          }}
        />
      )}

      {booking && <BookingModal initialDate={bookingDate} clients={clientRows} onClientCreated={(client) => setClientRows(current => current.some(c => c.id === client.id) ? current : [...current, client].sort((a,b)=>a.name.localeCompare(b.name)))} professionals={professionalRows} services={serviceRows} close={() => setBooking(false)} save={async (a, rawData) => { if(rawData) { const res = await createAppointmentRecord(rawData); if (res.success) { const fresh = await getAppointments(); setRows(fresh); setBooking(false); notify("Agendamento criado com sucesso."); } else { appNotify(("error" in res ? res.error : "Erro desconhecido")); } } else { setRows(v => [...v, a]); setBooking(false); notify("Agendamento criado (demo)."); } }} />}
      {finish && activeAppointment && <FinishModal appointment={activeAppointment} close={() => setFinish(false)} done={async (method, val, pkgId) => { const res = await finishAppointment({ appointmentId: activeAppointment.id, amount: val, paymentMethod: method, packageId: pkgId }); if (res.success) { setRows(v => v.map(a => a.id === activeAppointment.id ? { ...a, status: "Concluído", paid: (a.paid || 0) + val } : a)); getProfessionals().then(fresh => setProfessionalRows(fresh as any[])); setFinish(false); setActiveAppointment(null); setView("attendance"); notify("Atendimento concluído e pagamento registrado com sucesso."); } else { appNotify(("error" in res ? res.error : "Erro desconhecido")); } }} />}
      {cancelPending && <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4" role="presentation">
        <div role="alertdialog" aria-modal="true" aria-labelledby="cancel-appointment-title" aria-describedby="cancel-appointment-description" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
          <h2 id="cancel-appointment-title" className="text-xl font-semibold text-[#382D32]">Cancelar agendamento?</h2>
          <p id="cancel-appointment-description" className="mt-3 text-sm text-muted">Você está prestes a cancelar o horário de <strong>{cancelPending.client}</strong>{cancelPending.date ? ` em ${cancelPending.date}` : ""}, às {cancelPending.time}.</p>
          <p className="mt-3 text-sm text-muted">O horário ficará disponível para novos agendamentos. O histórico será mantido para consulta.</p>
          <p className="mt-3 text-sm font-medium text-[#8B4141]">Esta ação não poderá ser desfeita automaticamente.</p>
          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <button type="button" className="btn-outline" disabled={cancelBusy} onClick={() => setCancelPending(null)}>Manter agendamento</button>
            <button type="button" className="btn-primary" disabled={cancelBusy} onClick={executeCancellation}>{cancelBusy ? "Cancelando..." : "Confirmar cancelamento"}</button>
          </div>
        </div>
      </div>}
      {toast && <Toast text={toast} />}
      {systemAlertMessage && <SystemAlertModal title={systemAlertMessage.startsWith("Este número já está vinculado") ? "WhatsApp já cadastrado" : "Aviso do Sistema"} message={systemAlertMessage} close={() => setSystemAlertMessage(null)} />}
    </div>
  );
}


const OCCUPATION_BASE_MINUTES_UI = 480; // mesma base usada no cálculo do card da gestora

function toMinutes(hhmm: string) {
  const [h, m] = (hhmm || "00:00").split(":").map(Number);
  return h * 60 + m;
}

function ProfessionalDashboard({ rows, services, commissions, onOpen, onAgenda, onAttendances }: {
  rows: Appointment[];
  services: { name: string; maintenance?: number }[];
  commissions: { amount: number; status: string; date: string }[];
  onOpen: (view: View) => void;
  onAgenda: () => void;
  onAttendances: () => void;
}) {
  const [birthdays, setBirthdays] = useState<{ id: string; name: string; day: number; month: number }[]>([]);
  useEffect(() => {
    listMyClientBirthdays().then(res => setBirthdays(res.rows));
  }, []);

  const now = new Date();
  const todayKey = now.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const todayPt = now.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const nowTime = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Sao_Paulo" }).format(now);
  const nowMinutes = toMinutes(nowTime);

  const todays = rows.filter(a => a.dateStr === todayKey).sort((a, b) => a.time.localeCompare(b.time));
  const valid = todays.filter(a => a.status !== "Cancelado");
  const active = todays.filter(a => a.status !== "Cancelado" && a.status !== "Concluído");
  const inProgress = active.find(a => a.status === "Em atendimento" || a.status === "Cliente chegou");
  const next = inProgress ?? active.find(a => toMinutes(a.time) >= nowMinutes) ?? null;
  const minutesUntilNext = next ? toMinutes(next.time) - nowMinutes : null;

  const bookedMinutes = valid.reduce((sum, a) => sum + Math.max(0, toMinutes(a.end) - toMinutes(a.time)), 0);
  const occupation = Math.min(100, Math.round((bookedMinutes / OCCUPATION_BASE_MINUTES_UI) * 100));

  const producedToday = valid.filter(a => a.status === "Concluído").reduce((sum, a) => sum + Number(a.price || 0), 0);
  const commissionToday = commissions.filter(c => c.date === todayPt).reduce((sum, c) => sum + Number(c.amount || 0), 0);
  const toReceive = commissions.filter(c => c.status === "generated").reduce((sum, c) => sum + Number(c.amount || 0), 0);

  // Retornos: última visita concluída de cada cliente com cada serviço, somada à periodicidade do cadastro
  const lastVisit = new Map<string, { date: string; service: string; client: string; clientId?: string | null; days: number }>();
  for (const a of rows) {
    if (a.status !== "Concluído" || !a.dateStr || !a.clientId) continue;
    const days = Number(services.find(s => s.name === a.service)?.maintenance || 0);
    if (days <= 0) continue;
    const key = `${a.clientId}|${a.service}`;
    const current = lastVisit.get(key);
    if (!current || a.dateStr > current.date) lastVisit.set(key, { date: a.dateStr, service: a.service, client: a.client, clientId: a.clientId, days });
  }
  const dueSoon = Array.from(lastVisit.values())
    .map(v => {
      const d = new Date(`${v.date}T12:00:00Z`);
      d.setUTCDate(d.getUTCDate() + v.days);
      return { ...v, due: d.toISOString().slice(0, 10) };
    })
    .filter(v => v.due >= todayKey && v.due <= shiftDateKey(todayKey, 7))
    .sort((a, b) => a.due.localeCompare(b.due));

  const todayDay = Number(todayKey.slice(8, 10));
  const birthdaysSorted = [...birthdays].sort((a, b) => ((a.day - todayDay + 31) % 31) - ((b.day - todayDay + 31) % 31));

  const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
    <div className={`rounded-xl border border-[#E8D9C7] bg-white p-5 ${className}`}>{children}</div>
  );

  return (
    <main className="page-content">
      <div className="mb-5 flex flex-wrap gap-3">
        <button className="btn-primary" onClick={onAgenda}>Abrir minha agenda</button>
        <button className="btn-outline" onClick={onAttendances}>Meus atendimentos</button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <p className="text-xs text-muted">Próximo atendimento</p>
          {next ? (
            <>
              <p className="mt-2 text-2xl font-bold text-ink">{next.time} · {next.client}</p>
              <p className="mt-1 text-sm text-muted">{next.service}</p>
              <p className="mt-2 text-xs text-primary">
                {inProgress ? "Em andamento agora" : minutesUntilNext !== null && minutesUntilNext > 0 ? `Começa em ${minutesUntilNext} min` : "Começando agora"}
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted">Nenhum atendimento pendente hoje.</p>
          )}
        </Card>
        <Card>
          <p className="text-xs text-muted">Ocupação de hoje</p>
          <p className="mt-2 text-2xl font-bold text-ink">{occupation}%</p>
          <div className="mt-3 h-1.5 w-full rounded-full bg-[#E7EDF3]"><div className="h-full rounded-full bg-primary" style={{ width: `${occupation}%` }} /></div>
          <p className="mt-2 text-xs text-muted">{Math.round(bookedMinutes)} min agendados de {OCCUPATION_BASE_MINUTES_UI} min</p>
        </Card>
        <Card>
          <p className="text-xs text-muted">Hoje</p>
          <p className="mt-2 text-2xl font-bold text-ink">{money.format(producedToday)}</p>
          <p className="mt-1 text-sm text-muted">produção concluída</p>
          <p className="mt-3 text-sm"><span className="text-muted">Comissão gerada hoje: </span><span className="font-semibold">{money.format(commissionToday)}</span></p>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ink">Agenda de hoje</h3>
            <button className="text-xs text-primary underline" onClick={onAgenda}>Ver agenda</button>
          </div>
          {todays.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">Nenhum atendimento marcado para hoje.</p>
          ) : (
            <ul className="divide-y divide-[#E8D9C7]">
              {todays.map(a => (
                <li key={a.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium text-ink">{a.time} · {a.client}</p>
                    <p className="truncate text-xs text-muted">{a.service}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${a.status === "Concluído" ? "bg-green-50 text-green-800" : a.status === "Cancelado" ? "bg-red-50 text-red-700" : "bg-bg text-ink"}`}>{a.status}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="grid gap-4">
          <Card>
            <h3 className="text-sm font-semibold text-ink">Aniversariantes do mês</h3>
            {birthdaysSorted.length === 0 ? (
              <p className="mt-2 text-sm text-muted">Nenhuma aniversariante neste mês.</p>
            ) : (
              <ul className="mt-2 space-y-1.5 text-sm">
                {birthdaysSorted.slice(0, 6).map(b => (
                  <li key={b.id} className="flex justify-between"><span>{b.name}</span><span className="text-muted">{String(b.day).padStart(2, "0")}/{String(b.month).padStart(2, "0")}{b.day === todayDay ? " · hoje" : ""}</span></li>
                ))}
              </ul>
            )}
          </Card>
          <Card>
            <h3 className="text-sm font-semibold text-ink">Retornos nos próximos 7 dias</h3>
            {dueSoon.length === 0 ? (
              <p className="mt-2 text-sm text-muted">Nenhum retorno previsto.</p>
            ) : (
              <ul className="mt-2 space-y-1.5 text-sm">
                {dueSoon.slice(0, 6).map(v => (
                  <li key={`${v.clientId}|${v.service}`} className="flex justify-between gap-2"><span className="truncate">{v.client} · {v.service}</span><span className="shrink-0 text-muted">{v.due.slice(8, 10)}/{v.due.slice(5, 7)}</span></li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <div className="mt-4">
        <Card className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs text-muted">Comissão a receber</p>
            <p className="mt-1 text-2xl font-bold text-amber-900">{money.format(toReceive)}</p>
          </div>
          <button className="btn-outline" onClick={() => onOpen("reports")}>Ver financeiro</button>
        </Card>
      </div>
    </main>
  );
}

function ProfessionalAttendances({ rows, onCompleted }: { rows: Appointment[]; onCompleted: (id: string) => Promise<void> }) {
  const [period, setPeriod] = useState<ReportPeriod>("today");
  const [tab, setTab] = useState<"progress" | "done">("progress");
  const [busyId, setBusyId] = useState<string | null>(null);
  const now = new Date();
  const todayKey = now.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const range = periodRange(period, todayKey);
  const inRange = (key?: string | null) => !range || (!!key && key >= range.start && key <= range.end);

  const relevant = rows.filter(a => inRange(a.dateStr) && (a.status === "Em atendimento" || a.status === "Cliente chegou" || a.status === "Concluído"));
  const inProgress = relevant.filter(a => a.status === "Em atendimento" || a.status === "Cliente chegou");
  const done = relevant.filter(a => a.status === "Concluído");
  const production = done.reduce((sum, a) => sum + Number(a.price || 0), 0);
  const visible = (tab === "progress" ? inProgress : done)
    .slice()
    .sort((x, y) => (y.dateStr || "").localeCompare(x.dateStr || "") || x.time.localeCompare(y.time));

  const groups: { key: string; items: Appointment[] }[] = [];
  for (const a of visible) {
    const key = a.dateStr || "";
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(a); else groups.push({ key, items: [a] });
  }
  const dayLabel = (key: string) => {
    if (!key) return "Sem data";
    if (key === todayKey) return "Hoje";
    const label = new Date(`${key}T12:00:00Z`).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", timeZone: "America/Sao_Paulo" });
    return label.charAt(0).toUpperCase() + label.slice(1);
  };
  const pill = (status: string) => status === "Concluído"
    ? "bg-green-50 text-green-800 border-green-200"
    : status === "Cliente chegou" ? "bg-amber-50 text-amber-800 border-amber-200" : "bg-primary/10 text-primary border-primary/20";

  const Stat = ({ label, value }: { label: string; value: string }) => (
    <div className="rounded-xl border border-[#E8D9C7] bg-white p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold text-ink">{value}</p>
    </div>
  );

  return (
    <main className="page-content">
      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Período">
        {REPORT_PERIODS.map(p => (
          <button key={p.id} type="button" onClick={() => setPeriod(p.id)} aria-pressed={period === p.id}
            className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${period === p.id ? "border-primary bg-primary text-white" : "border-[#E8D9C7] bg-white text-ink hover:bg-bg"}`}>
            {p.label}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Em andamento" value={String(inProgress.length)} />
        <Stat label="Concluídos" value={String(done.length)} />
        <Stat label="Produção" value={money.format(production)} />
      </div>

      <div className="mt-5 inline-flex rounded-full border border-[#E8D9C7] bg-white p-1">
        {([["progress", `Em andamento (${inProgress.length})`], ["done", `Concluídos (${done.length})`]] as const).map(([id, label]) => (
          <button key={id} type="button" onClick={() => setTab(id)} aria-pressed={tab === id}
            className={`rounded-full px-4 py-1.5 text-sm transition-colors ${tab === id ? "bg-primary text-white" : "text-ink hover:bg-bg"}`}>{label}</button>
        ))}
      </div>

      <div className="mt-5 space-y-6">
        {groups.length === 0 && (
          <p className="rounded-xl border border-dashed border-[#E8D9C7] bg-white py-10 text-center text-sm text-muted">
            {tab === "progress" ? "Nenhum atendimento em andamento neste período." : "Nenhum atendimento concluído neste período."}
          </p>
        )}
        {groups.map(group => (
          <section key={group.key || "sem-data"}>
            <h3 className="mb-2 text-sm font-semibold text-ink">{dayLabel(group.key)}</h3>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {group.items.map(a => (
                <article key={a.id} className="flex flex-col rounded-xl border border-[#E8D9C7] border-l-4 bg-white p-4 shadow-sm"
                  style={{ borderLeftColor: a.status === "Concluído" ? "#16a34a" : a.status === "Cliente chegou" ? "#d97706" : "#7A4A6A" }}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-ink">{a.client}</p>
                      <p className="mt-0.5 text-xs text-muted">{a.time} – {a.end}</p>
                    </div>
                    <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${pill(a.status)}`}>{a.status}</span>
                  </div>
                  <p className="mt-2 text-sm text-ink">{a.service}</p>
                  <div className="mt-auto pt-3">
                    {a.status === "Concluído" ? (
                      <p className="text-sm font-medium text-green-800">{money.format(Number(a.price || 0))}</p>
                    ) : a.serviceCompletedAt ? (
                      <p className="text-sm text-muted">Serviço finalizado. A recepção fará o recebimento.</p>
                    ) : (
                      <button type="button" disabled={busyId === a.id} className="btn-primary w-full justify-center disabled:opacity-60"
                        onClick={async () => { setBusyId(a.id); try { await onCompleted(a.id); } finally { setBusyId(null); } }}>
                        {busyId === a.id ? "Salvando..." : "Marcar serviço como finalizado"}
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}

const REPORT_PERIODS = [
  { id: "today", label: "Hoje" },
  { id: "week", label: "Esta semana" },
  { id: "month", label: "Este mês" },
  { id: "last_month", label: "Mês anterior" },
  { id: "30days", label: "Últimos 30 dias" },
  { id: "all", label: "Todos" },
] as const;
type ReportPeriod = typeof REPORT_PERIODS[number]["id"];

function shiftDateKey(key: string, days: number) {
  const d = new Date(`${key}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function periodRange(period: ReportPeriod, todayKey: string): { start: string; end: string } | null {
  if (period === "all") return null;
  if (period === "today") return { start: todayKey, end: todayKey };
  if (period === "week") {
    const dow = new Date(`${todayKey}T12:00:00Z`).getUTCDay(); // 0 = domingo
    return { start: shiftDateKey(todayKey, -(dow === 0 ? 6 : dow - 1)), end: todayKey };
  }
  if (period === "month") return { start: `${todayKey.slice(0, 7)}-01`, end: todayKey };
  if (period === "last_month") {
    const [y, m] = todayKey.split("-").map(Number);
    const first = new Date(Date.UTC(y, m - 2, 1));
    const last = new Date(Date.UTC(y, m - 1, 0));
    return { start: first.toISOString().slice(0, 10), end: last.toISOString().slice(0, 10) };
  }
  return { start: shiftDateKey(todayKey, -29), end: todayKey }; // 30days
}

function ProfessionalReport({ rows, commissions }: { rows: Appointment[]; commissions: { amount: number; status: string; date: string }[] }) {
  const [period, setPeriod] = useState<ReportPeriod>("month");
  const now = new Date();
  const todayKey = now.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const range = periodRange(period, todayKey);
  const inRange = (key?: string | null) => !range || (!!key && key >= range.start && key <= range.end);
  const periodLabel = REPORT_PERIODS.find(p => p.id === period)?.label ?? "";
  const monthLabel = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "America/Sao_Paulo" }).format(now);

  const periodRows = rows.filter(a => inRange(a.dateStr));
  const completed = periodRows
    .filter(a => a.status === "Concluído")
    .sort((a, b) => `${b.dateStr}${b.time}`.localeCompare(`${a.dateStr}${a.time}`));
  const production = completed.reduce((sum, a) => sum + Number(a.price || 0), 0);
  const ticket = completed.length > 0 ? production / completed.length : 0;
  const scheduled = periodRows.filter(a => a.status !== "Concluído" && a.status !== "Cancelado").length;
  const cancelled = periodRows.filter(a => a.status === "Cancelado").length;

  const commissionsInPeriod = commissions.filter(c => {
    const [dd, mm, yyyy] = (c.date || "").split("/");
    return inRange(dd && mm && yyyy ? `${yyyy}-${mm}-${dd}` : null);
  });
  const toReceive = commissionsInPeriod.filter(c => c.status === "generated").reduce((sum, c) => sum + Number(c.amount || 0), 0);
  const received = commissionsInPeriod.filter(c => c.status === "paid").reduce((sum, c) => sum + Number(c.amount || 0), 0);

  const ReportStat = ({ label, value, hint }: { label: string; value: string; hint?: string }) => (
    <div className="rounded-xl border border-[#E8D9C7] bg-white p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold text-ink">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );

  return (
    <main className="page-content">
      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Período">
        {REPORT_PERIODS.map(p => (
          <button key={p.id} type="button" onClick={() => setPeriod(p.id)} aria-pressed={period === p.id}
            className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${period === p.id ? "border-primary bg-primary text-white" : "border-[#E8D9C7] bg-white text-ink hover:bg-bg"}`}>
            {p.label}
          </button>
        ))}
      </div>

      <div className="mb-5">
        <h2 className="text-lg font-semibold">{period === "month" ? monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1) : periodLabel}</h2>
        <p className="text-xs text-muted">Seus atendimentos e comissões no período selecionado.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <ReportStat label="Atendimentos concluídos" value={String(completed.length)} />
        <ReportStat label="Produção" value={money.format(production)} hint="Soma dos serviços concluídos" />
        <ReportStat label="Ticket médio" value={money.format(ticket)} />
        <ReportStat label="Agendados" value={String(scheduled)} hint={cancelled > 0 ? `${cancelled} cancelado(s)` : undefined} />
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
          <p className="text-xs text-amber-800">Comissão a receber</p>
          <p className="mt-1 text-2xl font-bold text-amber-900">{money.format(toReceive)}</p>
        </div>
        <div className="rounded-xl border border-green-100 bg-green-50 p-4">
          <p className="text-xs text-green-800">Comissão já recebida</p>
          <p className="mt-1 text-2xl font-bold text-green-900">{money.format(received)}</p>
        </div>
      </div>

      <section className="mt-6">
        <h3 className="mb-3 text-sm font-semibold text-ink">Atendimentos concluídos</h3>
        <div className="overflow-x-auto rounded-lg border border-[#E7EDF3]">
          <table className="data-table !min-w-0 table-fixed">
            <thead>
              <tr>
                <th className="w-[20%]">Data</th>
                <th>Serviço</th>
                <th className="w-[24%]">Cliente</th>
                <th className="w-[18%] text-right">Valor</th>
              </tr>
            </thead>
            <tbody>
              {completed.length === 0 ? (
                <tr><td colSpan={4} className="py-8 text-center text-muted">Nenhum atendimento concluído neste período.</td></tr>
              ) : completed.map(a => (
                <tr key={a.id}>
                  <td>{a.dateStr ? `${a.dateStr.slice(8, 10)}/${a.dateStr.slice(5, 7)} · ${a.time}` : a.time}</td>
                  <td>{a.service}</td>
                  <td>{a.client}</td>
                  <td className="text-right font-medium">{money.format(Number(a.price || 0))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function FinishModal({ appointment, close, done }:{ appointment: Appointment; close: () => void; done: (method: string, val: number, packageId?: string) => void }) {
  const [method, setMethod] = useState("PIX");
  const [submitting, setSubmitting] = useState(false);
  const [packages, setPackages] = useState<any[]>([]);
  const [selectedPkg, setSelectedPkg] = useState("");
  const [chargeMethod, setChargeMethod] = useState("PIX");
  const [preview, setPreview] = useState<null | { legacy: boolean; covered: { id: string; description: string }[]; uncovered: { id: string; description: string; total: number }[]; charge: number }>(null);
  const [previewError, setPreviewError] = useState("");

  useEffect(() => {
    if (method !== "Pacote" || !selectedPkg) { setPreview(null); setPreviewError(""); return; }
    let active = true;
    import("@/lib/actions/attendance").then(m => m.previewPackageCheckout(appointment.id, selectedPkg)).then(res => {
      if (!active) return;
      if (res.success) { setPreview(res); setPreviewError(""); }
      else { setPreview(null); setPreviewError(res.error); }
    });
    return () => { active = false; };
  }, [method, selectedPkg, appointment.id]);

  useEffect(() => {
    if (appointment.clientId) {
      import('@/lib/actions/packages').then(m => {
        m.getActivePackages(appointment.clientId!).then(pkgs => {
          setPackages(pkgs);
          if (pkgs.length > 0) setSelectedPkg(pkgs[0].id);
        });
      });
    }
  }, [appointment.clientId]);

  const alreadyPaid = Math.max(0, Number(appointment.paid || 0));
  const remaining = Math.max(0, Number(appointment.price || 0) - alreadyPaid);

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-navy-dark/45 sm:items-center sm:p-4">
      <div className="w-full max-w-lg rounded-t-lg bg-white p-5 sm:rounded-lg">
        <div className="flex justify-between">
          <div>
            <h2 className="text-lg font-semibold">Concluir atendimento</h2>
            <p className="text-xs text-muted">Revise o recebimento de {appointment.client}.</p>
          </div>
          <button onClick={close}><X size={18} /></button>
        </div>
        <div className="mt-5 rounded-md bg-bg p-4">
          <div className="flex justify-between">
            <span>Total do atendimento</span>
            <b>{money.format(appointment.price)}</b>
          </div>
          {alreadyPaid > 0 && (
            <div className="mt-2 flex justify-between text-sm text-muted">
              <span>Já recebido (antecipado)</span>
              <b>- {money.format(alreadyPaid)}</b>
            </div>
          )}
          <div className="mt-3 flex justify-between border-t border-[#DBE3EC] pt-3 text-base">
            <b>A receber</b>
            <b>{money.format(method === "Pacote" ? (preview && !preview.legacy ? preview.charge : 0) : remaining)}</b>
          </div>
        </div>
        <label className="mt-4 block">
          <span className="field-label">Forma de pagamento</span>
          <select value={method} onChange={e => setMethod(e.target.value)} className="field-input">
            <option value="PIX">PIX</option>
            <option value="Dinheiro">Dinheiro</option>
            <option value="Débito">Débito</option>
            <option value="Crédito">Crédito</option>
            {packages.length > 0 && <option value="Pacote">Abater de Pacote</option>}
          </select>
        </label>

        {method === "Pacote" && (
          <label className="mt-4 block">
            <span className="field-label">Escolha o Pacote</span>
            <select value={selectedPkg} onChange={e => setSelectedPkg(e.target.value)} className="field-input">
              {packages.map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.remaining_sessions} restantes)</option>
              ))}
            </select>
          </label>
        )}

        {method === "Pacote" && previewError && (
          <p className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700">{previewError}</p>
        )}

        {method === "Pacote" && preview && preview.legacy && (
          <div className="mt-3 rounded-md border border-[#DBE3EC] p-3 text-sm">
            <p className="text-muted">Este pacote não tem saldo por serviço. Ele consome 1 sessão por atendimento, como antes.</p>
          </div>
        )}

        {method === "Pacote" && preview && !preview.legacy && (
          <div className="mt-3 space-y-2 rounded-md border border-[#DBE3EC] p-3 text-sm">
            <p className="font-medium">Serviços cobertos pelo pacote ({preview.covered.length})</p>
            {preview.covered.length === 0 && <p className="text-muted">Nenhum serviço deste atendimento está no pacote.</p>}
            {preview.covered.map(c => (
              <p key={c.id} className="text-emerald-700">✓ {c.description} · debita 1 sessão</p>
            ))}
            {preview.uncovered.length > 0 && (
              <>
                <p className="pt-2 font-medium text-amber-700">Fora do pacote: será cobrado normalmente</p>
                {preview.uncovered.map(u => (
                  <p key={u.id} className="text-amber-700">• {u.description} · {money.format(u.total)}</p>
                ))}
                <label className="mt-2 block">
                  <span className="field-label">Forma de pagamento do valor fora do pacote</span>
                  <select value={chargeMethod} onChange={e => setChargeMethod(e.target.value)} className="field-input">
                    <option value="PIX">PIX</option>
                    <option value="Dinheiro">Dinheiro</option>
                    <option value="Débito">Débito</option>
                    <option value="Crédito">Crédito</option>
                  </select>
                </label>
              </>
            )}
          </div>
        )}

        <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-md border border-[#DBE3EC] p-3">
            <p className="text-muted">Comissão gerada</p>
            <b>{money.format(appointment.price * 0.3)}</b>
          </div>
          <div className="rounded-md border border-[#DBE3EC] p-3">
            <p className="text-muted">Status do sistema</p>
            <b>Caixa aberto</b>
          </div>
        </div>
        <button disabled={submitting || (method === "Pacote" && (!selectedPkg || !preview))} onClick={async () => {
          setSubmitting(true);
          if (method === "Pacote") {
            await done(chargeMethod, preview && !preview.legacy ? preview.charge : 0, selectedPkg);
          } else {
            await done(method, remaining, undefined);
          }
        }} className="btn-primary mt-5 w-full">
          <Check size={16} />{submitting ? "Processando..." : "Confirmar e concluir"}
        </button>
      </div>
    </div>
  );
}

// Tela completa dentro do provedor de diálogos do sistema (substitui alert, confirm e prompt do navegador).
export function NailStudioApp(props: Parameters<typeof NailStudioAppInner>[0]) {
  return <AppDialogProvider><NailStudioAppInner {...props} /></AppDialogProvider>;
}
