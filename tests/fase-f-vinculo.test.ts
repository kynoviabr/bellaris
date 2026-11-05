import { test } from "node:test";
import assert from "node:assert/strict";
import { getCurrentOrganizationId, getCurrentProfile } from "../src/lib/auth/current-organization.ts";

// Mock mínimo do cliente Supabase: um usuário autenticado e uma linha de perfil.
function fakeSupabase(profile: Record<string, unknown> | null, user: { id: string } | null = { id: "user-1" }) {
  return {
    auth: {
      getUser: async () => ({ data: { user }, error: null }),
    },
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
