import { test } from "node:test";
import assert from "node:assert/strict";
import { getCurrentOrganizationId, getCurrentProfile } from "../src/lib/auth/current-organization.ts";

// Mock mínimo do cliente Supabase: um usuário autenticado e uma linha de perfil.
function fakeSupabase(profile: Record<string, unknown> | null, user: { id: string } | null = { id: "user-1" }) {
  // Salão que o banco libera: o mesmo critério de my_current_organization().
  const accessible = profile?.active_organization_id ?? null;
  return {
    auth: {
      getUser: async () => ({ data: { user }, error: null }),
    },
    rpc: async (name: string) => (name === "my_current_organization" ? { data: accessible, error: null } : { data: null, error: { message: "rpc desconhecida" } }),
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: profile, error: null }),
        }),
      }),
    }),
  };
}

test("salão ativo válido é o salão atual", async () => {
  const supabase = fakeSupabase({ organization_id: "salao-a", active_organization_id: "salao-a", role: "owner" });
  assert.equal(await getCurrentOrganizationId(supabase), "salao-a");
});

test("salão bloqueado (banco não libera) não aparece como salão atual", async () => {
  // O perfil ainda aponta para o salão, mas o banco não libera: o app não pode usá-lo.
  const supabase = {
    ...fakeSupabase({ organization_id: "salao-a", active_organization_id: "salao-a", role: "owner" }),
    rpc: async () => ({ data: null, error: null }),
  };
  assert.equal(await getCurrentOrganizationId(supabase), null);
});

test("vínculo desativado (salão ativo nulo) não cai no salão do perfil", async () => {
  // Caso Fase F: o perfil ainda aponta para o salão desativado, mas o salão ativo ficou nulo.
  const supabase = fakeSupabase({ organization_id: "salao-desativado", active_organization_id: null, role: "professional" });
  assert.equal(await getCurrentOrganizationId(supabase), null);
  const profile = await getCurrentProfile(supabase);
  assert.equal(profile?.organizationId, null);
  assert.equal(profile?.role, "professional");
});

test("sem usuário autenticado não há salão", async () => {
  const supabase = fakeSupabase({ organization_id: "salao-a", active_organization_id: "salao-a", role: "owner" }, null);
  assert.equal(await getCurrentOrganizationId(supabase), null);
});

test("perfil inexistente não há salão", async () => {
  assert.equal(await getCurrentOrganizationId(fakeSupabase(null)), null);
});
