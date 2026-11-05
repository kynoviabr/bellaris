import "server-only";

const API_BASE = "https://api.cakto.com.br/public_api";
let tokenCache: { token: string; expiresAt: number } | null = null;

export type CaktoOffer = {
  id: string;
  name: string;
  price: number;
  product: string;
  status: string;
  type: string;
  recurrence_period?: number;
};

async function getAccessToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt) return tokenCache.token;
  const clientId = process.env.CAKTO_CLIENT_ID;
  const clientSecret = process.env.CAKTO_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Cakto API credentials not configured");
  const response = await fetch(API_BASE + "/token/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret }),
    cache: "no-store",
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) throw new Error("Cakto authentication failed (HTTP " + response.status + ")");
  const result: unknown = await response.json();
  if (!result || typeof result !== "object" || !("access_token" in result) || typeof result.access_token !== "string") {
    throw new Error("Invalid Cakto authentication response");
  }
  const ttl = "expires_in" in result && typeof result.expires_in === "number" ? result.expires_in : 300;
  tokenCache = { token: result.access_token, expiresAt: Date.now() + Math.max(30, ttl - 60) * 1000 };
  return tokenCache.token;
}

/** Read-only: fetch active subscription offers without exposing API credentials. */
export async function listCaktoSubscriptionOffers(): Promise<CaktoOffer[]> {
  const token = await getAccessToken();
  const offers: CaktoOffer[] = [];
  for (let page = 1; page <= 20; page++) {
    const url = new URL(API_BASE + "/offers/");
    url.searchParams.set("type", "subscription");
    url.searchParams.set("status", "active");
    url.searchParams.set("limit", "100");
    url.searchParams.set("page", String(page));
    const response = await fetch(url, {
      headers: { Authorization: "Bearer " + token },
      cache: "no-store",
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) throw new Error("Cakto offers lookup failed (HTTP " + response.status + ")");
    const result: unknown = await response.json();
    if (!result || typeof result !== "object" || !("results" in result) || !Array.isArray(result.results)) {
      throw new Error("Invalid Cakto offers response");
    }
    for (const entry of result.results) {
      if (entry && typeof entry.id === "string" && typeof entry.name === "string"
        && typeof entry.product === "string" && typeof entry.price === "number") {
        offers.push({ id: entry.id, name: entry.name, price: entry.price, product: entry.product,
          status: String(entry.status ?? ""), type: String(entry.type ?? ""),
          recurrence_period: typeof entry.recurrence_period === "number" ? entry.recurrence_period : undefined });
      }
    }
    if (!("next" in result) || !result.next) return offers;
  }
  throw new Error("Cakto offers pagination limit reached");
}
