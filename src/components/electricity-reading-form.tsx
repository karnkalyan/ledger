"use client";

import { useMemo, useState } from "react";
import { saveElectricityLogAction } from "@/app/(dashboard)/actions";
import { Zap, Calculator, RotateCcw, CheckCircle2 } from "lucide-react";

export function ElectricityReadingForm({
  orgId,
  currency,
  initialLastUnit = 0,
  defaultRate = 15,
  defaultMonth,
}: {
  orgId: string;
  currency: string;
  initialLastUnit?: number;
  defaultRate?: number;
  defaultMonth?: string;
}) {
  const [previousUnit, setPreviousUnit] = useState<number>(initialLastUnit);
  const [currentUnit, setCurrentUnit] = useState<number | string>("");
  const [ratePerUnit, setRatePerUnit] = useState<number>(defaultRate);
  const [isEditingPrevious, setIsEditingPrevious] = useState<boolean>(initialLastUnit === 0);
  const [month, setMonth] = useState<string>(
    defaultMonth || new Date().toISOString().slice(0, 7)
  );

  const curNum = typeof currentUnit === "number" ? currentUnit : parseFloat(currentUnit) || 0;
  const unitsConsumed = Math.max(0, curNum - previousUnit);
  const totalBill = unitsConsumed * ratePerUnit;
  const isValid = curNum >= previousUnit && curNum > 0;

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
      <input type="hidden" name="orgId" value={orgId} />
      <input type="hidden" name="previousUnit" value={previousUnit} />

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
              Just enter <strong>Current Unit</strong>. The last recorded reading is automatically remembered for next month!
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
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 12,
          alignItems: "end",
        }}
      >
        {/* BILLING MONTH */}
        <label className="field" style={{ margin: 0 }}>
          <span className="field-label">Billing Month</span>
          <input
            type="text"
            name="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            placeholder="YYYY-MM (e.g. 2083-06)"
            required
            style={{ fontFamily: "Consolas, monospace" }}
          />
        </label>

        {/* PREVIOUS UNIT (OLD LAST UNIT) */}
        <label className="field" style={{ margin: 0 }}>
          <span className="field-label" style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Last Unit (Previous)</span>
            {!isEditingPrevious && <span style={{ color: "var(--success)", fontSize: 10 }}>✔ Auto-Retrieved</span>}
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
            ★ Current Unit (Today)
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
            onChange={(e) => setRatePerUnit(parseFloat(e.target.value) || 15)}
            required
            style={{ fontFamily: "Consolas, monospace" }}
          />
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
          <div style={{ color: "var(--danger)", fontSize: 11, marginTop: 6, fontWeight: 600 }}>
            ⚠️ Current meter reading ({curNum}) is less than previous reading ({previousUnit}). Please check meter reading.
          </div>
        ) : (
          <div style={{ color: "var(--success)", fontSize: 11, marginTop: 6, display: "flex", alignItems: "center", gap: 4 }}>
            <CheckCircle2 size={13} />
            Ready: Submitting will record NPR {totalBill.toFixed(2)} into Expenses and set {curNum} as the last unit for next month.
          </div>
        )
      ) : null}
    </form>
  );
}
