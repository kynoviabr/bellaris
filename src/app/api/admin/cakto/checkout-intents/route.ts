import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Creates a server-owned checkout correlation intent; does not initiate payment. */
export async function POST(request: NextRequest) {
  const tokenHeader = request.headers.get("authorization") ?? "";
  const token = tokenHeader.startsWith("Bearer ") ? tokenHeader.slice(7).trim() : "";
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: auth, error: authError } = await db.auth.getUser(token);
  if (authError || !auth.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: profile, error: profileError } = await db.from("profiles").select("role").eq("id", auth.user.id).maybeSingle();
  if (profileError) return NextResponse.json({ error: "Profile lookup failed" }, { status: 503 });
  const role = String(profile?.role ?? "").trim().toLowerCase();
  const designatedAdmin = role === "admin" && auth.user.email?.trim().toLowerCase() === "admin.gabi@example.com";
  if (role !== "master" && !designatedAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let input: unknown;
  try { input = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  if (!input || typeof input !== "object" || Array.isArray(input)) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const body = input as Record<string, unknown>;
  const organizationId = body.organization_id;
  const planCode = body.plan_code;
  if (typeof organizationId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(organizationId)
      || typeof planCode !== "string" || !["essencial", "profissional", "completo"].includes(planCode)) {
    return NextResponse.json({ error: "Invalid organization or plan" }, { status: 400 });
  }
  const { data: org, error: orgError } = await db.from("organizations").select("id").eq("id", organizationId).maybeSingle();
  if (orgError) return NextResponse.json({ error: "Organization lookup failed" }, { status: 503 });
  if (!org) return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  const { data: offer, error: offerError } = await db.from("cakto_plan_offers").select("offer_id")
    .eq("plan_code", planCode).eq("active", true).limit(2);
  if (offerError) return NextResponse.json({ error: "Offer lookup failed" }, { status: 503 });
  if (!offer || offer.length !== 1) return NextResponse.json({ error: "Plan must have exactly one active offer" }, { status: 409 });
  const { data: existing, error: existingError } = await db.from("cakto_subscription_links")
    .select("cakto_subscription_id").eq("organization_id", organizationId).maybeSingle();
  if (existingError) return NextResponse.json({ error: "Subscription lookup failed" }, { status: 503 });
  if (existing) return NextResponse.json({ error: "Organization already has a linked Cakto subscription" }, { status: 409 });
  const { data: pending, error: pendingError } = await db.from("cakto_checkout_intents")
    .select("id,expires_at").eq("organization_id", organizationId).eq("status", "pending").maybeSingle();
  if (pendingError) return NextResponse.json({ error: "Pending checkout lookup failed" }, { status: 503 });
  if (pending && new Date(pending.expires_at).getTime() <= Date.now()) {
    const { error: expireError } = await db.from("cakto_checkout_intents").update({ status: "expired" })
      .eq("id", pending.id).eq("status", "pending");
    if (expireError) return NextResponse.json({ error: "Unable to expire stale checkout" }, { status: 503 });
  } else if (pending) {
    return NextResponse.json({ error: "Checkout already pending", expires_at: pending.expires_at }, { status: 409 });
  }
  const { data: intent, error: insertError } = await db.from("cakto_checkout_intents")
    .insert({ organization_id: organizationId, plan_code: planCode, offer_id: offer[0].offer_id })
    .select("id,offer_id,plan_code,expires_at").single();
  if (insertError) return NextResponse.json({ error: insertError.code === "23505" ? "Checkout already pending" : "Unable to create checkout intent" }, { status: insertError.code === "23505" ? 409 : 503 });
  return NextResponse.json({ intent }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
