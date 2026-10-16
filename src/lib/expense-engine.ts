import { Recurrence } from "@/generated/client";
import { getDaysInMonth } from "date-fns";

type RecurringInput = {
  recurrence: Recurrence | string;
  quantity?: number | string | { toString(): string } | null;
  unitRate?: number | string | { toString(): string } | null;
  billingDays?: number | string | { toString(): string } | null;
  fixedAmount?: number | string | { toString(): string } | null;
};

export function estimateRecurringExpense(item: RecurringInput, month = new Date()) {
  const fixed = Number(item.fixedAmount ?? 0);
  if (fixed > 0) return fixed;

  const quantity = Number(item.quantity ?? 1);
  const rate = Number(item.unitRate ?? 0);
  const overrideDays = Number(item.billingDays ?? 0);
  const days = overrideDays > 0 ? overrideDays : getDaysInMonth(month);

  switch (item.recurrence) {
    case "DAILY":
      return quantity * rate * days;
    case "WEEKLY":
      return quantity * rate * 4.345;
    case "QUARTERLY":
      return (quantity * rate) / 3;
    case "YEARLY":
      return (quantity * rate) / 12;
    case "MONTHLY":
    case "CUSTOM":
    default:
      return quantity * rate;
  }
}

export function expenseFormulaText(item: RecurringInput & { unit?: string | null }, month = new Date()) {
  const fixed = Number(item.fixedAmount ?? 0);
  if (fixed > 0) return `Fixed monthly amount`;
  const qty = Number(item.quantity ?? 1);
  const rate = Number(item.unitRate ?? 0);
  if (item.recurrence === "DAILY") {
    const days = Number(item.billingDays ?? 0) || getDaysInMonth(month);
    return `${qty} ${item.unit ?? "unit"} × ${rate} × ${days} days`;
  }
  return `${qty} ${item.unit ?? "unit"} × ${rate}`;
}
