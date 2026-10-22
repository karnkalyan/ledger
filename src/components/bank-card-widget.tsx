"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Building2,
  Landmark,
  CheckCircle2,
  Copy,
  Check,
  Paperclip,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  MapPin,
  Sparkles,
  Pencil,
  Banknote,
  Wallet,
} from "lucide-react";
import toast from "react-hot-toast";

export interface BankAccountItem {
  id: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  accountType?: string | null;
  branch?: string | null;
  currency?: string | null;
  currentBalance: string | number;
  holdAmount?: string | number | null;
  creditLimit?: string | number | null;
  statementDay?: number | null;
  paymentDueDay?: number | null;
  _count?: {
    transactions: number;
  };
  filterHref?: string;
}

export function formatAccountType(type?: string | null): string {
  if (!type) return "Current Account";
  const upper = type.toUpperCase().trim();
  if (upper === "CASH" || upper.includes("CASH")) return "Cash in Hand";
  if (upper === "CANR" || upper.includes("CURRENT") || upper === "CANR (CURRENT ACCOUNT)") return "Current Account";
  if (upper === "SB" || upper.includes("SAVING")) return "Savings Account";
  if (upper.includes("FIXED")) return "Fixed Deposit";
  if (upper.includes("OVERDRAFT") || upper === "OD") return "Overdraft";
  if (upper.includes("WALLET") || upper === "DIGITAL_WALLET" || upper.includes("ESEWA") || upper.includes("KHALTI")) return "Digital Wallet";
  if (upper.includes("FAMILY")) return "Family Member";
  if (upper.includes("PARTY")) return "Party / Personal";
  return type.replace(/_/g, " ");
}

