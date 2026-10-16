"use client";

import { useState } from "react";
import { Clock, Plus, X, Calendar, User, CheckCircle2, AlertCircle, Timer } from "lucide-react";
import { saveWorkLogAction } from "@/app/(dashboard)/actions";
import { toast } from "@/components/toast-provider";
import { adToBs, formatBsDate } from "@/lib/nepali-calendar";

interface ProjectOption {
  id: string;
  name: string;
}

interface TaskOption {
  id: string;
  title: string;
  projectId?: string | null;
  allocatedHours?: number | string | null;
}

interface EmployeeOption {
  id: string;
  name: string;
}

interface WorkLogData {
  id?: string;
  projectId?: string | null;
  taskId?: string | null;
  employeeId?: string | null;
  logDate?: string | Date | null;
  nepaliDate?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  durationMinutes?: number | null;
  comment?: string | null;
  isHolidayOrLeave?: boolean;
  isChargeable?: boolean;
}

export function WorkLogModal({
  orgId,
  projects = [],
  tasks = [],
  employees = [],
  worklog,
  defaultProjectId,
  defaultTaskId,
  trigger,
}: {
  orgId: string;
  projects: ProjectOption[];
  tasks: TaskOption[];
  employees: EmployeeOption[];
  worklog?: WorkLogData;
  defaultProjectId?: string;
  defaultTaskId?: string;
  trigger?: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [projectId, setProjectId] = useState<string>(
    worklog?.projectId || defaultProjectId || (projects[0]?.id || "")
  );
  const [taskId, setTaskId] = useState<string>(
    worklog?.taskId || defaultTaskId || ""
  );
  const [employeeId, setEmployeeId] = useState<string>(
    worklog?.employeeId || (employees[0]?.id || "")
  );
  const [dateStr, setDateStr] = useState<string>(
    worklog?.logDate ? new Date(worklog.logDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)
  );
  const [startTime, setStartTime] = useState<string>(worklog?.startTime || "09:30");
  const [endTime, setEndTime] = useState<string>(worklog?.endTime || "17:30");
  const [isHoliday, setIsHoliday] = useState<boolean>(worklog?.isHolidayOrLeave || false);
  const [isChargeable, setIsChargeable] = useState<boolean>(worklog?.isChargeable !== false);
  const [comment, setComment] = useState<string>(worklog?.comment || "");

  // Compute duration in minutes
  const computeDurationMinutes = (start: string, end: string) => {
    if (!start || !end) return 0;
    const [h1, m1] = start.split(":").map(Number);
    const [h2, m2] = end.split(":").map(Number);
    const mins1 = h1 * 60 + m1;
    const mins2 = h2 * 60 + m2;
    return Math.max(0, mins2 - mins1);
  };

  const durationMins = computeDurationMinutes(startTime, endTime);
  const durationHours = (durationMins / 60).toFixed(1);

  // Compute Nepali BS Date
  let bsDateDisplay = "";
  try {
    bsDateDisplay = formatBsDate(dateStr);
  } catch {
    bsDateDisplay = "";
  }

  // Filter tasks for selected project
  const availableTasks = tasks.filter((t) => !t.projectId || t.projectId === projectId);
  const isEditing = Boolean(worklog?.id);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.set("orgId", orgId);
      if (worklog?.id) formData.set("id", worklog.id);
      formData.set("projectId", projectId);
      formData.set("taskId", taskId);
      formData.set("employeeId", employeeId);
      formData.set("logDate", dateStr);
      formData.set("nepaliDate", bsDateDisplay);
      formData.set("startTime", startTime);
      formData.set("endTime", endTime);
      formData.set("durationMinutes", String(durationMins));
      formData.set("isHolidayOrLeave", String(isHoliday));
      formData.set("isChargeable", String(isChargeable));
      formData.set("comment", comment);

      await saveWorkLogAction(formData);
      toast.success(isEditing ? "Work log updated successfully" : "Time entry recorded and submitted for approval");
      setIsOpen(false);
    } catch {
      toast.error("Failed to save work log. Please verify inputs.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {trigger ? (
        <span onClick={() => setIsOpen(true)} style={{ cursor: "pointer", display: "inline-block" }}>
          {trigger}
        </span>
      ) : (
        <button
          type="button"
          className="primary-btn"
          onClick={() => setIsOpen(true)}
          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <Timer size={14} /> Log Work Hours
        </button>
      )}

      {isOpen && (
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
              width: "min(640px, 96vw)",
              maxHeight: "90vh",
              overflowY: "auto",
              background: "var(--surface)",
              borderRadius: "var(--radius-lg, 12px)",
              border: "1px solid var(--border)",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
              padding: 24,
            }}
          >
            {/* Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                paddingBottom: 16,
                borderBottom: "1px solid var(--border)",
                marginBottom: 16,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    background: "rgba(14, 165, 233, 0.12)",
                    color: "#0ea5e9",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Clock size={20} />
                </div>
                <div>
                  <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: "var(--text)" }}>
                    {isEditing ? "Edit Work Log" : "Log Work Hours & Timeslot"}
                  </h2>
                  <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "2px 0 0" }}>
                    Record dedicated task execution hours, client billing status, and work summaries.
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="modal-close-icon-btn"
                onClick={() => setIsOpen(false)}
                aria-label="Close"
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text-muted)",
                  padding: 6,
                  borderRadius: 6,
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Live Timeslot Metrics Gauge (From sajilo_task taskLog modal) */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 16px",
                borderRadius: 8,
                background: "var(--soft)",
                border: "1px solid var(--border)",
                marginBottom: 16,
              }}
            >
              <div>
                <span style={{ fontSize: 11, color: "var(--text-muted)", display: "block" }}>Date (AD &amp; BS)</span>
                <strong style={{ fontSize: 13, color: "var(--text)" }}>
                  {dateStr} {bsDateDisplay ? `· ${bsDateDisplay}` : ""}
                </strong>
              </div>
              <div>
                <span style={{ fontSize: 11, color: "var(--text-muted)", display: "block" }}>Timeslot Duration</span>
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: durationMins > 480 ? "#f59e0b" : "#0ea5e9",
                  }}
                >
                  {Math.floor(durationMins / 60)}h {durationMins % 60}m ({durationHours} hrs)
                </span>
              </div>
              <div>
                <span
                  style={{
                    fontSize: 11,
                    padding: "3px 8px",
                    borderRadius: 4,
                    fontWeight: 600,
                    background: isChargeable ? "rgba(16, 185, 129, 0.15)" : "rgba(100, 116, 139, 0.15)",
                    color: isChargeable ? "#10b981" : "#64748b",
                  }}
                >
                  {isChargeable ? "Chargeable" : "Non-Chargeable"}
                </span>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Row 1: Project & Task */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <label className="field">
                  <span className="field-label">Project</span>
                  <select
                    value={projectId}
                    onChange={(e) => {
                      setProjectId(e.target.value);
                      setTaskId("");
                    }}
                  >
                    <option value="">Select Project...</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span className="field-label">Action Item / Task</span>
                  <select
                    value={taskId}
                    onChange={(e) => setTaskId(e.target.value)}
                  >
                    <option value="">Select Task (Optional)...</option>
                    {availableTasks.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {/* Row 2: Employee & Date */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <label className="field">
                  <span className="field-label">Staff Member</span>
                  <select
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value)}
                  >
                    <option value="">Select Staff...</option>
                    {employees.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span className="field-label">Work Date (AD)</span>
                  <input
                    type="date"
                    value={dateStr}
                    onChange={(e) => setDateStr(e.target.value)}
                    required
                  />
                </label>
              </div>

              {/* Row 3: Timeslot Start & End Time */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <label className="field">
                  <span className="field-label">Start Time</span>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    required
                  />
                </label>

                <label className="field">
                  <span className="field-label">End Time</span>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    required
                  />
                </label>
              </div>

              {/* Checkboxes: Holiday & Chargeable */}
              <div style={{ display: "flex", gap: 24, padding: "8px 0", flexWrap: "wrap", alignItems: "center" }}>
                <label style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, userSelect: "none" }}>
                  <input
                    type="checkbox"
                    checked={isChargeable}
                    onChange={(e) => setIsChargeable(e.target.checked)}
                    style={{ width: 16, height: 16, margin: 0, flexShrink: 0 }}
                  />
                  <span style={{ whiteSpace: "nowrap" }}>Chargeable Project Work</span>
                </label>

                <label style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, userSelect: "none" }}>
                  <input
                    type="checkbox"
                    checked={isHoliday}
                    onChange={(e) => setIsHoliday(e.target.checked)}
                    style={{ width: 16, height: 16, margin: 0, flexShrink: 0 }}
                  />
                  <span style={{ whiteSpace: "nowrap" }}>Logged on Holiday / Weekend</span>
                </label>
              </div>

              {/* Comment */}
              <label className="field">
                <span className="field-label">Work Summary / Activities Completed *</span>
                <textarea
                  rows={4}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  required
                  placeholder="Detail activities completed during this timeslot (e.g. Conducted preliminary audit on tax deduction vouchers, drafted bank reconciliation report)..."
                />
              </label>

              {/* Actions */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => setIsOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary-btn"
                  disabled={isSubmitting}
                  style={{ padding: "8px 22px" }}
                >
                  {isSubmitting ? "Saving..." : isEditing ? "Save Changes" : "Record Work Log"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
