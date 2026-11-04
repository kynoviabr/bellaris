/**
 * Ponto único de resolução do salão do usuário autenticado.
 *
 * Hoje: o salão vem de profiles.organization_id (um usuário = um salão).
 * Quando a rede de salões for implementada, esta função passa a devolver o
 * salão ativo, validado contra os vínculos do usuário. Por isso nenhuma action
 * deve ler profiles.organization_id diretamente para escolher o salão.
 *
 * Retorna null se não houver usuário autenticado, se a leitura do perfil
 * falhar ou se o perfil não tiver salão.
 */
export async function getCurrentOrganizationId(supabase: any): Promise<string | null> {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return null;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) return null;
  return profile?.organization_id || null;
}
