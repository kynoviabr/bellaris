// Endereço público do logo de um salão. Retorna null quando o salão ainda não enviou imagem.
export function getSalonLogoUrl(logoPath: string | null | undefined): string | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!logoPath || !base) return null;
  return `${base}/storage/v1/object/public/salon-logos/${logoPath}`;
}
