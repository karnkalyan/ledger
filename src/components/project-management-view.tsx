"use client";

import { useState } from "react";
import Link from "next/link";
import {
  FolderKanban, Plus, Search, Filter, Calendar, Users, DollarSign,
  Edit3, Trash2, CheckCircle2, Clock, AlertTriangle, ArrowRight, Wallet,
  CalendarDays, Tag, ShieldCheck, ChevronRight
} from "lucide-react";
import { money, shortDate } from "@/lib/format";
import { ProjectModal } from "@/components/project-modal";
import { ConfirmModal } from "@/components/confirm-modal";
import { deleteProjectAction } from "@/app/(dashboard)/actions";
import { toast } from "@/components/toast-provider";
import { adToBs, formatBsDate } from "@/lib/nepali-calendar";

interface ProjectItem {
  id: string;
  name: string;
  description?: string | null;
  status: string;
  priority: string;
  workNature?: string | null;
  subWorkNature?: string | null;
  fiscalYear?: string | null;
  budget: number | string;
  startDate?: Date | string | null;
  endDate?: Date | string | null;
  createdAt: Date | string;
  contact?: { id: string; name: string; companyName?: string | null } | null;
  teamLeader?: { id: string; name: string; designation?: string | null } | null;
  members?: { id: string; employee: { id: string; name: string } }[];
  wallets?: {
    id: string;
    totalBudget: number | string;
    transferredAmount: number | string;
    holdAmount: number | string;
    leaderHoldAmount: number | string;
    balance: number | string;
  }[];
  tasksCount?: number;
}

interface ContactOption {
  id: string;
  name: string;
  companyName?: string | null;
}

interface EmployeeOption {
  id: string;
  name: string;
  designation?: string | null;
}

