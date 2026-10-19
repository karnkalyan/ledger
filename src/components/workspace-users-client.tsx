"use client";

import { useState } from "react";
import {
  Users,
  UserPlus,
  ShieldCheck,
  Shield,
  Briefcase,
  Calculator,
  UserCheck,
  Eye,
  Trash2,
  Building2,
  Check,
  X,
  Search,
  Key,
  ExternalLink,
} from "lucide-react";
import {
  addWorkspaceMemberAction,
  updateWorkspaceMemberRoleAction,
  removeWorkspaceMemberAction,
  updateUserWorkspacesAction,
} from "@/app/(dashboard)/[orgId]/users/actions";
import { FormPendingFeedback } from "@/components/form-pending-feedback";
import { formatDualDate } from "@/lib/nepali-calendar";

type Member = {
  id: string;
  userId: string;
  role: string;
  createdAt: Date;
  user: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    status: string;
  };
  userWorkspaces: {
    id: string;
    name: string;
    kind: string;
    role: string;
  }[];
};

type WorkspaceOption = {
  id: string;
  name: string;
  kind: string;
};

type CandidateUser = {
  id: string;
  name: string;
  email: string;
};

const ROLE_INFO: Record<string, { label: string; badgeCls: string; icon: any; desc: string }> = {
  OWNER: {
    label: "Workspace Owner",
    badgeCls: "purple",
    icon: ShieldCheck,
    desc: "Primary legal & administrative owner with full authority over all modules and settings.",
  },
  ADMIN: {
    label: "Company Administrator",
    badgeCls: "cyan",
    icon: Shield,
    desc: "Full company access: manage users, settings, commerce, stock, financial ledgers, and staff.",
  },
  ACCOUNTANT: {
    label: "Accountant & Finance",
    badgeCls: "green",
    icon: Calculator,
    desc: "Commercial invoices, quotes, expense management, income receipts, banking, and financial reports.",
  },
  SALES: {
    label: "CRM & Sales Specialist",
    badgeCls: "amber",
    icon: Briefcase,
    desc: "Customer & vendor CRM profiles, deals/leads, quotations, sales orders, and product stock lookup.",
  },
  HR: {
    label: "Human Resources (HRM)",
    badgeCls: "purple",
    icon: UserCheck,
    desc: "Employee directory, monthly payroll disbursements, leave requests, attendance, and tasks.",
  },
  VIEWER: {
    label: "Read-only Viewer",
    badgeCls: "slate",
    icon: Eye,
    desc: "Oversight access to review statements and records without permission to create, edit or delete.",
  },
};

