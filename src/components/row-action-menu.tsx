"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  MoreHorizontal,
  Eye,
  Edit3,
  Trash2,
  Ban,
  CheckCircle2,
  ChevronDown,
  Check,
  AlertTriangle,
} from "lucide-react";
import {
  updateStatusAction,
  hardDeleteRecordAction,
  softDeleteRecordAction,
  deleteQuoteAction,
} from "@/app/(dashboard)/actions";
import { toast } from "@/components/toast-provider";
import { ConfirmModal } from "@/components/confirm-modal";

export interface ActionMenuItem {
  label: string;
  href?: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  danger?: boolean;
  warning?: boolean;
}

export interface RowActionMenuProps {
  orgId: string;
  resource?: string; // "purchase" | "sales" | "invoice" | "quote" | "expense" | "recurring_expense" | "income" | "contact" | "lead" | "task" | "product" | "leave" | "reminder" | "license" | "loan" | "payroll" | "bank_tx" | "milk_log" | ...
  id: string;
  recordTitle?: string;
  currentStatus?: string;
  statusOptions?: string[];
  viewHref?: string;
  editHref?: string;
  onEdit?: () => void;
  showSoftDelete?: boolean;
  showHardDelete?: boolean;
  deleteResource?: "quote" | "invoice" | "expense" | "task" | string;
  customItems?: ActionMenuItem[];
}

