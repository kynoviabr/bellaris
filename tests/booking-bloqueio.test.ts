import { test } from "node:test";
import assert from "node:assert/strict";
import { getBookableOrgBySlug } from "../src/lib/services/public-booking.service.ts";

/** Mock mínimo: um salão com a situação de cadastro e a situação da assinatura informadas. */
function mockDb({ accessStatus, billing, rpcError = null }: { accessStatus: string; billing: string; rpcError?: any }) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: { id: "org-1", name: "Salão Teste", slug: "salao-teste", access_status: accessStatus },
            error: null,
          }),
        }),
      }),
    }),
    rpc: async (_fn: string, _args: unknown) => ({ data: billing, error: rpcError }),
  } as any;
}

test("salão ativo em dia recebe agendamento", async () => {
  const org = await getBookableOrgBySlug(mockDb({ accessStatus: "ativo", billing: "em_dia" }), "salao-teste");
  assert.ok(org);
  assert.equal(org.id, "org-1");
});

test("salão ativo com aviso de vencimento ainda recebe agendamento", async () => {
  const org = await getBookableOrgBySlug(mockDb({ accessStatus: "ativo", billing: "aviso" }), "salao-teste");
  assert.ok(org);
});

test("salão isento recebe agendamento", async () => {
  const org = await getBookableOrgBySlug(mockDb({ accessStatus: "ativo", billing: "isento" }), "salao-teste");
  assert.ok(org);
});

test("salão pendente (cadastro em análise) não recebe agendamento", async () => {
  const org = await getBookableOrgBySlug(mockDb({ accessStatus: "aguardando_aprovacao", billing: "em_dia" }), "salao-teste");
  assert.equal(org, null);
});

test("salão aguardando dados não recebe agendamento", async () => {
  const org = await getBookableOrgBySlug(mockDb({ accessStatus: "aguardando_dados", billing: "em_dia" }), "salao-teste");
  assert.equal(org, null);
});

test("salão em somente leitura não recebe agendamento", async () => {
  const org = await getBookableOrgBySlug(mockDb({ accessStatus: "ativo", billing: "somente_leitura" }), "salao-teste");
  assert.equal(org, null);
});

test("salão cancelado não recebe agendamento", async () => {
  const org = await getBookableOrgBySlug(mockDb({ accessStatus: "ativo", billing: "cancelada" }), "salao-teste");
  assert.equal(org, null);
});

test("salão sem plano não recebe agendamento", async () => {
  const org = await getBookableOrgBySlug(mockDb({ accessStatus: "ativo", billing: "sem_plano" }), "salao-teste");
  assert.equal(org, null);
});

test("erro ao consultar a assinatura não libera agendamento", async () => {
  const org = await getBookableOrgBySlug(
    mockDb({ accessStatus: "ativo", billing: "em_dia", rpcError: { code: "XX000", message: "falhou" } }),
    "salao-teste",
  );
  assert.equal(org, null);
});
