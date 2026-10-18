"use client";

import { useMemo, useState } from "react";
import { createExpenseAction, createRecurringExpenseAction } from "@/app/(dashboard)/actions";
import { NepaliDatePicker } from "@/components/nepali-date-picker";
import { FormPendingFeedback } from "@/components/form-pending-feedback";
import { Calculator, DollarSign, Banknote, Landmark, AlertTriangle, Wallet2 } from "lucide-react";

type Category = { id: string; name: string };
export type BankAccountOption = {
  id: string;
  bankName: string;
  accountNumber: string;
  accountType?: string | null;
  currentBalance?: number;
};

export function ExpenseForm({
  orgId,
  categories,
  bankAccounts = [],
  cashInHandBalance = 0,
  recurring = false,
  action: pageAction,
}: {
  orgId: string;
  categories: Category[];
  bankAccounts?: BankAccountOption[];
  cashInHandBalance?: number;
  recurring?: boolean;
  action?: (formData: FormData) => Promise<void>;
}) {
  // Payment Method: Default to CASH ("Cash in Hand")
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "BANK" | "WALLET">("CASH");
  const [selectedBankId, setSelectedBankId] = useState(bankAccounts[0]?.id || "");
  const [walletName, setWalletName] = useState("eSewa");

  // Mode selection: "DIRECT" vs "CALCULATED"
  const [calcMode, setCalcMode] = useState<"DIRECT" | "CALCULATED">("DIRECT");

  // Direct Amount State
  const [directAmount, setDirectAmount] = useState<number | string>("");
  const [isDirector, setIsDirector] = useState(false);

  // Formula State
  const [quantity, setQuantity] = useState(1);
  const [unit, setUnit] = useState("");
  const [rate, setRate] = useState(0);
  const [days, setDays] = useState(recurring ? 30 : 1);
  const [recurrence, setRecurrence] = useState("MONTHLY");

  // Total computation
  const formulaTotal = useMemo(() => {
    return quantity * rate * (recurring && recurrence === "DAILY" ? days : days > 0 ? days : 1);
  }, [quantity, rate, days, recurring, recurrence]);

  const finalAmount = calcMode === "DIRECT" ? Number(directAmount || 0) : formulaTotal;

  const action = pageAction ?? (recurring ? createRecurringExpenseAction : createExpenseAction);

  return (
    <form action={action} className="clean-expense-form">
      <FormPendingFeedback
        processingMessage={recurring ? "Saving the recurring expense rule..." : "Recording the expense and updating balances..."}
        successMessage={recurring ? "Recurring expense saved successfully" : "Expense recorded successfully"}
      />
      <input type="hidden" name="orgId" value={orgId} />

      <div className="form-grid">
        <label className="field full">
          <span className="field-label">Expense Title</span>
          <input
            name="title"
            placeholder={recurring ? "e.g. Office Internet bill" : "e.g. Electricity bill / Office Lunch"}
            required
          />
        </label>

        <label className="field">
          <span className="field-label">Category</span>
          <select name="categoryId">
            <option value="">Uncategorized</option>
            {categories.map((c) => (
              <option value={c.id} key={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span className="field-label">Vendor / Payee</span>
          <input name="vendor" placeholder="e.g. NEA / Supplier Name (Optional)" />
        </label>

        {recurring ? (
          <label className="field full">
            <span className="field-label">Recurrence Frequency</span>
            <select
              name="recurrence"
              value={recurrence}
              onChange={(e) => setRecurrence(e.target.value)}
            >
              <option value="DAILY">Daily</option>
              <option value="WEEKLY">Weekly</option>
              <option value="MONTHLY">Monthly</option>
              <option value="QUARTERLY">Quarterly</option>
              <option value="YEARLY">Yearly</option>
            </select>
          </label>
        ) : (
          <>
            <label className="field full">
              <span className="field-label">Expense Type</span>
              <select name="type">
                <option value="ONE_TIME">One Time</option>
                <option value="DAILY">Daily Operational</option>
                <option value="RECURRING">Recurring Actual</option>
              </select>
            </label>

            {/* PAYMENT METHOD & FUND SOURCE (Default: Cash in Hand) */}
            <div className="field full" style={{ border: "1px solid var(--line)", padding: 12, borderRadius: 8, background: "var(--soft)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 6 }}>
                <span className="field-label" style={{ margin: 0, fontWeight: 700 }}>Payment Method &amp; Fund Source</span>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  Available Cash in Hand: <strong style={{ color: cashInHandBalance > 0 ? "var(--success)" : "var(--danger)", fontFamily: "Consolas, monospace" }}>NPR {cashInHandBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
                </span>
              </div>
              <input type="hidden" name="paymentMethod" value={paymentMethod} />

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 8, marginBottom: 10 }}>
                <button
                  type="button"
                  onClick={() => setPaymentMethod("CASH")}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    padding: "8px 12px",
                    borderRadius: 6,
                    border: "1px solid",
                    borderColor: paymentMethod === "CASH" ? "var(--success)" : "var(--line)",
                    background: paymentMethod === "CASH" ? "var(--success-soft)" : "var(--surface)",
                    color: paymentMethod === "CASH" ? "var(--success)" : "var(--text-secondary)",
                    fontWeight: 650,
                    cursor: "pointer",
                    fontSize: 12,
                  }}
                >
                  <Banknote size={15} />
                  <span>Cash in Hand (Default)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod("BANK")}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    padding: "8px 12px",
                    borderRadius: 6,
                    border: "1px solid",
                    borderColor: paymentMethod === "BANK" ? "var(--cyan)" : "var(--line)",
                    background: paymentMethod === "BANK" ? "var(--cyan-soft)" : "var(--surface)",
                    color: paymentMethod === "BANK" ? "var(--cyan)" : "var(--text-secondary)",
                    fontWeight: 650,
                    cursor: "pointer",
                    fontSize: 12,
                  }}
                >
                  <Landmark size={15} />
                  <span>Bank Account ({bankAccounts.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod("WALLET")}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    padding: "8px 12px",
                    borderRadius: 6,
                    border: "1px solid",
                    borderColor: paymentMethod === "WALLET" ? "var(--purple)" : "var(--line)",
                    background: paymentMethod === "WALLET" ? "var(--purple-soft)" : "var(--surface)",
                    color: paymentMethod === "WALLET" ? "var(--purple)" : "var(--text-secondary)",
                    fontWeight: 650,
                    cursor: "pointer",
                    fontSize: 12,
                  }}
                >
                  <Wallet2 size={15} />
                  <span>Digital Wallet (eSewa / Khalti)</span>
                </button>
              </div>

              {paymentMethod === "BANK" && (
                <div style={{ marginTop: 8 }}>
                  <label className="field" style={{ margin: 0 }}>
                    <span className="field-label" style={{ fontSize: 11 }}>Select Deducting Bank Account</span>
                    <select
                      name="bankAccountId"
                      value={selectedBankId}
                      onChange={(e) => setSelectedBankId(e.target.value)}
                      required={paymentMethod === "BANK"}
                    >
                      {bankAccounts.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.bankName} (A/C: {b.accountNumber}) · Balance: NPR {Number(b.currentBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              )}

              {paymentMethod === "WALLET" && (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 8 }}>
                    <label className="field" style={{ margin: 0 }}>
                      <span className="field-label" style={{ fontSize: 11 }}>Digital Wallet Name</span>
                      <select
                        name="walletProvider"
                        value={walletName}
                        onChange={(e) => setWalletName(e.target.value)}
                      >
                        <option value="eSewa">eSewa Wallet</option>
                        <option value="Khalti">Khalti Digital Wallet</option>
                        <option value="IME Pay">IME Pay</option>
                        <option value="Prabhu Pay">Prabhu Pay</option>
                        <option value="Other">Other Wallet</option>
                      </select>
                    </label>
                    <label className="field" style={{ margin: 0 }}>
                      <span className="field-label" style={{ fontSize: 11 }}>Wallet ID / Linked Mobile</span>
                      <input name="walletId" placeholder="98XXXXXXXX" />
                    </label>
                  </div>
                  {(() => {
                    const matchedWallet = bankAccounts.find(
                      (b) => b.bankName.toLowerCase().includes(walletName.toLowerCase()) ||
                             (b.accountType === "DIGITAL_WALLET" && b.bankName.toLowerCase().includes(walletName.toLowerCase()))
                    );
                    const bal = matchedWallet ? Number(matchedWallet.currentBalance || 0) : null;
                    return (
                      <div style={{ marginTop: 6, fontSize: 11.5, color: "var(--text-secondary)" }}>
                        {matchedWallet ? (
                          <span>
                            Tracked Wallet Balance: <strong style={{ color: bal && bal > 0 ? "var(--green)" : "var(--amber)" }}>NPR {bal?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
                            {bal !== null && bal < finalAmount && finalAmount > 0 && (
                              <span style={{ color: "var(--danger)", marginLeft: 8 }}>
                                (⚠️ Low balance — transfer from Bank to Wallet if needed)
                              </span>
                            )}
                          </span>
                        ) : (
                          <span style={{ color: "var(--text-muted)" }}>
                            Tip: Transfer funds from your Bank Account to {walletName} via Banking to track live wallet balance.
                          </span>
                        )}
                      </div>
                    );
                  })()}
                </>
              )}

              {/* Insufficient Cash in Hand Warning / Guidance */}
              {paymentMethod === "CASH" && cashInHandBalance <= 0 && finalAmount > 0 && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 8,
                    padding: "8px 10px",
                    background: "rgba(239, 68, 68, 0.08)",
                    border: "1px solid var(--danger)",
                    borderRadius: 6,
                    color: "var(--danger)",
                    fontSize: 11.5,
                    marginTop: 8,
                  }}
                >
                  <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <strong>Notice: No recorded Cash in Hand balance available (NPR {cashInHandBalance.toLocaleString()}).</strong>
                    <div style={{ marginTop: 2, color: "var(--text-muted)", fontSize: 11 }}>
                      To prevent untracked cash gaps, record an income, bank ATM withdrawal, or wallet transfer first, or switch payment method to your Bank Account above.
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* CALCULATION MODE SWITCHER */}
        <div className="field full">
          <span className="field-label">Amount Input Method</span>
          <div className="amount-mode-toggle" role="group">
            <button
              type="button"
              className={`mode-btn ${calcMode === "DIRECT" ? "active" : ""}`}
              onClick={() => setCalcMode("DIRECT")}
            >
              <DollarSign size={13} />
              <span>Direct Amount</span>
            </button>
            <button
              type="button"
              className={`mode-btn ${calcMode === "CALCULATED" ? "active" : ""}`}
              onClick={() => setCalcMode("CALCULATED")}
            >
              <Calculator size={13} />
              <span>Calculate (Qty × Rate × Days)</span>
            </button>
          </div>
        </div>

        {calcMode === "DIRECT" ? (
          <label className="field full direct-amount-field">
            <span className="field-label">
              {recurring ? "Fixed Periodic Amount (NPR)" : "Total Amount (NPR)"}
            </span>
            <input
              name={recurring ? "fixedAmount" : "amount"}
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={directAmount}
              onChange={(e) => setDirectAmount(e.target.value)}
              required
              autoFocus
            />
          </label>
        ) : (
          <>
            <div className="calculated-fields-group full">
              <div className="form-grid">
                <label className="field">
                  <span className="field-label">Quantity</span>
                  <input
                    name="quantity"
                    type="number"
                    step="0.001"
                    min="0"
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                    required
                  />
                </label>

                <label className="field">
                  <span className="field-label">Unit</span>
                  <input
                    name="unit"
                    placeholder="ltr, pcs, unit, hrs, kg"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                  />
                </label>

                <label className="field">
                  <span className="field-label">Rate / Unit (NPR)</span>
                  <input
                    name="unitRate"
                    type="number"
                    step="0.01"
                    min="0"
                    value={rate}
                    onChange={(e) => setRate(Number(e.target.value))}
                    required
                  />
                </label>

                <label className="field">
                  <span className="field-label">
                    {recurring ? "Billing Days" : "Days / Multiplier"}
                  </span>
                  <input
                    name={recurring ? "billingDays" : "daysCount"}
                    type="number"
                    step="0.01"
                    min="1"
                    value={days}
                    onChange={(e) => setDays(Number(e.target.value))}
                  />
                </label>
              </div>
            </div>
            {/* Provide hidden amount value for regular expense if calculated */}
            {!recurring && (
              <input type="hidden" name="amount" value={formulaTotal.toFixed(2)} />
            )}
          </>
        )}

        {recurring ? (
          <>
            <label className="field">
              <span className="field-label">Payment Day of Month</span>
              <input name="dayOfMonth" type="number" min="1" max="32" placeholder="1" />
            </label>
            <label className="field">
              <span className="field-label">Reminder Before (Days)</span>
              <input name="reminderDaysBefore" type="number" min="0" defaultValue="3" />
            </label>
            <div className="field full">
              <NepaliDatePicker name="startDate" label="Start Date (BS / AD)" required />
            </div>
            <div className="field full">
              <NepaliDatePicker name="endDate" label="End Date (Optional)" />
            </div>
          </>
        ) : (
          <div className="field full">
            <NepaliDatePicker name="occurredAt" label="Expense Date (BS / AD)" required />
          </div>
        )}

        {/* DIRECTOR CURRENT ACCOUNT OPTION */}
        <div className="field full" style={{ background: "var(--soft)", padding: "12px 14px", borderRadius: 8, border: "1px solid var(--line)" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontWeight: 600 }}>
            <input
              type="checkbox"
              name="isDirectorAccount"
              checked={isDirector}
              onChange={(e) => setIsDirector(e.target.checked)}
              style={{ width: 16, height: 16, accentColor: "var(--brand)" }}
            />
            <span>Director Current Account (Personal Drawings / Loan Outlay)</span>
          </label>
          {isDirector && (
            <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <label className="field" style={{ margin: 0 }}>
                <span className="field-label" style={{ fontSize: 11 }}>Director Name</span>
                <input
                  name="directorName"
                  defaultValue="Director"
                  placeholder="e.g. Director Name"
                  required={isDirector}
                />
              </label>
              <label className="field" style={{ margin: 0 }}>
                <span className="field-label" style={{ fontSize: 11 }}>Director Outlay Type</span>
                <select name="directorTxType" defaultValue="DRAWINGS">
                  <option value="DRAWINGS">Director Personal Drawings (Money Out)</option>
                  <option value="REIMBURSEMENT">Loan / Expense Reimbursement to Director</option>
                  <option value="SALARY_ADVANCE">Director Advance</option>
                </select>
              </label>
            </div>
          )}
        </div>

        <label className="field full">
          <span className="field-label">Notes / Remarks</span>
          <textarea name="notes" placeholder="Optional notes or reference details..." rows={2} />
        </label>
      </div>

      <div className="formula-preview">
        <div>
          <span className="preview-label">Net Payable Amount</span>
          <strong className="preview-amount">
            NPR {finalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </strong>
        </div>
        <small className="preview-sub">
          {calcMode === "DIRECT"
            ? "Direct lump-sum amount"
            : `${quantity} ${unit || "units"} × NPR ${rate}${days > 1 ? ` × ${days} days` : ""}`}
        </small>
      </div>

      <div className="form-actions">
        <button className="primary-btn" type="submit">
          {recurring ? "Save Recurring Commitment" : "Save Expense"}
        </button>
      </div>
    </form>
  );
}
