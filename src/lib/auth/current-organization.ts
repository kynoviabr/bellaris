/**
 * Ponto único de resolução do usuário autenticado e do seu salão.
 *
 * O salão vem de my_current_organization(), a mesma regra que o banco usa nas políticas de acesso.
 * Sem salão liberado (sem vínculo ativo, vínculo desativado ou salão/rede bloqueados), retorna null.
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
  // Salão que o banco libera agora: exige vínculo ativo e salão e rede sem bloqueio.
  // Salão bloqueado ou vínculo desativado devolve null, e as telas tratam esse caso.
  const { data: accessibleOrg, error: accessError } = await supabase.rpc("my_current_organization");
  if (accessError) return null;
  return { organizationId: (accessibleOrg as string | null) ?? null, role: profile.role ?? null };
}

/** Salão do usuário autenticado, ou null (ver getCurrentProfile). */
export async function getCurrentOrganizationId(supabase: any): Promise<string | null> {
  const profile = await getCurrentProfile(supabase);
  return profile?.organizationId || null;
}
