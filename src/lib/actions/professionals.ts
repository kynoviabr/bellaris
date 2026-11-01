"use server";

import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

const SALON_TZ = "America/Sao_Paulo";
const OCCUPATION_BASE_MINUTES = 480; // jornada padrão de 8h, até existir jornada cadastrada

export interface ProfessionalItem {
  id?: string;
  name: string;
  initials: string;
  specialty: string;
  today: number;
  production: number;
  occupation: number;
  commission: number;
  
  // Real DB fields
  email?: string;
  phone?: string;
  default_commission?: number;
  notes?: string;
}

export async function getProfessionals(): Promise<ProfessionalItem[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("professionals")
    .select(`
      id,
      name,
      email,
      phone,
      specialties,
      default_commission,
      notes,
      active
    `)
    .eq("active", true)
    .order("name", { ascending: true });
    
  // Fetch pending commissions for each professional
  const { data: comms } = await supabase.from('commissions').select('professional_id, amount').eq('status', 'generated');

  // Indicadores: atendimentos do mês (inclui hoje), calculados no fuso do salão
  const todayKey = new Intl.DateTimeFormat("en-CA", { timeZone: SALON_TZ }).format(new Date());
  const monthStart = `${todayKey.slice(0, 7)}-01T00:00:00-03:00`;
  const { data: monthAppointments } = await supabase
    .from("appointments")
    .select(`
      professional_id,
      starts_at,
      ends_at,
      status,
      items:appointment_items(professional_id, unit_price, quantity)
    `)
    .gte("starts_at", monthStart)
    .neq("status", "cancelled");

  const indicators = new Map<string, { today: number; production: number; minutesToday: number }>();
  const bump = (profId: string) => {
    if (!indicators.has(profId)) indicators.set(profId, { today: 0, production: 0, minutesToday: 0 });
    return indicators.get(profId)!;
  };

  for (const appt of monthAppointments ?? []) {
    const isToday = new Intl.DateTimeFormat("en-CA", { timeZone: SALON_TZ }).format(new Date(appt.starts_at)) === todayKey;
    if (appt.professional_id) {
      const ind = bump(appt.professional_id);
      if (isToday) {
        ind.today += 1;
        ind.minutesToday += (new Date(appt.ends_at).getTime() - new Date(appt.starts_at).getTime()) / 60000;
      }
    }
    if (appt.status === "completed") {
      for (const item of (appt.items ?? []) as any[]) {
        const profId = item.professional_id || appt.professional_id;
        if (!profId) continue;
        bump(profId).production += Number(item.unit_price || 0) * Number(item.quantity || 1);
      }
    }
  }

  if (error || !data) {
    return [];
  }

  return data.map((item) => {
    const ind = indicators.get(item.id) ?? { today: 0, production: 0, minutesToday: 0 };
    return {
      id: item.id,
      name: item.name,
      initials: item.name.split(" ").map((part: string) => part[0]).join("").slice(0, 2).toUpperCase(),
      specialty: item.specialties && item.specialties.length > 0 ? item.specialties.join(", ") : "Geral",
      email: item.email,
      phone: item.phone,
      default_commission: item.default_commission,
      notes: item.notes,
      
      // Indicators
      today: ind.today,
      production: Math.round(ind.production * 100) / 100,
      // Provisório: minutos agendados hoje / jornada padrão de 8h. Não há jornada cadastrada no sistema.
      occupation: Math.min(100, Math.round((ind.minutesToday / OCCUPATION_BASE_MINUTES) * 100)),
      commission: comms ? comms.filter(c => c.professional_id === item.id).reduce((acc, c) => acc + Number(c.amount), 0) : 0,
    };
  });
}

export async function createProfessionalRecord(data: { name: string; email?: string; phone?: string; specialties: string[]; default_commission: number; notes?: string }) {
  if (!isSupabaseConfigured()) return { success: false, error: "No connection" };

  const supabase = await createClient();
  if (!supabase) return { success: false, error: "Supabase não conectado" };

  const { data: profile } = await supabase.from('profiles').select('organization_id').single();
  if (!profile?.organization_id) return { success: false, error: "Organização não encontrada" };

  const { data: newProf, error } = await supabase
    .from("professionals")
    .insert({
      organization_id: profile.organization_id,
      name: data.name,
      email: data.email || null,
      phone: data.phone || null,
      specialties: data.specialties,
      default_commission: data.default_commission,
      notes: data.notes || null,
    })
    .select()
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, mode: "supabase", data: newProf };
}

export async function updateProfessionalRecord(id: string, data: { name: string; email?: string; phone?: string; specialties: string[]; default_commission: number; notes?: string }) {
  if (!isSupabaseConfigured()) return { success: true };

  const supabase = await createClient();
  if (!supabase) return { success: false, error: "Supabase não conectado" };

  const { error } = await supabase
    .from("professionals")
    .update({
      name: data.name,
      email: data.email || null,
      phone: data.phone || null,
      specialties: data.specialties,
      default_commission: data.default_commission,
      notes: data.notes || null,
    })
    .eq("id", id);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function archiveProfessionalRecord(id: string) {
  if (!isSupabaseConfigured()) return { success: true };

  const supabase = await createClient();
  if (!supabase) return { success: false, error: "Supabase não conectado" };

  const { error } = await supabase
    .from("professionals")
    .update({ active: false })
    .eq("id", id);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}
