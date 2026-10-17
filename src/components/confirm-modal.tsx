"use client";

import { useEffect, useRef } from "react";
import { AlertTriangle, Trash2, Archive, X } from "lucide-react";

export interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string;
  itemLabel?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "default";
  isLoading?: boolean;
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  itemLabel,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  isLoading = false,
}: ConfirmModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isLoading) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isLoading, onClose]);

  if (!isOpen) return null;

  const isDanger = variant === "danger";
  const iconColor = isDanger ? "var(--danger, #ef4444)" : "var(--amber, #f59e0b)";
  const iconBg = isDanger ? "rgba(239, 68, 68, 0.12)" : "rgba(245, 158, 11, 0.12)";
  const confirmBtnBg = isDanger
    ? "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)"
    : "linear-gradient(135deg, #d97706 0%, #b45309 100%)";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(15, 23, 42, 0.65)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        padding: "16px",
        animation: "fadeIn 0.15s ease-out",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoading) {
          onClose();
        }
      }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        style={{
          width: "100%",
          maxWidth: "460px",
          background: "var(--card-bg, #ffffff)",
          border: "1px solid var(--line, #e2e8f0)",
          borderRadius: "16px",
          boxShadow: "0 20px 40px -10px rgba(0, 0, 0, 0.35)",
          overflow: "hidden",
          animation: "scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px 24px 16px",
            display: "flex",
            alignItems: "flex-start",
            gap: "16px",
          }}
        >
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "12px",
              background: iconBg,
              color: iconColor,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {isDanger ? <Trash2 size={22} /> : <AlertTriangle size={22} />}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <h3
              id="confirm-modal-title"
              style={{
                margin: "0 0 6px 0",
                fontSize: "17px",
                fontWeight: 700,
                color: "var(--text, #0f172a)",
                letterSpacing: "-0.01em",
              }}
            >
              {title}
            </h3>
            {itemLabel && (
              <div
                style={{
                  display: "inline-block",
                  padding: "3px 10px",
                  borderRadius: "6px",
                  background: "var(--soft, #f1f5f9)",
                  border: "1px solid var(--line, #e2e8f0)",
                  fontSize: "12px",
                  fontWeight: 600,
                  fontFamily: "monospace",
                  color: "var(--text, #0f172a)",
                  marginBottom: "8px",
                  maxWidth: "100%",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {itemLabel}
              </div>
            )}
            <p
              style={{
                margin: 0,
                fontSize: "13.5px",
                lineHeight: "1.55",
                color: "var(--text-muted, #64748b)",
                whiteSpace: "pre-line",
              }}
            >
              {message}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            aria-label="Close"
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-muted, #94a3b8)",
              cursor: isLoading ? "not-allowed" : "pointer",
              padding: "4px",
              borderRadius: "6px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: "16px 24px",
            background: "var(--soft, #f8fafc)",
            borderTop: "1px solid var(--line, #e2e8f0)",
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            style={{
              padding: "9px 18px",
              borderRadius: "8px",
              border: "1px solid var(--line-strong, #cbd5e1)",
              background: "var(--card-bg, #ffffff)",
              color: "var(--text, #334155)",
              fontSize: "13px",
              fontWeight: 600,
              cursor: isLoading ? "not-allowed" : "pointer",
              transition: "all 0.15s ease",
            }}
          >
            {cancelLabel}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            style={{
              padding: "9px 20px",
              borderRadius: "8px",
              border: "none",
              background: confirmBtnBg,
              color: "#ffffff",
              fontSize: "13px",
              fontWeight: 700,
              cursor: isLoading ? "not-allowed" : "pointer",
              boxShadow: isDanger
                ? "0 4px 12px rgba(220, 38, 38, 0.3)"
                : "0 4px 12px rgba(217, 119, 6, 0.3)",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              opacity: isLoading ? 0.7 : 1,
            }}
          >
            {isLoading ? (
              <>
                <span
                  style={{
                    display: "inline-block",
                    width: "14px",
                    height: "14px",
                    border: "2px solid #ffffff",
                    borderTopColor: "transparent",
                    borderRadius: "50%",
                    animation: "spin 0.6s linear infinite",
                  }}
                />
                <span>Processing...</span>
              </>
            ) : (
              <>
                {isDanger ? <Trash2 size={14} /> : <Archive size={14} />}
                <span>{confirmLabel}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
