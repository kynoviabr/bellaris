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
