import { test } from "node:test";
import assert from "node:assert/strict";
import { checkRateLimit, clientIp } from "../src/lib/rate-limit.ts";

test("libera até o limite e bloqueia na sequência dentro da janela", () => {
  const now = 1_000_000;
  const key = "teste:ip-a";
  for (let i = 0; i < 3; i++) assert.equal(checkRateLimit(key, 3, 60_000, now).allowed, true);
  const blocked = checkRateLimit(key, 3, 60_000, now + 1000);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.retryAfterSeconds, 59);
});

test("libera de novo depois que a janela termina", () => {
  const now = 2_000_000;
  const key = "teste:ip-b";
  for (let i = 0; i < 2; i++) checkRateLimit(key, 2, 60_000, now);
  assert.equal(checkRateLimit(key, 2, 60_000, now + 1000).allowed, false);
  assert.equal(checkRateLimit(key, 2, 60_000, now + 60_001).allowed, true);
});

test("IPs diferentes têm limites separados", () => {
  const now = 3_000_000;
  checkRateLimit("teste:ip-c", 1, 60_000, now);
  assert.equal(checkRateLimit("teste:ip-c", 1, 60_000, now).allowed, false);
  assert.equal(checkRateLimit("teste:ip-d", 1, 60_000, now).allowed, true);
});

test("IP do cliente vem do primeiro item de x-forwarded-for", () => {
  const req = new Request("https://x.test", { headers: { "x-forwarded-for": "201.10.20.30, 10.0.0.1" } });
  assert.equal(clientIp(req), "201.10.20.30");
  assert.equal(clientIp(new Request("https://x.test")), "unknown");
});
