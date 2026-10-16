import { adToBs, formatBsDate, formatDualDate } from "@/lib/nepali-calendar";

export function money(value: number | string | { toString(): string } | null | undefined, currency = "NPR") {
  const number = Number(value ?? 0);
  return new Intl.NumberFormat("en-NP", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(number);
}

export function compactMoney(value: number, currency = "NPR") {
  const number = Number(value ?? 0);
  return new Intl.NumberFormat("en-NP", {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(number);
}

export function shortDate(value: Date | string | null | undefined, preferBs = true) {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (isNaN(d.getTime())) return "—";
  if (preferBs) {
    const bs = adToBs(d);
    return `${bs.day} ${bs.monthName} ${bs.year} BS`;
  }
  return new Intl.DateTimeFormat("en-NP", { day: "2-digit", month: "short", year: "numeric" }).format(d);
}

export function dualDateText(value: Date | string | null | undefined) {
  return formatDualDate(value);
}

export function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