export function WorkspaceUsersClient({
  orgId,
  currentOrgName,
  ownerId,
  members,
  candidateUsers,
  allWorkspaces,
}: {
  orgId: string;
  currentOrgName: string;
  ownerId: string;
  members: Member[];
  candidateUsers: CandidateUser[];
  allWorkspaces: WorkspaceOption[];
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRoleFilter, setSelectedRoleFilter] = useState("ALL");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addMode, setAddMode] = useState<"NEW" | "EXISTING">("NEW");
  const [managingWorkspacesUser, setManagingWorkspacesUser] = useState<Member | null>(null);

  const filteredMembers = members.filter((m) => {
    const matchesSearch =
      m.user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (m.user.phone && m.user.phone.includes(searchTerm));
    const matchesRole = selectedRoleFilter === "ALL" || m.role === selectedRoleFilter;
    return matchesSearch && matchesRole;
  });

  const adminCount = members.filter((m) => m.role === "ADMIN" || m.role === "OWNER").length;
  const accountantCount = members.filter((m) => m.role === "ACCOUNTANT").length;
  const salesCount = members.filter((m) => m.role === "SALES").length;
  const hrCount = members.filter((m) => m.role === "HR").length;
  const viewerCount = members.filter((m) => m.role === "VIEWER").length;

  return (
    <div>
      {/* KPI METRIC STRIP */}
      <div className="grid-kpis" style={{ marginBottom: 24 }}>
        <div className="kpi-card">
          <span className="kpi-label">Total Workspace Members</span>
          <strong className="kpi-value">{members.length}</strong>
          <span className="kpi-meta">Active users with assigned roles</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Admins &amp; Owners</span>
          <strong className="kpi-value" style={{ color: "var(--purple)" }}>
            {adminCount}
          </strong>
          <span className="kpi-meta">Full company administration</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Accountants &amp; Finance</span>
          <strong className="kpi-value" style={{ color: "var(--success)" }}>
            {accountantCount}
          </strong>
          <span className="kpi-meta">Invoices, expenses &amp; banks</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">CRM &amp; Sales Users</span>
          <strong className="kpi-value" style={{ color: "var(--warning)" }}>
            {salesCount}
          </strong>
          <span className="kpi-meta">Customers, leads &amp; orders</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">HR &amp; Viewers</span>
          <strong className="kpi-value" style={{ color: "var(--cyan)" }}>
            {hrCount + viewerCount}
          </strong>
          <span className="kpi-meta">{hrCount} HR · {viewerCount} Viewers</span>
        </div>
      </div>

      {/* TOOLBAR & SEARCH */}
      <div className="table-card" style={{ marginBottom: 24 }}>
        <div className="table-toolbar" style={{ flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 260 }}>
            <div style={{ position: "relative", flex: 1 }}>
              <Search
                size={14}
                style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }}
              />
              <input
                type="text"
                placeholder="Search user by name, email, phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ paddingLeft: 30, width: "100%", height: 34, fontSize: 13 }}
              />
            </div>
            <select
              value={selectedRoleFilter}
              onChange={(e) => setSelectedRoleFilter(e.target.value)}
              style={{ height: 34, fontSize: 12.5, minWidth: 150 }}
            >
              <option value="ALL">All Roles ({members.length})</option>
              <option value="ADMIN">Admins &amp; Owners ({adminCount})</option>
              <option value="ACCOUNTANT">Accountants ({accountantCount})</option>
              <option value="SALES">CRM / Sales ({salesCount})</option>
              <option value="HR">HR Staff ({hrCount})</option>
              <option value="VIEWER">Viewers ({viewerCount})</option>
            </select>
          </div>

          <button
            type="button"
            className="primary-btn"
            onClick={() => setIsAddModalOpen(true)}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 34, fontSize: 13 }}
          >
            <UserPlus size={15} />
            <span>Add / Invite User</span>
          </button>
        </div>

        {/* MEMBERS TABLE */}
        <div className="table-scroll">
          <table className="responsive-table">
            <thead>
              <tr>
                <th>User &amp; Contact</th>
                <th>Workspace Role</th>
                <th>Accessible Workspaces</th>
                <th>Joined Date</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredMembers.map((m) => {
                const isOwner = m.userId === ownerId || m.role === "OWNER";
                const info = ROLE_INFO[m.role] || ROLE_INFO.VIEWER;
                const Icon = info.icon;
                return (
                  <tr key={m.id}>
                    <td data-label="User">
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: "50%",
                            background: "var(--brand-soft)",
                            color: "var(--brand)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontWeight: 700,
                            fontSize: 14,
                            flexShrink: 0,
                          }}
                        >
                          {m.user.name.slice(0, 1).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13.5 }}>{m.user.name}</div>
                          <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{m.user.email}</div>
                          {m.user.phone && (
                            <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{m.user.phone}</div>
                          )}
                        </div>
                      </div>
                    </td>

                    <td data-label="Role">
                      {isOwner ? (
                        <span className="badge purple" style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                          <ShieldCheck size={12} /> Workspace Owner
                        </span>
                      ) : (
                        <form action={updateWorkspaceMemberRoleAction} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          <FormPendingFeedback processingMessage="Updating role..." successMessage="Role updated" />
                          <input type="hidden" name="orgId" value={orgId} />
                          <input type="hidden" name="membershipId" value={m.id} />
                          <select
                            name="role"
                            defaultValue={m.role}
                            onChange={(e) => e.target.form?.requestSubmit()}
                            style={{
                              fontSize: 12,
                              padding: "4px 8px",
                              height: 30,
                              borderRadius: 6,
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                          >
                            <option value="ADMIN">ADMIN (Full Company)</option>
                            <option value="ACCOUNTANT">ACCOUNTANT (Accounts &amp; Banks)</option>
                            <option value="SALES">SALES (CRM &amp; Invoices)</option>
                            <option value="HR">HR (Staff &amp; Payroll)</option>
                            <option value="VIEWER">VIEWER (Read Only)</option>
                          </select>
                        </form>
                      )}
                    </td>

                    <td data-label="Workspaces">
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <span className="badge cyan" style={{ fontSize: 11 }}>
                          {m.userWorkspaces.length} workspace{m.userWorkspaces.length === 1 ? "" : "s"}
                        </span>
                        <button
                          type="button"
                          className="secondary-btn"
                          onClick={() => setManagingWorkspacesUser(m)}
                          style={{ fontSize: 11, padding: "2px 7px", height: 24 }}
                          title="Manage which workspaces this user can access"
                        >
                          Configure Access →
                        </button>
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                        {m.userWorkspaces.map((w) => w.name).slice(0, 2).join(", ")}
                        {m.userWorkspaces.length > 2 && ` +${m.userWorkspaces.length - 2} more`}
                      </div>
                    </td>

                    <td data-label="Joined">{formatDualDate(m.createdAt)}</td>

                    <td data-label="Actions" style={{ textAlign: "right" }}>
                      {!isOwner && (
                        <form
                          action={removeWorkspaceMemberAction}
                          onSubmit={(e) => {
                            if (!confirm(`Are you sure you want to remove ${m.user.name} from this workspace?`)) {
                              e.preventDefault();
                            }
                          }}
                          style={{ display: "inline-block" }}
                        >
                          <FormPendingFeedback processingMessage="Removing member..." successMessage="Member removed" />
                          <input type="hidden" name="orgId" value={orgId} />
                          <input type="hidden" name="membershipId" value={m.id} />
                          <button
                            type="submit"
                            className="ghost-btn icon-btn"
                            style={{ color: "var(--danger)" }}
                            title="Remove member from workspace"
                          >
                            <Trash2 size={14} />
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                );
              })}

              {!filteredMembers.length && (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: 24, color: "var(--text-muted)" }}>
                    No workspace members found matching the filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ROLE PERMISSION CAPABILITIES REFERENCE CARD */}
      <div className="table-card" style={{ padding: "20px 24px", marginBottom: 24 }}>
        <h3 style={{ margin: "0 0 6px 0", fontSize: 16 }}>Workspace Role Capabilities &amp; Access Scope</h3>
        <p style={{ margin: "0 0 16px 0", fontSize: 12.5, color: "var(--text-muted)" }}>
          Company users only access the workspaces they are explicitly assigned to. Within each workspace, roles limit access to specific operational modules:
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
          {Object.entries(ROLE_INFO).map(([key, item]) => {
            const Icon = item.icon;
            return (
              <div
                key={key}
                style={{
                  padding: "14px 16px",
                  borderRadius: 8,
                  border: "1px solid var(--line)",
                  background: "var(--soft)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <Icon size={16} style={{ color: "var(--brand)" }} />
                  <strong style={{ fontSize: 13.5 }}>{item.label}</strong>
                  <span className={`badge ${item.badgeCls}`} style={{ fontSize: 10 }}>
                    {key}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.45 }}>{item.desc}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* MODAL: ADD / INVITE USER TO WORKSPACE */}
      {isAddModalOpen && (
        <div className="search-modal-backdrop" onClick={() => setIsAddModalOpen(false)}>
          <div className="search-modal-box" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, borderBottom: "1px solid var(--line)", paddingBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <UserPlus size={18} style={{ color: "var(--brand)" }} />
                <h3 style={{ margin: 0, fontSize: 16 }}>Add User to Workspace</h3>
              </div>
              <button type="button" className="ghost-btn icon-btn" onClick={() => setIsAddModalOpen(false)}>
                <X size={16} />
              </button>
            </div>

            {/* Toggle Mode */}
            <div style={{ display: "flex", gap: 8, marginBottom: 16, background: "var(--soft)", padding: 4, borderRadius: 8 }}>
              <button
                type="button"
                className={`secondary-btn ${addMode === "NEW" ? "active-tab" : ""}`}
                style={{ flex: 1, height: 32, fontSize: 12.5, fontWeight: addMode === "NEW" ? 700 : 500 }}
                onClick={() => setAddMode("NEW")}
              >
                Create New Company User
              </button>
              <button
                type="button"
                className={`secondary-btn ${addMode === "EXISTING" ? "active-tab" : ""}`}
                style={{ flex: 1, height: 32, fontSize: 12.5, fontWeight: addMode === "EXISTING" ? 700 : 500 }}
                onClick={() => setAddMode("EXISTING")}
              >
                Select Existing User
              </button>
            </div>

            <form
              action={async (formData) => {
                await addWorkspaceMemberAction(formData);
                setIsAddModalOpen(false);
              }}
            >
              <FormPendingFeedback processingMessage="Adding user to workspace..." successMessage="User added successfully!" />
              <input type="hidden" name="orgId" value={orgId} />
              <input type="hidden" name="mode" value={addMode} />

              <div className="form-grid">
                {addMode === "EXISTING" ? (
                  <label className="field full">
                    <span>Select User Profile</span>
                    <select name="existingUserId" required>
                      <option value="">-- Choose registered user --</option>
                      {candidateUsers.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name} ({u.email})
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <>
                    <label className="field">
                      <span>Full Name</span>
                      <input name="name" required placeholder="e.g. Ramesh Shrestha" />
                    </label>
                    <label className="field">
                      <span>Email Address</span>
                      <input name="email" type="email" required placeholder="user@company.com" />
                    </label>
                    <label className="field">
                      <span>Phone / Mobile</span>
                      <input name="phone" placeholder="+977-98..." />
                    </label>
                    <label className="field">
                      <span>Password (min. 6 characters)</span>
                      <input name="password" type="password" required defaultValue="Simulcast@123" />
                    </label>
                  </>
                )}

                <label className="field full">
                  <span>Workspace Operational Role</span>
                  <select name="role" defaultValue="ACCOUNTANT" required>
                    <option value="ADMIN">ADMIN — Full Company Access</option>
                    <option value="ACCOUNTANT">ACCOUNTANT — Invoices, Expenses, Income, Banking &amp; Reports</option>
                    <option value="SALES">SALES / CRM — Customers, Vendors, Leads, Sales Orders &amp; Quotes</option>
                    <option value="HR">HR — Staff Directory, Payroll &amp; Leave Approvals</option>
                    <option value="VIEWER">VIEWER — Read Only Inspection</option>
                  </select>
                </label>

                {/* WORKSPACE ACCESS SELECTION */}
                <div className="field full" style={{ background: "var(--soft)", padding: "12px 14px", borderRadius: 8, border: "1px solid var(--line)" }}>
                  <span style={{ fontWeight: 700, fontSize: 13, display: "block", marginBottom: 6 }}>
                    Permitted Workspaces for this User:
                  </span>
                  <small style={{ color: "var(--text-muted)", fontSize: 11.5, display: "block", marginBottom: 10 }}>
                    Company users will only be able to view and switch between the checked workspaces.
                  </small>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    {allWorkspaces.map((ws) => (
                      <label key={ws.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          name="allowedOrgIds"
                          value={ws.id}
                          defaultChecked={ws.id === orgId}
                          style={{ width: 16, height: 16, accentColor: "var(--brand)" }}
                        />
                        <span>{ws.name} ({ws.kind})</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="form-actions" style={{ marginTop: 16 }}>
                <button type="button" className="ghost-btn" onClick={() => setIsAddModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="primary-btn">
                  Add User to Workspace
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: MANAGE USER WORKSPACES ACCESS */}
      {managingWorkspacesUser && (
        <div className="search-modal-backdrop" onClick={() => setManagingWorkspacesUser(null)}>
          <div className="search-modal-box" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, borderBottom: "1px solid var(--line)", paddingBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Building2 size={18} style={{ color: "var(--brand)" }} />
                <h3 style={{ margin: 0, fontSize: 16 }}>
                  Configure Workspace Access for {managingWorkspacesUser.user.name}
                </h3>
              </div>
              <button type="button" className="ghost-btn icon-btn" onClick={() => setManagingWorkspacesUser(null)}>
                <X size={16} />
              </button>
            </div>

            <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 0, marginBottom: 14 }}>
              Check which workspaces <strong>{managingWorkspacesUser.user.name}</strong> ({managingWorkspacesUser.user.email}) can access. Company users can only log into and choose among permitted workspaces.
            </p>

            <form
              action={async (formData) => {
                await updateUserWorkspacesAction(formData);
                setManagingWorkspacesUser(null);
              }}
            >
              <FormPendingFeedback processingMessage="Saving workspace permissions..." successMessage="Permissions updated" />
              <input type="hidden" name="orgId" value={orgId} />
              <input type="hidden" name="userId" value={managingWorkspacesUser.userId} />

              <div style={{ display: "flex", flexDirection: "column", gap: 10, background: "var(--soft)", padding: 14, borderRadius: 8, border: "1px solid var(--line)", marginBottom: 16 }}>
                {allWorkspaces.map((ws) => {
                  const hasAccess = managingWorkspacesUser.userWorkspaces.some((w) => w.id === ws.id);
                  return (
                    <label
                      key={ws.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "8px 10px",
                        background: "var(--surface)",
                        borderRadius: 6,
                        border: "1px solid var(--line)",
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <input
                          type="checkbox"
                          name="allowedOrgIds"
                          value={ws.id}
                          defaultChecked={hasAccess}
                          style={{ width: 16, height: 16, accentColor: "var(--brand)" }}
                        />
                        <div>
                          <strong style={{ fontSize: 13 }}>{ws.name}</strong>
                          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Kind: {ws.kind}</div>
                        </div>
                      </div>
                      <span className={`badge ${ws.kind === "COMPANY" ? "purple" : "cyan"}`} style={{ fontSize: 10 }}>
                        {ws.kind}
                      </span>
                    </label>
                  );
                })}
              </div>

              <div className="form-actions">
                <button type="button" className="ghost-btn" onClick={() => setManagingWorkspacesUser(null)}>
                  Cancel
                </button>
                <button type="submit" className="primary-btn">
                  Save Allowed Workspaces
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
