import {
  BadgeDollarSign, Boxes, BriefcaseBusiness, Building2, CalendarClock, ClipboardCheck, Clock,
  FileCheck2, FileText, FolderKanban, Gauge, HandCoins, House, Landmark, ListTodo, PackageSearch,
  ReceiptText, Settings, ShoppingCart, SquareKanban, TrendingUp, UserRoundSearch, UsersRound, Wallet, WalletCards,
  type LucideIcon
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  color: string;
}

export const officeNav: NavItem[] = [
  { href: "", label: "Dashboard", icon: Gauge, color: "#6366f1" }, // Indigo
  { href: "/projects", label: "Projects", icon: FolderKanban, color: "#8b5cf6" }, // Purple
  { href: "/tasks", label: "Tasks", icon: SquareKanban, color: "#2563eb" }, // Blue
  { href: "/worklogs", label: "Work Logs", icon: Clock, color: "#0ea5e9" }, // Sky
  { href: "/wallets", label: "Wallets", icon: Wallet, color: "#06b6d4" }, // Cyan
  { href: "/sales", label: "Sales & Orders", icon: ShoppingCart, color: "#10b981" }, // Emerald
  { href: "/purchase", label: "Purchase", icon: PackageSearch, color: "#f59e0b" }, // Amber
  { href: "/stock", label: "Stock", icon: Boxes, color: "#06b6d4" }, // Cyan
  { href: "/crm?type=CUSTOMER", label: "Customers", icon: UsersRound, color: "#3b82f6" }, // Blue
  { href: "/crm?type=VENDOR", label: "Vendors", icon: Building2, color: "#8b5cf6" }, // Purple
  { href: "/crm", label: "All Contacts (CRM)", icon: UserRoundSearch, color: "#7c3aed" }, // Violet
  { href: "/statement", label: "Party Statement", icon: FileText, color: "#0284c7" }, // Sky
  { href: "/leads", label: "Leads", icon: BriefcaseBusiness, color: "#f43f5e" }, // Rose
  { href: "/invoices", label: "Invoices", icon: ReceiptText, color: "#0d9488" }, // Teal
  { href: "/quotes", label: "Quotes", icon: FileText, color: "#0284c7" }, // Sky
  { href: "/income", label: "Income", icon: TrendingUp, color: "#16a34a" }, // Green
  { href: "/expenses", label: "Expenses", icon: WalletCards, color: "#ef4444" }, // Red
  { href: "/banking", label: "Banking & Accounts", icon: Landmark, color: "#4f46e5" }, // Indigo
  { href: "/staff", label: "Staff", icon: BriefcaseBusiness, color: "#d97706" }, // Amber
  { href: "/payroll", label: "Payroll", icon: HandCoins, color: "#c026d3" }, // Fuchsia
  { href: "/leaves", label: "Leave / HRM", icon: CalendarClock, color: "#ea580c" }, // Orange
  { href: "/licenses", label: "Licenses", icon: FileCheck2, color: "#84cc16" }, // Lime
  { href: "/loans", label: "Loans & Lending", icon: HandCoins, color: "#db2777" }, // Pink
  { href: "/reminders", label: "Reminders", icon: ClipboardCheck, color: "#eab308" }, // Yellow
  { href: "/reports", label: "Reports", icon: BadgeDollarSign, color: "#059669" }, // Emerald
  { href: "/users", label: "User Management", icon: UsersRound, color: "#6366f1" }, // Indigo
  { href: "/settings", label: "Company Settings", icon: Settings, color: "#64748b" }, // Slate
];

export const personalNav: NavItem[] = [
  { href: "", label: "Dashboard", icon: House, color: "#6366f1" },
  { href: "/income", label: "Personal Income", icon: TrendingUp, color: "#16a34a" },
  { href: "/expenses", label: "Home Expenses", icon: WalletCards, color: "#ef4444" },
  { href: "/loans", label: "Loans & Lending", icon: HandCoins, color: "#db2777" },
  { href: "/banking", label: "Bank Accounts", icon: Landmark, color: "#0891b2" },
  { href: "/tasks", label: "Tasks", icon: ListTodo, color: "#2563eb" },
  { href: "/reminders", label: "Reminders", icon: CalendarClock, color: "#eab308" },
  { href: "/reports", label: "Monthly Report", icon: BadgeDollarSign, color: "#8b5cf6" },
  { href: "/settings", label: "Settings", icon: Settings, color: "#64748b" },
];
