"use client";

import { useState } from "react";
import { Wallet, ArrowRightLeft, Plus, X, ShieldAlert, CreditCard, CheckCircle2, DollarSign } from "lucide-react";
import { saveWalletTransactionAction } from "@/app/(dashboard)/actions";
import { toast } from "@/components/toast-provider";
import { money } from "@/lib/format";

interface ProjectOption {
  id: string;
  name: string;
  budget: number | string;
  teamLeaderName?: string | null;
  teamLeaderId?: string | null;
  wallet?: {
    id: string;
    totalBudget: number | string;
    transferredAmount: number | string;
    holdAmount: number | string;
    leaderHoldAmount: number | string;
    balance: number | string;
  } | null;
}

interface EmployeeOption {
  id: string;
  name: string;
}

export function WalletModal({
  orgId,
  projects = [],
  employees = [],
  defaultProjectId,
  trigger,
}: {
  orgId: string;
  projects: ProjectOption[];
  employees: EmployeeOption[];
  defaultProjectId?: string;
  trigger?: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    defaultProjectId || (projects[0]?.id || "")
  );
  const [actionType, setActionType] = useState<"REQUEST" | "TRANSFER">("REQUEST");
  const [amount, setAmount] = useState<string>("");
  const [paymentMode, setPaymentMode] = useState<string>("Fonepay");
  const [requestedById, setRequestedById] = useState<string>("");
  const [transferToId, setTransferToId] = useState<string>("");
  const [description, setDescription] = useState<string>("");

  const selectedProject = projects.find((p) => p.id === selectedProjectId);
  const wallet = selectedProject?.wallet;

  const totalBudget = wallet ? Number(wallet.totalBudget) : Number(selectedProject?.budget || 0);
  const transferred = wallet ? Number(wallet.transferredAmount) : 0;
  const hold = wallet ? Number(wallet.holdAmount) : 0;
  const balance = Math.max(0, totalBudget - transferred);

  const numAmount = Number(amount) || 0;
  const isOverBudget = actionType === "TRANSFER" ? (transferred + numAmount > totalBudget) : false;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!wallet?.id) {
      toast.error("Project wallet not found. Please reselect project.");
      return;
    }
    if (numAmount <= 0) {
      toast.error("Please enter a valid amount greater than 0");
      return;
    }
    if (isOverBudget) {
      toast.error("Transfer amount exceeds remaining project wallet balance!");
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.set("orgId", orgId);
      formData.set("walletId", wallet.id);
      formData.set("type", actionType);
      formData.set("amount", String(numAmount));
      formData.set("paymentMode", paymentMode);
      formData.set("requestedById", requestedById || (employees[0]?.id || ""));
      formData.set("transferToId", transferToId || (employees[0]?.id || ""));
      formData.set("description", description);

      await saveWalletTransactionAction(formData);
      toast.success(
        actionType === "TRANSFER"
          ? "Fund transferred successfully and balance deducted"
          : "Fund request submitted for team leader & admin approval"
      );
      setIsOpen(false);
      setAmount("");
      setDescription("");
    } catch {
      toast.error("Failed to process wallet transaction");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {trigger ? (
        <span onClick={() => setIsOpen(true)} style={{ cursor: "pointer", display: "inline-block" }}>
          {trigger}
        </span>
      ) : (
        <button
          type="button"
          className="primary-btn"
          onClick={() => setIsOpen(true)}
          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <ArrowRightLeft size={14} /> Request / Transfer Fund
        </button>
      )}

      {isOpen && (
        <div
          className="drawer-backdrop"
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.55)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 16,
          }}
        >
          <div
            className="drawer-panel"
            style={{
              width: "min(680px, 96vw)",
              maxHeight: "90vh",
              overflowY: "auto",
              background: "var(--surface)",
              borderRadius: "var(--radius-lg, 12px)",
              border: "1px solid var(--border)",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
              padding: 24,
            }}
          >
            {/* Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                paddingBottom: 16,
                borderBottom: "1px solid var(--border)",
                marginBottom: 16,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    background: "rgba(6, 182, 212, 0.12)",
                    color: "#06b6d4",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Wallet size={20} />
                </div>
                <div>
                  <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: "var(--text)" }}>
                    Project Wallet Operations
                  </h2>
                  <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "2px 0 0" }}>
                    Manage budget disbursements, member expense requests, and Fonepay/Khalti transfers.
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="modal-close-icon-btn"
                onClick={() => setIsOpen(false)}
                aria-label="Close"
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text-muted)",
                  padding: 6,
                  borderRadius: 6,
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Project Selection & Financial Gauge */}
            <div style={{ marginBottom: 16 }}>
              <label className="field" style={{ marginBottom: 12 }}>
                <span className="field-label" style={{ fontWeight: 600 }}>Select Project</span>
                <select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  style={{ width: "100%" }}
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.teamLeaderName ? `(Leader: ${p.teamLeaderName})` : ""}
                    </option>
                  ))}
                </select>
              </label>

              {/* Wallet Metrics Preview Card (From sajilo_task projectValue badge) */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                  gap: 10,
                  padding: "12px 16px",
                  borderRadius: 8,
                  background: "var(--soft)",
                  border: "1px solid var(--border)",
                }}
              >
                <div>
                  <span style={{ fontSize: 11, color: "var(--text-muted)", display: "block" }}>Project Budget</span>
                  <strong style={{ fontSize: 13.5, color: "var(--text)" }}>{money(totalBudget)}</strong>
                </div>
                <div>
                  <span style={{ fontSize: 11, color: "#10b981", display: "block" }}>Transferred</span>
                  <strong style={{ fontSize: 13.5, color: "#10b981" }}>{money(transferred)}</strong>
                </div>
                <div>
                  <span style={{ fontSize: 11, color: "#f59e0b", display: "block" }}>Hold Amount</span>
                  <strong style={{ fontSize: 13.5, color: "#f59e0b" }}>{money(hold)}</strong>
                </div>
                <div>
                  <span style={{ fontSize: 11, color: "#06b6d4", display: "block" }}>Remaining Balance</span>
                  <strong style={{ fontSize: 13.5, color: "#06b6d4" }}>{money(balance)}</strong>
                </div>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Type Switcher: Request vs Transfer */}
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setActionType("REQUEST")}
                  style={{
                    flex: 1,
                    padding: "8px 14px",
                    borderRadius: 6,
                    border: actionType === "REQUEST" ? "1px solid #06b6d4" : "1px solid var(--border)",
                    background: actionType === "REQUEST" ? "rgba(6, 182, 212, 0.12)" : "var(--surface)",
                    color: actionType === "REQUEST" ? "#06b6d4" : "var(--text)",
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                  }}
                >
                  <Wallet size={14} /> Request Project Fund
                </button>
                <button
                  type="button"
                  onClick={() => setActionType("TRANSFER")}
                  style={{
                    flex: 1,
                    padding: "8px 14px",
                    borderRadius: 6,
                    border: actionType === "TRANSFER" ? "1px solid #8b5cf6" : "1px solid var(--border)",
                    background: actionType === "TRANSFER" ? "rgba(139, 92, 246, 0.12)" : "var(--surface)",
                    color: actionType === "TRANSFER" ? "#8b5cf6" : "var(--text)",
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                  }}
                >
                  <ArrowRightLeft size={14} /> Direct Transfer Fund
                </button>
              </div>

              {/* Row: Payment Mode & Amount */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <label className="field">
                  <span className="field-label">Payment Mode</span>
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value)}
                  >
                    <option value="Fonepay">Fonepay (QR / Merchant)</option>
                    <option value="Khalti">Khalti Digital Wallet</option>
                    <option value="Bank Transfer">Bank Transfer (NPR)</option>
                    <option value="Cash">Cash Advance</option>
                  </select>
                </label>

                <label className="field">
                  <span className="field-label">Amount (NPR) *</span>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                    placeholder="Enter amount in NPR"
                  />
                </label>
              </div>

              {isOverBudget && (
                <div
                  style={{
                    padding: "8px 12px",
                    borderRadius: 6,
                    background: "rgba(239, 68, 68, 0.12)",
                    border: "1px solid rgba(239, 68, 68, 0.3)",
                    color: "#ef4444",
                    fontSize: 12,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <ShieldAlert size={14} />
                  <span>
                    Warning: Sending NPR {money(numAmount)} exceeds the available wallet balance of NPR {money(balance)}.
                  </span>
                </div>
              )}

              {/* Staff Target */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <label className="field">
                  <span className="field-label">
                    {actionType === "REQUEST" ? "Requested By (Member)" : "Transfer By (Authority)"}
                  </span>
                  <select
                    value={requestedById}
                    onChange={(e) => setRequestedById(e.target.value)}
                  >
                    <option value="">Select Member...</option>
                    {employees.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span className="field-label">
                    {actionType === "REQUEST" ? "Target Approver / Leader" : "Transfer To (Recipient)"}
                  </span>
                  <select
                    value={transferToId}
                    onChange={(e) => setTransferToId(e.target.value)}
                  >
                    <option value="">Select Recipient...</option>
                    {employees.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {/* Description */}
              <label className="field">
                <span className="field-label">Purpose / Description</span>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Detail the expense purpose (e.g. Client visit travel allowance, Site inspection logistics)..."
                />
              </label>

              {/* Actions */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => setIsOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary-btn"
                  disabled={isSubmitting || isOverBudget}
                  style={{
                    padding: "8px 22px",
                    background: actionType === "TRANSFER" ? "#8b5cf6" : "#06b6d4",
                  }}
                >
                  {isSubmitting
                    ? "Processing..."
                    : actionType === "TRANSFER"
                    ? "Confirm Transfer"
                    : "Submit Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
