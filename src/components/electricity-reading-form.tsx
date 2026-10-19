"use client";

import { useMemo, useState } from "react";
import { saveElectricityLogAction } from "@/app/(dashboard)/actions";
import { Zap, RotateCcw, CheckCircle2, AlertCircle } from "lucide-react";
import { adToBs, NEPALI_MONTHS_EN, NEPALI_MONTHS_NE } from "@/lib/nepali-calendar";
import { FormPendingFeedback } from "@/components/form-pending-feedback";

export function ElectricityReadingForm({
  orgId,
  currency,
  initialLastUnit = 0,
  defaultRate = 12,
  defaultMonth,
}: {
  orgId: string;
  currency: string;
  initialLastUnit?: number;
  defaultRate?: number;
  defaultMonth?: string;
}) {
  const currentBs = useMemo(() => {
    try {
      return adToBs(new Date());
    } catch {
      return null;
    }
  }, []);

  const defaultBsMonth = currentBs ? `${currentBs.year}-${String(currentBs.month).padStart(2, "0")}` : "2083-07";

  const [previousUnit, setPreviousUnit] = useState<number>(initialLastUnit);
  const [currentUnit, setCurrentUnit] = useState<number | string>("");
  const [ratePerUnit, setRatePerUnit] = useState<number>(defaultRate);
  const [isEditingPrevious, setIsEditingPrevious] = useState<boolean>(initialLastUnit === 0);
  const [month, setMonth] = useState<string>(defaultMonth || defaultBsMonth);
  const [paidStatus, setPaidStatus] = useState<boolean>(true);

  const curNum = typeof currentUnit === "number" ? currentUnit : parseFloat(currentUnit) || 0;
  const unitsConsumed = Math.max(0, curNum - previousUnit);
  const totalBill = unitsConsumed * ratePerUnit;
  const isValid = curNum >= previousUnit && curNum > 0;

  // Generate Nepali BS month options (current year and surrounding)
  const nepaliMonthOptions = useMemo(() => {
    const y = currentBs?.year || 2083;
    const list = [];
    for (let yr = y; yr >= y - 1; yr--) {
      for (let m = 12; m >= 1; m--) {
        const mm = String(m).padStart(2, "0");
        const key = `${yr}-${mm}`;
        const nameEn = NEPALI_MONTHS_EN[m - 1];
        const nameNe = NEPALI_MONTHS_NE[m - 1];
        list.push({ key, label: `${key} · ${nameEn} (${nameNe}) ${yr} BS` });
      }
    }
    return list;
  }, [currentBs]);

  const activeMonthLabel = useMemo(() => {
    const parts = month.split("-");
    if (parts.length === 2) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      if (y > 2000 && y < 2200 && m >= 1 && m <= 12) {
        return `${NEPALI_MONTHS_EN[m - 1]} ${y} BS (${NEPALI_MONTHS_NE[m - 1]})`;
      }
    }
    return "";
  }, [month]);

  return (
    <form
      action={saveElectricityLogAction}
      className="electricity-reading-box"
      style={{
        background: "var(--soft)",
        padding: "18px 20px",
        borderRadius: 8,
        border: "1px solid var(--line)",
      }}
    >
      <FormPendingFeedback processingMessage="Saving electricity reading..." successMessage="Electricity reading saved successfully" />
      <input type="hidden" name="orgId" value={orgId} />
      <input type="hidden" name="previousUnit" value={previousUnit} />
      <input type="hidden" name="paid" value={paidStatus ? "true" : "false"} />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              display: "grid",
              placeItems: "center",
              width: 32,
              height: 32,
              borderRadius: 6,
              background: "var(--warning-soft)",
              color: "var(--warning)",
              border: "1px solid var(--warning-border)",
            }}
          >
            <Zap size={18} />
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: 14.5, fontWeight: 700 }}>
              Monthly Electricity Meter Reading &amp; Auto Bill
            </h4>
            <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
              Nepali Bikram Sambat (BS) calendar system. Just enter <strong>Current Unit</strong> — the last recorded reading is automatically remembered!
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsEditingPrevious((prev) => !prev)}
          className="secondary-btn"
          style={{ fontSize: 11, padding: "4px 8px" }}
          title="Manually adjust or reset baseline starting unit"
        >
          <RotateCcw size={12} style={{ verticalAlign: "middle", marginRight: 4 }} />
          {isEditingPrevious ? "Lock Last Unit" : "Calibrate / Edit Last Unit"}
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
          gap: 12,
          alignItems: "end",
        }}
      >
        {/* BILLING MONTH (NEPALI BS DROPDOWN WITH CUSTOM TYPING) */}
        <label className="field" style={{ margin: 0 }}>
          <span className="field-label" style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Billing Month (BS)</span>
            <span style={{ color: "var(--brand)", fontSize: 10, fontWeight: 700 }}>Nepali BS</span>
          </span>
          <select
            name="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            required
            style={{ fontFamily: "Consolas, monospace", fontWeight: 700, fontSize: 12 }}
          >
            {nepaliMonthOptions.map((opt) => (
              <option key={opt.key} value={opt.key}>
                {opt.label}
              </option>
            ))}
            {!nepaliMonthOptions.some((o) => o.key === month) && (
              <option value={month}>Custom: {month}</option>
            )}
          </select>
          {activeMonthLabel && (
            <span style={{ fontSize: 10.5, color: "var(--brand)", marginTop: 2, display: "block" }}>
              {activeMonthLabel}
            </span>
          )}
        </label>

        {/* PREVIOUS UNIT (OLD LAST UNIT) */}
        <label className="field" style={{ margin: 0 }}>
          <span className="field-label" style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Last Unit (Previous)</span>
            {!isEditingPrevious && (
              <span style={{ color: "var(--success)", fontSize: 10, display: "inline-flex", alignItems: "center", gap: 3 }}>
                <CheckCircle2 size={11} /> Auto-Retrieved
              </span>
            )}
          </span>
          <input
            type="number"
            step="0.01"
            value={previousUnit}
            onChange={(e) => setPreviousUnit(parseFloat(e.target.value) || 0)}
            disabled={!isEditingPrevious}
            required
            style={{
              fontFamily: "Consolas, monospace",
              background: isEditingPrevious ? "var(--surface)" : "var(--soft-hover)",
              fontWeight: 700,
            }}
          />
        </label>

        {/* CURRENT UNIT (PRIMARY ENTRY FIELD) */}
        <label className="field" style={{ margin: 0 }}>
          <span className="field-label" style={{ color: "var(--brand)", fontWeight: 750 }}>
            Current Unit (Today)
          </span>
          <input
            type="number"
            name="currentUnit"
            step="0.01"
            value={currentUnit}
            onChange={(e) => setCurrentUnit(e.target.value)}
            placeholder={`> ${previousUnit}`}
            required
            autoFocus
            style={{
              fontFamily: "Consolas, monospace",
              fontWeight: 800,
              fontSize: 14,
              borderColor: isValid ? "var(--brand)" : undefined,
            }}
          />
        </label>

        {/* RATE PER UNIT */}
        <label className="field" style={{ margin: 0 }}>
          <span className="field-label">Rate / Unit ({currency})</span>
          <input
            type="number"
            name="ratePerUnit"
            step="0.01"
            value={ratePerUnit}
            onChange={(e) => setRatePerUnit(parseFloat(e.target.value) || 12)}
            required
            style={{ fontFamily: "Consolas, monospace", fontWeight: 700 }}
          />
        </label>

        {/* BILL STATUS (PAID vs UNPAID) */}
        <label className="field" style={{ margin: 0 }}>
          <span className="field-label">Bill Status</span>
          <select
            value={paidStatus ? "PAID" : "UNPAID"}
            onChange={(e) => setPaidStatus(e.target.value === "PAID")}
            style={{
              fontWeight: 700,
              fontSize: 12,
              color: paidStatus ? "var(--green)" : "var(--amber)",
            }}
          >
            <option value="PAID">PAID (Finalized)</option>
            <option value="UNPAID">UNPAID (Pending)</option>
          </select>
        </label>

        {/* SUBMIT BUTTON */}
        <div>
          <button
            type="submit"
            className="primary-btn"
            disabled={!isValid}
            style={{
              width: "100%",
              padding: "9px 16px",
              fontWeight: 700,
              opacity: isValid ? 1 : 0.6,
              cursor: isValid ? "pointer" : "not-allowed",
            }}
          >
            Save &amp; Record Bill
          </button>
        </div>
      </div>

      {/* LIVE CALCULATION STRIP */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
          marginTop: 14,
          padding: "10px 14px",
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: 6,
          fontSize: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div>
            <span style={{ color: "var(--text-muted)" }}>Consumed: </span>
            <strong style={{ fontFamily: "Consolas, monospace", fontSize: 13.5, color: unitsConsumed > 0 ? "var(--brand)" : "inherit" }}>
              {unitsConsumed.toFixed(2)} units
            </strong>{" "}
            <small style={{ color: "var(--text-muted)" }}>
              ({curNum || 0} - {previousUnit})
            </small>
          </div>
          <div>
            <span style={{ color: "var(--text-muted)" }}>Rate: </span>
            <strong style={{ fontFamily: "Consolas, monospace" }}>
              {currency} {ratePerUnit}/unit
            </strong>
          </div>
          <div>
            <span style={{ color: "var(--text-muted)" }}>Status: </span>
            <strong style={{ color: paidStatus ? "var(--green)" : "var(--amber)" }}>
              {paidStatus ? "PAID" : "UNPAID (PENDING)"}
            </strong>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: "var(--text-muted)", textTransform: "uppercase", fontSize: 10.5, fontWeight: 700 }}>
            Computed Total Bill:
          </span>
          <strong style={{ fontSize: 16, color: "var(--danger)", fontFamily: "Consolas, monospace" }}>
            {currency} {totalBill.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </strong>
        </div>
      </div>

      {typeof currentUnit === "number" || (typeof currentUnit === "string" && currentUnit.trim() !== "") ? (
        curNum < previousUnit ? (
          <div style={{ color: "var(--danger)", fontSize: 11, marginTop: 6, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
            <AlertCircle size={13} /> Current meter reading ({curNum}) is less than previous reading ({previousUnit}). Please check meter reading.
          </div>
        ) : (
          <div style={{ color: "var(--success)", fontSize: 11, marginTop: 6, display: "flex", alignItems: "center", gap: 4 }}>
            <CheckCircle2 size={13} />
            Ready: Submitting will record NPR {totalBill.toFixed(2)} for {month} ({activeMonthLabel}) as {paidStatus ? "PAID" : "UNPAID"} and set {curNum} as the last unit for next month.
          </div>
        )
      ) : null}
    </form>
  );
}
