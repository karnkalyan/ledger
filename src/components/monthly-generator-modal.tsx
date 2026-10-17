"use client";

import { useState, useTransition } from "react";
import { RefreshCw, CheckSquare, Square, X, Calendar, DollarSign, CheckCircle2, Sliders } from "lucide-react";
import { generateMonthlyEstimatesAction } from "@/app/(dashboard)/actions";

export interface RecurringCommitmentItem {
  id: string;
  title: string;
  vendor?: string | null;
  recurrence: string;
  fixedAmount?: number | null;
  unitRate?: number | null;
  quantity?: number | null;
  estimatedAmount: number;
  categoryName?: string;
}

const BS_MONTH_OPTIONS = [
  { value: "2083-04", label: "2083-04 · Shrawan (श्रावण) 2083 BS" },
  { value: "2083-05", label: "2083-05 · Bhadra (भाद्र) 2083 BS" },
  { value: "2083-06", label: "2083-06 · Ashwin (असोज) 2083 BS" },
  { value: "2083-07", label: "2083-07 · Kartik (कार्तिक) 2083 BS (Current)" },
  { value: "2083-08", label: "2083-08 · Mangsir (मंसिर) 2083 BS" },
  { value: "2083-09", label: "2083-09 · Poush (पुष) 2083 BS" },
  { value: "2083-10", label: "2083-10 · Magh (माघ) 2083 BS" },
  { value: "2083-11", label: "2083-11 · Falgun (फाल्गुन) 2083 BS" },
  { value: "2083-12", label: "2083-12 · Chaitra (चैत) 2083 BS" },
];

