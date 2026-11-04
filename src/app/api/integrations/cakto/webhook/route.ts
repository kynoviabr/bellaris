import { createHmac, createHash, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 128 * 1024;
const MAX_SKEW_SECONDS = 300;

function verifySignature(body: string, timestamp: string, provided: string, secret: string): boolean {
  if (!/^\\d{10}$/.test(timestamp)) return false;
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

  const timestamp = request.headers.get("x-cakto-timestamp") ?? "";
  const signature = request.headers.get("x-cakto-signature") ?? "";
  if (!verifySignature(body, timestamp, signature, secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
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
  const db = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { error } = await db.from("cakto_webhook_events").insert({
    event_key: eventKey,
    event_type: eventType,
    order_id: orderId,
    payload: data
  });
  if (error && error.code !== "23505") {
    console.error("Cakto webhook storage failed", { code: error.code });
    return NextResponse.json({ error: "Unable to persist event" }, { status: 503 });
  }
  return NextResponse.json({ received: true }, { headers: { "Cache-Control": "no-store" } });
}
