import Link from "next/link";
import { Building2, Home, Plus, ShieldCheck, UserRound } from "lucide-react";
import { requireUser } from "@/lib/session";
import { getUserWorkspaces } from "@/lib/workspaces";
import { logoutAction } from "@/app/login/actions";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserRole } from "@/generated/client";

const iconFor = (kind: string) => kind === "COMPANY" ? Building2 : kind === "HOUSEHOLD" ? Home : UserRound;

export default async function WorkspacesPage() {
  const user = await requireUser();
  const memberships = await getUserWorkspaces(user.id);
  const offices = memberships.filter((m) => m.organization.kind === "COMPANY");
  const personals = memberships.filter((m) => m.organization.kind !== "COMPANY");

  return (
    <main className="workspace-page">
      <div className="workspace-shell">
        <div className="workspace-header">
          <div>
            <div className="brand-mark" style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <img 
                src="/logo-mark.png" 
                alt="Kashtrix Logo" 
                style={{ width: 32, height: 32, objectFit: "contain" }} 
              />
              <div>
                <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: "0.04em" }}>KASHTRIX</span>
                <div className="brand-sub" style={{ color: "var(--brand-pink)", fontWeight: 700 }}>ERP</div>
              </div>
            </div>
            <h1>Choose your workspace</h1>
            <p>Commercial ERP and personal finances remain completely separated. Switch anytime under one account.</p>
          </div>
          <div className="workspace-header-actions">
            <ThemeToggle />
            {user.role === UserRole.SUPER_ADMIN && (
              <Link href="/admin" className="secondary-btn">
                <ShieldCheck size={14} style={{ verticalAlign: "middle", marginRight: 5 }} />
                Super Admin Portal
              </Link>
            )}
            <form action={logoutAction}><button className="ghost-btn">Sign out</button></form>
          </div>
        </div>

        {/* WORKSPACE OVERVIEW WIDGET STRIP */}
        <div className="grid-kpis" style={{ marginBottom: 24 }}>
          <div className="kpi-card">
            <span className="kpi-label">Total Workspaces</span>
            <strong className="kpi-value">{memberships.length}</strong>
            <span className="kpi-meta">Accessible under your account</span>
          </div>
          <div className="kpi-card">
            <span className="kpi-label">Commercial Companies</span>
            <strong className="kpi-value" style={{ color: "var(--brand)" }}>{offices.length}</strong>
            <span className="kpi-meta">Invoicing, VAT &amp; Projects</span>
          </div>
          <div className="kpi-card">
            <span className="kpi-label">Household &amp; Personal</span>
            <strong className="kpi-value" style={{ color: "var(--success)" }}>{personals.length}</strong>
            <span className="kpi-meta">Family budgets &amp; expenses</span>
          </div>
          <div className="kpi-card">
            <span className="kpi-label">Security Role</span>
            <strong className="kpi-value" style={{ fontSize: 18, color: "var(--purple)" }}>{user.role}</strong>
            <span className="kpi-meta">{user.email}</span>
          </div>
        </div>

        <div className="workspace-sections">
        {offices.length > 0 && <section className="workspace-group">
          <div className="topbar-kicker">Office & Companies</div>
          <div className="workspace-grid">
            {offices.map(({ organization, role }) => { const Icon = iconFor(organization.kind); return (
              <Link className="workspace-card" href={`/${organization.id}`} key={organization.id}>
                <div className="workspace-card-top"><div className="workspace-icon"><Icon /></div><span className="badge purple">{role.toLowerCase()}</span></div>
                <h3>{organization.name}</h3><p>{organization.address || "Company ERP workspace"}</p>
                <div className="workspace-card-footer"><span>Sales · Purchase · CRM · HRM · Accounts</span><strong>Open →</strong></div>
              </Link>
            )})}
          </div>
        </section>}

        {personals.length > 0 && <section className="workspace-group">
          <div className="topbar-kicker">Personal & Household</div>
          <div className="workspace-grid">
            {personals.map(({ organization, role }) => { const Icon = iconFor(organization.kind); return (
              <Link className="workspace-card" href={`/${organization.id}`} key={organization.id}>
                <div className="workspace-card-top"><div className="workspace-icon"><Icon /></div><span className="badge cyan">{organization.kind.toLowerCase()}</span></div>
                <h3>{organization.name}</h3><p>{organization.address || "Personal money & household expense workspace"}</p>
                <div className="workspace-card-footer"><span>Income · Rent · Grocery · Bills · Reminders</span><strong>Open →</strong></div>
              </Link>
            )})}
          </div>
        </section>}
        </div>

        <Link href="/workspaces/new" className="secondary-btn"><Plus size={16} /> Add company / house / personal</Link>
      </div>
    </main>
  );
}
