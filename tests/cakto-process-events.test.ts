import { test } from "node:test";
import assert from "node:assert/strict";
import { extractCaktoEventFields } from "../src/lib/cakto/process-events.ts";

test("extrai oferta, assinatura e intenção do evento de compra aprovada", () => {
  const f = extractCaktoEventFields({
    event: "purchase_approved",
    data: {
      id: "ord-1",
      offer: { id: "399rzv4" },
      subscription: { id: "sub-1" },
      utm_content: "6c3f2a1e-2f0b-4b8e-9a3d-1d2e3f4a5b6c",
    },
  });
  assert.equal(f.eventType, "purchase_approved");
  assert.equal(f.offerId, "399rzv4");
  assert.equal(f.subscriptionId, "sub-1");
  assert.equal(f.intentId, "6c3f2a1e-2f0b-4b8e-9a3d-1d2e3f4a5b6c");
  assert.equal(f.orderId, "ord-1");
});

test("utm_content que não é UUID não vira intenção", () => {
  const f = extractCaktoEventFields({ event: "purchase_approved", data: { utm_content: "qualquer-texto" } });
  assert.equal(f.intentId, null);
});

test("evento sem dados não quebra", () => {
  const f = extractCaktoEventFields({ event: "refund" });
  assert.equal(f.eventType, "refund");
  assert.equal(f.offerId, null);
  assert.equal(f.subscriptionId, null);
});
