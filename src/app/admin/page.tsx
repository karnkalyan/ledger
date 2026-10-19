import { DataTable } from "@/components/data-table";
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { AccountStatus } from "@/generated/client";
import { getSessionUser } from "@/lib/session";
import {
  approveVendorAction,
  rejectVendorAction,
  suspendVendorAction,
} from "./actions";
import { logoutAction } from "@/app/login/actions";
import { ThemeToggle } from "@/components/theme-toggle";
import { formatDualDate, formatBsDate } from "@/lib/nepali-calendar";
import { money } from "@/lib/format";
import {
  Building2,
  CheckCircle2,
  Clock,
  ExternalLink,
  KeyRound,
  Lock,
  LogOut,
  ShieldCheck,
  Store,
  Users,
  XCircle,
  Landmark,
  Edit3,
  Receipt,
  ArrowUpDown,
  Search,
} from "lucide-react";

export default async function AdminVendorsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; search?: string; tab?: string; txType?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const fullUser = await db.user.findUnique({ where: { id: user.id } });
  if (!fullUser || fullUser.role !== "SUPER_ADMIN") {
    redirect("/workspaces");
  }

  const query = await searchParams;
  const tab = query.tab === "transactions" ? "transactions" : query.tab === "users" ? "users" : "vendors";
  const filterStatus = Object.values(AccountStatus).includes(query.status as AccountStatus)
    ? (query.status as AccountStatus)
    : undefined;
  const search = query.search?.trim() || "";
  const txType = query.txType || "ALL";

  const filterHref = (status?: string) => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (search) params.set("search", search);
    return `/admin${params.size ? `?${params}` : ""}`;
  };

  const txFilterHref = (newType: string) => {
    const params = new URLSearchParams();
    params.set("tab", "transactions");
    if (newType !== "ALL") params.set("txType", newType);
    if (search) params.set("search", search);
    return `/admin?${params.toString()}`;
  };

  // 1. VENDORS DIRECTORY QUERY
  const orgs = await db.organization.findMany({
    where: {
      kind: "COMPANY",
      ...(filterStatus ? { status: filterStatus } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search } },
              { owner: { name: { contains: search } } },
              { owner: { email: { contains: search } } },
              { panVatNumber: { contains: search } },
            ],
          }
        : {}),
    },
    include: {
      owner: true,
      _count: {
        select: {
          expenses: true,
          invoices: true,
          employees: true,
          products: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const allVendors = await db.organization.findMany({
    where: { kind: "COMPANY" },
    select: { status: true },
  });

  const totalCount = allVendors.length;
  const pendingCount = allVendors.filter((v) => v.status === "PENDING").length;
  const approvedCount = allVendors.filter((v) => v.status === "APPROVED").length;
  const rejectedCount = allVendors.filter((v) => v.status === "REJECTED").length;
  const suspendedCount = allVendors.filter((v) => v.status === "SUSPENDED").length;

  const allUsersCount = await db.user.count();
  const systemUsers =
    tab === "users"
      ? await db.user.findMany({
          where: search
            ? {
                OR: [
                  { name: { contains: search } },
                  { email: { contains: search } },
                ],
              }
            : {},
          include: {
            memberships: {
              include: {
                organization: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        })
      : [];

  // 2. TRANSACTION AUDIT & MODIFICATION QUERY (if on transactions tab)
  type UnifiedTx = {
    id: string;
    orgId: string;
    orgName: string;
    date: Date;
    kind: "EXPENSE" | "INCOME" | "BANK_TX";
    typeLabel: string;
    badgeCls: string;
    title: string;
    amount: number;
    channel: string;
    party: string;
    editUrl: string;
  };

  let transactionsList: UnifiedTx[] = [];

  if (tab === "transactions") {
    const [exps, incs, btxs] = await Promise.all([
      txType === "ALL" || txType === "EXPENSE"
        ? db.expense.findMany({
            where: search
              ? {
                  OR: [
                    { title: { contains: search } },
                    { vendor: { contains: search } },
                    { notes: { contains: search } },
                    { organization: { name: { contains: search } } },
                  ],
                }
              : {},
            include: { organization: true, category: true },
            orderBy: { occurredAt: "desc" },
            take: 60,
          })
        : [],
      txType === "ALL" || txType === "INCOME"
        ? db.income.findMany({
            where: search
              ? {
                  OR: [
                    { title: { contains: search } },
                    { source: { contains: search } },
                    { organization: { name: { contains: search } } },
                  ],
                }
              : {},
            include: { organization: true, bankAccount: true, contact: true },
            orderBy: { receivedAt: "desc" },
            take: 60,
          })
        : [],
      txType === "ALL" || txType === "BANK"
        ? db.bankTransaction.findMany({
            where: search
              ? {
                  OR: [
                    { description: { contains: search } },
                    { reference: { contains: search } },
                    { organization: { name: { contains: search } } },
                  ],
                }
              : {},
            include: { organization: true, bankAccount: true, contact: true },
            orderBy: { transactionDate: "desc" },
            take: 60,
          })
        : [],
    ]);

    const mappedExpenses: UnifiedTx[] = exps.map((e) => ({
      id: e.id,
      orgId: e.organizationId,
      orgName: e.organization.name,
      date: e.occurredAt,
      kind: "EXPENSE",
      typeLabel: "Operational Expense",
      badgeCls: "red",
      title: e.title,
      amount: -Number(e.amount),
      channel: e.category?.name || "Direct Expense",
      party: e.vendor || "—",
      editUrl: `/${e.organizationId}/expenses/${e.id}/edit`,
    }));

    const mappedIncomes: UnifiedTx[] = incs.map((i) => ({
      id: i.id,
      orgId: i.organizationId,
      orgName: i.organization.name,
      date: i.receivedAt,
      kind: "INCOME",
      typeLabel: "Income Receipt",
      badgeCls: "green",
      title: i.title,
      amount: Number(i.amount),
      channel:
        i.paymentMethod === "BANK" && i.bankAccount
          ? `Bank: ${i.bankAccount.bankName}`
          : i.paymentMethod === "CASH"
          ? "Cash in Hand"
          : "Other Channel",
      party: i.contact ? i.contact.companyName || i.contact.name : i.source || "—",
      editUrl: `/${i.organizationId}/income/${i.id}/edit`,
    }));

    const mappedBankTxs: UnifiedTx[] = btxs.map((b) => ({
      id: b.id,
      orgId: b.organizationId,
      orgName: b.organization.name,
      date: b.transactionDate,
      kind: "BANK_TX",
      typeLabel: b.type === "DEPOSIT" ? "Bank Deposit" : "Bank Withdrawal",
      badgeCls: b.type === "DEPOSIT" ? "green" : "purple",
      title: b.description,
      amount: b.type === "DEPOSIT" ? Number(b.amount) : -Number(b.amount),
      channel: `${b.bankAccount.bankName} (${b.bankAccount.accountNumber})`,
      party: b.contact ? b.contact.companyName || b.contact.name : b.reference || "—",
      editUrl: `/${b.organizationId}/banking/${b.id}/edit`,
    }));

    transactionsList = [...mappedExpenses, ...mappedIncomes, ...mappedBankTxs].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }

  return (
    <div className="admin-page-shell">
      <header className="admin-topbar">
        <div className="admin-brand">
          <div className="brand-mark" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <img
              src="/logo-mark.png"
              alt="Kashtrix Logo"
              style={{ width: 30, height: 30, objectFit: "contain" }}
            />
            <div>
              <span style={{ fontSize: 15, fontWeight: 800, letterSpacing: "0.04em" }}>KASHTRIX</span>
              <div className="brand-sub" style={{ color: "var(--brand-pink)", fontWeight: 700 }}>ERP SUPER ADMIN</div>
            </div>
          </div>
          <span className="badge purple" style={{ marginLeft: 12 }}>
            <ShieldCheck size={12} style={{ verticalAlign: "middle", marginRight: 4 }} />
            Master Administration
          </span>
        </div>

        <div className="topbar-actions">
          <ThemeToggle />
          <Link href="/workspaces" className="ghost-btn">
            View Workspaces
          </Link>
          <form action={logoutAction}>
            <button type="submit" className="ghost-btn" title="Sign out from super admin">
              <LogOut size={14} style={{ verticalAlign: "middle", marginRight: 6 }} />
              Log Out
            </button>
          </form>
        </div>
      </header>

      <main className="admin-body">
        {/* TOP LEVEL NAVIGATION SWITCHER */}
        <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap", borderBottom: "1px solid var(--line)", paddingBottom: 14 }}>
          <Link
            href="/admin"
            className={`filter-tab ${tab === "vendors" ? "active" : ""}`}
            style={{ fontSize: 13, padding: "8px 16px" }}
          >
            <Building2 size={15} style={{ verticalAlign: "middle", marginRight: 6 }} />
            Vendor Enterprises ({totalCount})
          </Link>
          <Link
            href="/admin?tab=transactions"
            className={`filter-tab ${tab === "transactions" ? "active" : ""}`}
            style={{ fontSize: 13, padding: "8px 16px" }}
          >
            <Receipt size={15} style={{ verticalAlign: "middle", marginRight: 6 }} />
            All Transactions &amp; Ledger Audit (Modify / Edit)
          </Link>
          <Link
            href="/admin?tab=users"
            className={`filter-tab ${tab === "users" ? "active" : ""}`}
            style={{ fontSize: 13, padding: "8px 16px" }}
          >
            <Users size={15} style={{ verticalAlign: "middle", marginRight: 6 }} />
            User Management &amp; Workspaces ({allUsersCount})
          </Link>
        </div>

        {tab === "vendors" && (
          <>
            <div className="admin-title-row">
              <div>
                <h2>Enterprise Vendor Directory &amp; Verification</h2>
                <p>Review new business onboarding applications, verify credentials, manage status, and audit ledgers.</p>
              </div>
            </div>

            {/* KPI METRICS OVERVIEW */}
            <div className="admin-kpi-grid">
              <div className="kpi-metric-card">
                <span className="kpi-label">Total Commercial Workspaces</span>
                <div className="kpi-value">{totalCount}</div>
                <div className="kpi-sub">Registered enterprises</div>
              </div>
              <div className="kpi-metric-card" style={{ borderColor: pendingCount > 0 ? "var(--warning)" : "var(--line)" }}>
                <span className="kpi-label">Pending Approval</span>
                <div className="kpi-value" style={{ color: pendingCount > 0 ? "var(--warning)" : "inherit" }}>
                  {pendingCount}
                </div>
                <div className="kpi-sub">Awaiting verification</div>
              </div>
              <div className="kpi-metric-card">
                <span className="kpi-label">Active / Approved</span>
                <div className="kpi-value" style={{ color: "var(--success)" }}>{approvedCount}</div>
                <div className="kpi-sub">Operational vendors</div>
              </div>
              <div className="kpi-metric-card">
                <span className="kpi-label">Suspended / Rejected</span>
                <div className="kpi-value">{rejectedCount + suspendedCount}</div>
                <div className="kpi-sub">Access disabled</div>
              </div>
            </div>

            {/* STATUS FILTER TABS */}
            <div className="admin-filter-bar">
              <div className="filter-tabs">
                <Link
                  href={filterHref()}
                  className={`filter-tab ${!filterStatus ? "active" : ""}`}
                >
                  All Vendors ({totalCount})
                </Link>
                <Link
                  href={filterHref("PENDING")}
                  className={`filter-tab ${filterStatus === "PENDING" ? "active" : ""}`}
                >
                  <Clock size={13} style={{ verticalAlign: "middle", marginRight: 4 }} />
                  Pending Review ({pendingCount})
                </Link>
                <Link
                  href={filterHref("APPROVED")}
                  className={`filter-tab ${filterStatus === "APPROVED" ? "active" : ""}`}
                >
                  <CheckCircle2 size={13} style={{ verticalAlign: "middle", marginRight: 4 }} />
                  Approved ({approvedCount})
                </Link>
                <Link
                  href={filterHref("REJECTED")}
                  className={`filter-tab ${filterStatus === "REJECTED" ? "active" : ""}`}
                >
                  <XCircle size={13} style={{ verticalAlign: "middle", marginRight: 4 }} />
                  Rejected ({rejectedCount})
                </Link>
                <Link href={filterHref("SUSPENDED")} className={`filter-tab ${filterStatus === "SUSPENDED" ? "active" : ""}`}>
                  <Lock size={13} /> Suspended ({suspendedCount})
                </Link>
              </div>
              <form className="admin-search" method="get" action="/admin" role="search">
                {filterStatus && <input type="hidden" name="status" value={filterStatus} />}
                <input type="search" name="search" defaultValue={search} aria-label="Search vendors" placeholder="Company, owner, email or PAN/VAT" />
                <button className="primary-btn" type="submit">Search</button>
                {search && <Link href={filterStatus ? `/admin?status=${filterStatus}` : "/admin"} className="ghost-btn">Clear</Link>}
              </form>
            </div>

            {/* VENDOR DIRECTORY TABLE */}
            <div className="table-card">
              <div className="table-toolbar">
                <h3>Vendor directory</h3>
                <span className="badge cyan">{orgs.length} matching vendors</span>
              </div>
              <DataTable className="responsive-table admin-vendor-table">
                <thead>
                  <tr>
                    <th>Vendor / Enterprise</th>
                    <th>Owner &amp; Contact</th>
                    <th>Category &amp; PAN/VAT</th>
                    <th>Registered (BS / AD)</th>
                    <th>Workspace Usage</th>
                    <th>Status</th>
                    <th style={{ textAlign: "right" }}>Management Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orgs.map((org) => (
                    <tr key={org.id} className={org.status === "PENDING" ? "row-pending-highlight" : ""}>
                      <td data-label="Vendor / Enterprise">
                        <strong>{org.name}</strong>
                        <div className="table-sub">{org.address || "Nepal"}</div>
                      </td>
                      <td data-label="Owner &amp; Contact">
                        <div>{org.owner.name}</div>
                        <div className="table-sub">{org.owner.email}</div>
                        {org.owner.phone && <div className="table-sub">{org.owner.phone}</div>}
                      </td>
                      <td data-label="Category &amp; PAN/VAT">
                        <div>{org.vendorCategory || "General Commercial"}</div>
                        <div className="table-sub">PAN/VAT: {org.panVatNumber || org.taxNumber || "—"}</div>
                      </td>
                      <td data-label="Registered">
                        <small>{formatDualDate(org.createdAt)}</small>
                      </td>
                      <td data-label="Workspace Usage">
                        <span className="badge gray">
                          {org._count.invoices} Invoices · {org._count.expenses} Expenses · {org._count.employees} Staff
                        </span>
                      </td>
                      <td data-label="Status">
                        <span
                          className={`badge ${
                            org.status === "APPROVED"
                              ? "green"
                              : org.status === "PENDING"
                              ? "amber"
                              : "red"
                          }`}
                        >
                          {org.status}
                        </span>
                      </td>
                      <td data-label="Management Actions" style={{ textAlign: "right" }}>
                        <div className="action-button-group" style={{ display: "inline-flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                          {org.status === "PENDING" && (
                            <>
                              <form action={approveVendorAction} style={{ display: "inline" }}>
                                <input type="hidden" name="orgId" value={org.id} />
                                <input type="hidden" name="userId" value={org.ownerId} />
                                <button className="success-btn" title="Approve vendor workspace">
                                  Approve
                                </button>
                              </form>
                              <form action={rejectVendorAction} style={{ display: "inline" }}>
                                <input type="hidden" name="orgId" value={org.id} />
                                <input type="hidden" name="userId" value={org.ownerId} />
                                <button className="danger-btn" title="Reject vendor request">
                                  Reject
                                </button>
                              </form>
                            </>
                          )}

                          {org.status === "APPROVED" && (
                            <>
                              <Link
                                href={`/${org.id}`}
                                className="secondary-btn"
                                target="_blank"
                                title="Open Vendor Workspace"
                              >
                                <ExternalLink size={12} />
                                Open
                              </Link>
                              <Link
                                href={`/${org.id}/banking`}
                                className="secondary-btn"
                                target="_blank"
                                title="Audit and modify workspace transactions"
                              >
                                <Landmark size={12} />
                                Audit Ledger
                              </Link>
                              <form action={suspendVendorAction} style={{ display: "inline" }}>
                                <input type="hidden" name="orgId" value={org.id} />
                                <input type="hidden" name="userId" value={org.ownerId} />
                                <button className="danger-btn" title="Suspend vendor access">
                                  Suspend
                                </button>
                              </form>
                            </>
                          )}

                          {(org.status === "REJECTED" || org.status === "SUSPENDED") && (
                            <form action={approveVendorAction} style={{ display: "inline" }}>
                              <input type="hidden" name="orgId" value={org.id} />
                              <input type="hidden" name="userId" value={org.ownerId} />
                              <button className="success-btn" title="Re-approve vendor">
                                Re-Approve
                              </button>
                            </form>
                          )}

                          <Link href={"/admin/vendors/" + org.id + "/edit"} className="ghost-btn" title="Manage vendor credentials">
                            <KeyRound size={13} /> Edit
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!orgs.length && (
                    <tr>
                      <td colSpan={7} style={{ textAlign: "center", padding: "32px" }}>
                        No vendors found for the selected filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </DataTable>
            </div>
          </>
        )}

        {/* 2. TRANSACTION AUDIT & DIRECT MODIFICATION TAB */}
        {tab === "transactions" && (
          <>
            <div className="admin-title-row">
              <div>
                <h2>Global Transaction Master &amp; Modification Control</h2>
                <p>Super Admin Centralized Audit: Inspect, verify, and modify complete details for expenses, incomes, and bank transactions across all client enterprises.</p>
              </div>
            </div>

            {/* TRANSACTION FILTER BAR */}
            <div className="admin-filter-bar">
              <div className="filter-tabs">
                <Link href={txFilterHref("ALL")} className={`filter-tab ${txType === "ALL" ? "active" : ""}`}>
                  All Transactions ({transactionsList.length})
                </Link>
                <Link href={txFilterHref("EXPENSE")} className={`filter-tab ${txType === "EXPENSE" ? "active" : ""}`}>
                  Expenses Only
                </Link>
                <Link href={txFilterHref("INCOME")} className={`filter-tab ${txType === "INCOME" ? "active" : ""}`}>
                  Incomes &amp; Receipts
                </Link>
                <Link href={txFilterHref("BANK")} className={`filter-tab ${txType === "BANK" ? "active" : ""}`}>
                  Bank Deposits &amp; Withdrawals
                </Link>
              </div>

              <form className="admin-search" method="get" action="/admin" role="search">
                <input type="hidden" name="tab" value="transactions" />
                {txType !== "ALL" && <input type="hidden" name="txType" value={txType} />}
                <input
                  type="search"
                  name="search"
                  defaultValue={search}
                  aria-label="Search transactions"
                  placeholder="Particulars, party, vendor, or workspace name..."
                />
                <button className="primary-btn" type="submit">Search</button>
                {search && <Link href={`/admin?tab=transactions${txType !== "ALL" ? `&txType=${txType}` : ""}`} className="ghost-btn">Clear</Link>}
              </form>
            </div>

            {/* TRANSACTIONS TABLE */}
            <div className="table-card">
              <div className="table-toolbar">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <h3>Transaction Audit Stream</h3>
                  <span className="badge purple">{transactionsList.length} recent transactions</span>
                </div>
              </div>
              <div className="table-scroll">
                <DataTable className="responsive-table">
                  <thead>
                    <tr>
                      <th>Date (BS / AD)</th>
                      <th>Enterprise / Workspace</th>
                      <th>Type</th>
                      <th>Description / Particulars</th>
                      <th>Channel / Account</th>
                      <th>Party / Vendor</th>
                      <th style={{ textAlign: "right" }}>Amount</th>
                      <th style={{ textAlign: "center", width: 120 }}>Admin Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactionsList.map((tx) => (
                      <tr key={`${tx.kind}-${tx.id}`}>
                        <td data-label="Date">
                          <div>{formatBsDate(tx.date)}</div>
                          <div className="table-sub">{tx.date.toISOString().slice(0, 10)} AD</div>
                        </td>
                        <td data-label="Enterprise">
                          <span className="badge cyan" style={{ fontSize: 10.5 }}>
                            {tx.orgName}
                          </span>
                        </td>
                        <td data-label="Type">
                          <span className={`badge ${tx.badgeCls}`} style={{ fontSize: 10 }}>
                            {tx.typeLabel}
                          </span>
                        </td>
                        <td data-label="Description" className="table-title">
                          <strong>{tx.title}</strong>
                        </td>
                        <td data-label="Channel" style={{ fontSize: 11.5 }}>
                          {tx.channel}
                        </td>
                        <td data-label="Party">
                          {tx.party}
                        </td>
                        <td
                          data-label="Amount"
                          style={{
                            textAlign: "right",
                            fontWeight: 700,
                            color: tx.amount >= 0 ? "var(--success)" : "var(--danger)",
                          }}
                        >
                          {tx.amount >= 0 ? `+ ${money(tx.amount, "NPR")}` : `- ${money(Math.abs(tx.amount), "NPR")}`}
                        </td>
                        <td data-label="Admin Action" style={{ textAlign: "center" }}>
                          <Link
                            href={tx.editUrl}
                            className="primary-btn"
                            style={{ fontSize: 11, padding: "4px 10px", display: "inline-flex", alignItems: "center", gap: 4 }}
                            title="Modify full transaction details"
                          >
                            <Edit3 size={11} />
                            Edit Details
                          </Link>
                        </td>
                      </tr>
                    ))}
                    {!transactionsList.length && (
                      <tr>
                        <td colSpan={8} style={{ textAlign: "center", padding: "32px", color: "var(--text-muted)" }}>
                          No transactions found matching the audit search criteria.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </DataTable>
              </div>
            </div>
          </>
        )}

        {tab === "users" && (
          <>
            <div className="admin-title-row">
              <div>
                <h2>Platform User Management &amp; Workspace Access</h2>
                <p>
                  Audit system users, assign operational roles (CRM, Accounts, Admin, HR), and control which company workspaces each user can access.
                </p>
              </div>
            </div>

            {/* KPI METRICS OVERVIEW */}
            <div className="admin-kpi-grid">
              <div className="kpi-metric-card">
                <span className="kpi-label">Total Platform Users</span>
                <div className="kpi-value">{allUsersCount}</div>
                <div className="kpi-sub">Registered accounts</div>
              </div>
              <div className="kpi-metric-card">
                <span className="kpi-label">Super Administrators</span>
                <div className="kpi-value" style={{ color: "var(--purple)" }}>
                  {systemUsers.filter((u) => u.role === "SUPER_ADMIN").length}
                </div>
                <div className="kpi-sub">Master platform access</div>
              </div>
              <div className="kpi-metric-card">
                <span className="kpi-label">Workspace Memberships</span>
                <div className="kpi-value" style={{ color: "var(--brand)" }}>
                  {systemUsers.reduce((sum, u) => sum + u.memberships.length, 0)}
                </div>
                <div className="kpi-sub">Company &amp; household bindings</div>
              </div>
              <div className="kpi-metric-card">
                <span className="kpi-label">Operational CRM &amp; Accounts</span>
                <div className="kpi-value" style={{ color: "var(--success)" }}>
                  {
                    systemUsers.filter((u) =>
                      u.memberships.some((m) =>
                        ["ACCOUNTANT", "SALES", "HR", "ADMIN"].includes(m.role)
                      )
                    ).length
                  }
                </div>
                <div className="kpi-sub">Specialized department users</div>
              </div>
            </div>

            {/* SEARCH & FILTERS BAR */}
            <div className="admin-filter-bar">
              <form
                method="GET"
                action="/admin"
                style={{ display: "flex", gap: 8, alignItems: "center", flex: 1, maxWidth: 500 }}
              >
                <input type="hidden" name="tab" value="users" />
                <div style={{ position: "relative", flex: 1 }}>
                  <Search
                    size={15}
                    style={{
                      position: "absolute",
                      left: 10,
                      top: "50%",
                      transform: "translateY(-50%)",
                      color: "var(--text-muted)",
                    }}
                  />
                  <input
                    type="search"
                    name="search"
                    defaultValue={search}
                    placeholder="Filter by user name or email address..."
                    style={{ width: "100%", paddingLeft: 32 }}
                  />
                </div>
                <button type="submit" className="secondary-btn" style={{ minHeight: 34 }}>
                  Filter
                </button>
                {search && (
                  <Link href="/admin?tab=users" className="ghost-btn" style={{ minHeight: 34 }}>
                    Clear
                  </Link>
                )}
              </form>
            </div>

            {/* USERS & WORKSPACES DIRECTORY TABLE */}
            <div className="table-card">
              <div className="table-wrap">
                <DataTable>
                  <thead>
                    <tr>
                      <th>User Account</th>
                      <th>Email Address</th>
                      <th>System Role</th>
                      <th>Status</th>
                      <th>Permitted Workspaces &amp; Roles</th>
                      <th>Joined Date</th>
                      <th style={{ textAlign: "center" }}>Workspace Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {systemUsers.map((u) => (
                      <tr key={u.id}>
                        <td data-label="User Account">
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div
                              style={{
                                width: 32,
                                height: 32,
                                borderRadius: "50%",
                                background: u.role === "SUPER_ADMIN" ? "var(--purple)" : "var(--brand)",
                                color: "#ffffff",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontWeight: 700,
                                fontSize: 13,
                                flexShrink: 0,
                              }}
                            >
                              {u.name.slice(0, 1).toUpperCase()}
                            </div>
                            <div>
                              <strong style={{ fontSize: 13 }}>{u.name}</strong>
                              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>ID: {u.id}</div>
                            </div>
                          </div>
                        </td>
                        <td data-label="Email Address">
                          <span style={{ fontSize: 12.5, fontFamily: "monospace" }}>{u.email}</span>
                        </td>
                        <td data-label="System Role">
                          <span className={`badge ${u.role === "SUPER_ADMIN" ? "purple" : "slate"}`}>
                            {u.role === "SUPER_ADMIN" ? "Master Super Admin" : "Company User"}
                          </span>
                        </td>
                        <td data-label="Status">
                          <span
                            className={`badge ${
                              u.status === "APPROVED"
                                ? "green"
                                : u.status === "PENDING"
                                ? "amber"
                                : "red"
                            }`}
                          >
                            {u.status}
                          </span>
                        </td>
                        <td data-label="Permitted Workspaces & Roles">
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {u.memberships.map((m) => (
                              <Link
                                key={m.id}
                                href={`/${m.organizationId}/users`}
                                className="panel-link"
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 5,
                                  fontSize: 11.5,
                                  padding: "3px 8px",
                                  borderRadius: 6,
                                  background: "var(--soft)",
                                  border: "1px solid var(--line)",
                                  textDecoration: "none",
                                }}
                                title={`Manage in ${m.organization.name}`}
                              >
                                <span style={{ fontWeight: 600, color: "var(--text)" }}>
                                  {m.organization.name}
                                </span>
                                <span
                                  className={`badge ${
                                    m.role === "OWNER"
                                      ? "purple"
                                      : m.role === "ADMIN"
                                      ? "blue"
                                      : m.role === "ACCOUNTANT"
                                      ? "green"
                                      : m.role === "SALES"
                                      ? "amber"
                                      : "slate"
                                  }`}
                                  style={{ fontSize: 9.5, padding: "1px 5px" }}
                                >
                                  {m.role}
                                </span>
                              </Link>
                            ))}
                            {!u.memberships.length && (
                              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                                No assigned workspaces
                              </span>
                            )}
                          </div>
                        </td>
                        <td data-label="Joined Date">
                          <div style={{ fontSize: 12 }}>{formatDualDate(u.createdAt)}</div>
                        </td>
                        <td data-label="Workspace Action" style={{ textAlign: "center" }}>
                          {u.memberships[0] ? (
                            <Link
                              href={`/${u.memberships[0].organizationId}/users`}
                              className="secondary-btn"
                              style={{
                                fontSize: 11,
                                padding: "4px 10px",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                              }}
                              title="Manage workspace membership & role"
                            >
                              <Users size={11} />
                              Manage Roles
                            </Link>
                          ) : (
                            <span style={{ fontSize: 11, color: "var(--text-dim)" }}>—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {!systemUsers.length && (
                      <tr>
                        <td colSpan={7} style={{ textAlign: "center", padding: "32px", color: "var(--text-muted)" }}>
                          No users found matching the filter criteria.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </DataTable>
              </div>
            </div>
          </>
        )}
      </main>

    </div>
  );
}
