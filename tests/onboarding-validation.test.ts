import { test } from "node:test";
import assert from "node:assert/strict";
import { isValidCpf, isValidWhatsapp, isValidCep, formatCepDisplay, isValidUf } from "../src/lib/validation/br.ts";
import { validateOwnerData } from "../src/lib/validation/owner-data.ts";

test("CPF: aceita CPF com dígitos verificadores corretos, com ou sem máscara", () => {
  assert.equal(isValidCpf("123.456.789-09"), true);
  assert.equal(isValidCpf("12345678909"), true);
});

test("CPF: rejeita dígitos verificadores errados, sequências iguais e tamanho errado", () => {
  assert.equal(isValidCpf("123.456.789-10"), false);
  assert.equal(isValidCpf("11111111111"), false);
  assert.equal(isValidCpf("1234567890"), false);
  assert.equal(isValidCpf(""), false);
});

test("WhatsApp: aceita fixo (10) e celular (11) com DDD", () => {
  assert.equal(isValidWhatsapp("(11) 3456-7890"), true);
  assert.equal(isValidWhatsapp("(11) 98765-4321"), true);
});

test("WhatsApp: rejeita sem DDD, DDD iniciado em 0 e tamanho errado", () => {
  assert.equal(isValidWhatsapp("98765-4321"), false);
  assert.equal(isValidWhatsapp("(01) 98765-4321"), false);
  assert.equal(isValidWhatsapp("119876"), false);
});

test("CEP: valida 8 dígitos e formata como 00000-000", () => {
  assert.equal(isValidCep("01310-100"), true);
  assert.equal(isValidCep("0131010"), false);
  assert.equal(formatCepDisplay("01310100"), "01310-100");
  assert.equal(formatCepDisplay("013101"), "01310-1");
});

test("UF: aceita as 27 siglas e rejeita o resto", () => {
  assert.equal(isValidUf("sp"), true);
  assert.equal(isValidUf("XX"), false);
});

const dadosValidos = {
  fullName: "Flavia de Souza",
  whatsapp: "(11) 98765-4321",
  cpf: "123.456.789-09",
  cep: "01310-100",
  logradouro: "Av. Paulista",
  numero: "1000",
  complemento: "sala 2",
  bairro: "Bela Vista",
  cidade: "São Paulo",
  uf: "sp",
  planCode: "essencial",
};

test("dados do dono: normaliza e devolve valor pronto para salvar", () => {
  const r = validateOwnerData(dadosValidos);
  assert.ok("value" in r);
  assert.equal(r.value.whatsapp, "11987654321");
  assert.equal(r.value.cpf, "12345678909");
  assert.equal(r.value.cep, "01310-100");
  assert.equal(r.value.uf, "SP");
  assert.equal(r.value.complemento, "sala 2");
});

test("dados do dono: complemento e bairro vazios viram null", () => {
  const r = validateOwnerData({ ...dadosValidos, complemento: "  ", bairro: "" });
  assert.ok("value" in r);
  assert.equal(r.value.complemento, null);
  assert.equal(r.value.bairro, null);
});

test("dados do dono: CPF obrigatório e validado", () => {
  const r = validateOwnerData({ ...dadosValidos, cpf: "" });
  assert.ok("error" in r);
  assert.match(r.error, /CPF/);
});

test("dados do dono: exige plano", () => {
  const r = validateOwnerData({ ...dadosValidos, planCode: "" });
  assert.ok("error" in r);
  assert.match(r.error, /plano/);
});

test("dados do dono: exige número e logradouro", () => {
  assert.ok("error" in validateOwnerData({ ...dadosValidos, numero: "" }));
  assert.ok("error" in validateOwnerData({ ...dadosValidos, logradouro: "" }));
});