export function BankCardWidget({
  account,
  isSelected,
  filterHref,
  currency = "NPR",
  moneyFormatter,
  onAttachStatement,
  onEdit,
}: {
  account: BankAccountItem;
  isSelected: boolean;
  filterHref: string;
  currency?: string;
  moneyFormatter?: (val: any, cur?: string) => string;
  onAttachStatement?: (accountId: string) => void;
  onEdit?: (account: BankAccountItem) => void;
}) {
  const [copied, setCopied] = useState(false);

  const balanceNum = Number(account.currentBalance || 0);
  const holdNum = Number(account.holdAmount || 0);
  const availableNum = balanceNum - holdNum;
  const isCreditCard = (account.accountType || "").toUpperCase() === "CREDIT_CARD";

  const formattedBalance = moneyFormatter
    ? moneyFormatter(account.currentBalance, account.currency || currency)
    : `${account.currency || currency} ${balanceNum.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

  const formattedAvailable = moneyFormatter
    ? moneyFormatter(availableNum, account.currency || currency)
    : `${account.currency || currency} ${availableNum.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

  const accountTypeFormatted = formatAccountType(account.accountType);
  const txCount = account._count?.transactions ?? 0;

  const handleCopy = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(account.accountNumber);
    setCopied(true);
    toast.success(`Account number ${account.accountNumber} copied!`);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      style={{
        position: "relative",
        background: isSelected
          ? "linear-gradient(135deg, rgba(74, 8, 107, 0.03) 0%, rgba(239, 8, 111, 0.03) 100%), var(--surface)"
          : "var(--surface)",
        border: isSelected ? "1.5px solid var(--brand)" : "1px solid var(--line)",
        borderRadius: 14,
        padding: "16px 18px",
        boxShadow: isSelected
          ? "0 8px 24px -4px rgba(74, 8, 107, 0.16), 0 2px 6px rgba(0, 0, 0, 0.04)"
          : "0 1px 3px rgba(0, 0, 0, 0.04)",
        transition: "all 0.2s ease",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      {/* Top Row: Type Pill + Active Status & Ending Balance */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 12 }}>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            {(() => {
              const upper = (account.accountType || "").toUpperCase();
              const isCash = upper === "CASH" || upper.includes("CASH");
              const isWallet = upper === "DIGITAL_WALLET" || upper.includes("WALLET") || upper.includes("ESEWA");
              const bg = isCash ? "var(--success-soft)" : isWallet ? "var(--purple-soft)" : "var(--brand-soft)";
              const col = isCash ? "var(--success)" : isWallet ? "var(--purple)" : "var(--brand)";
              return (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 750,
                    letterSpacing: 0.5,
                    textTransform: "uppercase",
                    padding: "3px 9px",
                    borderRadius: 20,
                    background: bg,
                    color: col,
                    whiteSpace: "nowrap",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                  }}
                >
                  {isCash ? <Banknote size={11} /> : isWallet ? <Wallet size={11} /> : <Building2 size={11} />}
                  {accountTypeFormatted}
                </span>
              );
            })()}

            {isSelected && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 750,
                  padding: "3px 9px",
                  borderRadius: 20,
                  background: "var(--success-soft)",
                  color: "var(--success)",
                  whiteSpace: "nowrap",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  border: "1px solid var(--success-border)",
                }}
              >
                <CheckCircle2 size={11} /> Active Filter
              </span>
            )}
          </div>

          <div style={{ textAlign: "right", whiteSpace: "nowrap", flexShrink: 0 }}>
            <div style={{ fontSize: 9.5, color: "var(--brand)", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 800 }}>
              Available Balance
            </div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 800,
                color: availableNum >= 0 ? "var(--text)" : "var(--danger)",
                letterSpacing: -0.4,
                lineHeight: 1.2,
                marginTop: 2,
              }}
            >
              {formattedAvailable}
            </div>
            <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 650, marginTop: 2 }}>
              Total: {formattedBalance} {holdNum > 0 && `· Hold: ${account.currency || currency} ${holdNum.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
            </div>
          </div>
        </div>

        {/* Bank Name & Account Number */}
        <div style={{ marginBottom: 12 }}>
          <h3
            style={{
              margin: "0 0 5px",
              fontSize: 15.5,
              fontWeight: 700,
              color: "var(--text)",
              letterSpacing: -0.2,
            }}
          >
            {account.bankName}
          </h3>

          <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span
              style={{
                fontSize: 11.5,
                color: "var(--text-secondary)",
                fontFamily: "var(--font-mono, 'Consolas', monospace)",
                background: "var(--soft)",
                padding: "2px 7px",
                borderRadius: 5,
                border: "1px solid var(--line)",
              }}
            >
              A/C: {account.accountNumber}
            </span>
            <button
              type="button"
              onClick={handleCopy}
              title="Copy account number"
              style={{
                background: "none",
                border: "none",
                color: copied ? "var(--success)" : "var(--text-muted)",
                cursor: "pointer",
                padding: 3,
                display: "inline-flex",
                alignItems: "center",
              }}
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
            </button>

            {onEdit && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onEdit(account);
                }}
                title="Edit account information and balance"
                style={{
                  background: "var(--soft)",
                  border: "1px solid var(--line)",
                  borderRadius: 5,
                  padding: "2px 7px",
                  fontSize: 11,
                  fontWeight: 650,
                  color: "var(--brand)",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 3,
                }}
              >
                <Pencil size={10} />
                <span>Edit</span>
              </button>
            )}
          </div>
        </div>

        {/* Hold Amount (Account Opening Charge / Minimum Lien) Display */}
        {holdNum > 0 && (
          <div
            style={{
              margin: "10px 0 12px 0",
              padding: "9px 12px",
              borderRadius: 8,
              background: "rgba(234, 88, 12, 0.08)",
              border: "1px solid rgba(234, 88, 12, 0.28)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span
                style={{
                  fontSize: 9.5,
                  fontWeight: 800,
                  textTransform: "uppercase",
                  padding: "2px 6px",
                  borderRadius: 4,
                  background: "#ea580c",
                  color: "#ffffff",
                  letterSpacing: 0.5,
                }}
              >
                HOLD
              </span>
              <span style={{ fontSize: 11.5, color: "var(--text)", fontWeight: 650 }}>
                Hold / Lien Amount: <strong>{account.currency || currency} {holdNum.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
              </span>
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
              Total Ledger: <strong>{formattedBalance}</strong> · Available: <strong style={{ color: "var(--success)" }}>{formattedAvailable}</strong>
            </div>
          </div>
        )}

        {isCreditCard && (
          <div style={{ margin: "10px 0 12px", padding: "9px 12px", borderRadius: 8, background: "rgba(79, 70, 229, 0.08)", border: "1px solid rgba(79, 70, 229, 0.24)", fontSize: 11.5 }}>
            <strong>Credit card cycle</strong>
            <div style={{ marginTop: 3, color: "var(--text-muted)" }}>
              Statement closes every month on day {account.statementDay || "-"} · Payment due on day {account.paymentDueDay || "-"}
              {Number(account.creditLimit || 0) > 0 ? ` · Credit limit ${account.currency || currency} ${Number(account.creditLimit).toLocaleString()}` : ""}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Row: Branch Info, Quick Actions & Ledger Filter Toggle */}
      <div
        style={{
          borderTop: "1px solid var(--line)",
          paddingTop: 10,
          marginTop: 4,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: 11.5,
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <span style={{ color: "var(--text-muted)", display: "inline-flex", alignItems: "center", gap: 4 }}>
          <MapPin size={11} />
          {account.branch || "Kathmandu Branch"}
        </span>

        <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          {onEdit && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onEdit(account);
              }}
              title="Edit bank or wallet details"
              style={{
                background: "var(--soft)",
                border: "1px solid var(--line)",
                borderRadius: 6,
                padding: "3px 8px",
                fontSize: 11,
                fontWeight: 650,
                color: "var(--text)",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <Pencil size={11} />
              <span>Edit</span>
            </button>
          )}

          {/* Quick Attach Statement button */}
          {onAttachStatement && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onAttachStatement(account.id);
              }}
              title="Attach statement or bill for this bank account"
              style={{
                background: "var(--soft)",
                border: "1px solid var(--line)",
                borderRadius: 6,
                padding: "3px 8px",
                fontSize: 11,
                fontWeight: 650,
                color: "var(--brand)",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <Sparkles size={11} />
              <span>Attach Bill</span>
            </button>
          )}

          <span style={{ color: "var(--text-muted)" }}>•</span>

          <span style={{ color: "var(--text)", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <strong>{txCount}</strong> txs
          </span>

          <span style={{ color: "var(--text-muted)" }}>•</span>

          <Link
            href={filterHref}
            style={{
              textDecoration: "none",
              color: isSelected ? "var(--danger)" : "var(--brand)",
              fontWeight: 700,
              fontSize: 11.5,
              display: "inline-flex",
              alignItems: "center",
              gap: 3,
            }}
          >
            {isSelected ? "Reset Filter" : "Filter Ledger →"}
          </Link>
        </div>
      </div>
    </div>
  );
}
