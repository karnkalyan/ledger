"use client";

import { useState } from "react";
import { NepaliDatePicker } from "@/components/nepali-date-picker";
import { FormPendingFeedback } from "@/components/form-pending-feedback";
import { Banknote, Landmark, Wallet2 } from "lucide-react";

type Contact = {
  id: string;
  name: string;
  companyName: string | null;
  taxNumber: string | null;
  type: string;
};

type BankAccount = {
  id: string;
  bankName: string;
  accountNumber: string;
  accountType?: string | null;
  currentBalance?: number;
};

export function IncomeForm({
  orgId,
  currency,
  contacts,
  bankAccounts = [],
  action,
}: {
  orgId: string;
  currency: string;
  contacts: Contact[];
  bankAccounts?: BankAccount[];
  action: (formData: FormData) => Promise<void>;
}) {
  const [source, setSource] = useState("");
  const [selectedContactId, setSelectedContactId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "BANK" | "OTHER">("CASH");
  const [selectedBankId, setSelectedBankId] = useState(bankAccounts[0]?.id || "");
  const [isDirector, setIsDirector] = useState(false);

  const handleContactSelect = (contactId: string) => {
    setSelectedContactId(contactId);
    if (!contactId) return;
    const c = contacts.find((item) => item.id === contactId);
    if (c) {
      setSource(c.companyName || c.name);
    }
  };

  return (
    <form action={action} className="clean-income-form">
      <FormPendingFeedback processingMessage="Recording the income and updating balances..." successMessage="Income recorded successfully" />
      <input type="hidden" name="orgId" value={orgId} />
      <input type="hidden" name="paymentMethod" value={paymentMethod} />

      <div className="form-grid">
        <label className="field full">
          <span className="field-label">Income / Receipt Title</span>
          <input
            name="title"
            required
            placeholder="e.g. Client Project milestone / Sales receipt / Salary remittance"
          />
        </label>

        {/* PAYMENT RECEPTION CHANNEL (Cash in Hand vs Bank Account vs Other) */}
        <div className="field full">
          <span className="field-label">Receipt Mode / Account Destination</span>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
              gap: 8,
              marginTop: 4,
            }}
          >
            <button
              type="button"
              className={`mode-btn ${paymentMethod === "CASH" ? "active" : ""}`}
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
              }}
            >
              <Banknote size={15} />
              <span>Cash in Hand</span>
            </button>

            <button
              type="button"
              className={`mode-btn ${paymentMethod === "BANK" ? "active" : ""}`}
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
              }}
            >
              <Landmark size={15} />
              <span>Bank Account</span>
            </button>

            <button
              type="button"
              className={`mode-btn ${paymentMethod === "OTHER" ? "active" : ""}`}
              onClick={() => setPaymentMethod("OTHER")}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                padding: "8px 12px",
                borderRadius: 6,
                border: "1px solid",
                borderColor: paymentMethod === "OTHER" ? "var(--purple)" : "var(--line)",
                background: paymentMethod === "OTHER" ? "var(--purple-soft)" : "var(--surface)",
                color: paymentMethod === "OTHER" ? "var(--purple)" : "var(--text-secondary)",
                fontWeight: 650,
                cursor: "pointer",
              }}
            >
              <Wallet2 size={15} />
              <span>Other (Wallet / Cheque)</span>
            </button>
          </div>
        </div>

        {/* BANK ACCOUNT SELECTION IF DEPOSITING INTO BANK */}
        {paymentMethod === "BANK" && (
          <div className="field full" style={{ background: "var(--cyan-soft)", padding: 12, borderRadius: 6, border: "1px solid var(--cyan-border)" }}>
            <label className="field" style={{ margin: 0 }}>
              <span className="field-label" style={{ color: "var(--cyan)", fontWeight: 700 }}>
                Select Receiving Bank Account
              </span>
              <select
                name="bankAccountId"
                value={selectedBankId}
                onChange={(e) => setSelectedBankId(e.target.value)}
                required
                style={{ background: "var(--surface)" }}
              >
                {bankAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.bankName} — A/C {a.accountNumber} ({a.accountType || "CURRENT"})
                  </option>
                ))}
                {!bankAccounts.length && (
                  <option value="">No bank account registered yet (Go to Banking &gt; Add Bank Account)</option>
                )}
              </select>
            </label>
            <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 6 }}>
              <strong>Auto-Reflect:</strong> This amount will automatically be recorded as a deposit in this bank account and update its ledger balance.
            </div>
          </div>
        )}

        <label className="field">
          <span className="field-label">Customer / Vendor (From CRM Directory)</span>
          <select
            name="contactId"
            value={selectedContactId}
            onChange={(e) => handleContactSelect(e.target.value)}
          >
            <option value="">-- Choose from CRM (Customer / Vendor) or Custom --</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.companyName || c.name} {c.taxNumber ? `(PAN: ${c.taxNumber})` : ""} · {c.type}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span className="field-label">Payer / Source Name (Custom or Auto-filled)</span>
          <input
            id="income-source-input"
            name="source"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            list="payer-suggestions"
            placeholder="Client, Vendor, Employer, or Custom payer name"
            required
          />
          <datalist id="payer-suggestions">
            {contacts.map((c) => (
              <option key={c.id} value={c.companyName || c.name} />
            ))}
          </datalist>
        </label>

        <label className="field">
          <span className="field-label">Amount ({currency})</span>
          <input
            name="amount"
            type="number"
            min="0"
            step="0.01"
            required
            placeholder="0.00"
          />
        </label>

        <div className="field">
          <NepaliDatePicker name="receivedAt" label="Received Date (BS / AD)" required />
        </div>

        {/* DIRECTOR CURRENT ACCOUNT INFLOW OPTION */}
        <div className="field full" style={{ background: "var(--soft)", padding: "12px 14px", borderRadius: 8, border: "1px solid var(--line)" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontWeight: 600 }}>
            <input
              type="checkbox"
              name="isDirectorAccount"
              checked={isDirector}
              onChange={(e) => {
                const next = e.target.checked;
                setIsDirector(next);
                if (next && !source) {
                  setSource("Director Capital / Inflow");
                }
              }}
              style={{ width: 16, height: 16, accentColor: "var(--brand)" }}
            />
            <span>Director Current Account (Capital Injection / Loan Inflow)</span>
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
                <span className="field-label" style={{ fontSize: 11 }}>Director Inflow Type</span>
                <select name="directorTxType" defaultValue="CAPITAL">
                  <option value="CAPITAL">Director Capital Injection / Inflow</option>
                  <option value="LOAN">Loan from Director to Company</option>
                  <option value="DRAWINGS_REPAYMENT">Repayment of Personal Drawings</option>
                </select>
              </label>
            </div>
          )}
        </div>

        <label className="field full">
          <span className="field-label">Transaction Notes / Reference</span>
          <textarea
            name="notes"
            placeholder="Cheque number, bank transfer ID, agreement reference, or particulars..."
            rows={2}
          />
        </label>
      </div>

      <div className="form-actions">
        <button className="success-btn" type="submit">
          Save Income {paymentMethod === "BANK" ? "(+ Reflect in Bank)" : "(+ Cash Ledger)"}
        </button>
      </div>
    </form>
  );
}
