"use client";

import { useState } from "react";
import {
  Clock, CheckCircle2, XCircle, Timer, Calendar, User, Search,
  Filter, AlertCircle, FileText, Check, X, ShieldCheck
} from "lucide-react";
import { shortDate } from "@/lib/format";
import { WorkLogModal } from "@/components/worklog-modal";
import { updateWorkLogStatusAction } from "@/app/(dashboard)/actions";
import { toast } from "@/components/toast-provider";
import { adToBs, formatBsDate } from "@/lib/nepali-calendar";

interface WorkLogItem {
  id: string;
  logDate: Date | string;
  nepaliDate?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  durationMinutes: number;
  isHolidayOrLeave: boolean;
  isChargeable: boolean;
  comment?: string | null;
  status: string;
  approvedById?: string | null;
  approvedAt?: Date | string | null;
  employee?: { id: string; name: string } | null;
  project?: { id: string; name: string } | null;
  task?: { id: string; title: string } | null;
}

interface ProjectOption {
  id: string;
  name: string;
}

interface TaskOption {
  id: string;
  title: string;
  projectId?: string | null;
}

interface EmployeeOption {
  id: string;
  name: string;
}

export function WorkLogManagementView({
  orgId,
  worklogs = [],
  projects = [],
  tasks = [],
  employees = [],
}: {
  orgId: string;
  worklogs: WorkLogItem[];
  projects: ProjectOption[];
  tasks: TaskOption[];
  employees: EmployeeOption[];
}) {
  const [activeTab, setActiveTab] = useState<"PENDING" | "APPROVED" | "REJECTED" | "ALL">("PENDING");
  const [searchQuery, setSearchQuery] = useState("");
  const [employeeFilter, setEmployeeFilter] = useState("ALL");
  const [selectedLog, setSelectedLog] = useState<WorkLogItem | null>(null);

  const filteredLogs = worklogs.filter((log) => {
    if (activeTab !== "ALL" && log.status !== activeTab) return false;
    if (employeeFilter !== "ALL" && log.employee?.id !== employeeFilter) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchEmp = log.employee?.name.toLowerCase().includes(q);
      const matchProj = log.project?.name.toLowerCase().includes(q);
      const matchTask = log.task?.title.toLowerCase().includes(q);
      const matchComment = log.comment?.toLowerCase().includes(q);
      if (!matchEmp && !matchProj && !matchTask && !matchComment) return false;
    }

    return true;
  });

  const handleStatusUpdate = async (id: string, status: "APPROVED" | "REJECTED") => {
    try {
      const fd = new FormData();
      fd.set("orgId", orgId);
      fd.set("id", id);
      fd.set("status", status);
      await updateWorkLogStatusAction(fd);
      toast.success(status === "APPROVED" ? "Work log approved" : "Work log rejected");
      if (selectedLog?.id === id) {
        setSelectedLog(null);
      }
    } catch {
      toast.error("Failed to update work log status");
    }
  };

  const totalMinutes = worklogs.reduce((acc, l) => acc + (l.durationMinutes || 0), 0);
  const totalHours = (totalMinutes / 60).toFixed(1);
  const pendingCount = worklogs.filter((l) => l.status === "PENDING").length;
  const approvedMinutes = worklogs
    .filter((l) => l.status === "APPROVED")
    .reduce((acc, l) => acc + (l.durationMinutes || 0), 0);
  const approvedHours = (approvedMinutes / 60).toFixed(1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Top Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: "var(--text)" }}>
            Work Log Timesheets &amp; Approvals
          </h2>
          <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "3px 0 0" }}>
            Track daily work hours, timeslots, billable duration, and manager approvals.
          </p>
        </div>

        <WorkLogModal
          orgId={orgId}
          projects={projects}
          tasks={tasks}
          employees={employees}
        />
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
          <span style={{ fontSize: 12, color: "var(--text-muted)", display: "block" }}>Total Recorded Hours</span>
          <strong style={{ fontSize: 22, color: "var(--text)" }}>{totalHours} hrs</strong>
          <small style={{ color: "var(--text-muted)", display: "block", marginTop: 4 }}>
            {worklogs.length} logged timeslot entries
          </small>
        </div>

        <div className="summary-card" style={{ padding: 16 }}>
          <span style={{ fontSize: 12, color: "var(--text-muted)", display: "block" }}>Pending Reviews</span>
          <strong style={{ fontSize: 22, color: "#f59e0b" }}>{pendingCount}</strong>
          <small style={{ color: "var(--text-muted)", display: "block", marginTop: 4 }}>
            Awaiting partner / manager approval
          </small>
        </div>

        <div className="summary-card" style={{ padding: 16 }}>
          <span style={{ fontSize: 12, color: "var(--text-muted)", display: "block" }}>Approved Hours</span>
          <strong style={{ fontSize: 22, color: "#10b981" }}>{approvedHours} hrs</strong>
          <small style={{ color: "var(--text-muted)", display: "block", marginTop: 4 }}>
            Cleared for client billing &amp; payroll
          </small>
        </div>

        <div className="summary-card" style={{ padding: 16 }}>
          <span style={{ fontSize: 12, color: "var(--text-muted)", display: "block" }}>Chargeable Ratio</span>
          <strong style={{ fontSize: 22, color: "#0ea5e9" }}>
            {totalMinutes > 0
              ? `${Math.round(
                  (worklogs
                    .filter((l) => l.isChargeable)
                    .reduce((acc, l) => acc + l.durationMinutes, 0) /
                    totalMinutes) *
                    100
                )}%`
              : "100%"}
          </strong>
          <small style={{ color: "var(--text-muted)", display: "block", marginTop: 4 }}>
            Billable client work efficiency
          </small>
        </div>
      </div>

      {/* Filter Tabs & Search */}
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
        {/* Tabs: Pending, Approved, Rejected, All (From approval-worklog.php) */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {[
            { id: "PENDING", label: `Pending (${worklogs.filter((l) => l.status === "PENDING").length})` },
            { id: "APPROVED", label: `Approved (${worklogs.filter((l) => l.status === "APPROVED").length})` },
            { id: "REJECTED", label: `Rejected (${worklogs.filter((l) => l.status === "REJECTED").length})` },
            { id: "ALL", label: `All Logs (${worklogs.length})` },
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
                  background: isActive ? "rgba(14, 165, 233, 0.15)" : "transparent",
                  color: isActive ? "#0ea5e9" : "var(--text-muted)",
                  fontWeight: isActive ? 700 : 500,
                  fontSize: 12.5,
                  cursor: "pointer",
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Search & Staff Filter */}
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
              placeholder="Search work logs..."
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
            value={employeeFilter}
            onChange={(e) => setEmployeeFilter(e.target.value)}
            style={{
              fontSize: 12,
              padding: "5px 8px",
              borderRadius: 6,
              border: "1px solid var(--border)",
              background: "var(--soft)",
              color: "var(--text)",
            }}
          >
            <option value="ALL">All Staff</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Worklogs Table */}
      <div className="table-card">
        <div className="table-scroll">
          <table className="responsive-table">
            <thead>
              <tr>
                <th>Staff Member</th>
                <th>Project &amp; Task</th>
                <th>Timeslot &amp; Duration</th>
                <th>Work Nature</th>
                <th>Date (AD &amp; BS)</th>
                <th>Summary / Comment</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((log) => {
                let dateBs = log.nepaliDate || "";
                if (!dateBs && log.logDate) {
                  try {
                    dateBs = formatBsDate(log.logDate);
                  } catch {}
                }

                const hrs = Math.floor(log.durationMinutes / 60);
                const mins = log.durationMinutes % 60;

                return (
                  <tr key={log.id}>
                    <td data-label="Staff">
                      <span style={{ fontWeight: 650 }}>{log.employee?.name || "Member"}</span>
                    </td>

                    <td data-label="Project">
                      <div>
                        <strong style={{ color: "var(--text)", display: "block" }}>
                          {log.project?.name || "General"}
                        </strong>
                        {log.task && (
                          <small style={{ color: "#0ea5e9" }}>
                            Task: {log.task.title}
                          </small>
                        )}
                      </div>
                    </td>

                    <td data-label="Duration">
                      <div>
                        <span style={{ fontWeight: 700, color: "var(--text)", display: "block" }}>
                          {hrs}h {mins}m
                        </span>
                        {log.startTime && log.endTime && (
                          <small style={{ color: "var(--text-muted)" }}>
                            {log.startTime} – {log.endTime}
                          </small>
                        )}
                      </div>
                    </td>

                    <td data-label="Nature">
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <span
                          style={{
                            fontSize: 10.5,
                            padding: "2px 6px",
                            borderRadius: 4,
                            fontWeight: 600,
                            display: "inline-block",
                            width: "fit-content",
                            background: log.isChargeable ? "rgba(16, 185, 129, 0.15)" : "rgba(100, 116, 139, 0.15)",
                            color: log.isChargeable ? "#10b981" : "#64748b",
                          }}
                        >
                          {log.isChargeable ? "Chargeable" : "Non-Chargeable"}
                        </span>
                        {log.isHolidayOrLeave && (
                          <small style={{ color: "#f59e0b", fontSize: 10 }}>Holiday / Weekend</small>
                        )}
                      </div>
                    </td>

                    <td data-label="Date">
                      <div>
                        <span style={{ fontSize: 11.5, display: "block" }}>
                          {shortDate(log.logDate)}
                        </span>
                        {dateBs && <small style={{ color: "var(--text-muted)" }}>{dateBs} BS</small>}
                      </div>
                    </td>

                    <td data-label="Comment" style={{ maxWidth: 280 }}>
                      <div
                        onClick={() => setSelectedLog(log)}
                        style={{
                          fontSize: 12,
                          color: "var(--text-muted)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          cursor: "pointer",
                        }}
                        title={log.comment || ""}
                      >
                        {log.comment || "—"}
                      </div>
                    </td>

                    <td data-label="Status">
                      <span
                        style={{
                          fontSize: 10.5,
                          padding: "2px 6px",
                          borderRadius: 4,
                          fontWeight: 650,
                          background:
                            log.status === "APPROVED"
                              ? "rgba(16, 185, 129, 0.15)"
                              : log.status === "REJECTED"
                              ? "rgba(239, 68, 68, 0.15)"
                              : "rgba(245, 158, 11, 0.15)",
                          color:
                            log.status === "APPROVED"
                              ? "#10b981"
                              : log.status === "REJECTED"
                              ? "#ef4444"
                              : "#f59e0b",
                        }}
                      >
                        {log.status}
                      </span>
                    </td>

                    <td data-label="Actions">
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        {log.status === "PENDING" && (
                          <>
                            <button
                              type="button"
                              className="secondary-btn"
                              style={{ padding: "3px 6px", fontSize: 11, color: "#10b981" }}
                              onClick={() => handleStatusUpdate(log.id, "APPROVED")}
                              title="Approve Work Log"
                            >
                              <Check size={12} /> Approve
                            </button>
                            <button
                              type="button"
                              className="secondary-btn"
                              style={{ padding: "3px 6px", fontSize: 11, color: "#ef4444" }}
                              onClick={() => handleStatusUpdate(log.id, "REJECTED")}
                              title="Reject Work Log"
                            >
                              <X size={12} />
                            </button>
                          </>
                        )}

                        <button
                          type="button"
                          className="secondary-btn"
                          style={{ padding: "3px 6px", fontSize: 11 }}
                          onClick={() => setSelectedLog(log)}
                          title="View Details"
                        >
                          <FileText size={11} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {!filteredLogs.length && (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: 28, color: "var(--text-muted)" }}>
                    No work logs found for this filter tab.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal / Drawer for detailed log review (From approval-worklog.php logDetailsModal) */}
      {selectedLog && (
        <div
          className="drawer-backdrop"
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.55)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 16,
          }}
        >
          <div
            className="drawer-panel"
            style={{
              width: "min(560px, 94vw)",
              background: "var(--surface)",
              borderRadius: "var(--radius-lg, 12px)",
              border: "1px solid var(--border)",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
              padding: 24,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                paddingBottom: 12,
                borderBottom: "1px solid var(--border)",
                marginBottom: 16,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Clock size={18} style={{ color: "#0ea5e9" }} />
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "var(--text)" }}>
                  Work Log Details
                </h3>
              </div>
              <button
                type="button"
                className="modal-close-icon-btn"
                onClick={() => setSelectedLog(null)}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: 13 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <span style={{ fontSize: 11, color: "var(--text-muted)", display: "block" }}>Project</span>
                  <strong>{selectedLog.project?.name || "General"}</strong>
                </div>
                <div>
                  <span style={{ fontSize: 11, color: "var(--text-muted)", display: "block" }}>Staff Member</span>
                  <strong>{selectedLog.employee?.name || "—"}</strong>
                </div>
              </div>

              {selectedLog.task && (
                <div>
                  <span style={{ fontSize: 11, color: "var(--text-muted)", display: "block" }}>Linked Task</span>
                  <strong>{selectedLog.task.title}</strong>
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, padding: 10, background: "var(--soft)", borderRadius: 8 }}>
                <div>
                  <span style={{ fontSize: 11, color: "var(--text-muted)", display: "block" }}>Timeslot</span>
                  <span>{selectedLog.startTime || "—"} – {selectedLog.endTime || "—"}</span>
                </div>
                <div>
                  <span style={{ fontSize: 11, color: "var(--text-muted)", display: "block" }}>Duration</span>
                  <strong style={{ color: "#0ea5e9" }}>
                    {Math.floor(selectedLog.durationMinutes / 60)}h {selectedLog.durationMinutes % 60}m
                  </strong>
                </div>
                <div>
                  <span style={{ fontSize: 11, color: "var(--text-muted)", display: "block" }}>Classification</span>
                  <span>{selectedLog.isChargeable ? "Chargeable" : "Non-Chargeable"}</span>
                </div>
              </div>

              <div>
                <span style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                  Activity Report &amp; Comments
                </span>
                <div
                  style={{
                    padding: 12,
                    borderRadius: 6,
                    background: "var(--soft)",
                    border: "1px solid var(--border)",
                    fontSize: 12.5,
                    lineHeight: 1.5,
                    color: "var(--text)",
                  }}
                >
                  {selectedLog.comment || "No detailed comment recorded."}
                </div>
              </div>

              {selectedLog.status === "PENDING" && (
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 12 }}>
                  <button
                    type="button"
                    className="secondary-btn"
                    style={{ color: "#ef4444" }}
                    onClick={() => handleStatusUpdate(selectedLog.id, "REJECTED")}
                  >
                    Reject Log
                  </button>
                  <button
                    type="button"
                    className="primary-btn"
                    style={{ background: "#10b981" }}
                    onClick={() => handleStatusUpdate(selectedLog.id, "APPROVED")}
                  >
                    Approve Work Log
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
