import { createHmac, timingSafeEqual } from "node:crypto";
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

  // Phase 1: verified receiver only. Do not acknowledge successful processing
  // until durable event storage and idempotent processing have been implemented.
  // A non-2xx response intentionally prevents silent loss of billing events.
  return NextResponse.json(
    { error: "Verified, but durable processing is not configured" },
    { status: 503, headers: { "Cache-Control": "no-store" } }
  );
}
