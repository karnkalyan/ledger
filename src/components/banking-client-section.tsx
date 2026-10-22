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
  X,
  CreditCard,
} from "lucide-react";
import { BankCardWidget, type BankAccountItem } from "@/components/bank-card-widget";
import { DocumentUploadModal } from "@/components/document-upload-modal";
import { FinancialAccountForm } from "@/components/financial-account-form";
import { updateBankAccountAction } from "@/app/(dashboard)/actions";

export function BankingClientSection({
  accounts,
  selectedAccountId,
  orgId,
  currency = "NPR",
  totalCount,
}: {
  accounts: BankAccountItem[];
  selectedAccountId: string;
  orgId: string;
  currency?: string;
  totalCount: number;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [targetBankAccountId, setTargetBankAccountId] = useState<string | undefined>(undefined);
  const [editingAccount, setEditingAccount] = useState<BankAccountItem | null>(null);

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
              Financial Accounts, Cash &amp; Wallets ({accounts.length})
            </h3>
            <p style={{ margin: 0, fontSize: 11.5, color: "var(--text-muted)" }}>
              Select an account to filter the general ledger, click &quot;Edit&quot; on any card to update details, or attach statements to auto-extract records.
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
          const href = acc.filterHref || `/${orgId}/banking${isSelected ? "" : `?accountId=${acc.id}`}`;

          return (
            <BankCardWidget
              key={acc.id}
              account={acc}
              isSelected={isSelected}
              filterHref={href}
              currency={currency}
              onAttachStatement={handleOpenUpload}
              onEdit={setEditingAccount}
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
            No accounts registered yet. Click &quot;+ Add Account&quot; to configure your account.
          </div>
        )}
      </div>

      {/* Edit Account Modal */}
      {editingAccount && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.55)",
            backdropFilter: "blur(4px)",
            zIndex: 1200,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setEditingAccount(null)}
        >
          <div
            style={{
              background: "var(--surface)",
              borderRadius: 14,
              border: "1px solid var(--line)",
              padding: "24px 28px",
              maxWidth: 680,
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 20px 45px rgba(0, 0, 0, 0.25)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18, borderBottom: "1px solid var(--line)", paddingBottom: 14 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "var(--text)", display: "flex", alignItems: "center", gap: 7 }}>
                  <Landmark size={18} style={{ color: "var(--brand)" }} />
                  <span>Modify Account / Wallet: {editingAccount.bankName}</span>
                </h3>
                <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text-muted)" }}>
                  Update bank information, wallet credentials, branch, lien hold, or reconcile current available balance.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingAccount(null)}
                style={{
                  background: "var(--soft)",
                  border: "1px solid var(--line)",
                  borderRadius: 6,
                  padding: "5px 9px",
                  cursor: "pointer",
                  color: "var(--text-muted)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <X size={15} />
              </button>
            </div>

            <FinancialAccountForm
              orgId={orgId}
              currency={currency}
              initialData={{
                id: editingAccount.id,
                bankName: editingAccount.bankName,
                accountName: editingAccount.accountName,
                accountNumber: editingAccount.accountNumber,
                accountType: editingAccount.accountType,
                branch: editingAccount.branch,
                currency: editingAccount.currency,
                currentBalance: Number(editingAccount.currentBalance || 0),
                openingBalance: Number(editingAccount.currentBalance || 0),
                holdAmount: Number(editingAccount.holdAmount || 0),
                creditLimit: editingAccount.creditLimit ? Number(editingAccount.creditLimit) : null,
                statementDay: editingAccount.statementDay,
                paymentDueDay: editingAccount.paymentDueDay,
              }}
              action={async (formData) => {
                await updateBankAccountAction(formData);
                setEditingAccount(null);
              }}
              onCancel={() => setEditingAccount(null)}
            />
          </div>
        </div>
      )}

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
