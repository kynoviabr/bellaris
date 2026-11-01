/**
 * Authorization defaults for Bellaris. These values control UI visibility only.
 * Database RLS and server actions MUST independently enforce every operation.
 */
export type StudioRole = "owner" | "admin" | "staff" | "professional" | "platform_master";
export type StudioModule = "dashboard" | "agenda" | "clients" | "services" | "professionals" | "attendance" | "finance" | "inventory" | "automations" | "reports" | "online" | "settings" | "packages";
export type StudioOperation = "view" | "create" | "update" | "delete" | "approve";

const professionalAccess: Partial<Record<StudioModule, readonly StudioOperation[]>> = {
  dashboard: ["view"],
  agenda: ["view"],
  clients: [],
  services: ["view"],
  attendance: [],
  finance: [],
  inventory: [],
  reports: [],
  online: ["view"],
  settings: ["view"],
};

export function canAccess(role: StudioRole, module: StudioModule, operation: StudioOperation = "view"): boolean {
  if (role === "owner" || role === "admin") return true;
  if (role === "professional") return professionalAccess[module]?.includes(operation) ?? false;
  return false;
}

export const professionalPermissionRoadmap: Partial<Record<StudioModule, readonly StudioOperation[]>> = {
  dashboard: ["view"],
  agenda: ["view", "create", "update"],
  clients: ["view", "create", "update"],
  services: ["view"],
  attendance: ["view", "create", "update"],
  finance: ["view"],
  inventory: ["view"],
  reports: ["view"],
  online: ["view"],
  settings: ["view", "update"],
};
