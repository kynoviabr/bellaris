import { NextResponse } from "next/server";
import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { reminderWindow, normalizeBrazilPhone, reminderParams } from "@/lib/whatsapp/reminders";
import { sendReminderTemplate } from "@/lib/whatsapp/meta";

export const dynamic = "force-dynamic";

// Lembretes de agenda pela API oficial do WhatsApp. Envia o modelo aprovado para os agendamentos
// de hoje até daqui a 3 dias. Só envia com WHATSAPP_REMINDERS_ENABLED=true. Exige CRON_SECRET.
const DAYS_AHEAD = 3;

type Candidate = {
  appointment_id: string;
  organization_id: string;
  organization_name: string;
  client_id: string;
  client_name: string;
  client_phone: string | null;
  starts_at: string;
  services: string;
};

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  if (process.env.WHATSAPP_REMINDERS_ENABLED !== "true") {
    return NextResponse.json({ enabled: false, sent: 0 });
  }

  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const templateName = process.env.WHATSAPP_REMINDER_TEMPLATE;
  const languageCode = process.env.WHATSAPP_REMINDER_LANGUAGE || "pt_BR";
  if (!token || !phoneNumberId || !templateName) {
    return NextResponse.json({ error: "Configuração do WhatsApp incompleta." }, { status: 500 });
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase não configurado." }, { status: 500 });
  }

  const supabase = await createAdminClient();
  if (!supabase) return NextResponse.json({ error: "Supabase não configurado." }, { status: 500 });

  const window = reminderWindow(new Date(), DAYS_AHEAD);
  const { data, error } = await supabase.rpc("reminder_candidates", { p_start: window.start, p_end: window.end });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const candidates = (data ?? []) as Candidate[];
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const row of candidates) {
    const to = normalizeBrazilPhone(row.client_phone);
    if (!to) {
      // Telefone inválido: não envia e não registra, para não tentar de novo todo dia.
      skipped++;
      continue;
    }

    const result = await sendReminderTemplate({
      to,
      templateName,
      languageCode,
      params: reminderParams({ clientName: row.client_name, startsAt: row.starts_at, services: row.services }),
      accessToken: token,
      phoneNumberId,
    });

    const { error: recordError } = await supabase.rpc("reminder_record_job", {
      p_org: row.organization_id,
      p_client: row.client_id,
      p_appointment: row.appointment_id,
      p_status: result.ok ? "sent" : "failed",
      p_provider_message_id: result.ok ? result.messageId : null,
      p_error: result.ok ? null : result.error,
    });
    if (recordError) {
      failed++;
      continue;
    }
    if (result.ok) sent++;
    else failed++;
  }

  return NextResponse.json({
    enabled: true,
    window,
    candidates: candidates.length,
    sent,
    failed,
    skipped,
  });
}
