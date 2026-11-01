"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function getProfessionalCommissions(profId: string) {
  const supabase = await createClient();
  if (!supabase) return { commissions: [], stats: { pending: 0, paid: 0 } };

  const { data, error } = await supabase
    .from("commissions")
    .select(`
      id,
      amount,
      status,
      created_at,
      appointment_item:appointment_items(
        id,
        service:services(name)
      )
    `)
    .eq("professional_id", profId)
    .order("created_at", { ascending: false });

  if (error || !data) return { commissions: [], stats: { pending: 0, paid: 0 } };

  let pending = 0;
  let paid = 0;

  const commissions = data.map((c: any) => {
    if (c.status === 'generated') pending += Number(c.amount);
    if (c.status === 'paid') paid += Number(c.amount);

    return {
      id: c.id,
      amount: Number(c.amount),
      status: c.status,
      date: new Date(c.created_at).toLocaleDateString("pt-BR"),
      service: c.appointment_item?.service?.name || "Serviço"
    };
  });

  return { commissions, stats: { pending, paid } };
}

// Marca as comissões pendentes como pagas e grava a despesa correspondente
// numa única transação no banco (função public.pay_commissions). O total é
// calculado no banco, não recebido da tela.
export async function payCommissions(profId: string, commissionIds?: string[]) {
  const supabase = await createClient();
  if (!supabase) return { success: false, error: "Sem conexão com o banco" };

  // Lista vazia nunca deve virar "pagar todas": só nulo/undefined paga todas as pendentes.
  if (commissionIds !== undefined && commissionIds.length === 0) {
    return { success: false, error: "Selecione ao menos uma comissão" };
  }

  const { data, error } = await supabase.rpc("pay_commissions", {
    p_professional_id: profId,
    p_commission_ids: commissionIds ?? null,
  });

  if (error) return { success: false, error: error.message };

  revalidatePath("/");
  return { success: true, total: Number(data) };
}
