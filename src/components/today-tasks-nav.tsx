"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { CheckSquare, CalendarClock, Check, Plus, ExternalLink, X } from "lucide-react";
import { updateStatusAction } from "@/app/(dashboard)/actions";
import { toast } from "@/components/toast-provider";
import { shortDate } from "@/lib/format";
import { formatBsDate } from "@/lib/nepali-calendar";

export interface PendingItem {
  id: string;
  title: string;
  dueAt: string | Date | null;
  priority?: string;
  type: "task" | "reminder";
}

export function TodayTasksNav({
  orgId,
  tasks = [],
  reminders = [],
}: {
  orgId: string;
  tasks?: PendingItem[];
  reminders?: PendingItem[];
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<PendingItem[]>([...tasks, ...reminders]);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setItems([...tasks, ...reminders]);
  }, [tasks, reminders]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const handleComplete = async (item: PendingItem) => {
    try {
      const formData = new FormData();
      formData.set("orgId", orgId);
      formData.set("resource", item.type);
      formData.set("id", item.id);
      formData.set("status", "DONE");
      await updateStatusAction(formData);
      setItems((prev) => prev.filter((x) => x.id !== item.id));
      toast.success(`Marked ${item.type} as completed`);
    } catch {
      toast.error("Failed to complete item");
    }
  };

  const count = items.length;

  return (
    <div className="today-tasks-nav-wrap" ref={panelRef} style={{ position: "relative" }}>
      <button
        type="button"
        className="ghost-btn icon-btn"
        onClick={() => setOpen((p) => !p)}
        title="Today's Tasks & Reminders"
        aria-label="Tasks and Reminders"
        style={{ position: "relative" }}
      >
        <CheckSquare size={15} />
        {count > 0 && (
          <span
            style={{
              position: "absolute",
              top: -3,
              right: -3,
              background: "var(--danger, #ef4444)",
              color: "#ffffff",
              fontSize: "9px",
              fontWeight: 800,
              minWidth: "15px",
              height: "15px",
              borderRadius: "50%",
              display: "grid",
              placeItems: "center",
              padding: "0 2px",
              boxShadow: "0 0 0 1.5px var(--surface)",
            }}
          >
            {count}
          </span>
        )}
      </button>

      {open && (
        <div
          className="today-tasks-popover"
          style={{
            position: "absolute",
            top: "100%",
            right: 0,
            marginTop: 8,
            width: 320,
            maxHeight: 420,
            overflowY: "auto",
            background: "var(--surface)",
            border: "1px solid var(--line-strong)",
            borderRadius: "var(--radius)",
            boxShadow: "var(--shadow-lg)",
            zIndex: 300,
            padding: "12px",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--line)", paddingBottom: 8 }}>
            <div>
              <strong style={{ fontSize: "13px", display: "block" }}>Today&apos;s Agenda</strong>
              <small style={{ fontSize: "10.5px", color: "var(--text-muted)" }}>
                {count > 0 ? `${count} pending action${count > 1 ? "s" : ""}` : "All tasks completed!"}
              </small>
            </div>
            <Link
              href={`/${orgId}/tasks/new?type=add-task`}
              className="primary-btn"
              style={{ padding: "3px 8px", fontSize: "11px", minHeight: "26px" }}
              onClick={() => setOpen(false)}
            >
              <Plus size={12} /> Add
            </Link>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {items.map((it) => (
              <div
                key={`${it.type}-${it.id}`}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 8,
                  padding: "8px",
                  background: "var(--soft)",
                  border: "1px solid var(--line)",
                  borderRadius: "var(--radius-sm)",
                }}
              >
                <button
                  type="button"
                  onClick={() => handleComplete(it)}
                  title="Mark as completed"
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 4,
                    border: "1px solid var(--brand)",
                    background: "var(--surface)",
                    display: "grid",
                    placeItems: "center",
                    cursor: "pointer",
                    flexShrink: 0,
                    marginTop: 2,
                    color: "var(--brand)",
                  }}
                >
                  <Check size={11} />
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: "11.5px", fontWeight: 600, display: "block", color: "var(--text)" }}>
                    {it.title}
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2, fontSize: "10px", color: "var(--text-muted)" }}>
                    <span className={`badge ${it.type === "task" ? "purple" : "amber"}`} style={{ fontSize: "9px", padding: "0 4px" }}>
                      {it.type.toUpperCase()}
                    </span>
                    {it.dueAt && <span>Due: {shortDate(new Date(it.dueAt))}</span>}
                  </div>
                </div>
              </div>
            ))}

            {!items.length && (
              <div style={{ textAlign: "center", padding: "16px 8px", color: "var(--text-muted)", fontSize: "12px" }}>
                <CheckSquare size={24} style={{ margin: "0 auto 6px", opacity: 0.5 }} />
                <p style={{ margin: 0 }}>No pending tasks or reminders.</p>
              </div>
            )}
          </div>

          <div style={{ borderTop: "1px solid var(--line)", paddingTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Link href={`/${orgId}/tasks`} onClick={() => setOpen(false)} className="panel-link">
              View All Tasks →
            </Link>
            <Link href={`/${orgId}/reminders`} onClick={() => setOpen(false)} className="panel-link">
              All Reminders →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