export function MonthlyGeneratorModal({
  orgId,
  currentMonth,
  currency = "NPR",
  recurringItems = [],
  isCompany = false,
}: {
  orgId: string;
  currentMonth: string;
  currency?: string;
  recurringItems: RecurringCommitmentItem[];
  isCompany?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [month, setMonth] = useState(currentMonth);
  const [markAsPaid, setMarkAsPaid] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    recurringItems.forEach((r) => {
      init[r.id] = true;
    });
    return init;
  });
  const [overrideAmounts, setOverrideAmounts] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    recurringItems.forEach((r) => {
      init[r.id] = r.estimatedAmount;
    });
    return init;
  });

  const [isPending, startTransition] = useTransition();

  const handleToggle = (id: string) => {
    setSelectedIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleSelectAll = (select: boolean) => {
    const updated: Record<string, boolean> = {};
    recurringItems.forEach((r) => {
      updated[r.id] = select;
    });
    setSelectedIds(updated);
  };

  const handleAmountChange = (id: string, val: number) => {
    setOverrideAmounts((prev) => ({
      ...prev,
      [id]: val,
    }));
  };

  const selectedCount = Object.values(selectedIds).filter(Boolean).length;
  const totalSelectedAmount = recurringItems
    .filter((r) => selectedIds[r.id])
    .reduce((sum, r) => sum + (overrideAmounts[r.id] || r.estimatedAmount), 0);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData();
    formData.set("orgId", orgId);
    formData.set("month", month);
    formData.set("markAsPaid", markAsPaid ? "true" : "false");

    Object.entries(selectedIds).forEach(([id, checked]) => {
      if (checked) {
        formData.append("selectedItems", id);
      }
    });

    formData.set("overrideAmounts", JSON.stringify(overrideAmounts));

    setIsOpen(false);
    startTransition(async () => {
      await generateMonthlyEstimatesAction(formData);
    });
  };

  return (
    <>
      <button
        type="button"
        className="ghost-btn"
        onClick={() => setIsOpen(true)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontWeight: 650,
          padding: "5px 12px",
          borderRadius: 6,
          border: "1px solid var(--line-strong)",
        }}
      >
        <RefreshCw size={13} style={{ verticalAlign: "middle" }} />
        <span>Generate Monthly</span>
      </button>

      {isOpen && (
        <div
          className="drawer-backdrop"
          style={{ display: "flex" }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsOpen(false);
            }
          }}
        >
          <div
            className="drawer-panel"
            role="dialog"
            aria-modal="true"
            style={{ width: "min(680px, 95vw)", maxHeight: "90vh", display: "flex", flexDirection: "column" }}
          >
            {/* Modal Header */}
            <div className="drawer-head" style={{ marginBottom: 12, paddingBottom: 10 }}>
              <div>
                <h2>{isCompany ? "Generate Office Monthly Expenses" : "Generate House & Family Monthly Commitments"}</h2>
                <p>
                  Select which recurring expenses to generate for the month (e.g. rent, internet, electricity, milk, groceries).
                  Uncheck items not used or not paid this month.
                </p>
              </div>
              <button
                type="button"
                className="modal-close-icon-btn"
                onClick={() => setIsOpen(false)}
                aria-label="Close"
              >
                <X size={15} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14, flex: 1, minHeight: 0 }}>
              {/* Month selector & quick toggles */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: "var(--soft)",
                  padding: "10px 14px",
                  borderRadius: 8,
                  border: "1px solid var(--line)",
                  flexWrap: "wrap",
                  gap: 10,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <Calendar size={15} style={{ color: "var(--brand)" }} />
                  <span style={{ fontSize: 12, fontWeight: 700 }}>Nepali BS Billing Month:</span>
                  <select
                    value={month}
                    onChange={(e) => setMonth(e.target.value)}
                    style={{
                      padding: "4px 8px",
                      fontSize: 13,
                      fontFamily: "Consolas, monospace",
                      fontWeight: 700,
                      borderRadius: 6,
                      border: "1px solid var(--line-strong)",
                      background: "var(--surface)",
                      color: "var(--foreground)",
                    }}
                  >
                    {BS_MONTH_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                    {!BS_MONTH_OPTIONS.some((o) => o.value === month) && (
                      <option value={month}>{month} (Selected Month)</option>
                    )}
                  </select>
                  <span className="badge green" style={{ fontSize: 10, fontWeight: 700 }}>
                    🇳🇵 BIKRAM SAMBAT
                  </span>
                </div>

                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, cursor: "pointer", background: "var(--surface)", padding: "3px 8px", borderRadius: 5, border: "1px solid var(--line)" }}>
                    <input
                      type="checkbox"
                      checked={markAsPaid}
                      onChange={(e) => setMarkAsPaid(e.target.checked)}
                    />
                    <span>Generate as <strong style={{ color: "var(--success)" }}>PAID</strong></span>
                  </label>

                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <button
                      type="button"
                      onClick={() => handleSelectAll(true)}
                      className="ghost-btn"
                      style={{ fontSize: 11, padding: "2px 8px" }}
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectAll(false)}
                      className="ghost-btn"
                      style={{ fontSize: 11, padding: "2px 8px" }}
                    >
                      Deselect All
                    </button>
                  </div>
                </div>
              </div>

              {/* Items List */}
              <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, paddingRight: 4, maxHeight: "50vh" }}>
                {recurringItems.length === 0 ? (
                  <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
                    No recurring expense commitments found. Set up recurring commitments in &quot;+ Recurring Rule&quot; first.
                  </div>
                ) : (
                  recurringItems.map((item) => {
                    const isChecked = Boolean(selectedIds[item.id]);
                    const currentAmt = overrideAmounts[item.id] !== undefined ? overrideAmounts[item.id] : item.estimatedAmount;

                    return (
                      <div
                        key={item.id}
                        onClick={() => handleToggle(item.id)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "10px 14px",
                          borderRadius: 8,
                          border: isChecked ? "1px solid var(--brand)" : "1px solid var(--line)",
                          background: isChecked ? "rgba(99, 102, 241, 0.04)" : "var(--surface)",
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}} // handled by parent onClick
                            style={{ width: 17, height: 17, accentColor: "var(--brand)", cursor: "pointer" }}
                          />
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <strong style={{ fontSize: 13.5, display: "block", color: "var(--text)" }}>
                              {item.title}
                            </strong>
                            <div style={{ display: "flex", gap: 8, fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                              {item.categoryName && <span>{item.categoryName}</span>}
                              {item.vendor && (
                                <>
                                  <span>•</span>
                                  <span>{item.vendor}</span>
                                </>
                              )}
                              <span>•</span>
                              <span style={{ textTransform: "capitalize" }}>{item.recurrence.toLowerCase()}</span>
                            </div>
                          </div>
                        </div>

                        {/* Amount display / custom adjust */}
                        <div
                          style={{ display: "flex", alignItems: "center", gap: 6 }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{currency}</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            disabled={!isChecked}
                            value={currentAmt}
                            onChange={(e) => handleAmountChange(item.id, Number(e.target.value))}
                            style={{
                              width: 105,
                              padding: "4px 8px",
                              textAlign: "right",
                              fontSize: 13,
                              fontWeight: 700,
                              fontFamily: "Consolas, monospace",
                              borderRadius: 5,
                              border: "1px solid var(--line)",
                              background: isChecked ? "var(--surface)" : "var(--soft)",
                            }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Summary Bar */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "10px 14px",
                  background: "var(--soft)",
                  borderRadius: 8,
                  border: "1px solid var(--line)",
                  marginTop: 4,
                }}
              >
                <div>
                  <span style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>
                    Selected Commitments ({selectedCount} of {recurringItems.length})
                  </span>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                    Unselected items will NOT be created for this month.
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", display: "block" }}>
                    Total Estimated
                  </span>
                  <strong style={{ fontSize: 16, fontFamily: "Consolas, monospace", color: "var(--brand)" }}>
                    {currency} {totalSelectedAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </strong>
                </div>
              </div>

              {/* Actions */}
              <div className="form-actions" style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 4 }}>
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => setIsOpen(false)}
                  disabled={isPending}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary-btn"
                  disabled={isPending || selectedCount === 0}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                >
                  <CheckCircle2 size={14} />
                  <span>{isPending ? "Generating..." : `Generate (${selectedCount} Items)`}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
