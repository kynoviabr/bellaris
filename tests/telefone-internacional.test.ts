import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeWhatsappPhone } from "../src/lib/whatsapp/reminders.ts";

test("telefone brasileiro continua sendo tratado com 55 na frente", () => {
  assert.equal(normalizeWhatsappPhone("(11) 99999-8888"), "5511999998888");
});

test("telefone internacional com + vale o que foi digitado, sem 55", () => {
  assert.equal(normalizeWhatsappPhone("+1 555 123 4567"), "15551234567");
  assert.equal(normalizeWhatsappPhone("+351 912 345 678"), "351912345678");
});

test("número internacional curto ou longo demais é recusado", () => {
  assert.equal(normalizeWhatsappPhone("+12"), null);
  assert.equal(normalizeWhatsappPhone("+1234567890123456"), null);
});
