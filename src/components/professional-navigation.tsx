"use client";
import { useState } from "react";
import Link from "next/link";
import { CalendarDays, LayoutDashboard, Wallet, Sparkles, LogOut, Menu, X } from "lucide-react";
import { logout } from "@/lib/actions/auth";

export function ProfessionalNavigation({ name, section }: { name: string; section: string }) {
  const [open, setOpen] = useState(false);
  const links = [
    { id: "dashboard", label: "Painel", icon: LayoutDashboard, href: "/profissional?aba=painel" },
    { id: "appointments", label: "Meus agendamentos", icon: CalendarDays, href: "/profissional?aba=agendamentos" },
    { id: "commissions", label: "Minhas comissões", icon: Wallet, href: "/profissional?aba=comissoes" },
  ];
  return <>
    {open && <button type="button" aria-label="Fechar menu" onClick={() => setOpen(false)} className="fixed inset-0 z-40 bg-black/40 lg:hidden" />}
    <aside className={`fixed inset-y-0 left-0 z-50 flex w-60 flex-col bg-navy text-white transition-transform lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}>
      <div className="flex h-[65px] items-center justify-between border-b border-white/10 px-5">
        <div className="flex items-center gap-3"><span className="rounded-md bg-primary p-2"><Sparkles size={17}/></span><div><strong className="block text-sm">{name}</strong><span className="text-xs text-white/60">Profissional</span></div></div>
        <button type="button" onClick={() => setOpen(false)} className="lg:hidden" aria-label="Fechar menu"><X size={20}/></button>
      </div>
      <nav aria-label="Menu profissional" className="flex-1 space-y-1 px-3 py-5">
        <p className="px-3 pb-2 text-[10px] uppercase tracking-widest text-white/50">Operação</p>
        {links.map(({id,label,icon:Icon,href}) => <Link key={id} href={href} onClick={() => {setOpen(false);}} className={`flex items-center gap-3 rounded-md px-3 py-3 text-sm transition-colors ${section === id ? "bg-primary text-white" : "text-white/75 hover:bg-white/10 hover:text-white"}`}><Icon size={17}/>{label}</Link>)}
      </nav>
      <form action={logout} className="border-t border-white/10 p-3"><button className="flex w-full items-center gap-3 rounded-md px-3 py-3 text-sm text-white/75 hover:bg-white/10" type="submit"><LogOut size={17}/> Sair do sistema</button></form>
    </aside>
    <button type="button" onClick={() => setOpen(true)} aria-label="Abrir menu" className="fixed left-4 top-4 z-30 rounded-lg border border-[#E8D9C7] bg-white p-2 text-primary shadow-sm lg:hidden"><Menu size={22}/></button>
  </>;
}
