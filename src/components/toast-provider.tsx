"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { Toaster, toast } from "react-hot-toast";
import { clearPendingOperation, readPendingOperation } from "@/lib/pending-operation";

export function ToastProvider() {
  const pathname = usePathname();

  useEffect(() => {
    const operation = readPendingOperation();
    if (!operation) return;
    clearPendingOperation();
    toast.success(operation.successMessage, { id: "flowledger-form-operation" });
  }, [pathname]);

  return (
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 3500,
        style: {
          background: "var(--surface, #ffffff)",
          color: "var(--text, #0f172a)",
          border: "1px solid var(--line, #e2e8f0)",
          boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
          fontSize: "12.5px",
          fontWeight: 600,
          borderRadius: "8px",
          padding: "10px 14px",
        },
        success: {
          iconTheme: {
            primary: "#10b981",
            secondary: "#ffffff",
          },
        },
        error: {
          iconTheme: {
            primary: "#ef4444",
            secondary: "#ffffff",
          },
        },
      }}
    />
  );
}

export { toast };
