"use client";

import { Toaster, toast } from "react-hot-toast";

export function ToastProvider() {
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
