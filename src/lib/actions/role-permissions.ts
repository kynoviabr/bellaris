"use server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/current-organization";
import { revalidatePath } from "next/cache";

const modules = ["dashboard","agenda","clients","services","professionals","attendance","finance","packages","inventory","automations","reports","online","settings"] as const;
const operations = ["view","create","update","delete","approve"] as const;
type Role = "professional" | "staff" | "admin";
export async function getRolePermissions() {
 const supabase=await createClient(); if(!supabase) return {error:"Sessão indisponível",rows:[]};
 const {data:{user}}=await supabase.auth.getUser();if(!user)return {error:"Não autenticado",rows:[]};
 const profile=await getCurrentProfile(supabase);
 if(!profile?.organizationId || !["owner","admin"].includes(profile.role ?? "")) return {error:"Acesso negado",rows:[]};
 const {data,error}=await supabase.from("role_permissions").select("role,module,operation,enabled").eq("organization_id",profile.organizationId);
 return {error:error?.message,rows:data??[]};
}
export async function saveRolePermission(role:Role,module:string,operation:string,enabled:boolean){
 if(!["professional","staff"].includes(role) || !modules.includes(module as typeof modules[number]) || !operations.includes(operation as typeof operations[number])) return {error:"Permissão inválida"};
 // Access to professionals and settings is reserved for management.
 if((module==="professionals" || module==="settings") && role==="professional" && enabled) return {error:"Módulo reservado à gestão"};
 const supabase=await createClient();if(!supabase)return {error:"Sessão indisponível"};
 const {data:{user}}=await supabase.auth.getUser();if(!user)return {error:"Não autenticado"};
 const profile=await getCurrentProfile(supabase);
 if(!profile?.organizationId || !["owner","admin"].includes(profile.role ?? ""))return {error:"Acesso negado"};
 const {error}=await supabase.from("role_permissions").upsert({organization_id:profile.organizationId,role,module,operation,enabled,updated_at:new Date().toISOString()},{onConflict:"organization_id,role,module,operation"});
 if(!error)revalidatePath("/");
 return {error:error?.message};
}
