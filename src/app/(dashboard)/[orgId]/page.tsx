import Link from "next/link";
import { cookies } from "next/headers";
import { endOfMonth, startOfMonth, subMonths } from "date-fns";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  FileText,
  Package,
  Receipt,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  WalletCards,
  Calendar,
  Globe,
  CheckSquare,
  Plus,
  Menu,
} from "lucide-react";
import { db } from "@/lib/db";
import { requireOrganizationAccess } from "@/lib/session";
import { money, shortDate } from "@/lib/format";
import { estimateRecurringExpense } from "@/lib/expense-engine";
import { adToBs, formatBsDate, formatDualDate } from "@/lib/nepali-calendar";
import { resolveActiveFiscalYear, getFiscalMonths } from "@/lib/fiscal-year";
import { NepaliCalendarWidget } from "@/components/nepali-calendar-widget";
import { InteractiveChartsSuite } from "@/components/interactive-charts-suite";

export default async function DashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams?: Promise<{ fy?: string }>;
}) {
  const { orgId } = await params;
  const query = searchParams ? await searchParams : {};
  const { organization } = await requireOrganizationAccess(orgId);
  const cookieStore = await cookies();
  const fyCookie = cookieStore.get("flowledger_fy")?.value || null;
  const activeFy = resolveActiveFiscalYear(query.fy, fyCookie);

  const now = new Date();
  const bsNow = adToBs(now);

  const dateFilterIncome = activeFy
    ? { receivedAt: { gte: activeFy.startDate, lte: activeFy.endDate } }
    : {};
  const dateFilterExpense = activeFy
    ? { occurredAt: { gte: activeFy.startDate, lte: activeFy.endDate } }
    : {};
  const dateFilterInvoice = activeFy
    ? { issueDate: { gte: activeFy.startDate, lte: activeFy.endDate } }
    : {};

  const [incomeAgg, expenseAgg, incomes, expenses, recurring, reminders, invoiceAgg, stockLow, recentInvoices, recentOrders, tasks] =
    await Promise.all([
      db.income.aggregate({
        where: { organizationId: orgId, ...dateFilterIncome },
        _sum: { amount: true },
      }),
      db.expense.aggregate({
        where: { organizationId: orgId, ...dateFilterExpense, isEstimated: false },
        _sum: { amount: true },
      }),
      db.income.findMany({
        where: { organizationId: orgId, ...dateFilterIncome },
        orderBy: { receivedAt: "asc" },
      }),
      db.expense.findMany({
        where: { organizationId: orgId, ...dateFilterExpense, isEstimated: false },
        include: { category: true },
        orderBy: { occurredAt: "asc" },
      }),
      db.recurringExpense.findMany({
        where: { organizationId: orgId, active: true },
        include: { category: true },
        take: 6,
        orderBy: { createdAt: "desc" },
      }),
      db.reminder.findMany({
        where: { organizationId: orgId, status: "PENDING" },
        take: 5,
        orderBy: { dueAt: "asc" },
      }),
      organization.kind === "COMPANY"
        ? db.invoice.aggregate({
            where: { organizationId: orgId, status: { not: "CANCELLED" }, ...dateFilterInvoice },
            _sum: { total: true, paidAmount: true },
          })
        : Promise.resolve({ _sum: { total: null, paidAmount: null } }),
      organization.kind === "COMPANY"
        ? db.product.findMany({
            where: { organizationId: orgId, active: true },
            take: 20,
            orderBy: { stockQty: "asc" },
          })
        : Promise.resolve([]),
      organization.kind === "COMPANY"
        ? db.invoice.findMany({
            where: { organizationId: orgId, ...dateFilterInvoice },
            include: { contact: true },
            take: 4,
            orderBy: { issueDate: "desc" },
          })
        : Promise.resolve([]),
      organization.kind === "COMPANY"
        ? db.salesOrder.findMany({
            where: { organizationId: orgId },
            include: { contact: true },
            take: 4,
            orderBy: { orderDate: "desc" },
          })
        : Promise.resolve([]),
      db.task.findMany({
        where: { organizationId: orgId, status: { not: "DONE" } },
        take: 5,
        orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      }),
    ]);

  const income = Number(incomeAgg._sum.amount || 0);
  const expense = Number(expenseAgg._sum.amount || 0);
  const balance = income - expense;
  const estimated = recurring.reduce((sum, r) => sum + estimateRecurringExpense(r, now), 0);
  const outstanding = Math.max(0, Number(invoiceAgg._sum.total || 0) - Number(invoiceAgg._sum.paidAmount || 0));
  const lowStockItems = stockLow.filter((p) => Number(p.stockQty) <= Number(p.reorderLevel));
  const lowStock = lowStockItems.length;

  // Monthly breakdown in Fiscal order (Shrawan to Ashadh) when activeFy is present
  const bars = activeFy
    ? getFiscalMonths(activeFy.startBsYear).map((fm) => {
        const inc = incomes
          .filter((x) => x.receivedAt >= fm.startDate && x.receivedAt <= fm.endDate)
          .reduce((s, x) => s + Number(x.amount), 0);
        const exp = expenses
          .filter((x) => x.occurredAt >= fm.startDate && x.occurredAt <= fm.endDate)
          .reduce((s, x) => s + Number(x.amount), 0);
        return {
          label: fm.monthNameEn.slice(0, 4),
          subLabel: `${fm.bsYear.toString().slice(-2)} BS`,
          income: inc,
          expense: exp,
        };
      })
    : Array.from({ length: 6 }, (_, i) => startOfMonth(subMonths(now, 5 - i))).map((m) => {
        const key = `${m.getFullYear()}-${m.getMonth()}`;
        const inc = incomes
          .filter((x) => `${x.receivedAt.getFullYear()}-${x.receivedAt.getMonth()}` === key)
          .reduce((s, x) => s + Number(x.amount), 0);
        const exp = expenses
          .filter((x) => `${x.occurredAt.getFullYear()}-${x.occurredAt.getMonth()}` === key)
          .reduce((s, x) => s + Number(x.amount), 0);
        const bsM = adToBs(m);
        return {
          label: `${bsM.monthName.slice(0, 4)}`,
          subLabel: m.toLocaleString("en", { month: "short" }),
          income: inc,
          expense: exp,
        };
      });

  const max = Math.max(1, ...bars.flatMap((b) => [b.income, b.expense]));
  const hasHistory = bars.some((b) => b.income > 0 || b.expense > 0);

  const recent = [
    ...incomes.slice(-6).map((x) => ({
      type: "income" as const,
      title: x.title,
      date: x.receivedAt,
      amount: Number(x.amount),
      meta: x.source || "Direct Inflow",
    })),
    ...expenses.slice(-6).map((x) => ({
      type: "expense" as const,
      title: x.title,
      date: x.occurredAt,
      amount: Number(x.amount),
      meta: x.vendor || "Operational Expense",
    })),
  ]
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 6);

  // Dynamic Categorical Breakdown for Animated Pie / Donut Chart
  const categoryTotals: Record<string, number> = {};
  for (const exp of expenses) {
    const catName = exp.category?.name || "General & Operations";
    categoryTotals[catName] = (categoryTotals[catName] || 0) + Number(exp.amount);
  }

  const categoryPalette = ["#2563eb", "#059669", "#d97706", "#7c3aed", "#0891b2", "#dc2626", "#ea580c"];
  const totalExp = Math.max(1, expense);
  const categoryData = Object.entries(categoryTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, amt], idx) => ({
      name,
      amount: amt,
      color: categoryPalette[idx % categoryPalette.length],
      percentage: Math.max(1, Math.round((amt / totalExp) * 100)),
    }));

  return (
    <main className="page-wrap">
      {/* DASHBOARD HEADER WITH ACTIVE FISCAL SYSTEM INDICATOR */}
      <div className="page-header">
        <div>
          <span className="page-eyebrow" style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {activeFy ? (
              <span className="badge purple" style={{ fontSize: 10, padding: "3px 8px", display: "inline-flex", alignItems: "center", gap: 4 }}>
                <Calendar size={11} /> FISCAL YEAR {activeFy.fullCode} ({activeFy.code}) · Shrawan 1, {activeFy.startBsYear} BS – Ashadh {activeFy.endBsYear} BS
              </span>
            ) : (
              <span className="badge cyan" style={{ fontSize: 10, padding: "3px 8px", display: "inline-flex", alignItems: "center", gap: 4 }}>
                <Globe size={11} /> ALL FISCAL YEARS (FULL LEDGER)
              </span>
            )}
            <span>· Today: {formatDualDate(now)}</span>
          </span>
          <h1 style={{ marginTop: 4 }}>
            {organization.kind === "COMPANY"
              ? `${organization.name} · Business Overview`
              : `${organization.name} · Personal & Household Ledger`}
          </h1>
          <p>
            {organization.kind === "COMPANY"
              ? `Real-time commercial accounting aligned with Nepal's ${activeFy ? `FY ${activeFy.fullCode} (${activeFy.code})` : "annual"} Shrawan–Ashadh fiscal cycle.`
              : "Household expenditures, recurring milk/rent bills, and family cash flow managed cleanly."}
          </p>
        </div>
        <div className="page-actions">
          <Link className="secondary-btn" href={`/${orgId}/expenses`}>
            <Plus size={13} /> Record Expense
          </Link>
          <Link className="success-btn" href={`/${orgId}/income`}>
            <Plus size={13} /> Add Income
          </Link>
          {organization.kind === "COMPANY" && (
            <Link className="primary-btn" href={`/${orgId}/invoices`}>
              <Plus size={13} /> Create Invoice
            </Link>
          )}
          <Link
            className="secondary-btn mobile-only"
            href={`/${orgId}/menu`}
            style={{ display: "inline-flex", alignItems: "center", gap: 5 }}
          >
            <Menu size={13} /> All Modules
          </Link>
        </div>
      </div>

      {/* MOBILE DASHBOARD MODULES QUICK ACCESS BANNER */}
      <div
        className="mobile-only"
        style={{
          background: "linear-gradient(135deg, var(--soft) 0%, var(--surface) 100%)",
          border: "1px solid var(--line)",
          borderRadius: 12,
          padding: "12px 14px",
          marginBottom: 16,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 10,
          boxShadow: "0 1px 4px rgba(0,0,0,0.03)",
        }}
      >
        <div>
          <strong style={{ fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6 }}>
            <FileText size={15} style={{ color: "var(--brand)" }} /> App Modules &amp; Sub-items Menu
          </strong>
          <span style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginTop: 2 }}>
            Browse commerce, banking, CRM &amp; utility pages cleanly
          </span>
        </div>
        <Link
          href={`/${orgId}/menu`}
          className="primary-btn"
          style={{ fontSize: 11.5, padding: "6px 12px", whiteSpace: "nowrap", flexShrink: 0 }}
        >
          Open Menu →
        </Link>
      </div>

      {/* TOP KPI CARDS */}
      <section className="grid-kpis">
        <div className="kpi-card">
          <div className="kpi-top">
            <span>{activeFy ? `Fiscal Income (${activeFy.code})` : "Total Income"}</span>
            <span className="kpi-icon icon-income">
              <ArrowUpRight size={16} />
            </span>
          </div>
          <div className="kpi-value income-val">{money(income, organization.currency)}</div>
          <div className="kpi-meta">
            {activeFy ? `BS ${activeFy.startDateBs} to ${activeFy.endDateBs}` : "All-time receipts"}
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-top">
            <span>{activeFy ? `Fiscal Outflows (${activeFy.code})` : "Actual Expenses"}</span>
            <span className="kpi-icon icon-expense">
              <ArrowDownRight size={16} />
            </span>
          </div>
          <div className="kpi-value expense-val">{money(expense, organization.currency)}</div>
          <div className="kpi-meta">
            {activeFy ? "Operational expenses in fiscal period" : "Recorded paid outlays"}
          </div>
        </div>

        <div className={`kpi-card ${balance >= 0 ? "kpi-surplus" : "kpi-deficit"}`}>
          <div className="kpi-top">
            <span>{activeFy ? `Net Fiscal Margin (${activeFy.code})` : "Net Cash Position"}</span>
            <span className="kpi-icon icon-net">
              <WalletCards size={16} />
            </span>
          </div>
          <div className="kpi-value net-val">{money(balance, organization.currency)}</div>
          <div className="kpi-meta">{balance >= 0 ? "Fiscal Operating Surplus" : "Fiscal Operating Deficit"}</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-top">
            <span>{organization.kind === "COMPANY" ? `Receivables Due (${activeFy ? activeFy.code : "All"})` : "Monthly Commitments"}</span>
            <span className="kpi-icon icon-planned">
              {organization.kind === "COMPANY" ? <Receipt size={16} /> : <CalendarClock size={16} />}
            </span>
          </div>
          <div className="kpi-value">
            {money(organization.kind === "COMPANY" ? outstanding : estimated, organization.currency)}
          </div>
          <div className="kpi-meta">
            {organization.kind === "COMPANY"
              ? lowStock > 0
                ? `${lowStock} item(s) low stock`
                : "All products in stock"
              : "Active recurring overhead"}
          </div>
        </div>
      </section>

      {/* MAIN DASHBOARD 2-COLUMN PANELS */}
      <section className="dashboard-grid">
        {/* PANEL 1: CASH FLOW & TRENDS REARRANGED IN FISCAL SYSTEM */}
        <div className="panel cash-panel">
          <div className="panel-head">
            <div>
              <h3>
                {activeFy
                  ? `Fiscal Cash Flow Breakdown (FY ${activeFy.fullCode} · Shrawan to Ashadh)`
                  : "Cash Flow Trends (Multi-Month)"}
              </h3>
              <span>
                {activeFy
                  ? `Monthly inflows vs operational outflows in Nepalese accounting order`
                  : "Monthly inflows vs operational outflows"}
              </span>
            </div>
            <div className="legend">
              <span>
                <i className="c1" /> Inflow
              </span>
              <span>
                <i className="c2" /> Outflow
              </span>
            </div>
          </div>

          {hasHistory ? (
            <div className="chart-bars" style={{ overflowX: "auto" }}>
              {bars.map((b) => (
                <div className="chart-month" key={`${b.label}-${b.subLabel}`}>
                  <div className="chart-column">
                    <div
                      className="bar income"
                      style={{ height: `${Math.max(6, (b.income / max) * 115)}px` }}
                      title={`Inflow: ${money(b.income, organization.currency)}`}
                    />
                    <div
                      className="bar expense"
                      style={{ height: `${Math.max(6, (b.expense / max) * 115)}px` }}
                      title={`Outflow: ${money(b.expense, organization.currency)}`}
                    />
                  </div>
                  <div className="chart-labels-wrap">
                    <span className="chart-label-primary">{b.label}</span>
                    <span className="chart-label-sub">{b.subLabel}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-panel-state">
              <CalendarClock size={28} />
              <p>No transactions logged in this fiscal period yet.</p>
            </div>
          )}
        </div>

        {/* PANEL 2: RECENT ENTRIES & QUICK SHORTCUTS */}
        <div className="panel activity-panel">
          <div className="panel-head">
            <div>
              <h3>Recent Entries</h3>
              <span>Latest income and expenses</span>
            </div>
            <Link href={`/${orgId}/reports`} className="panel-link">
              Audit Ledger →
            </Link>
          </div>

          {recent.length ? (
            <div className="activity-list">
              {recent.map((item, idx) => (
                <div className="activity-row" key={`${item.title}-${item.date.toISOString()}-${idx}`}>
                  <div className={`activity-icon ${item.type}`}>
                    {item.type === "income" ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                  </div>
                  <div className="activity-main">
                    <strong>{item.title}</strong>
                    <small>
                      {item.meta} · {formatBsDate(item.date)}
                    </small>
                  </div>
                  <div className={`activity-amt ${item.type}`}>
                    {item.type === "income" ? "+" : "-"}
                    {money(item.amount, organization.currency)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-panel-state">
              <AlertTriangle size={28} />
              <p>No recent activity. Use the top buttons to record transactions.</p>
            </div>
          )}
        </div>
      </section>

      {/* COMPANY ONLY COMMERCE PANELS */}
      {organization.kind === "COMPANY" && (
        <section className="dashboard-grid" style={{ marginTop: 24 }}>
          <div className="panel">
            <div className="panel-head">
              <div>
                <h3>Latest Invoices</h3>
                <span>Commercial billing activity</span>
              </div>
              <Link href={`/${orgId}/invoices`} className="panel-link">
                View All →
              </Link>
            </div>
            {recentInvoices.length ? (
              <div className="activity-list">
                {recentInvoices.map((inv) => (
                  <div className="activity-row" key={inv.id}>
                    <div className="activity-icon income">
                      <FileText size={14} />
                    </div>
                    <div className="activity-main">
                      <Link href={`/${orgId}/invoices/${inv.id}`} className="table-clickable-title">
                        {inv.invoiceNumber}
                      </Link>
                      <small>
                        {inv.contact?.companyName || inv.contact?.name || "Customer"} · {shortDate(inv.issueDate)}
                      </small>
                    </div>
                    <div style={{ textAlign: "right", marginLeft: "auto", flexShrink: 0 }}>
                      <strong style={{ display: "block", fontSize: 13, fontWeight: 700 }}>{money(inv.total, organization.currency)}</strong>
                      <span className={`badge ${inv.status === "PAID" ? "green" : inv.status === "OVERDUE" ? "red" : "soft"}`} style={{ fontSize: 9.5, padding: "1px 5px", display: "inline-block", marginTop: 2 }}>{inv.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-panel-state">
                <FileText size={24} />
                <p>No invoices created yet.</p>
              </div>
            )}
          </div>

          <div className="panel">
            <div className="panel-head">
              <div>
                <h3>Today&apos;s Agenda, Tasks &amp; Alerts</h3>
                <span>Pending work items, reminders, and low inventory</span>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <Link href={`/${orgId}/tasks`} className="panel-link">
                  Tasks →
                </Link>
                <Link href={`/${orgId}/reminders`} className="panel-link">
                  Reminders →
                </Link>
              </div>
            </div>
            {tasks.length || reminders.length || lowStockItems.length ? (
              <div className="activity-list">
                {tasks.map((t) => (
                  <div className="activity-row" key={t.id}>
                    <div className="activity-icon income">
                      <CheckSquare size={14} />
                    </div>
                    <div className="activity-main">
                      <Link href={`/${orgId}/tasks`} style={{ fontWeight: 650, color: "var(--text)" }}>
                        {t.title}
                      </Link>
                      <small>{t.description || "Active operational task"} · Priority: {t.priority}</small>
                    </div>
                    <span className="badge purple" style={{ fontSize: 10, marginLeft: "auto", flexShrink: 0 }}>{t.status}</span>
                  </div>
                ))}
                {lowStockItems.slice(0, 2).map((item) => (
                  <div className="activity-row" key={item.id}>
                    <div className="activity-icon expense">
                      <Package size={14} />
                    </div>
                    <div className="activity-main">
                      <strong>Low Stock: {item.name}</strong>
                      <small>
                        Only {Number(item.stockQty)} left (Reorder at {Number(item.reorderLevel)})
                      </small>
                    </div>
                    <span className="badge red" style={{ fontSize: 10, marginLeft: "auto", flexShrink: 0 }}>LOW</span>
                  </div>
                ))}
                {reminders.map((r) => (
                  <div className="activity-row" key={r.id}>
                    <div className="activity-icon income">
                      <CalendarClock size={14} />
                    </div>
                    <div className="activity-main">
                      <strong>{r.title}</strong>
                      <small>Due: {formatBsDate(r.dueAt)}</small>
                    </div>
                    <span className="badge amber" style={{ fontSize: 10, marginLeft: "auto", flexShrink: 0 }}>PENDING</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-panel-state">
                <CheckCircle2 size={24} />
                <p>All tasks, reminders and stock levels healthy.</p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* LOWER DASHBOARD: NEPALI CALENDAR (COMPACT 4/12 WIDTH) & INTERACTIVE ANIMATED CHARTS SUITE (8/12 WIDTH) */}
      <section className="dashboard-bottom-grid">
        <div style={{ width: "100%", height: "100%" }}>
          <NepaliCalendarWidget />
        </div>
        <div style={{ width: "100%", height: "100%" }}>
          <InteractiveChartsSuite
            trendData={bars}
            categoryData={categoryData}
            cashFlow={{ income, expense, net: balance, currency: organization.currency }}
            currency={organization.currency}
          />
        </div>
      </section>
    </main>
  );
}
