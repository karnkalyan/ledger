"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import {
  Plug,
  KeyRound,
  ShieldCheck,
  ShieldAlert,
  Server,
  Radio,
  Copy,
  Check,
  Clock,
  Calendar,
  Building2,
  User,
  Cpu,
  Layers,
  AlertTriangle,
  RefreshCw,
  Lock,
  Unlock,
  Ban,
  CheckCircle2,
  ExternalLink,
  Eye,
  Plus,
  Search,
  Laptop,
  CheckCircle,
  XCircle,
  X,
} from "lucide-react";
import type { RemoteLicenseItem, RemoteLicenseStatusResponse } from "@/lib/license-api";
import {
  extendRemoteLicenseAction,
  revokeRemoteLicenseAction,
  restoreRemoteLicenseAction,
  banRemoteLicenseClientAction,
  unbanRemoteLicenseClientAction,
} from "@/app/(dashboard)/actions";

interface OfficeLicenseManagerProps {
  initialLicenses: RemoteLicenseItem[];
  serverStatus: RemoteLicenseStatusResponse | null;
  isAdmin: boolean;
  orgId: string;
}

export function OfficeLicenseManager({
  initialLicenses,
  serverStatus,
  isAdmin,
  orgId,
}: OfficeLicenseManagerProps) {
  const [licenses] = useState<RemoteLicenseItem[]>(initialLicenses);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [vendorFilter, setVendorFilter] = useState("ALL");
  const [selectedLicense, setSelectedLicense] = useState<RemoteLicenseItem | null>(null);
  const [detailTab, setDetailTab] = useState<"overview" | "modules" | "activations">("overview");

  // Action Modals State
  const [extendTarget, setExtendTarget] = useState<RemoteLicenseItem | null>(null);
  const [extendDays, setExtendDays] = useState<number>(365);
  const [extendReason, setExtendReason] = useState("");
  const [revokeTarget, setRevokeTarget] = useState<RemoteLicenseItem | null>(null);
  const [revokeReason, setRevokeReason] = useState("");
  const [restoreTarget, setRestoreTarget] = useState<RemoteLicenseItem | null>(null);
  const [restoreReason, setRestoreReason] = useState("");
  const [banClientTarget, setBanClientTarget] = useState<{ clientId: string; serial: string } | null>(null);
  const [banReason, setBanReason] = useState("");

  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(text);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Vendors list for dropdown
  const vendors = Array.from(new Set(licenses.map((l) => l.vendor?.name).filter(Boolean)));

  // Filtered Licenses
  const filtered = licenses.filter((l) => {
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      !searchTerm ||
      l.serial.toLowerCase().includes(q) ||
      (l.customerOrganization && l.customerOrganization.toLowerCase().includes(q)) ||
      (l.vendor?.name && l.vendor.name.toLowerCase().includes(q)) ||
      (l.application?.name && l.application.name.toLowerCase().includes(q));

    const matchesStatus =
      statusFilter === "ALL" ||
      l.status.toUpperCase() === statusFilter.toUpperCase();

    const matchesVendor =
      vendorFilter === "ALL" ||
      l.vendor?.name === vendorFilter;

    return matchesSearch && matchesStatus && matchesVendor;
  });

  // KPI Calculations
  const totalCount = licenses.length;
  const activeCount = licenses.filter((l) => l.status === "ACTIVE").length;
  const revokedCount = licenses.filter((l) => l.status === "REVOKED").length;
  const expiredCount = licenses.filter((l) => l.status === "EXPIRED").length;
  const totalActivations = licenses.reduce((sum, l) => sum + (l.seats?.activeActivations || 0), 0);
  const onlineSockets = licenses.reduce(
    (sum, l) => sum + l.activations.filter((a) => a.isSocketOnline).length,
    0
  );

  const formatDate = (isoString: string | null) => {
    if (!isoString) return "Perpetual / None";
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return isoString;
    }
  };

  const getRemainingDays = (expiresAt: string | null) => {
    if (!expiresAt) return null;
    const diff = new Date(expiresAt).getTime() - Date.now();
    return Math.ceil(diff / (24 * 60 * 60 * 1000));
  };

  // Handlers for Admin Mutations
  const handleExtendSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!extendTarget || !isAdmin) return;
    setActionMessage(null);

    const fd = new FormData();
    fd.append("orgId", orgId);
    fd.append("serial", extendTarget.serial);
    fd.append("days", String(extendDays));
    fd.append("reason", extendReason || `Extended by ${extendDays} days`);

    startTransition(async () => {
      try {
        await extendRemoteLicenseAction(fd);
        setActionMessage({
          type: "success",
          text: `License ${extendTarget.serial} extended by ${extendDays} days successfully.`,
        });
        setExtendTarget(null);
        setExtendReason("");
      } catch (err: any) {
        setActionMessage({
          type: "error",
          text: err.message || "Failed to extend license",
        });
      }
    });
  };

  const handleRevokeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!revokeTarget || !isAdmin) return;
    setActionMessage(null);

    const fd = new FormData();
    fd.append("orgId", orgId);
    fd.append("serial", revokeTarget.serial);
    fd.append("reason", revokeReason || "Revoked via Office License Suite");

    startTransition(async () => {
      try {
        await revokeRemoteLicenseAction(fd);
        setActionMessage({
          type: "success",
          text: `License ${revokeTarget.serial} has been revoked.`,
        });
        setRevokeTarget(null);
        setRevokeReason("");
      } catch (err: any) {
        setActionMessage({
          type: "error",
          text: err.message || "Failed to revoke license",
        });
      }
    });
  };

  const handleRestoreSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!restoreTarget || !isAdmin) return;
    setActionMessage(null);

    const fd = new FormData();
    fd.append("orgId", orgId);
    fd.append("serial", restoreTarget.serial);
    fd.append("reason", restoreReason || "Restored via Office License Suite");

    startTransition(async () => {
      try {
        await restoreRemoteLicenseAction(fd);
        setActionMessage({
          type: "success",
          text: `License ${restoreTarget.serial} restored to active status.`,
        });
        setRestoreTarget(null);
        setRestoreReason("");
      } catch (err: any) {
        setActionMessage({
          type: "error",
          text: err.message || "Failed to restore license",
        });
      }
    });
  };

  const handleBanClientSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!banClientTarget || !isAdmin) return;
    setActionMessage(null);

    const fd = new FormData();
    fd.append("orgId", orgId);
    fd.append("clientId", banClientTarget.clientId);
    fd.append("reason", banReason || "Installation banned by administrator");

    startTransition(async () => {
      try {
        await banRemoteLicenseClientAction(fd);
        setActionMessage({
          type: "success",
          text: `Client installation ${banClientTarget.clientId.slice(0, 8)}... has been banned.`,
        });
        setBanClientTarget(null);
        setBanReason("");
      } catch (err: any) {
        setActionMessage({
          type: "error",
          text: err.message || "Failed to ban client activation",
        });
      }
    });
  };

  const handleUnbanClient = (clientId: string) => {
    if (!isAdmin) return;
    setActionMessage(null);

    const fd = new FormData();
    fd.append("orgId", orgId);
    fd.append("clientId", clientId);

    startTransition(async () => {
      try {
        await unbanRemoteLicenseClientAction(fd);
        setActionMessage({
          type: "success",
          text: `Client installation ${clientId.slice(0, 8)}... has been unbanned.`,
        });
      } catch (err: any) {
        setActionMessage({
          type: "error",
          text: err.message || "Failed to unban client activation",
        });
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Action Notification Alert */}
      {actionMessage && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: 8,
            marginBottom: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: actionMessage.type === "success" ? "#ecfdf5" : "#fef2f2",
            border: `1px solid ${actionMessage.type === "success" ? "#a7f3d0" : "#fecaca"}`,
            color: actionMessage.type === "success" ? "#065f46" : "#991b1b",
            fontSize: "13.5px",
            fontWeight: 500,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {actionMessage.type === "success" ? (
              <CheckCircle size={18} color="#059669" />
            ) : (
              <AlertTriangle size={18} color="#dc2626" />
            )}
            <span>{actionMessage.text}</span>
          </div>
          <button
            onClick={() => setActionMessage(null)}
            style={{ background: "none", border: "none", cursor: "pointer", color: "inherit" }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* API Connection Banner & Role Ribbon */}
      <div
        style={{
          background: "linear-gradient(135deg, rgba(30, 41, 59, 0.95), rgba(15, 23, 42, 0.98))",
          borderRadius: 12,
          padding: "18px 22px",
          color: "#f8fafc",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.2)",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              background: "linear-gradient(135deg, #0284c7, #0369a1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              boxShadow: "0 4px 12px rgba(2, 132, 199, 0.35)",
            }}
          >
            <Server size={22} />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontWeight: 700, fontSize: "15px", letterSpacing: "-0.01em" }}>
                Simulcast Secure License Manager API
              </span>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "2px 8px",
                  borderRadius: 20,
                  fontSize: "11px",
                  fontWeight: 600,
                  background: serverStatus?.ok ? "rgba(16, 185, 129, 0.2)" : "rgba(239, 68, 68, 0.2)",
                  color: serverStatus?.ok ? "#34d399" : "#f87171",
                  border: `1px solid ${serverStatus?.ok ? "rgba(16, 185, 129, 0.4)" : "rgba(239, 68, 68, 0.4)"}`,
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: serverStatus?.ok ? "#10b981" : "#ef4444",
                    boxShadow: serverStatus?.ok ? "0 0 8px #10b981" : "none",
                  }}
                />
                {serverStatus?.ok ? "Live & Connected" : "Connecting / Fallback"}
              </span>
            </div>
            <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: 3 }}>
              Endpoint: <code style={{ color: "#38bdf8", fontWeight: 600 }}>https://license.simulcast.com.np</code>{" "}
              · Key: <code style={{ color: "#cbd5e1" }}>{serverStatus?.keyName || "ERP Office"}</code> ({serverStatus?.role || "FULL"})
              {serverStatus?.remainingDays !== undefined && ` · Key Valid: ${serverStatus.remainingDays} days`}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <Link
            href={`/${orgId}/plugins`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "7px 12px",
              borderRadius: 8,
              background: "rgba(255, 255, 255, 0.1)",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              color: "#f1f5f9",
              fontSize: "12px",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            <Plug size={14} color="#c084fc" />
            <span>Manage in Plugins Hub</span>
          </Link>
          {isAdmin ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 14px",
                borderRadius: 8,
                background: "rgba(16, 185, 129, 0.15)",
                border: "1px solid rgba(16, 185, 129, 0.3)",
                color: "#6ee7b7",
                fontSize: "12.5px",
                fontWeight: 600,
              }}
            >
              <ShieldCheck size={16} color="#34d399" />
              <span>Admin Access: Extension, Revocation & Bans Enabled</span>
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 14px",
                borderRadius: 8,
                background: "rgba(245, 158, 11, 0.15)",
                border: "1px solid rgba(245, 158, 11, 0.3)",
                color: "#fde68a",
                fontSize: "12.5px",
                fontWeight: 600,
              }}
            >
              <Lock size={16} color="#fbbf24" />
              <span>Read-Only User: Inspection Only (Mutation Admin Only)</span>
            </div>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <section className="grid-kpis no-print">
        <div className="kpi-card">
          <div className="kpi-top">
            <span>Total Licenses</span>
            <KeyRound size={16} color="#64748b" />
          </div>
          <div className="kpi-value">{totalCount}</div>
          <div className="kpi-meta">Provisioned applications</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-top">
            <span>Active & Licensed</span>
            <CheckCircle2 size={16} color="#10b981" />
          </div>
          <div className="kpi-value" style={{ color: "#059669" }}>
            {activeCount}
          </div>
          <div className="kpi-meta">Full entitlement access</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-top">
            <span>Revoked / Expired</span>
            <ShieldAlert size={16} color="#ef4444" />
          </div>
          <div className="kpi-value" style={{ color: revokedCount + expiredCount > 0 ? "#dc2626" : "inherit" }}>
            {revokedCount + expiredCount}
          </div>
          <div className="kpi-meta">{revokedCount} revoked · {expiredCount} expired</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-top">
            <span>Client Activations</span>
            <Radio size={16} color="#0284c7" />
          </div>
          <div className="kpi-value">{totalActivations}</div>
          <div className="kpi-meta">{onlineSockets} live TCP sockets connected</div>
        </div>
      </section>

      {/* Search and Filters Bar */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px",
          background: "#ffffff",
          borderRadius: 8,
          border: "1px solid #e2e8f0",
        }}
        className="no-print"
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: "1 1 280px" }}>
          <div style={{ position: "relative", width: "100%", maxWidth: 360 }}>
            <Search
              size={15}
              style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }}
            />
            <input
              type="text"
              placeholder="Search serial, customer, application..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: "100%",
                paddingLeft: 32,
                paddingRight: 12,
                height: 34,
                fontSize: 12.5,
                borderRadius: 6,
                border: "1px solid #cbd5e1",
              }}
            />
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: "12px", color: "#64748b", fontWeight: 500 }}>Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ height: 34, padding: "0 8px", fontSize: 12.5, borderRadius: 6, border: "1px solid #cbd5e1" }}
            >
              <option value="ALL">All Statuses ({totalCount})</option>
              <option value="ACTIVE">Active ({activeCount})</option>
              <option value="EXPIRED">Expired ({expiredCount})</option>
              <option value="REVOKED">Revoked ({revokedCount})</option>
              <option value="SUSPENDED">Suspended</option>
            </select>
          </div>

          {vendors.length > 1 && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: "12px", color: "#64748b", fontWeight: 500 }}>Vendor:</span>
              <select
                value={vendorFilter}
                onChange={(e) => setVendorFilter(e.target.value)}
                style={{ height: 34, padding: "0 8px", fontSize: 12.5, borderRadius: 6, border: "1px solid #cbd5e1" }}
              >
                <option value="ALL">All Vendors</option>
                {vendors.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Main Licenses Data Table */}
      <div className="table-card">
        <div className="table-scroll">
          <table className="responsive-table" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#475569" }}>
                  License Serial
                </th>
                <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#475569" }}>
                  Application & Vendor
                </th>
                <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#475569" }}>
                  Customer / Tenant
                </th>
                <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#475569" }}>
                  Seats & Activations
                </th>
                <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#475569" }}>
                  Expiration Date
                </th>
                <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#475569" }}>
                  Status
                </th>
                <th
                  style={{
                    padding: "10px 14px",
                    textAlign: "right",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#475569",
                    minWidth: 160,
                  }}
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((lic) => {
                const remDays = getRemainingDays(lic.dates.expiresAt);
                const isExpiringSoon = remDays !== null && remDays > 0 && remDays <= 60;
                const isExpired = remDays !== null && remDays <= 0;
                const hasOnlineSockets = lic.activations.some((a) => a.isSocketOnline);

                return (
                  <tr
                    key={lic.serial}
                    style={{
                      borderBottom: "1px solid #f1f5f9",
                      transition: "background 0.15s ease",
                    }}
                  >
                    {/* Serial */}
                    <td data-label="License Serial" style={{ padding: "12px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <code
                          style={{
                            fontWeight: 700,
                            fontSize: 12.5,
                            color: "#0f172a",
                            background: "#f1f5f9",
                            padding: "3px 6px",
                            borderRadius: 4,
                          }}
                        >
                          {lic.serial}
                        </code>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(lic.serial)}
                          title="Copy serial"
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            padding: 2,
                            color: copiedKey === lic.serial ? "#10b981" : "#94a3b8",
                          }}
                        >
                          {copiedKey === lic.serial ? <Check size={14} /> : <Copy size={14} />}
                        </button>
                      </div>
                      <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                        Modules: {lic.modules.length} authorized
                      </div>
                    </td>

                    {/* App & Vendor */}
                    <td data-label="Application & Vendor" style={{ padding: "12px 14px" }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: "#0f172a" }}>
                        {lic.application.name}
                      </div>
                      <div style={{ fontSize: 11, color: "#64748b", display: "flex", alignItems: "center", gap: 4 }}>
                        <Building2 size={11} />
                        <span>Vendor: {lic.vendor.name}</span>
                      </div>
                    </td>

                    {/* Customer */}
                    <td data-label="Customer" style={{ padding: "12px 14px" }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: "#0f172a" }}>
                        {lic.customerOrganization}
                      </div>
                      {lic.customerContact?.email && (
                        <div style={{ fontSize: 11, color: "#64748b" }}>
                          {lic.customerContact.email}
                        </div>
                      )}
                    </td>

                    {/* Seats */}
                    <td data-label="Seats & Activations" style={{ padding: "12px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontWeight: 600, fontSize: 13 }}>
                          {lic.seats.activeActivations} / {lic.seats.maxActivations} Seats
                        </span>
                        {hasOnlineSockets && (
                          <span
                            title="Live TCP Socket Active"
                            style={{
                              display: "inline-block",
                              width: 8,
                              height: 8,
                              borderRadius: "50%",
                              background: "#10b981",
                              boxShadow: "0 0 6px #10b981",
                            }}
                          />
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: "#64748b", marginTop: 1 }}>
                        {lic.activations.length} total device bound
                      </div>
                    </td>

                    {/* Expiry */}
                    <td data-label="Expiration Date" style={{ padding: "12px 14px" }}>
                      <div style={{ fontWeight: 600, fontSize: 12.5, color: "#0f172a" }}>
                        {formatDate(lic.dates.expiresAt)}
                      </div>
                      {remDays !== null && (
                        <div
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            color: isExpired ? "#dc2626" : isExpiringSoon ? "#d97706" : "#059669",
                            marginTop: 1,
                          }}
                        >
                          {isExpired
                            ? `Expired ${Math.abs(remDays)}d ago`
                            : `${remDays} days remaining`}
                        </div>
                      )}
                    </td>

                    {/* Status Badge */}
                    <td data-label="Status" style={{ padding: "12px 14px" }}>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          padding: "3px 9px",
                          borderRadius: 20,
                          fontSize: 11.5,
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.02em",
                          background:
                            lic.status === "ACTIVE"
                              ? "#ecfdf5"
                              : lic.status === "REVOKED"
                              ? "#fef2f2"
                              : lic.status === "SUSPENDED"
                              ? "#fffbeb"
                              : "#f1f5f9",
                          color:
                            lic.status === "ACTIVE"
                              ? "#047857"
                              : lic.status === "REVOKED"
                              ? "#b91c1c"
                              : lic.status === "SUSPENDED"
                              ? "#b45309"
                              : "#475569",
                          border: `1px solid ${
                            lic.status === "ACTIVE"
                              ? "#a7f3d0"
                              : lic.status === "REVOKED"
                              ? "#fecaca"
                              : lic.status === "SUSPENDED"
                              ? "#fde68a"
                              : "#cbd5e1"
                          }`,
                        }}
                      >
                        {lic.status}
                      </span>
                    </td>

                    {/* Actions */}
                    <td data-label="Actions" style={{ padding: "12px 14px", textAlign: "right" }}>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        {/* View Details Button (Available to ALL users) */}
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedLicense(lic);
                            setDetailTab("overview");
                          }}
                          className="secondary-btn"
                          style={{
                            padding: "5px 9px",
                            fontSize: 11.5,
                            height: 28,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          <Eye size={13} />
                          <span>Details</span>
                        </button>

                        {/* Admin Action Buttons */}
                        {isAdmin ? (
                          <>
                            {/* Extend */}
                            <button
                              type="button"
                              onClick={() => {
                                setExtendTarget(lic);
                                setExtendDays(365);
                                setExtendReason("");
                              }}
                              className="primary-btn"
                              style={{
                                padding: "5px 9px",
                                fontSize: 11.5,
                                height: 28,
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                                background: "#0284c7",
                              }}
                            >
                              <Plus size={13} />
                              <span>Extend</span>
                            </button>

                            {/* Revoke or Restore */}
                            {lic.status === "REVOKED" || lic.status === "SUSPENDED" ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setRestoreTarget(lic);
                                  setRestoreReason("");
                                }}
                                style={{
                                  padding: "5px 9px",
                                  fontSize: 11.5,
                                  height: 28,
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4,
                                  borderRadius: 6,
                                  border: "1px solid #059669",
                                  background: "#ecfdf5",
                                  color: "#065f46",
                                  fontWeight: 600,
                                  cursor: "pointer",
                                }}
                              >
                                <Unlock size={13} />
                                <span>Restore</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setRevokeTarget(lic);
                                  setRevokeReason("");
                                }}
                                style={{
                                  padding: "5px 9px",
                                  fontSize: 11.5,
                                  height: 28,
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4,
                                  borderRadius: 6,
                                  border: "1px solid #ef4444",
                                  background: "#fef2f2",
                                  color: "#b91c1c",
                                  fontWeight: 600,
                                  cursor: "pointer",
                                }}
                              >
                                <Ban size={13} />
                                <span>Revoke</span>
                              </button>
                            )}
                          </>
                        ) : (
                          <span
                            title="Only administrators can extend, revoke, or ban activations."
                            style={{
                              fontSize: 11,
                              color: "#94a3b8",
                              fontStyle: "italic",
                              padding: "2px 6px",
                            }}
                          >
                            Read Only
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {!filtered.length && (
                <tr>
                  <td colSpan={7} style={{ padding: "36px 16px", textAlign: "center", color: "#64748b" }}>
                    <KeyRound size={28} color="#94a3b8" style={{ margin: "0 auto 8px" }} />
                    <div style={{ fontWeight: 600, fontSize: 14 }}>No licenses found matching your filters</div>
                    <div style={{ fontSize: 12, marginTop: 4 }}>
                      Try adjusting your search query or selecting a different status filter.
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* LICENSE DETAILS DRAWER / MODAL (ACCESSIBLE TO ALL USERS)                 */}
      {/* ========================================================================= */}
      {selectedLicense && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(4px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setSelectedLicense(null)}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 14,
              width: "100%",
              maxWidth: 720,
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
              border: "1px solid #cbd5e1",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              style={{
                padding: "18px 22px",
                borderBottom: "1px solid #e2e8f0",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "#f8fafc",
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#0f172a" }}>
                    License Details
                  </h3>
                  <code
                    style={{
                      background: "#e2e8f0",
                      padding: "2px 8px",
                      borderRadius: 4,
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    {selectedLicense.serial}
                  </code>
                </div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                  {selectedLicense.application.name} · {selectedLicense.vendor.name}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLicense(null)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#64748b",
                  padding: 4,
                  borderRadius: 6,
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Tabs */}
            <div
              style={{
                display: "flex",
                borderBottom: "1px solid #e2e8f0",
                padding: "0 22px",
                gap: 16,
                background: "#ffffff",
              }}
            >
              <button
                type="button"
                onClick={() => setDetailTab("overview")}
                style={{
                  padding: "12px 4px",
                  fontSize: 13,
                  fontWeight: 600,
                  border: "none",
                  background: "none",
                  cursor: "pointer",
                  color: detailTab === "overview" ? "#0284c7" : "#64748b",
                  borderBottom: detailTab === "overview" ? "2px solid #0284c7" : "2px solid transparent",
                }}
              >
                Overview & Dates
              </button>
              <button
                type="button"
                onClick={() => setDetailTab("modules")}
                style={{
                  padding: "12px 4px",
                  fontSize: 13,
                  fontWeight: 600,
                  border: "none",
                  background: "none",
                  cursor: "pointer",
                  color: detailTab === "modules" ? "#0284c7" : "#64748b",
                  borderBottom: detailTab === "modules" ? "2px solid #0284c7" : "2px solid transparent",
                }}
              >
                Modules & Entitlements ({selectedLicense.modules.length})
              </button>
              <button
                type="button"
                onClick={() => setDetailTab("activations")}
                style={{
                  padding: "12px 4px",
                  fontSize: 13,
                  fontWeight: 600,
                  border: "none",
                  background: "none",
                  cursor: "pointer",
                  color: detailTab === "activations" ? "#0284c7" : "#64748b",
                  borderBottom: detailTab === "activations" ? "2px solid #0284c7" : "2px solid transparent",
                }}
              >
                Connected Activations ({selectedLicense.activations.length})
              </button>
            </div>

            {/* Tab Body */}
            <div style={{ padding: "22px" }}>
              {detailTab === "overview" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                      Customer / Tenant
                    </label>
                    <div style={{ fontWeight: 600, fontSize: 13, marginTop: 3 }}>
                      {selectedLicense.customerOrganization}
                    </div>
                    {selectedLicense.customerContact?.email && (
                      <div style={{ fontSize: 12, color: "#64748b" }}>
                        Contact: {selectedLicense.customerContact.email}
                      </div>
                    )}
                  </div>

                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                      Current Status
                    </label>
                    <div style={{ marginTop: 3 }}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "3px 8px",
                          borderRadius: 4,
                          fontWeight: 700,
                          fontSize: 11.5,
                          background: selectedLicense.status === "ACTIVE" ? "#ecfdf5" : "#fef2f2",
                          color: selectedLicense.status === "ACTIVE" ? "#047857" : "#b91c1c",
                        }}
                      >
                        {selectedLicense.status}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                      Vendor Namespace
                    </label>
                    <div style={{ fontWeight: 600, fontSize: 13, marginTop: 3 }}>
                      {selectedLicense.vendor.name} ({selectedLicense.vendor.code})
                    </div>
                    <div style={{ fontSize: 11, color: "#94a3b8", fontFamily: "monospace" }}>
                      UUID: {selectedLicense.vendor.publicId}
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                      Application Namespace
                    </label>
                    <div style={{ fontWeight: 600, fontSize: 13, marginTop: 3 }}>
                      {selectedLicense.application.name} ({selectedLicense.application.code})
                    </div>
                    <div style={{ fontSize: 11, color: "#94a3b8", fontFamily: "monospace" }}>
                      UUID: {selectedLicense.application.publicId}
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                      Valid From
                    </label>
                    <div style={{ fontWeight: 600, fontSize: 13, marginTop: 3 }}>
                      {formatDate(selectedLicense.dates.validFrom)}
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                      Expiration Date
                    </label>
                    <div style={{ fontWeight: 600, fontSize: 13, marginTop: 3 }}>
                      {formatDate(selectedLicense.dates.expiresAt)}
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                      Provisioned Seats
                    </label>
                    <div style={{ fontWeight: 600, fontSize: 13, marginTop: 3 }}>
                      {selectedLicense.seats.activeActivations} Active / {selectedLicense.seats.maxActivations} Max Allowed
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                      Last Validated Timestamp
                    </label>
                    <div style={{ fontWeight: 600, fontSize: 13, marginTop: 3 }}>
                      {selectedLicense.dates.lastValidatedAt
                        ? formatDate(selectedLicense.dates.lastValidatedAt)
                        : "Never validated online"}
                    </div>
                  </div>
                </div>
              )}

              {detailTab === "modules" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div>
                    <h4 style={{ margin: "0 0 10px 0", fontSize: 13, fontWeight: 700, color: "#334155" }}>
                      Authorized Application Modules
                    </h4>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      {selectedLicense.modules.map((m) => (
                        <div
                          key={m.code}
                          style={{
                            padding: "10px 12px",
                            borderRadius: 8,
                            border: "1px solid #e2e8f0",
                            background: "#f8fafc",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <CheckCircle2 size={15} color="#10b981" />
                            <span style={{ fontWeight: 700, fontSize: 12.5, color: "#0f172a" }}>
                              {m.name}
                            </span>
                          </div>
                          <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>
                            Code: <code style={{ color: "#0284c7" }}>{m.code}</code>
                            {m.description && ` · ${m.description}`}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {Object.keys(selectedLicense.entitlements || {}).length > 0 && (
                    <div style={{ marginTop: 20 }}>
                      <h4 style={{ margin: "0 0 10px 0", fontSize: 13, fontWeight: 700, color: "#334155" }}>
                        Entitlement Parameters & Capacities
                      </h4>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                          gap: 8,
                        }}
                      >
                        {Object.entries(selectedLicense.entitlements).map(([key, val]) => (
                          <div
                            key={key}
                            style={{
                              padding: "8px 12px",
                              borderRadius: 6,
                              background: "#f1f5f9",
                              border: "1px solid #e2e8f0",
                            }}
                          >
                            <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>{key}</div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginTop: 2 }}>
                              {String(val)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {detailTab === "activations" && (
                <div>
                  <h4 style={{ margin: "0 0 10px 0", fontSize: 13, fontWeight: 700, color: "#334155" }}>
                    Registered Hardware Activations
                  </h4>
                  {selectedLicense.activations.length === 0 ? (
                    <div style={{ padding: 24, textAlign: "center", color: "#64748b", fontSize: 13 }}>
                      No client installations have activated this license yet.
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {selectedLicense.activations.map((a) => (
                        <div
                          key={a.id}
                          style={{
                            padding: "12px 14px",
                            borderRadius: 8,
                            border: "1px solid #e2e8f0",
                            background: a.state === "BANNED" ? "#fef2f2" : "#f8fafc",
                            display: "flex",
                            flexWrap: "wrap",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 12,
                          }}
                        >
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <Laptop size={16} color="#64748b" />
                              <code style={{ fontSize: 12, fontWeight: 700 }}>{a.clientId}</code>
                              <span
                                style={{
                                  fontSize: 10.5,
                                  fontWeight: 700,
                                  padding: "2px 6px",
                                  borderRadius: 4,
                                  background:
                                    a.state === "BANNED"
                                      ? "#dc2626"
                                      : a.isSocketOnline
                                      ? "#10b981"
                                      : "#64748b",
                                  color: "#fff",
                                }}
                              >
                                {a.state === "BANNED"
                                  ? "BANNED"
                                  : a.isSocketOnline
                                  ? "SOCKET LIVE"
                                  : a.state}
                              </span>
                            </div>
                            <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 4 }}>
                              Platform: <b>{a.platform}</b> · Version: <b>{a.appVersion}</b> · Last IP:{" "}
                              <b>{a.lastIp || "Unknown"}</b>
                            </div>
                            {a.lastHeartbeatAt && (
                              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                                Last Heartbeat: {formatDate(a.lastHeartbeatAt)}
                              </div>
                            )}
                          </div>

                          {/* Ban / Unban Button (Admin Only) */}
                          {isAdmin ? (
                            <div>
                              {a.state === "BANNED" ? (
                                <button
                                  type="button"
                                  onClick={() => handleUnbanClient(a.clientId)}
                                  disabled={isPending}
                                  style={{
                                    padding: "4px 10px",
                                    fontSize: 11.5,
                                    fontWeight: 600,
                                    borderRadius: 6,
                                    background: "#ecfdf5",
                                    color: "#065f46",
                                    border: "1px solid #059669",
                                    cursor: "pointer",
                                  }}
                                >
                                  Unban Installation
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setBanClientTarget({
                                      clientId: a.clientId,
                                      serial: selectedLicense.serial,
                                    })
                                  }
                                  disabled={isPending}
                                  style={{
                                    padding: "4px 10px",
                                    fontSize: 11.5,
                                    fontWeight: 600,
                                    borderRadius: 6,
                                    background: "#fef2f2",
                                    color: "#b91c1c",
                                    border: "1px solid #ef4444",
                                    cursor: "pointer",
                                  }}
                                >
                                  Ban Installation
                                </button>
                              )}
                            </div>
                          ) : (
                            <span style={{ fontSize: 11, color: "#94a3b8" }}>
                              Admin ban required
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: "14px 22px",
                borderTop: "1px solid #e2e8f0",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "#f8fafc",
              }}
            >
              <div style={{ fontSize: 11.5, color: "#64748b" }}>
                License Serial: <code style={{ fontWeight: 700 }}>{selectedLicense.serial}</code>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {isAdmin && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        const target = selectedLicense;
                        setSelectedLicense(null);
                        setExtendTarget(target);
                        setExtendDays(365);
                      }}
                      className="primary-btn"
                      style={{ fontSize: 12, height: 32, padding: "0 12px" }}
                    >
                      Extend Validity
                    </button>
                    {selectedLicense.status === "ACTIVE" ? (
                      <button
                        type="button"
                        onClick={() => {
                          const target = selectedLicense;
                          setSelectedLicense(null);
                          setRevokeTarget(target);
                        }}
                        style={{
                          fontSize: 12,
                          height: 32,
                          padding: "0 12px",
                          borderRadius: 6,
                          background: "#fef2f2",
                          color: "#b91c1c",
                          border: "1px solid #ef4444",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        Revoke License
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          const target = selectedLicense;
                          setSelectedLicense(null);
                          setRestoreTarget(target);
                        }}
                        style={{
                          fontSize: 12,
                          height: 32,
                          padding: "0 12px",
                          borderRadius: 6,
                          background: "#ecfdf5",
                          color: "#065f46",
                          border: "1px solid #059669",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        Restore License
                      </button>
                    )}
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedLicense(null)}
                  className="secondary-btn"
                  style={{ fontSize: 12, height: 32, padding: "0 12px" }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* EXTEND LICENSE MODAL (ADMIN ONLY)                                        */}
      {/* ========================================================================= */}
      {extendTarget && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(4px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setExtendTarget(null)}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 14,
              width: "100%",
              maxWidth: 480,
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
              border: "1px solid #cbd5e1",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <form onSubmit={handleExtendSubmit}>
              <div style={{ padding: "18px 22px", borderBottom: "1px solid #e2e8f0", background: "#f8fafc" }}>
                <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#0f172a" }}>
                  Extend License Validity
                </h3>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 3 }}>
                  Serial: <code style={{ fontWeight: 700 }}>{extendTarget.serial}</code> (
                  {extendTarget.customerOrganization})
                </div>
              </div>

              <div style={{ padding: 22, display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#334155", display: "block", marginBottom: 6 }}>
                    Select Extension Duration
                  </label>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                    {[30, 90, 180, 365].map((d) => (
                      <button
                        type="button"
                        key={d}
                        onClick={() => setExtendDays(d)}
                        style={{
                          padding: "8px 4px",
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: "pointer",
                          border: extendDays === d ? "2px solid #0284c7" : "1px solid #cbd5e1",
                          background: extendDays === d ? "#f0f9ff" : "#ffffff",
                          color: extendDays === d ? "#0369a1" : "#334155",
                        }}
                      >
                        +{d} Days
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#334155", display: "block", marginBottom: 6 }}>
                    Or Custom Number of Days
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={3650}
                    value={extendDays}
                    onChange={(e) => setExtendDays(Number(e.target.value))}
                    style={{
                      width: "100%",
                      height: 36,
                      borderRadius: 6,
                      border: "1px solid #cbd5e1",
                      padding: "0 10px",
                      fontSize: 13,
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#334155", display: "block", marginBottom: 6 }}>
                    Reason / Notes (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Annual renewal paid via Bank transfer"
                    value={extendReason}
                    onChange={(e) => setExtendReason(e.target.value)}
                    style={{
                      width: "100%",
                      height: 36,
                      borderRadius: 6,
                      border: "1px solid #cbd5e1",
                      padding: "0 10px",
                      fontSize: 13,
                    }}
                  />
                </div>
              </div>

              <div
                style={{
                  padding: "14px 22px",
                  borderTop: "1px solid #e2e8f0",
                  background: "#f8fafc",
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 10,
                }}
              >
                <button
                  type="button"
                  onClick={() => setExtendTarget(null)}
                  className="secondary-btn"
                  style={{ fontSize: 12.5, height: 34 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="primary-btn"
                  style={{ fontSize: 12.5, height: 34 }}
                >
                  {isPending ? "Extending..." : "Confirm Extension"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* REVOKE LICENSE MODAL (ADMIN ONLY)                                        */}
      {/* ========================================================================= */}
      {revokeTarget && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(4px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setRevokeTarget(null)}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 14,
              width: "100%",
              maxWidth: 480,
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
              border: "1px solid #cbd5e1",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <form onSubmit={handleRevokeSubmit}>
              <div style={{ padding: "18px 22px", borderBottom: "1px solid #e2e8f0", background: "#fef2f2" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <AlertTriangle size={20} color="#dc2626" />
                  <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#991b1b" }}>
                    Revoke Commercial License
                  </h3>
                </div>
                <div style={{ fontSize: 12, color: "#7f1d1d", marginTop: 3 }}>
                  Serial: <code style={{ fontWeight: 700 }}>{revokeTarget.serial}</code>
                </div>
              </div>

              <div style={{ padding: 22, display: "flex", flexDirection: "column", gap: 14 }}>
                <p style={{ margin: 0, fontSize: "13px", color: "#475569", lineHeight: 1.5 }}>
                  Warning: Revoking this license will immediately lock licensed features and terminate active
                  client socket connections across all registered machines.
                </p>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#334155", display: "block", marginBottom: 6 }}>
                    Revocation Reason
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Contract terminated, payment default, or security recall"
                    value={revokeReason}
                    onChange={(e) => setRevokeReason(e.target.value)}
                    style={{
                      width: "100%",
                      height: 36,
                      borderRadius: 6,
                      border: "1px solid #cbd5e1",
                      padding: "0 10px",
                      fontSize: 13,
                    }}
                  />
                </div>
              </div>

              <div
                style={{
                  padding: "14px 22px",
                  borderTop: "1px solid #e2e8f0",
                  background: "#f8fafc",
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 10,
                }}
              >
                <button
                  type="button"
                  onClick={() => setRevokeTarget(null)}
                  className="secondary-btn"
                  style={{ fontSize: 12.5, height: 34 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  style={{
                    fontSize: 12.5,
                    height: 34,
                    padding: "0 16px",
                    borderRadius: 6,
                    background: "#dc2626",
                    color: "#fff",
                    fontWeight: 600,
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  {isPending ? "Revoking..." : "Confirm Revocation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* RESTORE LICENSE MODAL (ADMIN ONLY)                                       */}
      {/* ========================================================================= */}
      {restoreTarget && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(4px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setRestoreTarget(null)}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 14,
              width: "100%",
              maxWidth: 480,
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
              border: "1px solid #cbd5e1",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <form onSubmit={handleRestoreSubmit}>
              <div style={{ padding: "18px 22px", borderBottom: "1px solid #e2e8f0", background: "#ecfdf5" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Unlock size={20} color="#059669" />
                  <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#065f46" }}>
                    Restore License to Active Status
                  </h3>
                </div>
                <div style={{ fontSize: 12, color: "#047857", marginTop: 3 }}>
                  Serial: <code style={{ fontWeight: 700 }}>{restoreTarget.serial}</code>
                </div>
              </div>

              <div style={{ padding: 22, display: "flex", flexDirection: "column", gap: 14 }}>
                <p style={{ margin: 0, fontSize: "13px", color: "#475569", lineHeight: 1.5 }}>
                  Restoring this license will reset status to ACTIVE, permit clients to revalidate online, and
                  re-enable authorized application modules.
                </p>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#334155", display: "block", marginBottom: 6 }}>
                    Restoration Reason (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Account cleared and reinstated"
                    value={restoreReason}
                    onChange={(e) => setRestoreReason(e.target.value)}
                    style={{
                      width: "100%",
                      height: 36,
                      borderRadius: 6,
                      border: "1px solid #cbd5e1",
                      padding: "0 10px",
                      fontSize: 13,
                    }}
                  />
                </div>
              </div>

              <div
                style={{
                  padding: "14px 22px",
                  borderTop: "1px solid #e2e8f0",
                  background: "#f8fafc",
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 10,
                }}
              >
                <button
                  type="button"
                  onClick={() => setRestoreTarget(null)}
                  className="secondary-btn"
                  style={{ fontSize: 12.5, height: 34 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="primary-btn"
                  style={{ fontSize: 12.5, height: 34, background: "#059669" }}
                >
                  {isPending ? "Restoring..." : "Restore License"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* BAN CLIENT MODAL (ADMIN ONLY)                                            */}
      {/* ========================================================================= */}
      {banClientTarget && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(4px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setBanClientTarget(null)}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 14,
              width: "100%",
              maxWidth: 480,
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
              border: "1px solid #cbd5e1",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <form onSubmit={handleBanClientSubmit}>
              <div style={{ padding: "18px 22px", borderBottom: "1px solid #e2e8f0", background: "#fef2f2" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Ban size={20} color="#dc2626" />
                  <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#991b1b" }}>
                    Ban Client Device Installation
                  </h3>
                </div>
                <div style={{ fontSize: 12, color: "#7f1d1d", marginTop: 3 }}>
                  Installation UUID: <code style={{ fontWeight: 700 }}>{banClientTarget.clientId}</code>
                </div>
              </div>

              <div style={{ padding: 22, display: "flex", flexDirection: "column", gap: 14 }}>
                <p style={{ margin: 0, fontSize: "13px", color: "#475569", lineHeight: 1.5 }}>
                  Banning this device stops heartbeats, sends a signed termination signal, disconnects the live socket,
                  and blocks reconnection for this hardware instance.
                </p>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#334155", display: "block", marginBottom: 6 }}>
                    Ban Reason
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Unauthorized workstation, hardware cloned"
                    value={banReason}
                    onChange={(e) => setBanReason(e.target.value)}
                    style={{
                      width: "100%",
                      height: 36,
                      borderRadius: 6,
                      border: "1px solid #cbd5e1",
                      padding: "0 10px",
                      fontSize: 13,
                    }}
                  />
                </div>
              </div>

              <div
                style={{
                  padding: "14px 22px",
                  borderTop: "1px solid #e2e8f0",
                  background: "#f8fafc",
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 10,
                }}
              >
                <button
                  type="button"
                  onClick={() => setBanClientTarget(null)}
                  className="secondary-btn"
                  style={{ fontSize: 12.5, height: 34 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  style={{
                    fontSize: 12.5,
                    height: 34,
                    padding: "0 16px",
                    borderRadius: 6,
                    background: "#dc2626",
                    color: "#fff",
                    fontWeight: 600,
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  {isPending ? "Banning..." : "Confirm Ban"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
