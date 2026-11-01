/**
 * Authorization defaults for Bellaris. These values control UI visibility only.
 * Database RLS and server actions MUST independently enforce every operation.
 */
export type StudioRole = "owner" | "admin" | "staff" | "professional" | "platform_master";
export type StudioModule = "dashboard" | "agenda" | "clients" | "services" | "professionals" | "attendance" | "finance" | "inventory" | "automations" | "reports" | "online" | "settings" | "packages";
export type StudioOperation = "view" | "create" | "update" | "delete" | "approve";

// Profissional: somente os próprios dados. Painel, Agenda (consulta), Atendimentos,
// Financeiro (somente as próprias comissões) e Relatórios (somente os próprios atendimentos).
const professionalAccess: Partial<Record<StudioModule, readonly StudioOperation[]>> = {
  dashboard: ["view"],
  agenda: ["view"],
  attendance: ["view"],
  finance: ["view"],
  reports: ["view"],
};

// Recepcionista (papel staff): operação do dia a dia. Sem Financeiro e sem Relatórios,
// que contêm dados sensíveis e ficam restritos à gestora.
const staffAccess: Partial<Record<StudioModule, readonly StudioOperation[]>> = {
  agenda: ["view", "create", "update"],
  clients: ["view", "create", "update"],
  services: ["view"],
  professionals: ["view"],
  attendance: ["view", "create", "update"],
  inventory: ["view", "create", "update"],
  automations: ["view", "create", "update"],
};

export function canAccess(role: StudioRole, module: StudioModule, operation: StudioOperation = "view"): boolean {
  if (role === "owner" || role === "admin") return true;
  if (role === "professional") return professionalAccess[module]?.includes(operation) ?? false;
  if (role === "staff") return staffAccess[module]?.includes(operation) ?? false;
  return false;
}

// Telas (menus) da interface mapeadas para o módulo de permissão.
// "commissions" é a parte de comissões do módulo financeiro.
export const viewModule: Record<string, StudioModule> = {
  dashboard: "dashboard",
  agenda: "agenda",
  clients: "clients",
  services: "services",
  professionals: "professionals",
  attendance: "attendance",
  finance: "finance",
  commissions: "finance",
  packages: "packages",
  inventory: "inventory",
  automations: "automations",
  reports: "reports",
  online: "online",
  settings: "settings",
};

// Linha da tabela role_permissions (matriz editável pela gestora em Configurações).
export type PermissionRow = { role: string; module: string; operation: string; enabled: boolean };

// Quando `rows` é informado, a matriz gravada no banco manda (owner/admin sempre liberados).
// Sem `rows`, usa os padrões do código.
export function canOpenView(role: StudioRole, view: string, rows?: PermissionRow[]): boolean {
  if (role === "owner" || role === "admin") return true;
  const moduleName = viewModule[view];
  if (!moduleName) return false;
  if (rows) return rows.some(r => r.role === role && r.module === moduleName && r.operation === "view" && r.enabled);
  return canAccess(role, moduleName, "view");
}
