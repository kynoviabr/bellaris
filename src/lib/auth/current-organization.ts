/**
 * Ponto único de resolução do usuário autenticado e do seu salão.
 *
 * O salão vem do salão ativo do perfil (profiles.active_organization_id), que o banco
 * só aceita com vínculo ativo do usuário. Sem salão ativo, usa profiles.organization_id.
 * Por isso nenhuma action deve ler profiles para escolher o salão ou o papel.
 */
export type CurrentProfile = {
  organizationId: string | null;
  role: string | null;
};

/**
 * Perfil (salão e papel) do usuário autenticado.
 * Retorna null se não houver usuário, se a leitura falhar ou se não existir perfil.
 */
export async function getCurrentProfile(supabase: any): Promise<CurrentProfile | null> {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return null;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("organization_id,active_organization_id,role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) return null;
  // Salão ativo (validado por vínculo no banco); cai no salão do perfil se ainda não houver ativo.
  const organizationId = profile.active_organization_id ?? profile.organization_id ?? null;
  return { organizationId, role: profile.role ?? null };
}

/** Salão do usuário autenticado, ou null (ver getCurrentProfile). */
export async function getCurrentOrganizationId(supabase: any): Promise<string | null> {
  const profile = await getCurrentProfile(supabase);
  return profile?.organizationId || null;
}
