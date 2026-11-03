"use server";
import { createClient } from "@/lib/supabase/server";

async function context() {
 const supabase=await createClient();
 if(!supabase) throw new Error("Sessão indisponível");
 const {data:{user}}=await supabase.auth.getUser();
 if(!user) throw new Error("Sessão expirada");
 const {data:profile}=await supabase.from("profiles").select("role,organization_id").eq("id",user.id).single();
 if(profile?.role!=="professional"||!profile.organization_id)throw new Error("Perfil sem permissão");
 const {data:professional}=await supabase.from("professionals").select("id").eq("user_id",user.id).eq("organization_id",profile.organization_id).single();
 if(!professional)throw new Error("Profissional não vinculada");
 return {supabase,organizationId:profile.organization_id,professionalId:professional.id};
}
// Aniversariantes do mês entre as clientes que a profissional já atendeu.
// Retorna só nome e dia/mês, sem data completa nem outros dados.
export async function listMyClientBirthdays():Promise<{rows:{id:string;name:string;day:number;month:number}[];error?:string}>{
 try{
  const {supabase,organizationId,professionalId}=await context();
  const {data:appointments,error:appointmentsError}=await supabase.from("appointments").select("client_id").eq("organization_id",organizationId).eq("professional_id",professionalId).limit(1000);
  if(appointmentsError)throw appointmentsError;
  const ids=Array.from(new Set((appointments||[]).map(a=>a.client_id).filter(Boolean))) as string[];
  if(ids.length===0)return {rows:[]};
  const {data:clients,error:clientsError}=await supabase.from("clients").select("id,name,birth_date").eq("organization_id",organizationId).in("id",ids).not("birth_date","is",null);
  if(clientsError)throw clientsError;
  const currentMonth=Number(new Intl.DateTimeFormat("en-CA",{month:"2-digit",timeZone:"America/Sao_Paulo"}).format(new Date()));
  const rows=(clients||[]).map(c=>{
   const [,m,d]=String(c.birth_date).split("-").map(Number);
   return {id:c.id as string,name:c.name as string,day:d,month:m};
  }).filter(c=>c.month===currentMonth).sort((a,b)=>a.day-b.day);
  return {rows};
 }catch(e:any){
  return {rows:[],error:e?.message||"Erro ao carregar aniversariantes"};
 }
}
