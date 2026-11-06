import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Homologation-only read-only reconciliation. Never activates or cancels access. */
export async function GET(request: NextRequest) {
  const bearer = request.headers.get("authorization") ?? "";
  const token = bearer.startsWith("Bearer ") ? bearer.slice(7).trim() : "";
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: auth, error: authError } = await db.auth.getUser(token);
  if (authError || !auth.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: profile, error } = await db.from("profiles").select("role").eq("id", auth.user.id).maybeSingle();
  if (error) return NextResponse.json({ error: "Profile lookup failed" }, { status: 503 });
  const role = String(profile?.role ?? "").trim().toLowerCase();
  const designatedAdmin = role === "admin" && auth.user.email?.trim().toLowerCase() === "admin.gabi@example.com";
  if (role !== "master" && !designatedAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { data, error: queryError } = await db.from("cakto_webhook_reconciliation")
    .select("event_id,event_type,received_at,offer_id,cakto_subscription_id,plan_code,organization_id,reconciliation_status")
    .order("received_at", { ascending: false }).limit(50);
  if (queryError) {
    console.error("Cakto reconciliation read failed", { code: queryError.code });
    return NextResponse.json({ error: "Unable to retrieve reconciliation" }, { status: 503 });
  }
  return NextResponse.json({ events: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
}
