import { createHmac, createHash, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { activationEnabled } from "@/lib/cakto/webhook-queue";
import { processPendingCaktoEvents, type Db } from "@/lib/cakto/process-events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 128 * 1024;
const MAX_SKEW_SECONDS = 300;

function verifySignature(body: string, timestamp: string, provided: string, secret: string): boolean {
  if (!/^[0-9]{10}$/.test(timestamp)) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp)) > MAX_SKEW_SECONDS) return false;
  const expected = "v1=" + createHmac("sha256", secret).update(timestamp + "." + body).digest("hex");
  const normalized = provided.trim();
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(normalized, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  const secret = process.env.CAKTO_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_BODY_BYTES) return NextResponse.json({ error: "Payload too large" }, { status: 413 });

  const body = await request.text();
  if (Buffer.byteLength(body, "utf8") > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const record = payload as Record<string, unknown>;
  const bodyCredential = typeof record.secret === "string" ? record.secret : "";
  const supplied = Buffer.from(bodyCredential, "utf8");
  const configured = Buffer.from(secret, "utf8");
  const bodyAuthenticated = supplied.length === configured.length && timingSafeEqual(supplied, configured);
  const timestamp = request.headers.get("x-cakto-timestamp") ?? "";
  const signature = request.headers.get("x-cakto-signature") ?? "";
  const headerAuthenticated = Boolean(timestamp && signature) && verifySignature(body, timestamp, signature, secret);
  if (!bodyAuthenticated && !headerAuthenticated) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const data = payload as Record<string, unknown>;
  const eventType = typeof data.event === "string" ? data.event : "";
  const details = data.data && typeof data.data === "object" && !Array.isArray(data.data)
    ? data.data as Record<string, unknown> : {};
  if (!eventType) return NextResponse.json({ error: "Missing event" }, { status: 400 });
  const orderId = typeof details.id === "string" ? details.id : null;
  const eventKey = createHash("sha256").update(eventType + ":" + (orderId ?? "") + ":" + body).digest("hex");

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: "Webhook storage not configured" }, { status: 503 });
  }
  // Never persist the shared webhook credential in the event inbox.
  const sanitizedPayload = { ...data };
  delete sanitizedPayload.secret;
  const db = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { error } = await db.from("cakto_webhook_events").insert({
    event_key: eventKey,
    event_type: eventType,
    order_id: orderId,
    payload: sanitizedPayload
  });
  if (error && error.code !== "23505") {
    console.error("Cakto webhook storage failed", { code: error.code });
    return NextResponse.json({ error: "Unable to persist event" }, { status: 503 });
  }
  // Processa os eventos pendentes só com a ativação ligada. Falha aqui não derruba o recebimento:
  // o evento continua pendente e é tentado de novo na próxima chamada.
  const activation = activationEnabled();
  let processed = 0;
  let processingError: string | null = null;
  if (activation) {
    try {
      const { data: offerRows, error: offerError } = await db.from("cakto_plan_offers").select("offer_id,plan_code").eq("active", true);
      if (offerError) throw new Error("oferta: " + offerError.message);
      const offers: Record<string, string> = {};
      for (const row of (offerRows ?? []) as { offer_id: string; plan_code: string }[]) offers[row.offer_id] = row.plan_code;
      processed = await processPendingCaktoEvents(db as unknown as Db, offers);
    } catch (processError) {
      processingError = (processError as Error).message;
      console.error("Cakto processing failed", { message: processingError });
    }
  }
  // Diagnóstico sem dados pessoais nem segredos: só contagens e a mensagem de erro, se houver.
  return NextResponse.json(
    { received: true, activation, processed, processingError },
    { headers: { "Cache-Control": "no-store" } },
  );
}
