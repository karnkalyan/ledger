"use client";

import { useState } from "react";
import {
  Wallet, ArrowRightLeft, Plus, CheckCircle2, XCircle, Clock, ShieldCheck,
  CreditCard, ArrowUpRight, ArrowDownLeft, AlertCircle
} from "lucide-react";
import { money, shortDate } from "@/lib/format";
import { WalletModal } from "@/components/wallet-modal";
import { updateWalletTransactionStatusAction } from "@/app/(dashboard)/actions";
import { toast } from "@/components/toast-provider";
import { adToBs, formatBsDate } from "@/lib/nepali-calendar";

interface ProjectWalletData {
  id: string;
  totalBudget: number | string;
  transferredAmount: number | string;
  holdAmount: number | string;
  leaderHoldAmount: number | string;
  balance: number | string;
  project: {
    id: string;
    name: string;
    budget: number | string;
    teamLeader?: { id: string; name: string } | null;
  };
}

interface WalletTransactionItem {
  id: string;
  type: string;
  amount: number | string;
  paymentMode: string;
  leaderApproval: string;
  adminApproval: string;
  status: string;
  description?: string | null;
  transactionDate: Date | string;
  requestedBy?: { id: string; name: string } | null;
  transferTo?: { id: string; name: string } | null;
  wallet: {
    id: string;
    project: {
      id: string;
      name: string;
    };
  };
}

interface EmployeeOption {
  id: string;
  name: string;
}

