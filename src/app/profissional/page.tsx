import { ProfessionalNavigation } from "@/components/professional-navigation";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { logout } from "@/lib/actions/auth";
import { CalendarDays, Wallet, LogOut, Sparkles, Clock3, ShieldCheck } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ProfessionalHome() {
  const supabase = await createClient();
  if (!supabase) redirect("/login");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role,full_name").eq("id", user.id).single();
  if (profile?.role !== "professional") redirect("/");

  const { data: professional } = await supabase.from("professionals").select("id,name").eq("user_id", user.id).single();
  const name = professional?.name || profile.full_name || "Profissional";
  const appointmentsResult = professional
    ? await supabase.from("appointments").select("id,starts_at,status").eq("professional_id", professional.id).order("starts_at", { ascending: false }).limit(30)
    : { data: [], error: null };
  const commissionsResult = professional
    ? await supabase.from("commissions").select("id,amount,status,created_at").eq("professional_id", professional.id).order("created_at", { ascending: false }).limit(30)
    : { data: [], error: null };
  const appointments = appointmentsResult.data ?? [];
  const commissions = commissionsResult.data ?? [];
  const total = commissions.reduce((sum, c) => sum + Number(c.amount || 0), 0);
  const currency = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  const dateTime = (value: string) => new Date(value).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
  const dateOnly = (value: string) => new Date(value).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

  return (
    <div className="min-h-screen bg-bg lg:pl-60"><ProfessionalNavigation name={name} />
      <header className="border-b border-[#E8D9C7] bg-white">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary text-white"><Sparkles size={23} /></div>
            <div><p className="text-base font-semibold text-ink">Gabi Nails</p><p className="text-xs text-muted">Painel da profissional</p></div>
          </div>
          <form action={logout}><button className="btn-outline" type="submit"><LogOut size={16} /> Sair</button></form>
        </div>
      </header>
      <main id="painel" className="mx-auto max-w-[1200px] space-y-6 px-4 py-7 sm:px-6 sm:py-10">
        <div>
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary"><ShieldCheck size={15} /> Acesso profissional</p>
          <h1 className="text-2xl font-bold text-ink sm:text-3xl">Olá, {name}</h1>
          <p className="mt-2 text-sm text-muted">Acompanhe seus agendamentos e suas comissões em um só lugar.</p>
        </div>
        {!professional && <div className="card text-sm text-ink">Seu usuário ainda não está vinculado a uma profissional. Solicite o vínculo à administração do salão.</div>}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="card"><div className="flex items-center gap-2 text-sm text-muted"><CalendarDays size={18} className="text-primary" /> Agendamentos</div><p className="mt-3 text-3xl font-bold text-ink">{appointments.length}</p><p className="mt-1 text-xs text-muted">Até 30 registros recentes</p></div>
          <div className="card"><div className="flex items-center gap-2 text-sm text-muted"><Wallet size={18} className="text-primary" /> Comissões</div><p className="mt-3 text-3xl font-bold text-ink">{commissions.length}</p><p className="mt-1 text-xs text-muted">Até 30 registros recentes</p></div>
          <div className="card"><div className="flex items-center gap-2 text-sm text-muted"><Wallet size={18} className="text-primary" /> Valor das comissões listadas</div><p className="mt-3 text-2xl font-bold text-ink">{currency(total)}</p><p className="mt-1 text-xs text-muted">Soma dos registros exibidos, não saldo a receber</p></div>
        </div>
        <div className="grid items-start gap-5 lg:grid-cols-2">
          <section id="agendamentos" className="card">
            <h2 className="flex items-center gap-2 text-lg font-bold text-ink"><CalendarDays size={19} className="text-primary" /> Meus agendamentos</h2>
            {appointmentsResult.error ? <p className="mt-5 text-sm text-danger">Não foi possível consultar seus agendamentos.</p> : appointments.length === 0 ? <div className="mt-5 rounded-lg bg-[#FAF6F0] px-5 py-10 text-center"><Clock3 className="mx-auto mb-3 text-primary" size={28} /><p className="font-medium">Nenhum agendamento encontrado</p><p className="mt-1 text-sm text-muted">Seus próximos atendimentos aparecerão aqui quando forem cadastrados.</p></div> : <ul className="mt-5 divide-y divide-[#E8D9C7]">{appointments.map(a => <li key={a.id} className="flex justify-between gap-4 py-3 text-sm"><span>{dateTime(a.starts_at)}</span><span className="font-medium text-primary">{a.status}</span></li>)}</ul>}
          </section>
          <section id="comissoes" className="card">
            <h2 className="flex items-center gap-2 text-lg font-bold text-ink"><Wallet size={19} className="text-primary" /> Minhas comissões</h2>
            {commissionsResult.error ? <p className="mt-5 text-sm text-danger">Não foi possível consultar suas comissões.</p> : commissions.length === 0 ? <div className="mt-5 rounded-lg bg-[#FAF6F0] px-5 py-10 text-center"><Wallet className="mx-auto mb-3 text-primary" size={28} /><p className="font-medium">Nenhuma comissão encontrada</p><p className="mt-1 text-sm text-muted">Suas comissões serão exibidas aqui após o registro dos atendimentos.</p></div> : <ul className="mt-5 divide-y divide-[#E8D9C7]">{commissions.map(c => <li key={c.id} className="flex justify-between gap-4 py-3 text-sm"><span>{dateOnly(c.created_at)} · {c.status}</span><strong>{currency(Number(c.amount))}</strong></li>)}</ul>}
          </section>
        </div>
      </main>
    </div>
  );
}