export function RowActionMenu({
  orgId,
  resource,
  id,
  recordTitle,
  currentStatus,
  statusOptions,
  viewHref,
  editHref,
  onEdit,
  showSoftDelete = true,
  showHardDelete = true,
  deleteResource,
  customItems = [],
}: RowActionMenuProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [statusExpanded, setStatusExpanded] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSoftDeleting, setIsSoftDeleting] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    type: "soft" | "hard";
    title: string;
    message: string;
    itemLabel?: string;
  }>({
    isOpen: false,
    type: "hard",
    title: "",
    message: "",
  });

  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const [coords, setCoords] = useState<{
    top?: number;
    bottom?: number;
    right: number;
    placement: "bottom" | "top";
  }>({ right: 16, placement: "bottom" });

  useEffect(() => {
    setMounted(true);
  }, []);

  const calculatePosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    // Estimated dropdown panel height with all items is around 240-280px
    const minRequiredHeight = 240;

    const shouldOpenUpwards = spaceBelow < minRequiredHeight && spaceAbove > spaceBelow;
    // Align with the right edge of the button with viewport padding
    const right = Math.max(8, window.innerWidth - rect.right);

    if (shouldOpenUpwards) {
      setCoords({
        bottom: Math.max(8, window.innerHeight - rect.top + 6),
        right,
        placement: "top",
      });
    } else {
      setCoords({
        top: Math.max(8, rect.bottom + 6),
        right,
        placement: "bottom",
      });
    }
  }, []);

  // Recalculate on open, window scroll or resize
  useEffect(() => {
    if (!open) return;
    calculatePosition();

    const handleScrollOrResize = () => {
      calculatePosition();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setStatusExpanded(false);
      }
    };

    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, calculatePosition]);

  // Click outside listener
  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (
        buttonRef.current &&
        !buttonRef.current.contains(target) &&
        panelRef.current &&
        !panelRef.current.contains(target)
      ) {
        setOpen(false);
        setStatusExpanded(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const handleStatusChange = async (newStatus: string) => {
    if (!resource || isUpdatingStatus) return;
    try {
      setIsUpdatingStatus(true);
      const formData = new FormData();
      formData.set("orgId", orgId);
      formData.set("resource", resource);
      formData.set("id", id);
      formData.set("status", newStatus);
      await updateStatusAction(formData);
      toast.success(`Status updated to ${newStatus.replaceAll("_", " ")}`);
      setOpen(false);
      setStatusExpanded(false);
      router.refresh();
    } catch {
      toast.error("Failed to update status");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const openSoftDeleteModal = () => {
    if (!resource || isSoftDeleting) return;
    setOpen(false);
    setConfirmModal({
      isOpen: true,
      type: "soft",
      title: "Archive / Soft Delete Record",
      message: "Are you sure you want to cancel / archive this record? The status will be marked as CANCELLED or INACTIVE.",
      itemLabel: recordTitle || `${resource} #${id.slice(-6)}`,
    });
  };

  const executeSoftDelete = async () => {
    if (!resource || isSoftDeleting) return;

    try {
      setIsSoftDeleting(true);
      const formData = new FormData();
      formData.set("orgId", orgId);
      formData.set("resource", resource);
      formData.set("id", id);
      await softDeleteRecordAction(formData);
      toast.success(`Record soft-deleted (status marked CANCELLED)`);
      setConfirmModal((prev) => ({ ...prev, isOpen: false }));
      setStatusExpanded(false);
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to soft-delete record");
    } finally {
      setIsSoftDeleting(false);
    }
  };

  const openHardDeleteModal = () => {
    const targetResource = resource || deleteResource;
    if (!targetResource || isDeleting) return;
    setOpen(false);
    setConfirmModal({
      isOpen: true,
      type: "hard",
      title: "Permanent Hard Delete",
      message: "Are you sure you want to PERMANENTLY delete this record? This will completely erase the entry and any child items from the database. This action CANNOT be undone.",
      itemLabel: recordTitle || `${targetResource} #${id.slice(-6)}`,
    });
  };

  const executeHardDelete = async () => {
    const targetResource = resource || deleteResource;
    if (!targetResource || isDeleting) return;

    try {
      setIsDeleting(true);
      if (deleteResource === "quote" && !resource) {
        const formData = new FormData();
        formData.set("orgId", orgId);
        formData.set("quoteId", id);
        await deleteQuoteAction(formData);
      } else {
        const formData = new FormData();
        formData.set("orgId", orgId);
        formData.set("resource", targetResource);
        formData.set("id", id);
        await hardDeleteRecordAction(formData);
      }
      toast.success("Record permanently deleted from database");
      setConfirmModal((prev) => ({ ...prev, isOpen: false }));
      setStatusExpanded(false);
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to permanently delete record");
    } finally {
      setIsDeleting(false);
    }
  };

  // Determine if soft delete should be available
  const canSoftDelete =
    showSoftDelete &&
    resource &&
    currentStatus !== "CANCELLED" &&
    currentStatus !== "SETTLED" &&
    currentStatus !== "LOST";

  // Determine if hard delete should be available
  const canHardDelete = showHardDelete && (resource || deleteResource);

  return (
    <div className="row-action-menu-wrap no-print" style={{ position: "relative", display: "inline-block" }}>
      <button
        ref={buttonRef}
        type="button"
        className="row-action-trigger-btn"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((prev) => {
            const next = !prev;
            if (next) calculatePosition();
            return next;
          });
          setStatusExpanded(false);
        }}
        title="Actions"
        aria-label="Row actions"
        aria-expanded={open}
      >
        <MoreHorizontal size={14} />
      </button>

      {open &&
        mounted &&
        createPortal(
          <div
            ref={panelRef}
            className="row-action-dropdown-panel"
            role="menu"
            style={{
              position: "fixed",
              top: coords.top !== undefined ? `${coords.top}px` : "auto",
              bottom: coords.bottom !== undefined ? `${coords.bottom}px` : "auto",
              right: `${coords.right}px`,
              zIndex: 999999,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* VIEW DETAILS */}
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

            {/* EDIT RECORD */}
            {editHref ? (
              <Link
                href={editHref}
                className="row-action-dropdown-item"
                onClick={() => setOpen(false)}
              >
                <Edit3 size={13} />
                <span>Edit Record</span>
              </Link>
            ) : onEdit ? (
              <button
                type="button"
                className="row-action-dropdown-item"
                onClick={() => {
                  setOpen(false);
                  onEdit();
                }}
              >
                <Edit3 size={13} />
                <span>Edit Record</span>
              </button>
            ) : null}

            {/* CUSTOM ITEMS */}
            {customItems.map((item, idx) =>
              item.href ? (
                <Link
                  key={idx}
                  href={item.href}
                  className={`row-action-dropdown-item ${item.danger ? "danger" : ""} ${
                    item.warning ? "warning" : ""
                  }`}
                  onClick={() => setOpen(false)}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </Link>
              ) : (
                <button
                  key={idx}
                  type="button"
                  className={`row-action-dropdown-item ${item.danger ? "danger" : ""} ${
                    item.warning ? "warning" : ""
                  }`}
                  onClick={() => {
                    setOpen(false);
                    item.onClick?.();
                  }}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              )
            )}

            {/* UPDATE STATUS ACCORDION */}
            {statusOptions && statusOptions.length > 0 && resource && (
              <div className="row-action-status-section">
                <button
                  type="button"
                  className="row-action-dropdown-item has-submenu"
                  onClick={() => setStatusExpanded((p) => !p)}
                  title="Change status"
                >
                  <CheckCircle2 size={13} />
                  <span style={{ flex: 1, textAlign: "left" }}>Update Status</span>
                  <ChevronDown
                    size={12}
                    style={{
                      transform: statusExpanded ? "rotate(180deg)" : "none",
                      transition: "transform 0.15s ease",
                    }}
                  />
                </button>

                {statusExpanded && (
                  <div className="row-action-inline-status-list">
                    {statusOptions.map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        disabled={isUpdatingStatus}
                        className={`row-action-subitem ${opt === currentStatus ? "active" : ""}`}
                        onClick={() => handleStatusChange(opt)}
                      >
                        <span>{opt.replaceAll("_", " ")}</span>
                        {opt === currentStatus && <Check size={12} className="check-mark" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* DIVIDER FOR DELETION ACTIONS */}
            {(canSoftDelete || canHardDelete) && <div className="row-action-divider" />}

            {/* SOFT DELETE (CANCEL / VOID / ARCHIVE) */}
            {canSoftDelete && (
              <button
                type="button"
                className="row-action-dropdown-item warning"
                onClick={openSoftDeleteModal}
                disabled={isSoftDeleting || isDeleting}
                title="Mark this record as Cancelled / Inactive"
              >
                <Ban size={13} />
                <span>
                  {isSoftDeleting
                    ? "Cancelling..."
                    : resource === "product"
                    ? "Soft Delete (Deactivate)"
                    : resource === "task"
                    ? "Soft Delete (Block)"
                    : resource === "lead"
                    ? "Soft Delete (Lost)"
                    : "Soft Delete (Cancel)"}
                </span>
              </button>
            )}

            {/* HARD DELETE (PERMANENT PURGE) */}
            {canHardDelete && (
              <button
                type="button"
                className="row-action-dropdown-item danger"
                onClick={openHardDeleteModal}
                disabled={isDeleting || isSoftDeleting}
                title="Permanently remove this record and child data from database"
              >
                <Trash2 size={13} />
                <span>{isDeleting ? "Erasing..." : "Hard Delete (Permanent)"}</span>
              </button>
            )}
          </div>,
          document.body
        )}

      {/* CUSTOM CONFIRMATION MODAL (NO JAVASCRIPT BROWSER CONFIRM) */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModal.type === "soft" ? executeSoftDelete : executeHardDelete}
        title={confirmModal.title}
        message={confirmModal.message}
        itemLabel={confirmModal.itemLabel}
        confirmLabel={
          confirmModal.type === "soft" ? "Yes, Archive Record" : "Yes, Permanently Delete"
        }
        variant={confirmModal.type === "soft" ? "warning" : "danger"}
        isLoading={isDeleting || isSoftDeleting}
      />
    </div>
  );
}