export function ProjectManagementView({
  orgId,
  projects = [],
  contacts = [],
  employees = [],
  fiscalYears = ["2081/82", "2082/83", "2083/84"],
}: {
  orgId: string;
  projects: ProjectItem[];
  contacts: ContactOption[];
  employees: EmployeeOption[];
  fiscalYears?: string[];
}) {
  const [activeTab, setActiveTab] = useState<"all" | "today" | "tomorrow" | "upcoming" | "archived" | "kanban">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [natureFilter, setNatureFilter] = useState("ALL");

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dayAfterTomorrow = new Date(today);
  dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);

  // Filter projects by Tab and Search
  const filteredProjects = projects.filter((p) => {
    // Tab filter
    if (activeTab === "archived" && p.status !== "ARCHIVED") return false;
    if (activeTab !== "archived" && p.status === "ARCHIVED" && activeTab !== "all") return false;

    if (activeTab === "today") {
      if (!p.startDate) return false;
      const d = new Date(p.startDate);
      d.setHours(0, 0, 0, 0);
      if (d.getTime() !== today.getTime()) return false;
    } else if (activeTab === "tomorrow") {
      if (!p.startDate) return false;
      const d = new Date(p.startDate);
      d.setHours(0, 0, 0, 0);
      if (d.getTime() !== tomorrow.getTime()) return false;
    } else if (activeTab === "upcoming") {
      if (p.status !== "UPCOMING" && (!p.startDate || new Date(p.startDate) <= today)) return false;
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = p.name.toLowerCase().includes(q);
      const matchClient = p.contact?.name.toLowerCase().includes(q) || p.contact?.companyName?.toLowerCase().includes(q);
      const matchLeader = p.teamLeader?.name.toLowerCase().includes(q);
      const matchNature = p.workNature?.toLowerCase().includes(q) || p.subWorkNature?.toLowerCase().includes(q);
      if (!matchName && !matchClient && !matchLeader && !matchNature) return false;
    }

    // Priority filter
    if (priorityFilter !== "ALL" && p.priority !== priorityFilter) return false;

    // Nature filter
    if (natureFilter !== "ALL" && p.workNature !== natureFilter) return false;

    return true;
  });

  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    id: string;
    name: string;
    loading: boolean;
  }>({
    isOpen: false,
    id: "",
    name: "",
    loading: false,
  });

  const handleDelete = (id: string, name: string) => {
    setDeleteConfirm({
      isOpen: true,
      id,
      name,
      loading: false,
    });
  };

  const executeDeleteProject = async () => {
    if (!deleteConfirm.id) return;
    try {
      setDeleteConfirm((prev) => ({ ...prev, loading: true }));
      const fd = new FormData();
      fd.set("orgId", orgId);
      fd.set("id", deleteConfirm.id);
      await deleteProjectAction(fd);
      toast.success("Project deleted successfully");
      setDeleteConfirm({ isOpen: false, id: "", name: "", loading: false });
    } catch {
      toast.error("Failed to delete project");
      setDeleteConfirm((prev) => ({ ...prev, loading: false }));
    }
  };

  // KPIs
  const totalBudget = projects.reduce((acc, p) => acc + Number(p.budget || 0), 0);
  const activeCount = projects.filter((p) => p.status === "ACTIVE").length;
  const totalTransferred = projects.reduce((acc, p) => {
    const w = p.wallets?.[0];
    return acc + Number(w?.transferredAmount || 0);
  }, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Top Header & Actions */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: "var(--text)" }}>
            Project Operations &amp; Portfolios
          </h2>
          <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "3px 0 0" }}>
            Real-time project governance, team assignments, work natures, and wallet budgets.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <ProjectModal
            orgId={orgId}
            contacts={contacts}
            employees={employees}
            fiscalYears={fiscalYears}
          />
        </div>
      </div>

      {/* KPI Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 12,
        }}
      >
        <div className="summary-card" style={{ padding: 16 }}>
          <span style={{ fontSize: 12, color: "var(--text-muted)", display: "block" }}>Total Projects</span>
          <strong style={{ fontSize: 22, color: "var(--text)" }}>{projects.length}</strong>
          <small style={{ color: "var(--text-muted)", display: "block", marginTop: 4 }}>
            {activeCount} actively in progress
          </small>
        </div>

        <div className="summary-card" style={{ padding: 16 }}>
          <span style={{ fontSize: 12, color: "var(--text-muted)", display: "block" }}>Total Portfolio Budget</span>
          <strong style={{ fontSize: 22, color: "#8b5cf6" }}>{money(totalBudget)}</strong>
          <small style={{ color: "var(--text-muted)", display: "block", marginTop: 4 }}>
            Aggregated across all contracts
          </small>
        </div>

        <div className="summary-card" style={{ padding: 16 }}>
          <span style={{ fontSize: 12, color: "var(--text-muted)", display: "block" }}>Wallet Disbursed</span>
          <strong style={{ fontSize: 22, color: "#10b981" }}>{money(totalTransferred)}</strong>
          <small style={{ color: "var(--text-muted)", display: "block", marginTop: 4 }}>
            Transferred to project leaders / members
          </small>
        </div>

        <div className="summary-card" style={{ padding: 16 }}>
          <span style={{ fontSize: 12, color: "var(--text-muted)", display: "block" }}>Remaining Unspent</span>
          <strong style={{ fontSize: 22, color: "#06b6d4" }}>
            {money(Math.max(0, totalBudget - totalTransferred))}
          </strong>
          <small style={{ color: "var(--text-muted)", display: "block", marginTop: 4 }}>
            Available for future milestones
          </small>
        </div>
      </div>

      {/* Tabs & Filters Bar (Matching Sajilo Task tabs) */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
          padding: "10px 14px",
          background: "var(--surface)",
          borderRadius: "var(--radius-md, 8px)",
          border: "1px solid var(--border)",
        }}
      >
        {/* Navigation Tabs */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {[
            { id: "all", label: "All Projects" },
            { id: "today", label: "Today" },
            { id: "tomorrow", label: "Tomorrow" },
            { id: "upcoming", label: "Upcoming" },
            { id: "archived", label: "Archived" },
            { id: "kanban", label: "Kanban Board" },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 6,
                  border: "none",
                  background: isActive ? "rgba(139, 92, 246, 0.15)" : "transparent",
                  color: isActive ? "#8b5cf6" : "var(--text-muted)",
                  fontWeight: isActive ? 700 : 500,
                  fontSize: 12.5,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Filter Inputs */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <div style={{ position: "relative", minWidth: 180 }}>
            <Search
              size={14}
              style={{
                position: "absolute",
                left: 10,
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--text-muted)",
              }}
            />
            <input
              type="text"
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                paddingLeft: 30,
                paddingRight: 10,
                paddingTop: 5,
                paddingBottom: 5,
                fontSize: 12,
                borderRadius: 6,
                border: "1px solid var(--border)",
                background: "var(--soft)",
                color: "var(--text)",
                width: "100%",
              }}
            />
          </div>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            style={{
              fontSize: 12,
              padding: "5px 8px",
              borderRadius: 6,
              border: "1px solid var(--border)",
              background: "var(--soft)",
              color: "var(--text)",
            }}
          >
            <option value="ALL">All Priorities</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="URGENT">Urgent</option>
          </select>
        </div>
      </div>

      {/* Main Content: Table or Kanban */}
      {activeTab === "kanban" ? (
        /* Kanban Board View */
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 14,
            alignItems: "start",
          }}
        >
          {["UPCOMING", "ACTIVE", "COMPLETED", "ARCHIVED"].map((colStatus) => {
            const colProjects = filteredProjects.filter((p) => p.status === colStatus);
            const statusColor =
              colStatus === "ACTIVE"
                ? "#10b981"
                : colStatus === "UPCOMING"
                ? "#0ea5e9"
                : colStatus === "COMPLETED"
                ? "#8b5cf6"
                : "#64748b";

            return (
              <div
                key={colStatus}
                style={{
                  background: "var(--surface)",
                  borderRadius: "var(--radius-md, 8px)",
                  border: "1px solid var(--border)",
                  padding: 12,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingBottom: 8,
                    marginBottom: 10,
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: statusColor,
                      }}
                    />
                    <strong style={{ fontSize: 13, textTransform: "capitalize", color: "var(--text)" }}>
                      {colStatus.toLowerCase()}
                    </strong>
                  </div>
                  <span
                    style={{
                      fontSize: 11,
                      padding: "2px 6px",
                      borderRadius: 10,
                      background: "var(--soft)",
                      color: "var(--text-muted)",
                      fontWeight: 600,
                    }}
                  >
                    {colProjects.length}
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {colProjects.map((p) => (
                    <div
                      key={p.id}
                      style={{
                        padding: 12,
                        borderRadius: 8,
                        background: "var(--soft)",
                        border: "1px solid var(--border)",
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 6 }}>
                        <strong style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.3 }}>
                          {p.name}
                        </strong>
                        <span
                          style={{
                            fontSize: 10,
                            padding: "2px 6px",
                            borderRadius: 4,
                            fontWeight: 600,
                            background:
                              p.priority === "URGENT"
                                ? "rgba(239, 68, 68, 0.15)"
                                : p.priority === "HIGH"
                                ? "rgba(245, 158, 11, 0.15)"
                                : "rgba(100, 116, 139, 0.15)",
                            color:
                              p.priority === "URGENT"
                                ? "#ef4444"
                                : p.priority === "HIGH"
                                ? "#f59e0b"
                                : "#64748b",
                          }}
                        >
                          {p.priority}
                        </span>
                      </div>

                      {p.workNature && (
                        <span style={{ fontSize: 11, color: "#8b5cf6", fontWeight: 600 }}>
                          {p.workNature} {p.subWorkNature ? `· ${p.subWorkNature}` : ""}
                        </span>
                      )}

                      {p.contact && (
                        <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                          Client: <strong>{p.contact.name}</strong>
                        </span>
                      )}

                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4, fontSize: 11.5 }}>
                        <span style={{ fontWeight: 600, color: "var(--text)" }}>
                          {money(p.budget)}
                        </span>
                        {p.teamLeader && (
                          <span style={{ color: "var(--text-muted)" }}>
                            Leader: {p.teamLeader.name}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}

                  {!colProjects.length && (
                    <div style={{ textAlign: "center", padding: "16px 8px", fontSize: 12, color: "var(--text-muted)" }}>
                      No projects
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <div className="table-card">
          <div className="table-scroll">
            <table className="responsive-table">
              <thead>
                <tr>
                  <th>Project Name &amp; Nature</th>
                  <th>Client / Entity</th>
                  <th>Team Leader &amp; Members</th>
                  <th>Fiscal Year</th>
                  <th>Budget &amp; Disbursed</th>
                  <th>Schedule</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProjects.map((p) => {
                  const wallet = p.wallets?.[0];
                  const budgetNum = Number(p.budget || 0);
                  const transferredNum = wallet ? Number(wallet.transferredAmount) : 0;
                  const memberIds = p.members?.map((m) => m.employee.id) || [];

                  let startBs = "";
                  if (p.startDate) {
                    try {
                      startBs = formatBsDate(p.startDate);
                    } catch {}
                  }

                  return (
                    <tr key={p.id}>
                      <td data-label="Project">
                        <ProjectModal
                          orgId={orgId}
                          contacts={contacts}
                          employees={employees}
                          fiscalYears={fiscalYears}
                          project={{
                            id: p.id,
                            name: p.name,
                            description: p.description,
                            contactId: p.contact?.id,
                            teamLeaderId: p.teamLeader?.id,
                            status: p.status,
                            priority: p.priority,
                            workNature: p.workNature,
                            subWorkNature: p.subWorkNature,
                            fiscalYear: p.fiscalYear,
                            budget: p.budget,
                            startDate: p.startDate,
                            endDate: p.endDate,
                            memberIds,
                          }}
                          trigger={
                            <div className="table-clickable-title" style={{ fontWeight: 650, color: "var(--text)" }}>
                              {p.name}
                            </div>
                          }
                        />
                        <div style={{ fontSize: 11.5, color: "#8b5cf6", marginTop: 2, fontWeight: 500 }}>
                          {p.workNature || "General Operations"} {p.subWorkNature ? `· ${p.subWorkNature}` : ""}
                        </div>
                      </td>

                      <td data-label="Client">
                        {p.contact ? (
                          <div>
                            <span style={{ fontWeight: 600, display: "block" }}>{p.contact.name}</span>
                            {p.contact.companyName && (
                              <small style={{ color: "var(--text-muted)" }}>{p.contact.companyName}</small>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: "var(--text-muted)" }}>—</span>
                        )}
                      </td>

                      <td data-label="Team">
                        <div>
                          <span style={{ fontWeight: 600, display: "block" }}>
                            {p.teamLeader?.name || "Unassigned"}
                          </span>
                          <small style={{ color: "var(--text-muted)" }}>
                            {p.members?.length || 0} assigned member{p.members?.length === 1 ? "" : "s"}
                          </small>
                        </div>
                      </td>

                      <td data-label="Fiscal Year">
                        <span style={{ fontSize: 12, fontWeight: 600 }}>{p.fiscalYear || "—"}</span>
                      </td>

                      <td data-label="Budget">
                        <div>
                          <strong style={{ display: "block", color: "var(--text)" }}>{money(budgetNum)}</strong>
                          <small style={{ color: "#10b981" }}>
                            Paid: {money(transferredNum)}
                          </small>
                        </div>
                      </td>

                      <td data-label="Schedule">
                        <div>
                          <span style={{ display: "block", fontSize: 12 }}>
                            {p.startDate ? shortDate(p.startDate) : "—"}
                          </span>
                          {startBs && (
                            <small style={{ color: "var(--text-muted)" }}>{startBs} BS</small>
                          )}
                        </div>
                      </td>

                      <td data-label="Status">
                        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                          <span
                            style={{
                              fontSize: 10.5,
                              padding: "2px 6px",
                              borderRadius: 4,
                              fontWeight: 650,
                              textTransform: "uppercase",
                              background:
                                p.status === "ACTIVE"
                                  ? "rgba(16, 185, 129, 0.15)"
                                  : p.status === "UPCOMING"
                                  ? "rgba(14, 165, 233, 0.15)"
                                  : p.status === "COMPLETED"
                                  ? "rgba(139, 92, 246, 0.15)"
                                  : "rgba(100, 116, 139, 0.15)",
                              color:
                                p.status === "ACTIVE"
                                  ? "#10b981"
                                  : p.status === "UPCOMING"
                                  ? "#0ea5e9"
                                  : p.status === "COMPLETED"
                                  ? "#8b5cf6"
                                  : "#64748b",
                            }}
                          >
                            {p.status}
                          </span>
                          <span
                            style={{
                              fontSize: 10,
                              color:
                                p.priority === "URGENT"
                                  ? "#ef4444"
                                  : p.priority === "HIGH"
                                  ? "#f59e0b"
                                  : "var(--text-muted)",
                              fontWeight: 600,
                            }}
                          >
                            {p.priority} Priority
                          </span>
                        </div>
                      </td>

                      <td data-label="Actions">
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <ProjectModal
                            orgId={orgId}
                            contacts={contacts}
                            employees={employees}
                            fiscalYears={fiscalYears}
                            project={{
                              id: p.id,
                              name: p.name,
                              description: p.description,
                              contactId: p.contact?.id,
                              teamLeaderId: p.teamLeader?.id,
                              status: p.status,
                              priority: p.priority,
                              workNature: p.workNature,
                              subWorkNature: p.subWorkNature,
                              fiscalYear: p.fiscalYear,
                              budget: p.budget,
                              startDate: p.startDate,
                              endDate: p.endDate,
                              memberIds,
                            }}
                            trigger={
                              <button
                                type="button"
                                className="secondary-btn"
                                style={{ padding: "3px 8px", fontSize: 11 }}
                                title="Edit Project"
                              >
                                <Edit3 size={11} /> Edit
                              </button>
                            }
                          />

                          <Link
                            href={`/${orgId}/wallets`}
                            className="secondary-btn"
                            style={{ padding: "3px 8px", fontSize: 11, display: "inline-flex", alignItems: "center", gap: 4 }}
                            title="Manage Project Wallet"
                          >
                            <Wallet size={11} /> Wallet
                          </Link>

                          <button
                            type="button"
                            className="secondary-btn"
                            onClick={() => handleDelete(p.id, p.name)}
                            style={{ padding: "3px 8px", fontSize: 11, color: "var(--danger, #ef4444)" }}
                            title="Delete Project"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {!filteredProjects.length && (
                  <tr>
                    <td colSpan={8} style={{ textAlign: "center", padding: 32, color: "var(--text-muted)" }}>
                      No projects found matching the current tab and filter criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Custom Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, id: "", name: "", loading: false })}
        onConfirm={executeDeleteProject}
        title="Delete Project"
        message="Are you sure you want to permanently delete this project? Associated task associations and project logs may be affected."
        itemLabel={deleteConfirm.name}
        confirmLabel="Yes, Delete Project"
        variant="danger"
        isLoading={deleteConfirm.loading}
      />
    </div>
  );
}
