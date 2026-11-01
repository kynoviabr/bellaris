"use client";
import { useEffect,useState } from "react";
import { getRolePermissions,saveRolePermission } from "@/lib/actions/role-permissions";
const labels:Record<string,string>={dashboard:"Painel",agenda:"Agenda",clients:"Clientes",services:"Serviços",professionals:"Profissionais",attendance:"Atendimentos",finance:"Financeiro",packages:"Pacotes",inventory:"Estoque",automations:"Automações",reports:"Relatórios",online:"Agendamento online",settings:"Configurações"};
const actions:Record<string,string>={view:"Visualizar",create:"Cadastrar",update:"Editar",delete:"Excluir",approve:"Aprovar"};
type Permission={role:string;module:string;operation:string;enabled:boolean};
export function RolePermissionsManager(){
 const [rows,setRows]=useState<Permission[]>([]);const [role,setRole]=useState<"professional"|"staff">("professional");
 const [error,setError]=useState("");const [busy,setBusy]=useState("");
 useEffect(()=>{getRolePermissions().then(r=>{setRows(r.rows);setError(r.error||"")})},[]);
 async function change(module:string,operation:string,enabled:boolean){
  const key=role+":"+module+":"+operation;setBusy(key);setError("");
  const result=await saveRolePermission(role,module,operation,enabled);
  if(result.error)setError(result.error);else setRows(prev=>[...prev.filter(r=>!(r.role===role&&r.module===module&&r.operation===operation)),{role,module,operation,enabled}]);
  setBusy("");
 }
 return <section className="rounded-lg border bg-white p-5 shadow-sm">
 <h3 className="text-lg font-semibold">Perfis e permissões</h3>
 <p className="mt-1 text-sm text-muted">Configure permissões por perfil para este salão. A proteção de dados continua limitada ao salão e à profissional autenticada.</p>
 <label className="mt-5 block text-sm font-medium">Perfil</label>
 <select className="field-input mt-2 max-w-xs" value={role} onChange={e=>setRole(e.target.value as "professional"|"staff")}><option value="professional">Profissional</option><option value="staff">Equipe / atendimento</option></select>
 {error&&<p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
 <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[620px] text-sm"><thead><tr className="border-b text-left"><th className="py-3">Módulo</th>{Object.entries(actions).map(([k,v])=><th key={k} className="px-2 text-center">{v}</th>)}</tr></thead><tbody>{Object.entries(labels).map(([module,label])=><tr key={module} className="border-b"><td className="py-3 font-medium">{label}</td>{Object.keys(actions).map(operation=>{const key=role+":"+module+":"+operation;const checked=rows.some(r=>r.role===role&&r.module===module&&r.operation===operation&&r.enabled);const locked=role==="professional"&&["professionals","settings"].includes(module);return <td key={operation} className="px-2 text-center"><input type="checkbox" aria-label={label+" - "+actions[operation]} checked={checked} disabled={locked||busy!==""} onChange={e=>change(module,operation,e.target.checked)}/></td>})}</tr>)}</tbody></table></div>
 <p className="mt-4 text-xs text-muted">As permissões são gravadas por salão. Novas liberações só se tornam operacionais quando o módulo e as políticas de segurança correspondentes estiverem integrados.</p>
 </section>;
}
