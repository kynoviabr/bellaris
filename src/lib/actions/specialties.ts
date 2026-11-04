"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentOrganizationId } from "@/lib/auth/current-organization";
import { revalidatePath } from "next/cache";

export async function getSpecialties() {
  const supabase = await createClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("specialties")
    .select("id, name, active")
    .order("name");

  if (error) {
    console.error("Error fetching specialties:", error);
    return [];
  }

  return data;
}

export async function createSpecialtyRecord(name: string) {
  const supabase = await createClient();
  if (!supabase) return { success: false, error: "No connection" };

  const orgId = await getCurrentOrganizationId(supabase);
  if (!orgId) return { success: false, error: "Organização não encontrada" };

  const { data, error } = await supabase
    .from("specialties")
    .insert([{ organization_id: orgId, name }])
    .select()
    .single();

  if (error) {
    console.error("Error creating specialty:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/");
  return { success: true, data };
}
