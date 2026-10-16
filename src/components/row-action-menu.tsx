"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { MoreHorizontal, Eye, Edit3, Trash2, Printer, CheckCircle2, ChevronRight, FileCheck, Check } from "lucide-react";
import { updateStatusAction, deleteQuoteAction } from "@/app/(dashboard)/actions";
import { toast } from "@/components/toast-provider";

export interface ActionMenuItem {
  label: string;
  href?: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  danger?: boolean;
}

export function RowActionMenu({
  orgId,
  resource,
  id,
  currentStatus,
  statusOptions,
  viewHref,
  editHref,
  deleteResource,
  customItems = [],
}: {
  orgId: string;
  resource?: string;
  id: string;
  currentStatus?: string;
  statusOptions?: string[];
  viewHref?: string;
  editHref?: string;
  deleteResource?: "quote" | "invoice" | "expense" | "task";
  customItems?: ActionMenuItem[];
}) {
  const [open, setOpen] = useState(false);
  const [statusSubmenuOpen, setStatusSubmenuOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
        setStatusSubmenuOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const handleStatusChange = async (newStatus: string) => {
    if (!resource) return;
    try {
      const formData = new FormData();
      formData.set("orgId", orgId);
      formData.set("resource", resource);
      formData.set("id", id);
      formData.set("status", newStatus);
      await updateStatusAction(formData);
      toast.success(`Status updated to ${newStatus.replaceAll("_", " ")}`);
      setOpen(false);
      setStatusSubmenuOpen(false);
    } catch {
      toast.error("Failed to update status");
    }
  };

  const handleDelete = async () => {
    if (!deleteResource) return;
    if (!window.confirm(`Are you sure you want to permanently delete this ${deleteResource}?`)) return;
    try {
      setIsDeleting(true);
      if (deleteResource === "quote") {
        const formData = new FormData();
        formData.set("orgId", orgId);
        formData.set("quoteId", id);
        await deleteQuoteAction(formData);
        toast.success("Quotation deleted successfully");
      }
      setOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete item");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="row-action-menu-wrap" ref={menuRef} style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        className="row-action-trigger-btn"
        onClick={() => {
          setOpen((prev) => !prev);
          setStatusSubmenuOpen(false);
        }}
        title="Actions"
        aria-label="Row actions"
        aria-expanded={open}
      >
        <MoreHorizontal size={14} />
      </button>

      {open && (
        <div className="row-action-dropdown-panel" role="menu">
          {viewHref && (
            <Link
              href={viewHref}
              className="row-action-dropdown-item"
              onClick={() => setOpen(false)}
            >
              <Eye size={13} />
              <span>View Details</span>
            </Link>
          )}

          {editHref && (
            <Link
              href={editHref}
              className="row-action-dropdown-item"
              onClick={() => setOpen(false)}
            >
              <Edit3 size={13} />
              <span>Edit Record</span>
            </Link>
          )}

          {customItems.map((item, idx) => (
            item.href ? (
              <Link
                key={idx}
                href={item.href}
                className={`row-action-dropdown-item ${item.danger ? "danger" : ""}`}
                onClick={() => setOpen(false)}
              >
                {item.icon}
                <span>{item.label}</span>
              </Link>
            ) : (
              <button
                key={idx}
                type="button"
                className={`row-action-dropdown-item ${item.danger ? "danger" : ""}`}
                onClick={() => {
                  setOpen(false);
                  item.onClick?.();
                }}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            )
          ))}

          {statusOptions && statusOptions.length > 0 && resource && (
            <div
              className="row-action-dropdown-item has-submenu"
              onMouseEnter={() => setStatusSubmenuOpen(true)}
              onClick={() => setStatusSubmenuOpen((p) => !p)}
            >
              <CheckCircle2 size={13} />
              <span style={{ flex: 1 }}>Update Status</span>
              <ChevronRight size={11} />

              {statusSubmenuOpen && (
                <div className="row-action-subpanel">
                  {statusOptions.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      className={`row-action-subitem ${opt === currentStatus ? "active" : ""}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStatusChange(opt);
                      }}
                    >
                      <span>{opt.replaceAll("_", " ")}</span>
                      {opt === currentStatus && <Check size={12} className="check-mark" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {deleteResource && (
            <button
              type="button"
              className="row-action-dropdown-item danger"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              <Trash2 size={13} />
              <span>{isDeleting ? "Deleting..." : `Delete ${deleteResource.charAt(0).toUpperCase() + deleteResource.slice(1)}`}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
