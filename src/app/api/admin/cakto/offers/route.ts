import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { listCaktoSubscriptionOffers } from "@/lib/cakto/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Read-only diagnostic; restricted to authenticated platform master or designated homologation admin. */
export async function GET(request: NextRequest) {
  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return NextResponse.json({ error: "Not configured" }, { status: 503 });

  const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: auth, error: authError } = await db.auth.getUser(token);
  if (authError || !auth.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile, error: profileError } = await db.from("profiles")
    .select("role").eq("id", auth.user.id).maybeSingle();
  if (profileError) {
    console.error("Cakto admin profile lookup failed", { code: profileError.code });
    return NextResponse.json({ error: "Profile lookup failed", diagnostic: "profile_query_error" }, { status: 503 });
  }
  if (!profile) {
    return NextResponse.json({ error: "Forbidden", diagnostic: "profile_not_found" }, { status: 403 });
  }
  const role = String(profile.role).trim().toLowerCase();
  if (role !== "platform_master") {
    return NextResponse.json({ error: "Forbidden", diagnostic: "role_not_master", currentRole: profile.role }, { status: 403 });
  }

  try {
    const offers = (await listCaktoSubscriptionOffers()).filter(offer =>
      offer.product === "b0489bfc-7184-4df8-bc9f-a4714bf95c45"
    );
    return NextResponse.json({ offers }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Cakto offer diagnostic failed", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Unable to retrieve offers" }, { status: 502 });
  }
}
