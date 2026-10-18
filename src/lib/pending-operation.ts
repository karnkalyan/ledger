const STORAGE_KEY = "flowledger_pending_operation";

export type PendingOperation = {
  successMessage: string;
  startedAt: number;
};

export function savePendingOperation(operation: PendingOperation) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(operation));
  } catch {
    // Storage can be unavailable in restricted browser contexts.
  }
}

export function readPendingOperation(): PendingOperation | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingOperation;
    if (!parsed.successMessage || Date.now() - parsed.startedAt > 120_000) {
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearPendingOperation() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage can be unavailable in restricted browser contexts.
  }
}
