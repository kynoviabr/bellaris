// Limite de requisições por IP em janela fixa.
// Fica na memória de cada instância da Vercel: freia abuso simples e rajadas, mas não é global
// entre instâncias. Para limite global, usar regras de WAF/rate limiting da Vercel ou uma tabela no banco.

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10_000;

export type RateLimitResult = { allowed: boolean; retryAfterSeconds: number };

export function checkRateLimit(key: string, limit: number, windowMs: number, now = Date.now()): RateLimitResult {
  if (buckets.size > MAX_BUCKETS) {
    buckets.forEach((b, k) => {
      if (b.resetAt <= now) buckets.delete(k);
    });
  }

  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (current.count >= limit) {
    return { allowed: false, retryAfterSeconds: Math.ceil((current.resetAt - now) / 1000) };
  }

  current.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

// IP do cliente. A Vercel preenche x-forwarded-for; o primeiro item é o cliente.
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

export function tooManyRequestsResponse(retryAfterSeconds: number) {
  return new Response(JSON.stringify({ error: "Muitas tentativas. Aguarde um pouco e tente de novo." }), {
    status: 429,
    headers: {
      "Content-Type": "application/json",
      "Retry-After": String(Math.max(1, retryAfterSeconds)),
      "Cache-Control": "no-store",
    },
  });
}
