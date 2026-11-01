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
export type ProfessionalClient={id:string;name:string;phone:string;email:string|null;marketing_consent:boolean;preferred_professional_id:string|null;last_visit:string|null;can_edit:boolean};
export async function listMyClients():Promise<{rows:ProfessionalClient[];error?:string}>{
 try{
  const {supabase,organizationId,professionalId}=await context();
  const {data:appointments,error:appointmentsError}=await supabase.from("appointments").select("client_id,starts_at").eq("organization_id",organizationId).eq("professional_id",professionalId).order("starts_at",{ascending:false}).limit(1000);
  if(appointmentsError)throw appointmentsError;
  const visits=new Map<string,string>();
  for(const a of appointments||[])if(a.client_id&&!visits.has(a.client_id))visits.set(a.client_id,a.starts_at);
  const {data,error}=await supabase.from("clients").select("id,name,phone,email,marketing_consent,preferred_professional_id").eq("organization_id",organizationId).order("name").limit(1000);
  if(error)throw error;
  return {rows:(data||[]).filter(c=>c.preferred_professional_id===professionalId||visits.has(c.id)).map(c=>({...c,last_visit:visits.get(c.id)||null,can_edit:c.preferred_professional_id===professionalId}))};
 }catch(e){return {rows:[],error:e instanceof Error?e.message:"Erro ao carregar clientes"}}
}
export async function saveMyClient(input:{id?:string;name:string;phone:string;email?:string;marketing_consent?:boolean}):Promise<{success:boolean;error?:string}>{
 try{
  const {supabase,organizationId,professionalId}=await context();
  const name=input.name.trim(),phone=input.phone.replace(/\D/g,""),email=input.email?.trim()||null;
  if(name.length<2||phone.length<10||phone.length>13) return {success:false,error:"Informe nome e WhatsApp válido"};
  if(input.id){
   const {data,error}=await supabase.from("clients").update({name,phone,phone_normalized:phone,email}).eq("id",input.id).eq("organization_id",organizationId).eq("preferred_professional_id",professionalId).select("id").maybeSingle();
   if(error)throw error;
   if(!data)return {success:false,error:"Esta cliente não pode ser alterada por seu perfil"};
  }else{
   const {error}=await supabase.from("clients").insert({organization_id:organizationId,preferred_professional_id:professionalId,name,phone,phone_normalized:phone,email,marketing_consent:input.marketing_consent===true});
   if(error){if(error.code==="23505")return {success:false,error:"WhatsApp já cadastrado neste salão. Solicite o vínculo à gestora."};throw error}
  }
  return {success:true};
 }catch(e){return {success:false,error:e instanceof Error?e.message:"Não foi possível salvar"}}
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
