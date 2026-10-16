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
import { formatDualDate } from "@/lib/nepali-calendar";
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
} from "lucide-react";

export default async function AdminVendorsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; search?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const fullUser = await db.user.findUnique({ where: { id: user.id } });
  if (!fullUser || fullUser.role !== "SUPER_ADMIN") {
    redirect("/workspaces");
  }

  const query = await searchParams;
  const filterStatus = Object.values(AccountStatus).includes(query.status as AccountStatus) ? query.status as AccountStatus : undefined;
  const search = query.search?.trim() || "";
  const filterHref = (status?: string) => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (search) params.set("search", search);
    return `/admin${params.size ? `?${params}` : ""}`;
  };

  // Query all organizations (vendors) with their owners
  const orgs = await db.organization.findMany({
    where: {
      kind: "COMPANY",
      ...(filterStatus
        ? { status: filterStatus }
        : {}),
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

  return (
    <div className="admin-page-shell">
      <header className="admin-topbar">
        <div className="admin-brand">
          <div className="brand-mark" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <img 
              src="/logo-mark.png" 
              alt="Simulcast Logo" 
              style={{ width: 30, height: 30, objectFit: "contain" }} 
            />
            <div>
              <span style={{ fontSize: 15, fontWeight: 800, letterSpacing: "0.04em" }}>SIMULCAST</span>
              <div className="brand-sub" style={{ color: "var(--brand-pink)", fontWeight: 700 }}>SUPER ADMIN</div>
            </div>
          </div>
          <span className="badge purple" style={{ marginLeft: 12 }}>
            <ShieldCheck size={12} style={{ verticalAlign: "middle", marginRight: 4 }} />
            Vendor Management Portal
          </span>
        </div>

        <div className="topbar-actions">
          <ThemeToggle />
          <Link href="/workspaces" className="ghost-btn">
            View Workspaces
          </Link>
          <div className="user-pill">
            <div className="avatar">SA</div>
            <div>
              <strong>{fullUser.name}</strong>
              <small>Super Administrator</small>
            </div>
          </div>
          <form action={logoutAction}>
            <button className="ghost-btn icon-btn" title="Sign out" aria-label="Sign out">
              <LogOut size={14} />
            </button>
          </form>
        </div>
      </header>

      <main className="admin-content-wrap">
        <div className="page-header">
          <div>
            <h1>Vendor Management & Approvals</h1>
            <p>
              Supervise all registered multi-vendor companies, review pending onboarding requests, approve licenses, and manage vendor credentials.
            </p>
          </div>
          <div className="page-actions">
            <Link href="/register" className="secondary-btn" target="_blank">
              <Store size={14} style={{ verticalAlign: "middle", marginRight: 5 }} />
              Vendor Register Page
            </Link>
          </div>
        </div>

        {/* METRICS KPI STRIP */}
        <div className="grid-kpis admin-kpis">
          <div className="kpi-card">
            <span className="kpi-label">Total Registered Vendors</span>
            <div className="kpi-value">{totalCount}</div>
            <div className="kpi-sub">Across all business categories</div>
          </div>
          <div className="kpi-card highlight-warning">
            <span className="kpi-label">Pending Approval Requests</span>
            <div className="kpi-value warning-text">{pendingCount}</div>
            <div className="kpi-sub">Awaiting admin verification</div>
          </div>
          <div className="kpi-card highlight-success">
            <span className="kpi-label">Active Approved Vendors</span>
            <div className="kpi-value success-text">{approvedCount}</div>
            <div className="kpi-sub">Live workspaces in production</div>
          </div>
          <div className="kpi-card">
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
          <div className="table-toolbar"><h3>Vendor directory</h3><span className="badge cyan">{orgs.length} matching vendors</span></div>
          <DataTable className="responsive-table admin-vendor-table">
            <thead>
              <tr>
                <th>Vendor / Enterprise</th>
                <th>Owner & Contact</th>
                <th>Category & PAN/VAT</th>
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
                  <td data-label="Owner & Contact">
                    <div>{org.owner.name}</div>
                    <div className="table-sub">{org.owner.email}</div>
                    {org.owner.phone && <div className="table-sub">{org.owner.phone}</div>}
                  </td>
                  <td data-label="Category & PAN/VAT">
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
                    <div className="action-button-group">
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

                      <Link href={"/admin/vendors/" + org.id + "/edit"} className="ghost-btn" title="Manage vendor credentials"><KeyRound size={13} /> Edit</Link>
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
      </main>
    </div>
  );
}
