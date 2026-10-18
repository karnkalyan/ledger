"use client";

import { useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { LoaderCircle } from "lucide-react";
import { toast } from "@/components/toast-provider";
import { clearPendingOperation, savePendingOperation } from "@/lib/pending-operation";

const TOAST_ID = "flowledger-form-operation";

export function FormPendingFeedback({
  processingMessage = "Please wait, processing your request...",
  successMessage = "Operation completed successfully",
}: {
  processingMessage?: string;
  successMessage?: string;
}) {
  const { pending } = useFormStatus();
  const wasPending = useRef(false);

  useEffect(() => {
    if (pending) {
      wasPending.current = true;
      savePendingOperation({ successMessage, startedAt: Date.now() });
      toast.loading(processingMessage, { id: TOAST_ID });
      return;
    }

    if (wasPending.current) {
      wasPending.current = false;
      clearPendingOperation();
      toast.success(successMessage, { id: TOAST_ID });
    }
  }, [pending, processingMessage, successMessage]);

  if (!pending) return null;

  return (
    <div className="operation-modal-backdrop no-print" role="dialog" aria-modal="true" aria-live="polite" aria-label="Processing request">
      <div className="operation-modal-card">
        <LoaderCircle className="operation-modal-spinner" size={34} aria-hidden="true" />
        <strong>Please wait</strong>
        <p>{processingMessage}</p>
        <small>Please do not close this page or submit the form again.</small>
      </div>
    </div>
  );
}
