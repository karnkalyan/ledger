"use client";

import { useState, useMemo, useEffect } from "react";
import { NepaliDatePicker } from "@/components/nepali-date-picker";
import { money } from "@/lib/format";
import { Calculator, Check, Sparkles } from "lucide-react";

interface LoanSettlementFormProps {
  orgId: string;
  loanId: string;
  loanType: "TAKEN" | "GIVEN";
  partyName: string;
  currency: string;
  remainingPrincipal: number;
  hasInterest: boolean;
  interestRate: number | null;
  interestFrequency: string;
  startDate: string | Date;
  dueDate?: string | Date | null;
  totalInterestPaid: number;
  action: (formData: FormData) => Promise<void>;
}

export function LoanSettlementForm({
  orgId,
  loanId,
  loanType,
  partyName,
  currency,
  remainingPrincipal,
  hasInterest,
  interestRate,
  interestFrequency,
  startDate,
  dueDate,
  totalInterestPaid,
  action,
}: LoanSettlementFormProps) {
  const [principal, setPrincipal] = useState<number>(remainingPrincipal);
  const [paymentDate, setPaymentDate] = useState<Date>(new Date());

  // Helper to compute interest dynamically
  const computeInterest = (
    p: number,
    targetDate: Date,
    overrideMode?: "PRO_RATA" | "FULL_MONTH" | "DUE_DATE" | "ZERO"
  ): { interest: number; days: number; rule: string } => {
    if (!hasInterest || !interestRate || overrideMode === "ZERO") {
      return { interest: 0, days: 0, rule: "Interest-free or waived" };
    }

    const r = Number(interestRate);
    const startMs = new Date(startDate).getTime();
    const settleMs = targetDate.getTime();
    let days = Math.round((settleMs - startMs) / (1000 * 60 * 60 * 24));

    if (overrideMode === "FULL_MONTH" || (days <= 0 && interestFrequency === "MONTHLY" && !dueDate)) {
      const fullMonthInterest = Math.round(p * (r / 100) * 100) / 100;
      return {
        interest: Math.max(0, fullMonthInterest - totalInterestPaid),
        days: 30,
        rule: `1 Full Month (${r}%)`,
      };
    }

    if (overrideMode === "DUE_DATE" && dueDate) {
      days = Math.max(1, Math.round((new Date(dueDate).getTime() - startMs) / (1000 * 60 * 60 * 24)));
    } else if (days <= 0) {
      if (dueDate && new Date(dueDate).getTime() > startMs) {
        days = Math.max(1, Math.round((new Date(dueDate).getTime() - startMs) / (1000 * 60 * 60 * 24)));
      } else {
        days = interestFrequency === "DAILY" ? 1 : interestFrequency === "YEARLY" ? 365 : 30;
      }
    }

    let calculated = 0;
    let ruleText = "";
    if (interestFrequency === "DAILY") {
      calculated = p * (r / 100) * days;
      ruleText = `${days} days @ ${r}% daily`;
    } else if (interestFrequency === "YEARLY") {
      calculated = p * (r / 100) * (days / 365.25);
      ruleText = `${days} days @ ${r}% yearly pro-rata`;
    } else {
      // MONTHLY
      calculated = p * (r / 100) * (days / 30);
      ruleText = `${days} days @ ${r}% monthly pro-rata`;
    }

    const netInterest = Math.max(0, Math.round((calculated - totalInterestPaid) * 100) / 100);
    return { interest: netInterest, days, rule: ruleText };
  };

  const initialCalc = useMemo(
    () => computeInterest(remainingPrincipal, new Date()),
    [remainingPrincipal, hasInterest, interestRate, interestFrequency, startDate, dueDate, totalInterestPaid]
  );

  const [interest, setInterest] = useState<number>(initialCalc.interest);
  const [calculationNote, setCalculationNote] = useState<string>(initialCalc.rule);

  // Auto recalculate when payment date or principal changes
  const handleDateChange = (newDate: Date) => {
    setPaymentDate(newDate);
    if (hasInterest && interestRate) {
      const result = computeInterest(principal, newDate);
      setInterest(result.interest);
      setCalculationNote(result.rule);
    }
  };

  const handlePrincipalChange = (val: number) => {
    setPrincipal(val);
    if (hasInterest && interestRate) {
      const result = computeInterest(val, paymentDate);
      setInterest(result.interest);
      setCalculationNote(result.rule);
    }
  };

  const applyPreset = (mode: "PRO_RATA" | "FULL_MONTH" | "DUE_DATE" | "ZERO") => {
    const result = computeInterest(principal, paymentDate, mode);
    setInterest(result.interest);
    setCalculationNote(result.rule);
  };

  const totalSettleAmount = Math.max(0, (principal || 0) + (interest || 0));

  return (
    <div style={{ marginTop: 16, borderTop: "1px solid var(--line)", paddingTop: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 10 }}>
        <div>
          <h4 style={{ margin: 0, fontSize: 14 }}>
            Record Loan Repayment / Settlement ({loanType === "TAKEN" ? `Pay Back ${partyName}` : `Collect from ${partyName}`})
          </h4>
          <p style={{ margin: "3px 0 0", fontSize: 12, color: "var(--text-muted)" }}>
            Accrued interest auto-calculates in real-time as principal or settlement date changes.
          </p>
        </div>

        {hasInterest && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button
              type="button"
              className="ghost-btn"
              onClick={() => applyPreset("PRO_RATA")}
              style={{ fontSize: 11, padding: "4px 8px" }}
              title="Recalculate pro-rata interest to selected settlement date"
            >
              <Sparkles size={11} style={{ marginRight: 3, color: "var(--brand)" }} />
              Auto-Calc Pro-Rata
            </button>
            {interestFrequency === "MONTHLY" && (
              <button
                type="button"
                className="ghost-btn"
                onClick={() => applyPreset("FULL_MONTH")}
                style={{ fontSize: 11, padding: "4px 8px" }}
                title="Apply standard 1 full month interest"
              >
                1 Full Month ({interestRate}%)
              </button>
            )}
            {dueDate && (
              <button
                type="button"
                className="ghost-btn"
                onClick={() => applyPreset("DUE_DATE")}
                style={{ fontSize: 11, padding: "4px 8px" }}
                title="Calculate interest up to target due date"
              >
                Due Date Term
              </button>
            )}
            <button
              type="button"
              className="ghost-btn"
              onClick={() => applyPreset("ZERO")}
              style={{ fontSize: 11, padding: "4px 8px" }}
              title="Waive or set 0 interest"
            >
              Waive Interest (NPR 0)
            </button>
          </div>
        )}
      </div>

      <form action={action}>
        <input type="hidden" name="orgId" value={orgId} />
        <input type="hidden" name="loanId" value={loanId} />

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, alignItems: "flex-end" }}>
          <label className="field">
            Principal Amount ({currency})
            <input
              type="number"
              name="principalAmount"
              value={principal}
              onChange={(e) => handlePrincipalChange(Number(e.target.value))}
              max={remainingPrincipal}
              min="0"
              step="0.01"
              required
            />
          </label>

          <label className="field">
            <span style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Interest Amount ({currency})</span>
              {hasInterest && calculationNote && (
                <span style={{ fontSize: 10, color: "var(--brand)", fontWeight: 500, display: "inline-flex", alignItems: "center", gap: 3 }}>
                  <Sparkles size={11} /> {calculationNote}
                </span>
              )}
            </span>
            <input
              type="number"
              name="interestAmount"
              value={interest}
              onChange={(e) => setInterest(Number(e.target.value))}
              min="0"
              step="0.01"
            />
          </label>

          <div className="field">
            <NepaliDatePicker
              name="paymentDate"
              label="Settlement Date (BS / AD)"
              required
              onChange={handleDateChange}
            />
          </div>

          <label className="field">
            Payment Method
            <select name="method" defaultValue="Bank Transfer">
              <option value="Bank Transfer">Bank Transfer</option>
              <option value="Cash">Cash / Physical</option>
              <option value="Cheque">Cheque</option>
              <option value="ConnectIPS / Fonepay">ConnectIPS / Fonepay</option>
            </select>
          </label>

          <label className="field" style={{ gridColumn: "1 / -1" }}>
            Settlement Notes / Memo
            <input
              name="notes"
              placeholder={`e.g. Loan settlement (${loanType === "TAKEN" ? "paid" : "received"} Principal: ${principal}, Interest: ${interest})`}
            />
          </label>
        </div>

        {/* Live Total Due Indicator */}
        <div
          style={{
            marginTop: 12,
            padding: "10px 14px",
            background: "var(--bg-accent, rgba(99, 102, 241, 0.05))",
            borderRadius: 6,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 10,
          }}
        >
          <div style={{ fontSize: 13 }}>
            <span>Settlement Breakdown: </span>
            <strong>Principal {money(principal, currency)}</strong> +{" "}
            <strong>Interest {money(interest, currency)}</strong>
          </div>
          <div style={{ fontSize: 14 }}>
            <span>Total to Settle: </span>
            <strong style={{ fontSize: 16, color: "var(--brand)" }}>
              {money(totalSettleAmount, currency)}
            </strong>
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <button className="success-btn" type="submit" style={{ padding: "8px 18px", minHeight: 36 }}>
            Settle Payment (Syncs to Cash Ledger &amp; Monthly Report)
          </button>
        </div>
      </form>
    </div>
  );
}
