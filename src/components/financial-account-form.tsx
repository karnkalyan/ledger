"use client";

import { useState } from "react";
import { FormPendingFeedback } from "@/components/form-pending-feedback";
import { CreditCard, Landmark, Wallet, Banknote, Users, Sparkles, Building2, HelpCircle } from "lucide-react";

export function FinancialAccountForm({
  orgId,
  currency = "NPR",
  defaultName = "",
  action,
}: {
  orgId: string;
  currency?: string;
  defaultName?: string;
  action: (formData: FormData) => Promise<any>;
}) {
  const [accountType, setAccountType] = useState<string>("CURRENT");

  const isCreditCard = accountType === "CREDIT_CARD";
  const isCash = accountType === "CASH";
  const isWallet = accountType === "DIGITAL_WALLET";
  const isPersonOrFamily = accountType === "PARTY_ACCOUNT" || accountType === "FAMILY_ACCOUNT";
  const isOverdraft = accountType === "OVERDRAFT";
  const isStandardBank = accountType === "CURRENT" || accountType === "SAVINGS" || accountType === "FIXED" || isOverdraft;

  // Dynamic placeholders and labels
  let providerLabel = "Bank Name / Institution";
  let providerPlaceholder = "Siddhartha Bank Ltd / Nabil Bank / NIC ASIA Bank";
  let accountNameLabel = "Account Title / Holder Name";
  let accountNumberLabel = "Account Number";
  let accountNumberPlaceholder = "02017249683";
  let openingBalanceLabel = "Opening Balance";
  let openingBalanceHelp = "Initial ledger balance recorded for this account";

  if (isCreditCard) {
    providerLabel = "Card Issuer / Bank Name";
    providerPlaceholder = "Siddhartha Bank / Nabil Bank Credit Card";
    accountNameLabel = "Cardholder Name (as printed on card)";
    accountNumberLabel = "Card Number / Last 4 Digits";
    accountNumberPlaceholder = "e.g. 4532 9812 7741 0284 or 0284";
    openingBalanceLabel = "Current Outstanding / Billed Balance";
    openingBalanceHelp = "Amount currently owed / billed on the card (Positive = Amount to pay)";
  } else if (isCash) {
    providerLabel = "Cash Account / Custodian Title";
    providerPlaceholder = "Cash in Hand / Cash Drawer / Petty Cash";
    accountNameLabel = "Custodian / Responsible Person";
    accountNumberLabel = "Cash Account Identifier";
    accountNumberPlaceholder = "CASH-MAIN / CASH-DRAWER";
    openingBalanceLabel = "Cash in Hand Opening Balance";
    openingBalanceHelp = "Physical physical cash currently counted in hand or drawer";
  } else if (isWallet) {
    providerLabel = "Digital Wallet Provider";
    providerPlaceholder = "eSewa / Khalti / IME Pay / Prabhu Pay";
    accountNameLabel = "Wallet Account Holder Name";
    accountNumberLabel = "Registered Mobile Number / Wallet ID";
    accountNumberPlaceholder = "98XXXXXXXX";
    openingBalanceLabel = "Current Wallet Balance";
    openingBalanceHelp = "Actual balance currently inside the digital wallet app";
  } else if (isPersonOrFamily) {
    providerLabel = "Person / Party Name";
    providerPlaceholder = "Kashvi / Kalyan / Sujan / Client / Associate Name";
    accountNameLabel = "Relationship / Role / Account Subtitle";
    accountNumberLabel = "Mobile / Reference Identification (Optional)";
    accountNumberPlaceholder = "98XXXXXXXX or REF-PERSON";
    openingBalanceLabel = "Opening Balance";
    openingBalanceHelp = "Positive = Money Given / Receivable (they owe you); Negative = Money Taken / Payable (you owe them)";
  }

  return (
    <form action={action}>
      <FormPendingFeedback
        processingMessage="Registering financial account..."
        successMessage="Financial account configured successfully"
      />
      <input type="hidden" name="orgId" value={orgId} />

      {/* Account Type Selector Header */}
      <div style={{ marginBottom: 18, background: "var(--soft)", padding: 14, borderRadius: 8, border: "1px solid var(--line)" }}>
        <label className="field" style={{ margin: 0 }}>
          <span className="field-label" style={{ fontWeight: 700, fontSize: 13, color: "var(--brand)", display: "flex", alignItems: "center", gap: 6 }}>
            {isCreditCard && <CreditCard size={15} />}
            {isCash && <Banknote size={15} />}
            {isWallet && <Wallet size={15} />}
            {isPersonOrFamily && <Users size={15} />}
            {isStandardBank && <Landmark size={15} />}
            <span>Select Financial Account Type</span>
          </span>
          <select
            name="accountType"
            value={accountType}
            onChange={(e) => setAccountType(e.target.value)}
            style={{ fontSize: 13.5, fontWeight: 650, marginTop: 4 }}
          >
            <optgroup label="Banking Facilities">
              <option value="CURRENT">Current Account (CANR / Cheque Operating)</option>
              <option value="SAVINGS">Savings Account (SVPS / Personal / Business)</option>
              <option value="OVERDRAFT">Overdraft Facility (OD / Credit Line)</option>
              <option value="FIXED">Fixed Deposit Account</option>
            </optgroup>
            <optgroup label="Cards &amp; Wallets">
              <option value="CREDIT_CARD">Credit Card (Statement &amp; Due Date Cycles)</option>
              <option value="DIGITAL_WALLET">Digital Wallet (eSewa / Khalti / IME Pay)</option>
            </optgroup>
            <optgroup label="Cash &amp; Person Accounts">
              <option value="CASH">Cash in Hand / Cash Drawer</option>
              <option value="PARTY_ACCOUNT">Person / Party Account (Money Taken / Given)</option>
              <option value="FAMILY_ACCOUNT">Family Member Account (Kashvi, Kalyan, Sujan, etc.)</option>
            </optgroup>
            <optgroup label="Other">
              <option value="CUSTOM">Other / Custom Financial Account</option>
            </optgroup>
          </select>
        </label>
      </div>

      <div className="form-grid">
        {/* Account Provider / Person / Name */}
        <label className="field full">
          <span className="field-label">{providerLabel}</span>
          <input
            name="bankName"
            required
            placeholder={providerPlaceholder}
            defaultValue={isCash ? "Cash in Hand" : isWallet ? "eSewa Wallet" : ""}
          />
        </label>

        {/* Account Holder / Title */}
        <label className="field">
          <span className="field-label">{accountNameLabel}</span>
          <input
            name="accountName"
            placeholder="Account Name"
            defaultValue={defaultName || ""}
          />
        </label>

        {/* Account Number / Card / Phone */}
        <label className="field">
          <span className="field-label">{accountNumberLabel}</span>
          <input
            name="accountNumber"
            required
            placeholder={accountNumberPlaceholder}
            defaultValue={isCash ? "CASH-MAIN" : ""}
          />
        </label>

        {/* Branch Name - Only for Standard Bank Accounts */}
        {isStandardBank && (
          <label className="field">
            <span className="field-label">Branch Name</span>
            <input name="branch" placeholder="Kathmandu Branch / Hattisar / New Road" />
          </label>
        )}

        {/* Currency */}
        <label className="field">
          <span className="field-label">Currency</span>
          <input name="currency" defaultValue={currency} />
        </label>

        {/* Opening Balance */}
        <label className="field">
          <span className="field-label">{openingBalanceLabel}</span>
          <input name="openingBalance" type="number" step="0.01" defaultValue="0" />
          <small style={{ color: "var(--text-muted)", fontSize: 11, marginTop: 3, display: "block" }}>
            {openingBalanceHelp}
          </small>
        </label>

        {/* Bank Hold / Lien Amount - Only for Bank Accounts */}
        {isStandardBank && (
          <label className="field">
            <span className="field-label">Hold / Lien Amount (Account Minimum / Lien)</span>
            <input name="holdAmount" type="number" step="0.01" defaultValue="0" placeholder="2500" />
            <small style={{ color: "var(--text-muted)", fontSize: 11, marginTop: 3, display: "block" }}>
              Restricted or opening charge amount excluded from available liquidity (e.g. 2,500)
            </small>
          </label>
        )}

        {/* Overdraft Facility Limit - Only for OVERDRAFT */}
        {isOverdraft && (
          <label className="field">
            <span className="field-label">Overdraft (OD) Sanctioned Limit ({currency})</span>
            <input name="creditLimit" type="number" min="0" step="0.01" defaultValue="0" placeholder="500000" />
          </label>
        )}

        {/* CREDIT CARD DEDICATED FIELDS - ONLY FOR CREDIT CARD */}
        {isCreditCard && (
          <>
            <label className="field">
              <span className="field-label" style={{ fontWeight: 700, color: "var(--brand)" }}>
                Credit Card Limit ({currency})
              </span>
              <input name="creditLimit" type="number" min="0" step="0.01" placeholder="100000" required />
            </label>

            <label className="field">
              <span className="field-label" style={{ fontWeight: 700, color: "var(--brand)" }}>
                Monthly Statement Day (Closing Date)
              </span>
              <input name="statementDay" type="number" min="1" max="31" placeholder="26" defaultValue="26" required />
              <small style={{ color: "var(--text-muted)", fontSize: 11, marginTop: 3, display: "block" }}>
                Day of each month the bank closes and generates your credit card statement (e.g. 26th)
              </small>
            </label>

            <label className="field">
              <span className="field-label" style={{ fontWeight: 700, color: "var(--brand)" }}>
                Monthly Payment Due Day
              </span>
              <input name="paymentDueDay" type="number" min="1" max="31" placeholder="10" defaultValue="10" required />
              <small style={{ color: "var(--text-muted)", fontSize: 11, marginTop: 3, display: "block" }}>
                Day of each month the payment must be settled to avoid finance charges (e.g. 10th)
              </small>
            </label>
          </>
        )}

        {/* Notes / Remarks */}
        <label className="field full">
          <span className="field-label">Notes / Remarks</span>
          <textarea
            name="notes"
            placeholder={
              isCreditCard
                ? "Auto-debit setup, reward points, bank helpline..."
                : isPersonOrFamily
                ? "Purpose of account, settlement agreements, notes..."
                : "Account opening purpose, signatories, instructions..."
            }
          />
        </label>
      </div>

      <div className="form-actions" style={{ marginTop: 16 }}>
        <button className="primary-btn" type="submit">
          {isCreditCard
            ? "Save Credit Card Account"
            : isCash
            ? "Save Cash Account"
            : isWallet
            ? "Save Digital Wallet"
            : isPersonOrFamily
            ? "Save Person / Party Account"
            : "Save Financial Account"}
        </button>
      </div>
    </form>
  );
}
