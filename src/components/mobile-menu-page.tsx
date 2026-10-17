"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Search,
  ReceiptText,
  FileText,
  ShoppingCart,
  PackageSearch,
  Boxes,
  Plus,
  Landmark,
  TrendingUp,
  WalletCards,
  UserCheck,
  HandCoins,
  BadgeDollarSign,
  UsersRound,
  Building2,
  BriefcaseBusiness,
  CalendarClock,
  Zap,
  Building,
  Milk,
  Settings,
  ShieldCheck,
  ChevronRight,
  ExternalLink,
  Sparkles,
  ArrowRight,
  Home,
  CheckCircle2,
} from "lucide-react";

interface MenuSection {
  title: string;
  description: string;
  color: string;
  items: {
    title: string;
    description: string;
    href: string;
    icon: any;
    badge?: string;
    subItems?: { label: string; href: string; isCreate?: boolean }[];
  }[];
}

export function MobileMenuPageContent({
  orgId,
  orgName,
  kind,
  taxNumber,
  currency,
  userRole,
}: {
  orgId: string;
  orgName: string;
  kind: string;
  taxNumber?: string | null;
  currency: string;
  userRole: string;
}) {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");

  const sections: MenuSection[] = useMemo(() => {
    const list: MenuSection[] = [
      {
        title: "Commercial & Enterprise Sales",
        description: "Billing, quotation pipelines, purchases & inventory control",
        color: "var(--brand)",
        items: [
          {
            title: "Invoices & Billing",
            description: "Issue client invoices, track paid/unpaid status & print PDF",
            href: `/${orgId}/invoices`,
            icon: ReceiptText,
            subItems: [
              { label: "View All Invoices", href: `/${orgId}/invoices` },
              { label: "+ New Invoice", href: `/${orgId}/invoices/new?type=new-invoice`, isCreate: true },
            ],
          },
          {
            title: "Quotes & Estimates",
            description: "Proposals, bids, pricing schedules with dual BS/AD dates",
            href: `/${orgId}/quotes`,
            icon: FileText,
            subItems: [
              { label: "View Quotes", href: `/${orgId}/quotes` },
              { label: "+ Create Quote", href: `/${orgId}/quotes/new?type=new-quote`, isCreate: true },
            ],
          },
          {
            title: "Sales & Orders",
            description: "Customer sales orders, fulfillment tracking & billing links",
            href: `/${orgId}/sales`,
            icon: ShoppingCart,
            subItems: [
              { label: "Orders Pipeline", href: `/${orgId}/sales` },
              { label: "+ Record Sale", href: `/${orgId}/sales/new?type=new-order`, isCreate: true },
            ],
          },
          {
            title: "Purchases & Procurement",
            description: "Supplier purchase orders, incoming stock bills & payment outlays",
            href: `/${orgId}/purchase`,
            icon: PackageSearch,
            subItems: [
              { label: "Purchases List", href: `/${orgId}/purchase` },
              { label: "+ Record Purchase", href: `/${orgId}/purchase/new?type=new-purchase`, isCreate: true },
            ],
          },
          {
            title: "Inventory & Stock Catalog",
            description: "Item quantities, SKU prices, reorder alerts & movement ledgers",
            href: `/${orgId}/stock`,
            icon: Boxes,
            subItems: [
              { label: "Stock Catalog", href: `/${orgId}/stock` },
              { label: "+ Add Product", href: `/${orgId}/stock/new?type=new-product`, isCreate: true },
              { label: "+ In/Out Movement", href: `/${orgId}/stock/new?type=new-movement`, isCreate: true },
            ],
          },
        ],
      },
      {
        title: "Banking, Inflows & Director Ledger",
        description: "Bank accounts, cash receipts, operational outlays & director drawings",
        color: "var(--cyan)",
        items: [
          {
            title: "Banking & Bank Accounts",
            description: "Bank ledgers, passbook statements, deposits & withdrawals",
            href: `/${orgId}/banking`,
            icon: Landmark,
            badge: "Audited",
            subItems: [
              { label: "All Bank Accounts", href: `/${orgId}/banking` },
              { label: "+ Record Deposit", href: `/${orgId}/banking/new?type=record-deposit`, isCreate: true },
              { label: "+ Record Withdrawal", href: `/${orgId}/banking/new?type=record-withdrawal`, isCreate: true },
              { label: "+ Add Bank Account", href: `/${orgId}/banking/new?type=new-bank-account`, isCreate: true },
            ],
          },
          {
            title: "Income & Inflows",
            description: "Cash in hand, bank inflows, digital receipts & revenue logs",
            href: `/${orgId}/income`,
            icon: TrendingUp,
            subItems: [
              { label: "All Receipts", href: `/${orgId}/income` },
              { label: "💵 Cash in Hand", href: `/${orgId}/income?channel=CASH` },
              { label: "🏦 Bank Inflows", href: `/${orgId}/income?channel=BANK` },
              { label: "+ Record Income", href: `/${orgId}/income/new?type=record-income`, isCreate: true },
            ],
          },
          {
            title: "Expenses & Outlays",
            description: "Daily expenditures, recurring commitments & vendor payouts",
            href: `/${orgId}/expenses`,
            icon: WalletCards,
            subItems: [
              { label: "All Expenses", href: `/${orgId}/expenses` },
              { label: "+ Record Expense", href: `/${orgId}/expenses/new?type=new-expense`, isCreate: true },
              { label: "+ Recurring Commitment", href: `/${orgId}/expenses/new?type=new-recurring`, isCreate: true },
            ],
          },
          {
            title: "Director Current Account",
            description: "Director drawings, capital injection, loans & equity running balances",
            href: `/${orgId}/reports?reportType=director`,
            icon: UserCheck,
            badge: "Director",
            subItems: [
              { label: "Director Statement & Ledger", href: `/${orgId}/reports?reportType=director` },
              { label: "+ Record Director Deposit", href: `/${orgId}/banking/new?type=record-deposit`, isCreate: true },
              { label: "+ Record Director Drawings", href: `/${orgId}/banking/new?type=record-withdrawal`, isCreate: true },
            ],
          },
          {
            title: "Loans & Borrowings",
            description: "Principal borrowed/lent, interest schedules & installment settlements",
            href: `/${orgId}/loans`,
            icon: HandCoins,
            subItems: [
              { label: "Active Loans", href: `/${orgId}/loans` },
              { label: "+ New Loan Entry", href: `/${orgId}/loans/new?type=new-loan`, isCreate: true },
            ],
          },
        ],
      },
      {
        title: "Reports & Financial Intelligence",
        description: "Profit & loss, balance sheets, fiscal audits & PDF downloads",
        color: "var(--purple)",
        items: [
          {
            title: "Audit & Financial Reports",
            description: "Income vs expense analysis, categorized breakdown & fiscal stats",
            href: `/${orgId}/reports`,
            icon: BadgeDollarSign,
            subItems: [
              { label: "Annual / Monthly P&L", href: `/${orgId}/reports` },
              { label: "Director Account Statement", href: `/${orgId}/reports?reportType=director` },
              { label: "Fiscal Summary (FY)", href: `/${orgId}/reports?reportType=fiscal` },
            ],
          },
        ],
      },
      {
        title: "CRM Directory & Human Resources",
        description: "Customers, vendors, sales leads, staff team & payroll runs",
        color: "var(--success)",
        items: [
          {
            title: "CRM Directory (Contacts)",
            description: "Customers, corporate suppliers & vendor ledgers with PAN/VAT",
            href: `/${orgId}/crm`,
            icon: UsersRound,
            subItems: [
              { label: "All Contacts", href: `/${orgId}/crm` },
              { label: "Customers", href: `/${orgId}/crm?type=CUSTOMER` },
              { label: "Vendors & Suppliers", href: `/${orgId}/crm?type=VENDOR` },
              { label: "+ Add Contact", href: `/${orgId}/crm/new?type=new-contact`, isCreate: true },
            ],
          },
          {
            title: "Leads & Deal Board",
            description: "Opportunity tracking, deal stages, estimated revenue & closure status",
            href: `/${orgId}/leads`,
            icon: BriefcaseBusiness,
            subItems: [
              { label: "Lead Pipeline", href: `/${orgId}/leads` },
              { label: "+ New Lead", href: `/${orgId}/leads/new?type=new-lead`, isCreate: true },
            ],
          },
          {
            title: "Staff & Team Directory",
            description: "Employee records, departments, designations & basic salaries",
            href: `/${orgId}/staff`,
            icon: UsersRound,
            subItems: [
              { label: "Staff Directory", href: `/${orgId}/staff` },
              { label: "+ Add Employee", href: `/${orgId}/staff/new?type=new-employee`, isCreate: true },
            ],
          },
          {
            title: "Payroll & Salary Slips",
            description: "Monthly salary disbursements, deductions, bonuses & pay history",
            href: `/${orgId}/payroll`,
            icon: HandCoins,
            subItems: [
              { label: "Payroll History", href: `/${orgId}/payroll` },
              { label: "+ Process Payroll Run", href: `/${orgId}/payroll/new?type=new-payroll`, isCreate: true },
            ],
          },
          {
            title: "Leave Management",
            description: "Employee leave applications, approvals, balance & attendance",
            href: `/${orgId}/leaves`,
            icon: CalendarClock,
            subItems: [
              { label: "Leave Requests", href: `/${orgId}/leaves` },
              { label: "+ Request Leave", href: `/${orgId}/leaves/new?type=new-leave`, isCreate: true },
            ],
          },
        ],
      },
      {
        title: "Utilities & Everyday Facilities",
        description: "Electricity meter units logger, tenant room rentals & dairy records",
        color: "var(--brand-pink, #ef086f)",
        items: [
          {
            title: "Electricity Meter Logger",
            description: "Sub-meter & main NEA units log, tariff billing & previous unit continuity",
            href: `/${orgId}/expenses?tab=electricity`,
            icon: Zap,
            badge: "Units Tracker",
            subItems: [
              { label: "Electricity Readings", href: `/${orgId}/expenses?tab=electricity` },
            ],
          },
          {
            title: "Rental Houses & Tenants",
            description: "Properties, tenant lease contracts, room allocations & monthly rents",
            href: `/${orgId}/expenses?tab=rental`,
            icon: Building,
            subItems: [
              { label: "Rental House Manager", href: `/${orgId}/expenses?tab=rental` },
            ],
          },
          {
            title: "Daily Dairy & Milk Tracker",
            description: "Daily morning/evening milk supply liters, fat tests & monthly bills",
            href: `/${orgId}/expenses?tab=milk`,
            icon: Milk,
            subItems: [
              { label: "Milk Daily Inflow", href: `/${orgId}/expenses?tab=milk` },
            ],
          },
        ],
      },
      {
        title: "Workspace & Administration",
        description: "Settings, organization profile, fiscal year & super admin tools",
        color: "var(--text-muted)",
        items: [
          {
            title: "Company Settings & Tax",
            description: "Name, PAN/VAT number, logo branding & system preferences",
            href: `/${orgId}/settings`,
            icon: Settings,
            subItems: [
              { label: "Workspace Settings", href: `/${orgId}/settings` },
            ],
          },
          ...(userRole === "ADMIN" || userRole === "SUPER_ADMIN"
            ? [
                {
                  title: "Platform Administration",
                  description: "Manage global organizations, verify vendors & admin control",
                  href: `/admin`,
                  icon: ShieldCheck,
                  badge: "Admin",
                  subItems: [
                    { label: "Admin Dashboard", href: `/admin` },
                  ],
                },
              ]
            : []),
        ],
      },
    ];

    return list;
  }, [orgId, userRole]);

  // Categories list for interactive filter tabs
  const categories = useMemo(() => {
    const totalCount = sections.reduce((sum, s) => sum + s.items.length, 0);
    return [
      { id: "ALL", label: "All Modules", count: totalCount },
      ...sections.map((s) => ({
        id: s.title,
        label: s.title.split("&")[0].trim(),
        fullTitle: s.title,
        count: s.items.length,
      })),
    ];
  }, [sections]);

  // Filter sections by category and search query
  const filteredSections = useMemo(() => {
    let list = sections;
    if (selectedCategory !== "ALL") {
      list = list.filter((s) => s.title === selectedCategory);
    }
    if (!search.trim()) return list;
    const q = search.toLowerCase();

    return list
      .map((sec) => {
        const matchesSection = sec.title.toLowerCase().includes(q) || sec.description.toLowerCase().includes(q);
        const filteredItems = sec.items.filter((item) => {
          if (matchesSection) return true;
          if (item.title.toLowerCase().includes(q) || item.description.toLowerCase().includes(q)) return true;
          if (item.subItems?.some((sub) => sub.label.toLowerCase().includes(q))) return true;
          return false;
        });

        if (filteredItems.length === 0) return null;
        return {
          ...sec,
          items: filteredItems,
        };
      })
      .filter(Boolean) as MenuSection[];
  }, [sections, search, selectedCategory]);

  const totalFilteredModules = useMemo(() => {
    return filteredSections.reduce((sum, s) => sum + s.items.length, 0);
  }, [filteredSections]);

  return (
    <div
      className="module-directory-container"
      style={{
        width: "100%",
        maxWidth: 1440,
        margin: "0 auto",
        paddingBottom: 60,
      }}
    >
      <style>{`
        .module-card-item {
          transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
        }
        .module-card-item:hover {
          transform: translateY(-2px);
          border-color: var(--brand) !important;
          box-shadow: 0 8px 24px -4px rgba(0, 0, 0, 0.08) !important;
        }
        .module-shortcut-btn {
          transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
        }
        .module-shortcut-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
        }
      `}</style>

      {/* HEADER BANNER */}
      <div
        style={{
          background: "linear-gradient(135deg, var(--surface) 0%, var(--soft) 100%)",
          borderRadius: 14,
          padding: "20px 22px",
          marginBottom: 20,
          border: "1px solid var(--line)",
          boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
              <span className="badge purple" style={{ fontSize: 10, textTransform: "uppercase", padding: "3px 8px" }}>
                {kind === "COMPANY" ? "🏢 Commercial Enterprise" : "🏡 Household Suite"}
              </span>
              {taxNumber && (
                <span className="badge cyan" style={{ fontSize: 10, padding: "3px 8px" }}>
                  PAN/VAT: {taxNumber}
                </span>
              )}
              <span className="badge green" style={{ fontSize: 10, padding: "3px 8px" }}>
                Currency: {currency}
              </span>
              <span style={{ fontSize: 10.5, color: "var(--text-muted)", fontWeight: 600 }}>
                {totalFilteredModules} Modules Available
              </span>
            </div>
            <h1 style={{ fontSize: 24, margin: "2px 0 4px 0", fontWeight: 800, color: "var(--text)" }}>
              {orgName} · Module Directory & Apps Hub
            </h1>
            <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)" }}>
              Access any ledger, transaction book, sales pipeline, or administrative utility with one-click direct actions.
            </p>
          </div>
          <Link
            href={`/${orgId}`}
            className="secondary-btn"
            style={{ fontSize: 12.5, display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", flexShrink: 0 }}
          >
            <Home size={15} /> Dashboard Home
          </Link>
        </div>

        {/* SEARCH BAR */}
        <div style={{ marginTop: 16, position: "relative" }}>
          <Search
            size={18}
            style={{
              position: "absolute",
              left: 14,
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--text-muted)",
              pointerEvents: "none",
            }}
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search all modules, invoices, reports, staff, banking, utilities..."
            style={{
              width: "100%",
              padding: "11px 14px 11px 42px",
              borderRadius: 10,
              border: "1px solid var(--line)",
              background: "var(--surface)",
              fontSize: 14,
              outline: "none",
              color: "var(--text)",
              boxSizing: "border-box",
            }}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              style={{
                position: "absolute",
                right: 12,
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                fontSize: 12,
                fontWeight: 600,
                color: "var(--text-muted)",
                cursor: "pointer",
              }}
            >
              Clear
            </button>
          )}
        </div>

        {/* INTERACTIVE CATEGORY TABS ROW */}
        <div
          style={{
            marginTop: 14,
            display: "flex",
            alignItems: "center",
            gap: 6,
            flexWrap: "wrap",
            paddingTop: 12,
            borderTop: "1px solid var(--line)",
          }}
        >
          <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--text-muted)", marginRight: 4, textTransform: "uppercase" }}>
            Categories:
          </span>
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                style={{
                  padding: "4px 10px",
                  borderRadius: 20,
                  fontSize: 11.5,
                  fontWeight: isSelected ? 700 : 500,
                  background: isSelected ? "var(--brand)" : "var(--surface)",
                  color: isSelected ? "#ffffff" : "var(--text-secondary)",
                  border: isSelected ? "1px solid var(--brand)" : "1px solid var(--line)",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  transition: "all 0.15s ease",
                }}
              >
                <span>{cat.label}</span>
                <span
                  style={{
                    fontSize: 9.5,
                    padding: "1px 5px",
                    borderRadius: 10,
                    background: isSelected ? "rgba(255, 255, 255, 0.25)" : "var(--soft)",
                    color: isSelected ? "#ffffff" : "var(--text-muted)",
                    fontWeight: 700,
                  }}
                >
                  {cat.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* QUICK SHORTCUTS ROW (RESPONSIVE DESKTOP LAUNCHPAD) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))",
          gap: 10,
          marginBottom: 24,
        }}
      >
        <Link
          href={`/${orgId}/invoices/new?type=new-invoice`}
          className="module-shortcut-btn"
          style={{
            background: "var(--brand-soft)",
            color: "var(--brand)",
            padding: "10px 14px",
            borderRadius: 10,
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 12.5,
            fontWeight: 700,
            border: "1px solid var(--brand-border)",
          }}
        >
          <ReceiptText size={16} /> + New Invoice
        </Link>
        <Link
          href={`/${orgId}/expenses/new?type=new-expense`}
          className="module-shortcut-btn"
          style={{
            background: "var(--danger-soft)",
            color: "var(--danger)",
            padding: "10px 14px",
            borderRadius: 10,
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 12.5,
            fontWeight: 700,
            border: "1px solid rgba(239, 68, 68, 0.25)",
          }}
        >
          <Plus size={16} /> + Record Expense
        </Link>
        <Link
          href={`/${orgId}/income/new?type=record-income`}
          className="module-shortcut-btn"
          style={{
            background: "var(--success-soft)",
            color: "var(--success)",
            padding: "10px 14px",
            borderRadius: 10,
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 12.5,
            fontWeight: 700,
            border: "1px solid rgba(22, 163, 74, 0.25)",
          }}
        >
          <TrendingUp size={16} /> + Record Income
        </Link>
        <Link
          href={`/${orgId}/banking/new?type=record-deposit`}
          className="module-shortcut-btn"
          style={{
            background: "var(--cyan-soft)",
            color: "var(--cyan)",
            padding: "10px 14px",
            borderRadius: 10,
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 12.5,
            fontWeight: 700,
            border: "1px solid rgba(6, 182, 212, 0.25)",
          }}
        >
          <Landmark size={16} /> + Bank Deposit
        </Link>
        <Link
          href={`/${orgId}/reports?reportType=director`}
          className="module-shortcut-btn"
          style={{
            background: "var(--purple-soft)",
            color: "var(--purple)",
            padding: "10px 14px",
            borderRadius: 10,
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 12.5,
            fontWeight: 700,
            border: "1px solid rgba(139, 92, 246, 0.25)",
          }}
        >
          <UserCheck size={16} /> Director Ledger
        </Link>
        <Link
          href={`/${orgId}/quotes/new?type=new-quote`}
          className="module-shortcut-btn"
          style={{
            background: "var(--soft)",
            color: "var(--text)",
            padding: "10px 14px",
            borderRadius: 10,
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 12.5,
            fontWeight: 700,
            border: "1px solid var(--line)",
          }}
        >
          <FileText size={16} /> + Create Quote
        </Link>
      </div>

      {/* CATEGORIZED MODULE SECTIONS */}
      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        {filteredSections.map((sec, sIdx) => (
          <div key={sIdx} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", borderBottom: "1px solid var(--line)", paddingBottom: 8, gap: 12 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div
                    style={{
                      width: 4,
                      height: 18,
                      borderRadius: 2,
                      background: sec.color,
                    }}
                  />
                  <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "var(--text)" }}>{sec.title}</h2>
                </div>
                <p style={{ margin: "3px 0 0 12px", fontSize: 12, color: "var(--text-muted)" }}>
                  {sec.description}
                </p>
              </div>
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  padding: "2px 8px",
                  borderRadius: 12,
                  background: "var(--soft)",
                  color: "var(--text-secondary)",
                  border: "1px solid var(--line)",
                  whiteSpace: "nowrap",
                }}
              >
                {sec.items.length} {sec.items.length === 1 ? "Module" : "Modules"}
              </span>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
                gap: 14,
              }}
            >
              {sec.items.map((item, iIdx) => {
                const IconComponent = item.icon;
                return (
                  <div
                    key={iIdx}
                    className="module-card-item"
                    style={{
                      background: "var(--surface)",
                      borderRadius: 14,
                      border: "1px solid var(--line)",
                      padding: "16px",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      gap: 12,
                      boxShadow: "0 1px 4px rgba(0,0,0,0.03)",
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                        <Link
                          href={item.href}
                          style={{
                            display: "flex",
                            alignItems: "flex-start",
                            gap: 12,
                            textDecoration: "none",
                            color: "inherit",
                            flex: 1,
                            minWidth: 0,
                          }}
                        >
                          <div
                            style={{
                              width: 40,
                              height: 40,
                              borderRadius: 10,
                              background: "var(--soft)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: sec.color,
                              flexShrink: 0,
                              border: "1px solid var(--line)",
                            }}
                          >
                            <IconComponent size={20} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                              <strong style={{ fontSize: 14, color: "var(--text)" }}>{item.title}</strong>
                              {item.badge && (
                                <span className="badge purple" style={{ fontSize: 9.5, padding: "1px 6px" }}>
                                  {item.badge}
                                </span>
                              )}
                            </div>
                            <span style={{ fontSize: 12, color: "var(--text-secondary)", display: "block", marginTop: 2, lineHeight: 1.4 }}>
                              {item.description}
                            </span>
                          </div>
                        </Link>
                        <Link
                          href={item.href}
                          style={{
                            color: "var(--text-muted)",
                            padding: 6,
                            borderRadius: 6,
                            display: "inline-flex",
                            alignItems: "center",
                            background: "var(--soft)",
                            border: "1px solid var(--line)",
                            flexShrink: 0,
                          }}
                          aria-label={`Open ${item.title}`}
                        >
                          <ChevronRight size={15} />
                        </Link>
                      </div>
                    </div>

                    {/* SUB ITEMS ACTIONS PILLS */}
                    {item.subItems && item.subItems.length > 0 && (
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 6,
                          paddingTop: 10,
                          borderTop: "1px dashed var(--line)",
                        }}
                      >
                        {item.subItems.map((sub, subIdx) => (
                          <Link
                            key={subIdx}
                            href={sub.href}
                            style={{
                              fontSize: 11.5,
                              fontWeight: sub.isCreate ? 700 : 500,
                              padding: "4px 9px",
                              borderRadius: 6,
                              textDecoration: "none",
                              background: sub.isCreate ? "var(--brand-soft)" : "var(--soft)",
                              color: sub.isCreate ? "var(--brand)" : "var(--text-secondary)",
                              border: sub.isCreate ? "1px solid var(--brand-border)" : "1px solid var(--line)",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                              transition: "all 0.15s ease",
                            }}
                          >
                            {sub.label}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {filteredSections.length === 0 && (
          <div
            style={{
              padding: "48px 24px",
              textAlign: "center",
              background: "var(--surface)",
              borderRadius: 14,
              border: "1px solid var(--line)",
            }}
          >
            <p style={{ margin: "0 0 10px 0", color: "var(--text)", fontSize: 15, fontWeight: 600 }}>
              No modules or actions matching &quot;{search}&quot; in this category.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setSelectedCategory("ALL");
              }}
              className="secondary-btn"
              style={{ fontSize: 12.5 }}
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
