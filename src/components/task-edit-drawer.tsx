"use client";

import { useState } from "react";
import { Edit3, X, CheckSquare } from "lucide-react";
import { updateTaskAction } from "@/app/(dashboard)/actions";
import { toast } from "@/components/toast-provider";

export function TaskEditDrawer({
  orgId,
  task,
  staff = [],
  projects = [],
  triggerText,
}: {
  orgId: string;
  task: {
    id: string;
    title: string;
    description?: string | null;
    status: string;
    priority: string;
    dueAt?: Date | string | null;
    employeeId?: string | null;
    projectId?: string | null;
    allocatedHours?: number | string | null;
  };
  staff?: { id: string; name: string }[];
  projects?: { id: string; name: string }[];
  triggerText?: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const formData = new FormData(e.currentTarget);
      await updateTaskAction(formData);
      toast.success("Task updated successfully");
      setIsOpen(false);
    } catch {
      toast.error("Failed to update task");
    } finally {
      setIsSubmitting(false);
    }
  };

  const dueStr = task.dueAt ? new Date(task.dueAt).toISOString().slice(0, 10) : "";

  return (
    <>
      {triggerText ? (
        <span onClick={() => setIsOpen(true)} style={{ cursor: "pointer", display: "inline-block" }}>
          {triggerText}
        </span>
      ) : (
        <button
          type="button"
          className="secondary-btn"
          style={{ padding: "3px 8px", fontSize: 11 }}
          onClick={() => setIsOpen(true)}
          title="Edit Task"
        >
          <Edit3 size={12} /> Edit
        </button>
      )}

      {isOpen && (
        <div className="drawer-backdrop" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="drawer-panel" style={{ width: "min(540px, 94vw)" }}>
            <div className="drawer-head">
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <CheckSquare size={18} style={{ color: "var(--brand)" }} />
                <div>
                  <h2 style={{ fontSize: 16 }}>Edit Task &amp; Project Alignment</h2>
                  <p style={{ fontSize: 11.5, color: "var(--text-muted)" }}>Update assignment, project link, schedule, or priority.</p>
                </div>
              </div>
              <button
                type="button"
                className="modal-close-icon-btn"
                onClick={() => setIsOpen(false)}
                aria-label="Close"
              >
                <X size={14} />
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <input type="hidden" name="orgId" value={orgId} />
              <input type="hidden" name="taskId" value={task.id} />

              <label className="field">
                <span className="field-label">Task Title</span>
                <input name="title" defaultValue={task.title} required placeholder="What needs to be done?" />
              </label>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <label className="field">
                  <span className="field-label">Linked Project</span>
                  <select name="projectId" defaultValue={task.projectId || ""}>
                    <option value="">No Project (General)</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span className="field-label">Allocated Hours</span>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    name="allocatedHours"
                    defaultValue={task.allocatedHours ? Number(task.allocatedHours) : 0}
                    placeholder="e.g. 8.0"
                  />
                </label>
              </div>

              <label className="field">
                <span className="field-label">Description / Instructions</span>
                <textarea name="description" rows={3} defaultValue={task.description || ""} placeholder="Detailed steps or acceptance criteria..." />
              </label>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <label className="field">
                  <span className="field-label">Status</span>
                  <select name="status" defaultValue={task.status}>
                    <option value="TODO">To Do</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="BLOCKED">Blocked</option>
                    <option value="DONE">Completed (Done)</option>
                  </select>
                </label>

                <label className="field">
                  <span className="field-label">Priority</span>
                  <select name="priority" defaultValue={task.priority}>
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent (Immediate)</option>
                  </select>
                </label>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <label className="field">
                  <span className="field-label">Due Date</span>
                  <input type="date" name="dueAt" defaultValue={dueStr} />
                </label>

                <label className="field">
                  <span className="field-label">Assignee Staff</span>
                  <select name="employeeId" defaultValue={task.employeeId || ""}>
                    <option value="">Unassigned</option>
                    {staff.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => setIsOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary-btn"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
