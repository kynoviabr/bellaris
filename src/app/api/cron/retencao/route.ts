import { NextResponse } from "next/server";
import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Roda todo dia (ver vercel.json). Apaga anamnese e fotos e anonimiza clientes
// de salões cancelados há 90 dias ou mais. Exige o segredo CRON_SECRET.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase não configurado." }, { status: 500 });
  }

  const supabase = await createAdminClient();
  if (!supabase) return NextResponse.json({ error: "Supabase não configurado." }, { status: 500 });

  const { data: due, error: dueError } = await supabase.rpc("retention_due_salons");
  if (dueError) return NextResponse.json({ error: dueError.message }, { status: 500 });

  const results: Record<string, unknown>[] = [];
  for (const row of (due ?? []) as { organization_id: string }[]) {
    const { data, error } = await supabase.rpc("retention_purge_salon", { p_org: row.organization_id });
    if (error) {
      results.push({ organization_id: row.organization_id, error: error.message });
      continue;
    }

    const { photo_paths, ...summary } = (data ?? {}) as { photo_paths?: string[] } & Record<string, unknown>;
    const paths = Array.isArray(photo_paths) ? photo_paths : [];
    let removidos = 0;
    const falhas: string[] = [];
    for (let i = 0; i < paths.length; i += 100) {
      const chunk = paths.slice(i, i + 100);
      const { error: removeError } = await supabase.storage.from("client-photos").remove(chunk);
      if (removeError) falhas.push(...chunk);
      else removidos += chunk.length;
    }

    results.push({
      organization_id: row.organization_id,
      ...summary,
      arquivos_removidos: removidos,
      // Arquivos que sobraram no armazenamento precisam de limpeza manual.
      arquivos_com_falha: falhas.length,
    });
  }

  return NextResponse.json({ processed: results.length, results });
}
