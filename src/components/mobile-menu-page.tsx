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

  // Filter sections by search query
  const filteredSections = useMemo(() => {
    if (!search.trim()) return sections;
    const q = search.toLowerCase();

    return sections
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
  }, [sections, search]);

  return (
    <div className="mobile-menu-page-container" style={{ maxWidth: 840, margin: "0 auto", paddingBottom: 60 }}>
      {/* HEADER BANNER */}
      <div
        style={{
          background: "linear-gradient(135deg, var(--surface) 0%, var(--soft) 100%)",
          borderRadius: 14,
          padding: "20px 18px",
          marginBottom: 16,
          border: "1px solid var(--line)",
          boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <span className="badge purple" style={{ fontSize: 10, textTransform: "uppercase" }}>
                {kind === "COMPANY" ? "🏢 Commercial Enterprise" : "🏡 Household Suite"}
              </span>
              {taxNumber && (
                <span className="badge cyan" style={{ fontSize: 10 }}>
                  PAN: {taxNumber}
                </span>
              )}
            </div>
            <h1 style={{ fontSize: 22, margin: "4px 0 2px 0", fontWeight: 800 }}>
              {orgName} · Module Directory
            </h1>
            <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-secondary)" }}>
              Access any ledger, transaction book, or administrative tool with instant sub-item actions.
            </p>
          </div>
          <Link
            href={`/${orgId}`}
            className="secondary-btn"
            style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4, flexShrink: 0 }}
          >
            <Home size={14} /> Dashboard
          </Link>
        </div>

        {/* SEARCH BAR */}
        <div style={{ marginTop: 14, position: "relative" }}>
          <Search
            size={16}
            style={{
              position: "absolute",
              left: 12,
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
            placeholder="Search all modules, invoices, reports, staff, banking..."
            style={{
              width: "100%",
              padding: "10px 12px 10px 38px",
              borderRadius: 10,
              border: "1px solid var(--line)",
              background: "var(--surface)",
              fontSize: 13.5,
              outline: "none",
            }}
          />
        </div>
      </div>

      {/* QUICK SHORTCUTS ROW */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
          gap: 8,
          marginBottom: 20,
        }}
      >
        <Link
          href={`/${orgId}/expenses/new?type=new-expense`}
          style={{
            background: "var(--danger-soft)",
            color: "var(--danger)",
            padding: "10px 12px",
            borderRadius: 10,
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 12,
            fontWeight: 700,
            border: "1px solid rgba(239, 68, 68, 0.2)",
          }}
        >
          <Plus size={15} /> + New Expense
        </Link>
        <Link
          href={`/${orgId}/income/new?type=record-income`}
          style={{
            background: "var(--success-soft)",
            color: "var(--success)",
            padding: "10px 12px",
            borderRadius: 10,
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 12,
            fontWeight: 700,
            border: "1px solid rgba(22, 163, 74, 0.2)",
          }}
        >
          <Plus size={15} /> + Record Income
        </Link>
        <Link
          href={`/${orgId}/banking/new?type=record-deposit`}
          style={{
            background: "var(--cyan-soft)",
            color: "var(--cyan)",
            padding: "10px 12px",
            borderRadius: 10,
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 12,
            fontWeight: 700,
            border: "1px solid rgba(6, 182, 212, 0.2)",
          }}
        >
          <Plus size={15} /> + Bank Deposit
        </Link>
        <Link
          href={`/${orgId}/reports?reportType=director`}
          style={{
            background: "var(--purple-soft)",
            color: "var(--purple)",
            padding: "10px 12px",
            borderRadius: 10,
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 12,
            fontWeight: 700,
            border: "1px solid rgba(139, 92, 246, 0.2)",
          }}
        >
          <UserCheck size={15} /> Director Ledger
        </Link>
      </div>

      {/* CATEGORIZED MODULE SECTIONS */}
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {filteredSections.map((sec, sIdx) => (
          <div key={sIdx} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ borderBottom: "1px solid var(--line)", paddingBottom: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div
                  style={{
                    width: 4,
                    height: 16,
                    borderRadius: 2,
                    background: sec.color,
                  }}
                />
                <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{sec.title}</h2>
              </div>
              <p style={{ margin: "2px 0 0 12px", fontSize: 11.5, color: "var(--text-muted)" }}>
                {sec.description}
              </p>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                gap: 12,
              }}
            >
              {sec.items.map((item, iIdx) => {
                const IconComponent = item.icon;
                return (
                  <div
                    key={iIdx}
                    style={{
                      background: "var(--surface)",
                      borderRadius: 12,
                      border: "1px solid var(--line)",
                      padding: "14px",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      gap: 10,
                      boxShadow: "0 1px 4px rgba(0,0,0,0.03)",
                      transition: "transform 0.15s ease, box-shadow 0.15s ease",
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                        <Link
                          href={item.href}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            textDecoration: "none",
                            color: "inherit",
                          }}
                        >
                          <div
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: 9,
                              background: "var(--soft)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: sec.color,
                              flexShrink: 0,
                              border: "1px solid var(--line)",
                            }}
                          >
                            <IconComponent size={18} />
                          </div>
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <strong style={{ fontSize: 13.5, color: "var(--text)" }}>{item.title}</strong>
                              {item.badge && (
                                <span className="badge purple" style={{ fontSize: 9, padding: "1px 5px" }}>
                                  {item.badge}
                                </span>
                              )}
                            </div>
                            <span style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginTop: 1 }}>
                              {item.description}
                            </span>
                          </div>
                        </Link>
                        <Link
                          href={item.href}
                          style={{
                            color: "var(--text-muted)",
                            padding: 4,
                            display: "inline-flex",
                            alignItems: "center",
                          }}
                          aria-label={`Open ${item.title}`}
                        >
                          <ChevronRight size={16} />
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
                          paddingTop: 8,
                          borderTop: "1px dashed var(--line)",
                        }}
                      >
                        {item.subItems.map((sub, subIdx) => (
                          <Link
                            key={subIdx}
                            href={sub.href}
                            style={{
                              fontSize: 11,
                              fontWeight: sub.isCreate ? 700 : 500,
                              padding: "3px 8px",
                              borderRadius: 6,
                              textDecoration: "none",
                              background: sub.isCreate ? "var(--brand-soft)" : "var(--soft)",
                              color: sub.isCreate ? "var(--brand)" : "var(--text-secondary)",
                              border: "1px solid var(--line)",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 3,
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
              padding: "40px 20px",
              textAlign: "center",
              background: "var(--surface)",
              borderRadius: 12,
              border: "1px solid var(--line)",
            }}
          >
            <p style={{ margin: 0, color: "var(--text-muted)", fontSize: 14 }}>
              No modules or actions matching &quot;{search}&quot;.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
