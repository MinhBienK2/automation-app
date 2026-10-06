import type { AppScreen } from "../shared/types/workspaceContracts";

const ROUTE_CONFIGS: Record<AppScreen, { allowedRoles?: ("admin" | "user")[] }> = {
  overview: { allowedRoles: ["admin", "user"] },
  projects: { allowedRoles: ["admin", "user"] },
  detail: { allowedRoles: ["admin", "user"] },
  "subflow-detail": { allowedRoles: ["admin", "user"] },
  settings: { allowedRoles: ["admin", "user"] },
  schedules: { allowedRoles: ["admin", "user"] },
  "settings-help": { allowedRoles: ["admin", "user"] },
  "admin-users": { allowedRoles: ["admin"] },
  "admin-backups": { allowedRoles: ["admin"] },
};

export function isRouteAllowed(
  screen: AppScreen,
  mode: "pending" | "team",
  role?: "admin" | "user",
): boolean {
  const config = ROUTE_CONFIGS[screen];
  if (!config) return true;
  if (mode === "team") {
    if (!role) return false;
    return config.allowedRoles?.includes(role) ?? true;
  }
  return false;
}

export function getActiveSidebarItem(screen: AppScreen): string {
  if (screen === "settings" || screen === "settings-help") return "settings";
  if (screen === "schedules") return "schedules";
  if (screen === "overview") return "overview";
  if (screen === "admin-users" || screen === "admin-backups") return screen;
  return "projects";
}
