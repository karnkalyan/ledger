export type MemberRoleType = "OWNER" | "ADMIN" | "MANAGER" | "ACCOUNTANT" | "HR" | "SALES" | "VIEWER";

export const ROLE_ALLOWED_MODULES: Record<string, string[]> = {
  OWNER: ["*"],
  ADMIN: ["*"],
  MANAGER: ["*"],
  ACCOUNTANT: [
    "invoices",
    "quotes",
    "income",
    "expenses",
    "banking",
    "bank",
    "loans",
    "reports",
    "crm",
    "contacts",
    "sales",
    "purchase",
    "stock",
    "tasks",
    "reminders",
    "menu",
    "statement",
  ],
  SALES: [
    "crm",
    "contacts",
    "leads",
    "sales",
    "quotes",
    "invoices",
    "income",
    "stock",
    "projects",
    "tasks",
    "worklogs",
    "wallets",
    "reminders",
    "menu",
    "statement",
  ],
  HR: [
    "staff",
    "payroll",
    "leaves",
    "tasks",
    "reminders",
    "menu",
  ],
  VIEWER: ["*"],
};

export function canAccessModule(role?: string | null, moduleName?: string | null): boolean {
  if (!role || role === "OWNER" || role === "ADMIN" || role === "MANAGER" || role === "SUPER_ADMIN") return true;
  if (!moduleName) return true;
  const list = ROLE_ALLOWED_MODULES[role] || [];
  if (list.includes("*")) return true;
  return list.includes(moduleName.toLowerCase());
}
