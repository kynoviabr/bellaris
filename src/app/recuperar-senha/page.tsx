"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
export default function Page(){
 const [email,setEmail]=useState("");
 const [msg,setMsg]=useState("");
 async function submit(e:React.FormEvent<HTMLFormElement>){
 e.preventDefault();
 const supabase=createClient();
 if(!supabase){setMsg("Serviço indisponível");return;}
 const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo:window.location.origin+"/redefinir-senha"});
 setMsg(error?error.message:"Verifique sua caixa de entrada.");
 }
 return <main style={{padding:32}}><h1>Recuperar senha</h1><form onSubmit={submit}><input type="email" required value={email} onChange={e=>setEmail(e.target.value)}/><button>Enviar link</button></form><p>{msg}</p></main>;
}