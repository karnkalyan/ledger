"use client";

import { useState } from "react";
import { FolderKanban, Plus, X, Calendar, User, DollarSign, Tag, Users, CheckCircle } from "lucide-react";
import { saveProjectAction } from "@/app/(dashboard)/actions";
import { toast } from "@/components/toast-provider";

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

interface ProjectData {
  id?: string;
  name?: string;
  description?: string | null;
  contactId?: string | null;
  teamLeaderId?: string | null;
  status?: string;
  priority?: string;
  workNature?: string | null;
  subWorkNature?: string | null;
  fiscalYear?: string | null;
  budget?: number | string | null;
  startDate?: string | Date | null;
  endDate?: string | Date | null;
  memberIds?: string[];
}

export function ProjectModal({
  orgId,
  contacts = [],
  employees = [],
  fiscalYears = ["2081/82", "2082/83", "2083/84"],
  project,
  trigger,
}: {
  orgId: string;
  contacts: ContactOption[];
  employees: EmployeeOption[];
  fiscalYears?: string[];
  project?: ProjectData;
  trigger?: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<string[]>(
    project?.memberIds || []
  );

  const isEditing = Boolean(project?.id);

  const handleMemberToggle = (empId: string) => {
    setSelectedMembers((prev) =>
      prev.includes(empId) ? prev.filter((id) => id !== empId) : [...prev, empId]
    );
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const formData = new FormData(e.currentTarget);
      formData.set("memberIds", selectedMembers.join(","));
      await saveProjectAction(formData);
      toast.success(isEditing ? "Project updated successfully" : "Project created with allocated wallet");
      setIsOpen(false);
    } catch {
      toast.error("Failed to save project. Please check the inputs.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const startStr = project?.startDate
    ? new Date(project.startDate).toISOString().slice(0, 10)
    : "";
  const endStr = project?.endDate
    ? new Date(project.endDate).toISOString().slice(0, 10)
    : "";

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
          <Plus size={14} /> Create Project
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
              width: "min(720px, 96vw)",
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
                    background: "rgba(139, 92, 246, 0.12)",
                    color: "#8b5cf6",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <FolderKanban size={20} />
                </div>
                <div>
                  <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: "var(--text)" }}>
                    {isEditing ? "Edit Project" : "Create New Project"}
                  </h2>
                  <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "2px 0 0" }}>
                    Configure client, lead authority, members, timeline, and wallet budget.
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

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <input type="hidden" name="orgId" value={orgId} />
              {project?.id && <input type="hidden" name="id" value={project.id} />}

              {/* Project Name */}
              <label className="field">
                <span className="field-label" style={{ fontWeight: 600 }}>Project Title / Name *</span>
                <input
                  name="name"
                  defaultValue={project?.name || ""}
                  required
                  placeholder="e.g. Audit & Financial Statements FY 83/84 — Kantipur Media"
                  style={{ width: "100%" }}
                />
              </label>

              {/* Row 1: Client & Team Leader */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
                <label className="field">
                  <span className="field-label">Client / Customer (Entity)</span>
                  <select name="contactId" defaultValue={project?.contactId || ""}>
                    <option value="">Select Client / Party...</option>
                    {contacts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.companyName ? `(${c.companyName})` : ""}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span className="field-label">Team Leader / Partner In-Charge</span>
                  <select name="teamLeaderId" defaultValue={project?.teamLeaderId || ""}>
                    <option value="">Select Team Leader...</option>
                    {employees.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name} {e.designation ? `— ${e.designation}` : ""}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {/* Row 2: Work Nature & Sub Nature */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
                <label className="field">
                  <span className="field-label">Nature of Work</span>
                  <select name="workNature" defaultValue={project?.workNature || "Tax & Audit"}>
                    <option value="Tax & Audit">Tax &amp; Audit Services</option>
                    <option value="Commercial Accounting">Commercial Accounting &amp; Bookkeeping</option>
                    <option value="Legal & Compliance">Company Legal &amp; Compliance</option>
                    <option value="Software & IT Solutions">Software &amp; IT Solutions</option>
                    <option value="Business Consulting">Business Consulting</option>
                    <option value="Non-Chargeable Internal">Non-Chargeable Internal</option>
                  </select>
                </label>

                <label className="field">
                  <span className="field-label">Sub Nature / Classification</span>
                  <input
                    name="subWorkNature"
                    defaultValue={project?.subWorkNature || ""}
                    placeholder="e.g. Quarterly TDS Reconciliation, VAT Audit"
                  />
                </label>
              </div>

              {/* Row 3: Fiscal Year, Priority, Status */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
                <label className="field">
                  <span className="field-label">Fiscal Year</span>
                  <select name="fiscalYear" defaultValue={project?.fiscalYear || fiscalYears[0]}>
                    {fiscalYears.map((fy) => (
                      <option key={fy} value={fy}>{fy} BS</option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span className="field-label">Priority Label</span>
                  <select name="priority" defaultValue={project?.priority || "MEDIUM"}>
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </label>

                <label className="field">
                  <span className="field-label">Project Status</span>
                  <select name="status" defaultValue={project?.status || "ACTIVE"}>
                    <option value="ACTIVE">Active</option>
                    <option value="UPCOMING">Upcoming</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="ARCHIVED">Archived</option>
                  </select>
                </label>
              </div>

              {/* Row 4: Budget & Dates */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
                <label className="field">
                  <span className="field-label">Total Value / Budget (NPR)</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    name="budget"
                    defaultValue={project?.budget ? Number(project.budget) : 0}
                    placeholder="0.00"
                  />
                </label>

                <label className="field">
                  <span className="field-label">Start Date (AD)</span>
                  <input type="date" name="startDate" defaultValue={startStr} />
                </label>

                <label className="field">
                  <span className="field-label">End / Deadline Date (AD)</span>
                  <input type="date" name="endDate" defaultValue={endStr} />
                </label>
              </div>

              {/* Team Members Assignment */}
              <div style={{ marginTop: 4 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <span className="field-label" style={{ fontWeight: 600 }}>Assign Project Team Members</span>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    {selectedMembers.length} member{selectedMembers.length === 1 ? "" : "s"} selected
                  </span>
                </div>
                <div
                  style={{
                    maxHeight: 140,
                    overflowY: "auto",
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))",
                    gap: 8,
                    padding: 10,
                    background: "var(--soft)",
                    borderRadius: "var(--radius-sm, 8px)",
                    border: "1px solid var(--border)",
                  }}
                >
                  {employees.map((emp) => {
                    const isSelected = selectedMembers.includes(emp.id);
                    return (
                      <div
                        key={emp.id}
                        onClick={() => handleMemberToggle(emp.id)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "6px 10px",
                          borderRadius: 6,
                          background: isSelected ? "rgba(139, 92, 246, 0.15)" : "var(--surface)",
                          border: isSelected ? "1px solid rgba(139, 92, 246, 0.4)" : "1px solid var(--border)",
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          style={{ cursor: "pointer" }}
                        />
                        <div style={{ overflow: "hidden" }}>
                          <span style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text)", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                            {emp.name}
                          </span>
                          {emp.designation && (
                            <span style={{ display: "block", fontSize: 10, color: "var(--text-muted)", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                              {emp.designation}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {!employees.length && (
                    <div style={{ gridColumn: "1 / -1", textAlign: "center", fontSize: 12, color: "var(--text-muted)", padding: 8 }}>
                      No staff members registered in workspace yet.
                    </div>
                  )}
                </div>
              </div>

              {/* Description */}
              <label className="field">
                <span className="field-label">Project Scope &amp; Notes</span>
                <textarea
                  name="description"
                  rows={2}
                  defaultValue={project?.description || ""}
                  placeholder="Deliverables, scope, milestones, or client billing terms..."
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
                  style={{ padding: "8px 20px" }}
                >
                  {isSubmitting ? "Saving..." : isEditing ? "Save Changes" : "Create Project"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
