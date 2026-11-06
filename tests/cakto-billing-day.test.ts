import { test } from "node:test";
import assert from "node:assert/strict";
import { businessDayOrdinal, nthBusinessDay, saoPauloDate } from "../src/lib/cakto/billing-day.ts";

test("ordinal conta só dias úteis até a data", () => {
  // Novembro de 2026: 2 é segunda. Então 6 é o 5º dia útil.
  assert.equal(businessDayOrdinal({ year: 2026, month: 11, day: 6 }), 5);
  assert.equal(businessDayOrdinal({ year: 2026, month: 11, day: 1 }), 0);
});

test("nthBusinessDay devolve a data do N-ésimo dia útil", () => {
  assert.equal(nthBusinessDay(2026, 11, 5), "2026-11-06");
  assert.equal(nthBusinessDay(2026, 11, 1), "2026-11-02");
});

test("liberação em fim de semana mantém o ordinal do último dia útil", () => {
  // 7 de novembro de 2026 é sábado: o ordinal continua 5, e o vencimento cai na sexta, 6.
  const ordinal = businessDayOrdinal({ year: 2026, month: 11, day: 7 });
  assert.equal(ordinal, 5);
  assert.equal(nthBusinessDay(2026, 11, ordinal), "2026-11-06");
});

test("saoPauloDate usa o calendário de São Paulo, não o UTC", () => {
  // 2026-11-07T01:30Z ainda é 6 de novembro em São Paulo (UTC-3).
  assert.deepEqual(saoPauloDate(new Date("2026-11-07T01:30:00Z")), { year: 2026, month: 11, day: 6 });
});
