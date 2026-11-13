import { test } from "node:test";
import assert from "node:assert/strict";
import { detectDialCode } from "../src/lib/phone/countries.ts";
import { applyPhoneInput, parseStoredPhone, displayFor, localDigitsOf } from "../src/lib/phone/phone-display.ts";

test("detecta o código do país pelo começo do número", () => {
  assert.equal(detectDialCode("351912345678"), "351");
  assert.equal(detectDialCode("15551234567"), "1");
  assert.equal(detectDialCode("5511999998888"), "55");
  assert.equal(detectDialCode("9999"), null);
});

test("digitar + e o código troca o país e separa o número", () => {
  const r = applyPhoneInput("+351 912 345 678", "55");
  assert.equal(r.dial, "351");
  assert.equal(r.display, "+351 912345678");
});

test("sem +, mantém o país e aplica a máscara brasileira", () => {
  const r = applyPhoneInput("11999998888", "55");
  assert.equal(r.dial, "55");
  assert.equal(r.display, "(11) 99999-8888");
});

test("trocar o país no combo preserva o número", () => {
  const local = localDigitsOf("+351 912345678", "351");
  assert.equal(local, "912345678");
  assert.equal(displayFor("1", local), "+1 912345678");
});

test("lê telefone salvo, brasileiro e internacional", () => {
  assert.deepEqual(parseStoredPhone("+1 555 123 4567"), { dial: "1", display: "+1 5551234567" });
  assert.deepEqual(parseStoredPhone("11999998888"), { dial: "55", display: "(11) 99999-8888" });
});