export function WalletManagementView({
  orgId,
  wallets = [],
  transactions = [],
  employees = [],
}: {
  orgId: string;
  wallets: ProjectWalletData[];
  transactions: WalletTransactionItem[];
  employees: EmployeeOption[];
}) {
  const [activeSubTab, setActiveSubTab] = useState<"all" | "requests" | "transfers">("all");

  const requests = transactions.filter((t) => t.type === "REQUEST");
  const transfers = transactions.filter((t) => t.type === "TRANSFER" || t.status === "TRANSFERRED");

  const totalValue = wallets.reduce((acc, w) => acc + Number(w.totalBudget || 0), 0);
  const totalTransferred = wallets.reduce((acc, w) => acc + Number(w.transferredAmount || 0), 0);
  const totalHold = wallets.reduce((acc, w) => acc + Number(w.holdAmount || 0), 0);
  const totalRemaining = Math.max(0, totalValue - totalTransferred);

  const handleAction = async (id: string, actionType: string) => {
    try {
      const fd = new FormData();
      fd.set("orgId", orgId);
      fd.set("id", id);
      fd.set("actionType", actionType);
      await updateWalletTransactionStatusAction(fd);
      toast.success(
        actionType === "LEADER_APPROVE"
          ? "Leader approval granted"
          : actionType === "ADMIN_APPROVE"
          ? "Admin approval granted"
          : actionType === "COMPLETE_TRANSFER"
          ? "Fund disbursed and wallet balance updated"
          : "Transaction rejected and hold amount released"
      );
    } catch {
      toast.error("Failed to update transaction status");
    }
  };

  const projectOptions = wallets.map((w) => ({
    id: w.project.id,
    name: w.project.name,
    budget: w.project.budget,
    teamLeaderName: w.project.teamLeader?.name,
    teamLeaderId: w.project.teamLeader?.id,
    wallet: {
      id: w.id,
      totalBudget: w.totalBudget,
      transferredAmount: w.transferredAmount,
      holdAmount: w.holdAmount,
      leaderHoldAmount: w.leaderHoldAmount,
      balance: w.balance,
    },
  }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Top Header & Modal Launcher */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: "var(--text)" }}>
            Project Wallets &amp; Disbursal Flow
          </h2>
          <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "3px 0 0" }}>
            Track project fund requests, leader approvals, and Fonepay/Khalti disbursements.
          </p>
        </div>

        <WalletModal
          orgId={orgId}
          projects={projectOptions}
          employees={employees}
        />
      </div>

      {/* KPI Cards (Matching sajilo_task projectValue badge layout) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
          gap: 12,
        }}
      >
        <div className="summary-card" style={{ padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Total Project Value</span>
            <Wallet size={16} style={{ color: "var(--brand)" }} />
          </div>
          <strong style={{ fontSize: 22, color: "var(--text)", display: "block", marginTop: 4 }}>
            {money(totalValue)}
          </strong>
          <small style={{ color: "var(--text-muted)", display: "block", marginTop: 4 }}>
            Across {wallets.length} active project wallets
          </small>
        </div>

        <div className="summary-card" style={{ padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Transferred Amount</span>
            <ArrowUpRight size={16} style={{ color: "#10b981" }} />
          </div>
          <strong style={{ fontSize: 22, color: "#10b981", display: "block", marginTop: 4 }}>
            {money(totalTransferred)}
          </strong>
          <small style={{ color: "var(--text-muted)", display: "block", marginTop: 4 }}>
            Settled via Fonepay / Khalti / Cash
          </small>
        </div>

        <div className="summary-card" style={{ padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Project Hold Amount</span>
            <Clock size={16} style={{ color: "#f59e0b" }} />
          </div>
          <strong style={{ fontSize: 22, color: "#f59e0b", display: "block", marginTop: 4 }}>
            {money(totalHold)}
          </strong>
          <small style={{ color: "var(--text-muted)", display: "block", marginTop: 4 }}>
            Awaiting leader or admin clearance
          </small>
        </div>

        <div className="summary-card" style={{ padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Remaining Balance</span>
            <ShieldCheck size={16} style={{ color: "#06b6d4" }} />
          </div>
          <strong style={{ fontSize: 22, color: "#06b6d4", display: "block", marginTop: 4 }}>
            {money(totalRemaining)}
          </strong>
          <small style={{ color: "var(--text-muted)", display: "block", marginTop: 4 }}>
            Remaining wallet fund pool
          </small>
        </div>
      </div>

      {/* View Switcher: All, Requests, Transfers */}
      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          onClick={() => setActiveSubTab("all")}
          style={{
            padding: "6px 14px",
            borderRadius: 6,
            border: "none",
            background: activeSubTab === "all" ? "rgba(6, 182, 212, 0.15)" : "var(--surface)",
            color: activeSubTab === "all" ? "#06b6d4" : "var(--text-muted)",
            fontWeight: activeSubTab === "all" ? 700 : 500,
            fontSize: 12.5,
            cursor: "pointer",
          }}
        >
          All Activity
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab("requests")}
          style={{
            padding: "6px 14px",
            borderRadius: 6,
            border: "none",
            background: activeSubTab === "requests" ? "rgba(245, 158, 11, 0.15)" : "var(--surface)",
            color: activeSubTab === "requests" ? "#f59e0b" : "var(--text-muted)",
            fontWeight: activeSubTab === "requests" ? 700 : 500,
            fontSize: 12.5,
            cursor: "pointer",
          }}
        >
          Fund Requests ({requests.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab("transfers")}
          style={{
            padding: "6px 14px",
            borderRadius: 6,
            border: "none",
            background: activeSubTab === "transfers" ? "rgba(16, 185, 129, 0.15)" : "var(--surface)",
            color: activeSubTab === "transfers" ? "#10b981" : "var(--text-muted)",
            fontWeight: activeSubTab === "transfers" ? 700 : 500,
            fontSize: 12.5,
            cursor: "pointer",
          }}
        >
          Transferred History ({transfers.length})
        </button>
      </div>

      {/* Section 1: Fund Requests Table (From sajilo_task requestTable) */}
      {(activeSubTab === "all" || activeSubTab === "requests") && (
        <div className="table-card">
          <div
            style={{
              padding: "12px 16px",
              borderBottom: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  fontSize: 11,
                  padding: "2px 8px",
                  borderRadius: 4,
                  fontWeight: 700,
                  background: "rgba(245, 158, 11, 0.15)",
                  color: "#f59e0b",
                  textTransform: "uppercase",
                }}
              >
                Requests
              </span>
              <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: "var(--text)" }}>
                Requested Project Funds &amp; Approvals
              </h3>
            </div>
          </div>

          <div className="table-scroll">
            <table className="responsive-table">
              <thead>
                <tr>
                  <th>Requested By</th>
                  <th>Project</th>
                  <th>Requested Amount</th>
                  <th>Payment Option</th>
                  <th>Description</th>
                  <th>Leader Approval</th>
                  <th>Admin Approval</th>
                  <th>Status</th>
                  <th>Requested Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => {
                  let dateBs = "";
                  try {
                    dateBs = formatBsDate(r.transactionDate);
                  } catch {}

                  const canDisburse =
                    r.status === "PENDING" &&
                    (r.leaderApproval === "APPROVED" || r.adminApproval === "APPROVED");

                  return (
                    <tr key={r.id}>
                      <td data-label="User">
                        <span style={{ fontWeight: 600 }}>{r.requestedBy?.name || "Member"}</span>
                      </td>

                      <td data-label="Project">
                        <strong style={{ color: "var(--text)" }}>{r.wallet?.project?.name}</strong>
                      </td>

                      <td data-label="Amount">
                        <span style={{ fontWeight: 700, color: "#f59e0b" }}>{money(r.amount)}</span>
                      </td>

                      <td data-label="Payment Mode">
                        <span
                          style={{
                            fontSize: 11,
                            padding: "2px 6px",
                            borderRadius: 4,
                            fontWeight: 600,
                            background:
                              r.paymentMode === "Fonepay"
                                ? "rgba(239, 68, 68, 0.12)"
                                : r.paymentMode === "Khalti"
                                ? "rgba(139, 92, 246, 0.12)"
                                : "rgba(100, 116, 139, 0.12)",
                            color:
                              r.paymentMode === "Fonepay"
                                ? "#ef4444"
                                : r.paymentMode === "Khalti"
                                ? "#8b5cf6"
                                : "#64748b",
                          }}
                        >
                          {r.paymentMode}
                        </span>
                      </td>

                      <td data-label="Description">
                        <small style={{ color: "var(--text-muted)" }}>
                          {r.description || "Project operational expense"}
                        </small>
                      </td>

                      <td data-label="Leader Approval">
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 650,
                            color:
                              r.leaderApproval === "APPROVED"
                                ? "#10b981"
                                : r.leaderApproval === "REJECTED"
                                ? "#ef4444"
                                : "#f59e0b",
                          }}
                        >
                          {r.leaderApproval}
                        </span>
                      </td>

                      <td data-label="Admin Approval">
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 650,
                            color:
                              r.adminApproval === "APPROVED"
                                ? "#10b981"
                                : r.adminApproval === "REJECTED"
                                ? "#ef4444"
                                : "#f59e0b",
                          }}
                        >
                          {r.adminApproval}
                        </span>
                      </td>

                      <td data-label="Status">
                        <span
                          style={{
                            fontSize: 10.5,
                            padding: "2px 6px",
                            borderRadius: 4,
                            fontWeight: 650,
                            background:
                              r.status === "TRANSFERRED"
                                ? "rgba(16, 185, 129, 0.15)"
                                : r.status === "REJECTED"
                                ? "rgba(239, 68, 68, 0.15)"
                                : "rgba(245, 158, 11, 0.15)",
                            color:
                              r.status === "TRANSFERRED"
                                ? "#10b981"
                                : r.status === "REJECTED"
                                ? "#ef4444"
                                : "#f59e0b",
                          }}
                        >
                          {r.status}
                        </span>
                      </td>

                      <td data-label="Date">
                        <div>
                          <span style={{ fontSize: 11.5, display: "block" }}>
                            {shortDate(r.transactionDate)}
                          </span>
                          {dateBs && <small style={{ color: "var(--text-muted)" }}>{dateBs} BS</small>}
                        </div>
                      </td>

                      <td data-label="Actions">
                        {r.status === "PENDING" ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            {r.leaderApproval !== "APPROVED" && (
                              <button
                                type="button"
                                className="secondary-btn"
                                style={{ padding: "2px 6px", fontSize: 10.5 }}
                                onClick={() => handleAction(r.id, "LEADER_APPROVE")}
                                title="Grant Leader Approval"
                              >
                                Leader ✓
                              </button>
                            )}

                            {r.adminApproval !== "APPROVED" && (
                              <button
                                type="button"
                                className="secondary-btn"
                                style={{ padding: "2px 6px", fontSize: 10.5 }}
                                onClick={() => handleAction(r.id, "ADMIN_APPROVE")}
                                title="Grant Admin Approval"
                              >
                                Admin ✓
                              </button>
                            )}

                            {canDisburse && (
                              <button
                                type="button"
                                className="primary-btn"
                                style={{ padding: "2px 8px", fontSize: 10.5, background: "#10b981" }}
                                onClick={() => handleAction(r.id, "COMPLETE_TRANSFER")}
                                title="Complete Disbursement"
                              >
                                Disburse
                              </button>
                            )}

                            <button
                              type="button"
                              className="secondary-btn"
                              style={{ padding: "2px 6px", fontSize: 10.5, color: "#ef4444" }}
                              onClick={() => handleAction(r.id, "REJECT")}
                              title="Reject Request"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Settled</span>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {!requests.length && (
                  <tr>
                    <td colSpan={10} style={{ textAlign: "center", padding: 24, color: "var(--text-muted)" }}>
                      No fund requests submitted yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Section 2: Transferred History Table (From sajilo_task transferTable) */}
      {(activeSubTab === "all" || activeSubTab === "transfers") && (
        <div className="table-card">
          <div
            style={{
              padding: "12px 16px",
              borderBottom: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  fontSize: 11,
                  padding: "2px 8px",
                  borderRadius: 4,
                  fontWeight: 700,
                  background: "rgba(16, 185, 129, 0.15)",
                  color: "#10b981",
                  textTransform: "uppercase",
                }}
              >
                Transfers
              </span>
              <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: "var(--text)" }}>
                Transferred History &amp; Settlements
              </h3>
            </div>
          </div>

          <div className="table-scroll">
            <table className="responsive-table">
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Amount</th>
                  <th>Payment Option</th>
                  <th>Description</th>
                  <th>Transfer By</th>
                  <th>Transfer To</th>
                  <th>Approval Status</th>
                  <th>Transfer Date</th>
                </tr>
              </thead>
              <tbody>
                {transfers.map((t) => {
                  let dateBs = "";
                  try {
                    dateBs = formatBsDate(t.transactionDate);
                  } catch {}

                  return (
                    <tr key={t.id}>
                      <td data-label="Project">
                        <strong style={{ color: "var(--text)" }}>{t.wallet?.project?.name}</strong>
                      </td>

                      <td data-label="Amount">
                        <strong style={{ color: "#10b981" }}>{money(t.amount)}</strong>
                      </td>

                      <td data-label="Mode">
                        <span
                          style={{
                            fontSize: 11,
                            padding: "2px 6px",
                            borderRadius: 4,
                            fontWeight: 600,
                            background:
                              t.paymentMode === "Fonepay"
                                ? "rgba(239, 68, 68, 0.12)"
                                : t.paymentMode === "Khalti"
                                ? "rgba(139, 92, 246, 0.12)"
                                : "rgba(100, 116, 139, 0.12)",
                            color:
                              t.paymentMode === "Fonepay"
                                ? "#ef4444"
                                : t.paymentMode === "Khalti"
                                ? "#8b5cf6"
                                : "#64748b",
                          }}
                        >
                          {t.paymentMode}
                        </span>
                      </td>

                      <td data-label="Description">
                        <small style={{ color: "var(--text-muted)" }}>
                          {t.description || "Project fund disbursement"}
                        </small>
                      </td>

                      <td data-label="Transfer By">
                        <span>{t.requestedBy?.name || "Management"}</span>
                      </td>

                      <td data-label="Transfer To">
                        <span style={{ fontWeight: 600 }}>{t.transferTo?.name || "Team Member"}</span>
                      </td>

                      <td data-label="Approval">
                        <span style={{ fontSize: 11, fontWeight: 650, color: "#10b981" }}>
                          ✓ Approved &amp; Settled
                        </span>
                      </td>

                      <td data-label="Date">
                        <div>
                          <span style={{ fontSize: 11.5, display: "block" }}>
                            {shortDate(t.transactionDate)}
                          </span>
                          {dateBs && <small style={{ color: "var(--text-muted)" }}>{dateBs} BS</small>}
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {!transfers.length && (
                  <tr>
                    <td colSpan={8} style={{ textAlign: "center", padding: 24, color: "var(--text-muted)" }}>
                      No transfer history recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
