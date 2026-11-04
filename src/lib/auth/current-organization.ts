/**
 * Ponto único de resolução do usuário autenticado e do seu salão.
 *
 * Hoje: o salão vem de profiles.organization_id (um usuário = um salão).
 * Quando a rede de salões for implementada, getCurrentProfile passa a devolver
 * o salão ativo, validado contra os vínculos do usuário. Por isso nenhuma action
 * deve ler profiles para escolher o salão ou o papel.
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
    .select("organization_id,role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) return null;
  return { organizationId: profile.organization_id ?? null, role: profile.role ?? null };
}

/** Salão do usuário autenticado, ou null (ver getCurrentProfile). */
export async function getCurrentOrganizationId(supabase: any): Promise<string | null> {
  const profile = await getCurrentProfile(supabase);
  return profile?.organizationId || null;
}
