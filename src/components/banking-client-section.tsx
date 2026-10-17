"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Sparkles,
  Upload,
  Plus,
  Landmark,
  CheckCircle2,
  Filter,
} from "lucide-react";
import { BankCardWidget, type BankAccountItem } from "@/components/bank-card-widget";
import { DocumentUploadModal } from "@/components/document-upload-modal";

export function BankingClientSection({
  accounts,
  selectedAccountId,
  orgId,
  currency = "NPR",
  totalCount,
  filterHrefBuilder,
}: {
  accounts: BankAccountItem[];
  selectedAccountId: string;
  orgId: string;
  currency?: string;
  totalCount: number;
  filterHrefBuilder: (params: { accountId?: string | null }) => string;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [targetBankAccountId, setTargetBankAccountId] = useState<string | undefined>(undefined);

  const handleOpenUpload = (accountId?: string) => {
    setTargetBankAccountId(accountId || selectedAccountId || accounts[0]?.id);
    setModalOpen(true);
  };

  return (
    <>
      {/* Top Banking Action Bar */}
      <div
        className="no-print"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: "var(--brand-soft)",
              color: "var(--brand)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Landmark size={17} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--text)" }}>
              Registered Bank Accounts ({accounts.length})
            </h3>
            <p style={{ margin: 0, fontSize: 11.5, color: "var(--text-muted)" }}>
              Select an account to filter the general ledger, or attach statements to auto-extract records.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            type="button"
            onClick={() => handleOpenUpload()}
            style={{
              padding: "7px 15px",
              borderRadius: 8,
              border: "none",
              background: "linear-gradient(135deg, #4a086b 0%, #ef086f 100%)",
              color: "#ffffff",
              fontWeight: 700,
              fontSize: 12.5,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              boxShadow: "0 3px 10px rgba(74, 8, 107, 0.22)",
            }}
          >
            <Sparkles size={14} />
            <span>Attach Statement / Any Bill (AI Extract)</span>
          </button>
        </div>
      </div>

      {/* Bank Account Interactive Cards Grid */}
      <div
        className="no-print"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
          gap: 16,
          marginBottom: 20,
        }}
      >
        {accounts.map((acc) => {
          const isSelected = selectedAccountId === acc.id;
          const href = filterHrefBuilder({ accountId: isSelected ? null : acc.id });

          return (
            <BankCardWidget
              key={acc.id}
              account={acc}
              isSelected={isSelected}
              filterHref={href}
              currency={currency}
              onAttachStatement={handleOpenUpload}
            />
          );
        })}

        {!accounts.length && (
          <div
            style={{
              gridColumn: "1 / -1",
              padding: 24,
              textAlign: "center",
              borderRadius: 12,
              border: "1px dashed var(--line-strong)",
              background: "var(--soft)",
              color: "var(--text-muted)",
              fontSize: 13,
            }}
          >
            No bank accounts registered yet. Click &quot;+ Add Bank Account&quot; to configure your account.
          </div>
        )}
      </div>

      {/* Document Upload & Extraction Modal */}
      <DocumentUploadModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        orgId={orgId}
        initialBankAccountId={targetBankAccountId}
        bankAccounts={accounts.map((a) => ({
          id: a.id,
          bankName: a.bankName,
          accountNumber: a.accountNumber,
        }))}
        currency={currency}
        onSuccess={() => {
          // Page refreshes automatically
        }}
      />
    </>
  );
}
