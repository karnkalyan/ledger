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
    if (!isoString) return "Perpetual / Never";
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
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
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Action Notification Alert */}
      {actionMessage && (
        <div
          style={{
            padding: "10px 14px",
            borderRadius: "var(--radius-sm)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: actionMessage.type === "success" ? "var(--success-soft)" : "var(--danger-soft)",
            border: `1px solid ${actionMessage.type === "success" ? "var(--success-border)" : "var(--danger-border)"}`,
            color: actionMessage.type === "success" ? "var(--success)" : "var(--danger)",
            fontSize: "12.5px",
            fontWeight: 600,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {actionMessage.type === "success" ? (
              <CheckCircle size={16} />
            ) : (
              <AlertTriangle size={16} />
            )}
            <span>{actionMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionMessage(null)}
            style={{ color: "inherit", opacity: 0.8 }}
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* Connection Info & Action Ribbon - Styled with standard Kashtrix ERP Theme */}
      <div
        className="table-card"
        style={{
          padding: "14px 18px",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 14,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: "var(--radius-sm)",
              background: "var(--brand-soft)",
              border: "1px solid var(--brand-border)",
              color: "var(--brand)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Server size={20} />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontWeight: 700, fontSize: "14px", color: "var(--text)" }}>
                Kashtrix License Manager
              </span>
              <span
                className={`badge ${serverStatus?.ok ? "badge-active" : "badge-cancelled"}`}
                style={{ fontSize: "11px", padding: "2px 8px" }}
              >
                {serverStatus?.ok ? "● Connected" : "○ Disconnected"}
              </span>
            </div>
            <div style={{ fontSize: "11.5px", color: "var(--text-muted)", marginTop: 2 }}>
              Endpoint: <code style={{ color: "var(--brand)", fontWeight: 600 }}>https://license.simulcast.com.np</code>{" "}
              · Key: <span style={{ color: "var(--text)" }}>{serverStatus?.keyName || "Kashtrix Office"}</span> ({serverStatus?.role || "FULL"})
              {serverStatus?.remainingDays !== undefined && ` · Key Valid: ${serverStatus.remainingDays} days`}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <Link
            href={`/${orgId}/plugins`}
            className="secondary-btn"
          >
            <Plug size={13} />
            <span>Plugins Hub</span>
          </Link>
          {isAdmin ? (
            <span className="badge badge-active" style={{ fontSize: "11px" }}>
              <ShieldCheck size={13} style={{ marginRight: 4 }} />
              Admin: Extension &amp; Revocation Active
            </span>
          ) : (
            <span className="badge badge-pending" style={{ fontSize: "11px" }}>
              <Lock size={13} style={{ marginRight: 4 }} />
              Read-Only Inspection
            </span>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <section className="grid-kpis no-print">
        <div className="kpi-card">
          <div className="kpi-top">
            <span>Total Licenses</span>
            <KeyRound size={15} color="var(--text-muted)" />
          </div>
          <div className="kpi-value">{totalCount}</div>
          <div className="kpi-meta">Provisioned applications</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-top">
            <span>Active &amp; Licensed</span>
            <CheckCircle2 size={15} color="var(--success)" />
          </div>
          <div className="kpi-value" style={{ color: "var(--success)" }}>
            {activeCount}
          </div>
          <div className="kpi-meta">Full entitlement access</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-top">
            <span>Revoked / Expired</span>
            <ShieldAlert size={15} color="var(--danger)" />
          </div>
          <div className="kpi-value" style={{ color: revokedCount + expiredCount > 0 ? "var(--danger)" : "inherit" }}>
            {revokedCount + expiredCount}
          </div>
          <div className="kpi-meta">{revokedCount} revoked · {expiredCount} expired</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-top">
            <span>Client Activations</span>
            <Radio size={15} color="var(--brand)" />
          </div>
          <div className="kpi-value">{totalActivations}</div>
          <div className="kpi-meta">{onlineSockets} live TCP sockets</div>
        </div>
      </section>

      {/* Search and Filters Bar */}
      <div
        className="table-card no-print"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 14px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: "1 1 260px" }}>
          <div style={{ position: "relative", width: "100%", maxWidth: 360 }}>
            <Search
              size={14}
              style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }}
            />
            <input
              type="text"
              placeholder="Search serial, customer, application..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: "100%",
                paddingLeft: 30,
                paddingRight: 10,
                height: 32,
                fontSize: 12,
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--line)",
                background: "var(--surface)",
                color: "var(--text)",
              }}
            />
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: "11.5px", color: "var(--text-muted)", fontWeight: 600 }}>Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                height: 32,
                padding: "0 8px",
                fontSize: 12,
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--line)",
                background: "var(--surface)",
                color: "var(--text)",
              }}
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
              <span style={{ fontSize: "11.5px", color: "var(--text-muted)", fontWeight: 600 }}>Vendor:</span>
              <select
                value={vendorFilter}
                onChange={(e) => setVendorFilter(e.target.value)}
                style={{
                  height: 32,
                  padding: "0 8px",
                  fontSize: 12,
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--line)",
                  background: "var(--surface)",
                  color: "var(--text)",
                }}
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

      {/* Main Licenses Data Table - Completely Native ERP Theme */}
      <div className="table-card">
        <div className="table-scroll">
          <table className="responsive-table data-table" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}>License Serial</th>
                <th style={{ textAlign: "left" }}>Application &amp; Vendor</th>
                <th style={{ textAlign: "left" }}>Customer / Tenant</th>
                <th style={{ textAlign: "left" }}>Seats &amp; Activations</th>
                <th style={{ textAlign: "left" }}>Expiration Date</th>
                <th style={{ textAlign: "left" }}>Status</th>
                <th style={{ textAlign: "right", minWidth: 160 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((lic) => {
                const remDays = getRemainingDays(lic.dates.expiresAt);
                const isExpiringSoon = remDays !== null && remDays > 0 && remDays <= 60;
                const isExpired = remDays !== null && remDays <= 0;
                const hasOnlineSockets = lic.activations.some((a) => a.isSocketOnline);

                return (
                  <tr key={lic.serial}>
                    {/* Serial */}
                    <td data-label="License Serial">
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <code
                          style={{
                            fontWeight: 700,
                            fontSize: 12,
                            color: "var(--text)",
                            background: "var(--soft)",
                            padding: "2px 6px",
                            borderRadius: 4,
                            border: "1px solid var(--line)",
                          }}
                        >
                          {lic.serial}
                        </code>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(lic.serial)}
                          title="Copy serial"
                          style={{
                            padding: 2,
                            color: copiedKey === lic.serial ? "var(--success)" : "var(--text-muted)",
                          }}
                        >
                          {copiedKey === lic.serial ? <Check size={13} /> : <Copy size={13} />}
                        </button>
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                        Modules: {lic.modules.length} authorized
                      </div>
                    </td>

                    {/* App & Vendor */}
                    <td data-label="Application & Vendor">
                      <div style={{ fontWeight: 600, fontSize: 12.5, color: "var(--text)" }}>
                        {lic.application.name}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4 }}>
                        <Building2 size={11} />
                        <span>Vendor: {lic.vendor.name}</span>
                      </div>
                    </td>

                    {/* Customer */}
                    <td data-label="Customer">
                      <div style={{ fontWeight: 600, fontSize: 12.5, color: "var(--text)" }}>
                        {lic.customerOrganization}
                      </div>
                      {lic.customerContact?.email && (
                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                          {lic.customerContact.email}
                        </div>
                      )}
                    </td>

                    {/* Seats */}
                    <td data-label="Seats & Activations">
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontWeight: 600, fontSize: 12.5 }}>
                          {lic.seats.activeActivations} / {lic.seats.maxActivations} Seats
                        </span>
                        {hasOnlineSockets && (
                          <span
                            title="Live Socket Connected"
                            style={{
                              display: "inline-block",
                              width: 7,
                              height: 7,
                              borderRadius: "50%",
                              background: "var(--success)",
                            }}
                          />
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>
                        {lic.activations.length} device activations
                      </div>
                    </td>

                    {/* Expiry */}
                    <td data-label="Expiration Date">
                      <div style={{ fontWeight: 600, fontSize: 12, color: "var(--text)" }}>
                        {formatDate(lic.dates.expiresAt)}
                      </div>
                      {remDays !== null && (
                        <div
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            color: isExpired ? "var(--danger)" : isExpiringSoon ? "var(--warning)" : "var(--success)",
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
                    <td data-label="Status">
                      <span
                        className={`badge ${
                          lic.status === "ACTIVE"
                            ? "badge-active"
                            : lic.status === "REVOKED"
                            ? "badge-cancelled"
                            : "badge-pending"
                        }`}
                        style={{ fontSize: "11px" }}
                      >
                        {lic.status}
                      </span>
                    </td>

                    {/* Actions - Standard ERP Theme Buttons */}
                    <td data-label="Actions" style={{ textAlign: "right" }}>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        {/* View Details Button (Available to ALL users) */}
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedLicense(lic);
                            setDetailTab("overview");
                          }}
                          className="secondary-btn"
                          style={{ minHeight: 28, height: 28, padding: "3px 8px", fontSize: "11px" }}
                        >
                          <Eye size={12} />
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
                              style={{ minHeight: 28, height: 28, padding: "3px 8px", fontSize: "11px" }}
                            >
                              <Plus size={12} />
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
                                className="success-btn"
                                style={{ minHeight: 28, height: 28, padding: "3px 8px", fontSize: "11px" }}
                              >
                                <Unlock size={12} />
                                <span>Restore</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setRevokeTarget(lic);
                                  setRevokeReason("");
                                }}
                                className="danger-btn"
                                style={{ minHeight: 28, height: 28, padding: "3px 8px", fontSize: "11px" }}
                              >
                                <Ban size={12} />
                                <span>Revoke</span>
                              </button>
                            )}
                          </>
                        ) : (
                          <span style={{ fontSize: 11, color: "var(--text-muted)", fontStyle: "italic" }}>
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
                  <td colSpan={7} style={{ padding: "36px 16px", textAlign: "center", color: "var(--text-muted)" }}>
                    <KeyRound size={26} color="var(--text-muted)" style={{ margin: "0 auto 8px" }} />
                    <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text)" }}>No licenses found matching your filters</div>
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
      {/* LICENSE DETAILS MODAL (ACCESSIBLE TO ALL USERS)                          */}
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
            className="table-card"
            style={{
              width: "100%",
              maxWidth: 720,
              maxHeight: "90vh",
              overflowY: "auto",
              padding: 0,
              boxShadow: "var(--modal-shadow)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid var(--line)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "var(--soft)",
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "var(--text)" }}>
                    License Details
                  </h3>
                  <code
                    style={{
                      background: "var(--surface)",
                      padding: "2px 6px",
                      borderRadius: 4,
                      fontSize: 11.5,
                      fontWeight: 700,
                      border: "1px solid var(--line)",
                    }}
                  >
                    {selectedLicense.serial}
                  </code>
                </div>
                <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 2 }}>
                  {selectedLicense.application.name} · {selectedLicense.vendor.name}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLicense(null)}
                style={{ color: "var(--text-muted)", padding: 4 }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Tabs */}
            <div
              style={{
                display: "flex",
                borderBottom: "1px solid var(--line)",
                padding: "0 20px",
                gap: 16,
                background: "var(--surface)",
              }}
            >
              <button
                type="button"
                onClick={() => setDetailTab("overview")}
                style={{
                  padding: "10px 4px",
                  fontSize: 12.5,
                  fontWeight: 600,
                  border: "none",
                  background: "none",
                  cursor: "pointer",
                  color: detailTab === "overview" ? "var(--brand)" : "var(--text-muted)",
                  borderBottom: detailTab === "overview" ? "2px solid var(--brand)" : "2px solid transparent",
                }}
              >
                Overview &amp; Dates
              </button>
              <button
                type="button"
                onClick={() => setDetailTab("modules")}
                style={{
                  padding: "10px 4px",
                  fontSize: 12.5,
                  fontWeight: 600,
                  border: "none",
                  background: "none",
                  cursor: "pointer",
                  color: detailTab === "modules" ? "var(--brand)" : "var(--text-muted)",
                  borderBottom: detailTab === "modules" ? "2px solid var(--brand)" : "2px solid transparent",
                }}
              >
                Modules &amp; Entitlements ({selectedLicense.modules.length})
              </button>
              <button
                type="button"
                onClick={() => setDetailTab("activations")}
                style={{
                  padding: "10px 4px",
                  fontSize: 12.5,
                  fontWeight: 600,
                  border: "none",
                  background: "none",
                  cursor: "pointer",
                  color: detailTab === "activations" ? "var(--brand)" : "var(--text-muted)",
                  borderBottom: detailTab === "activations" ? "2px solid var(--brand)" : "2px solid transparent",
                }}
              >
                Connected Activations ({selectedLicense.activations.length})
              </button>
            </div>

            {/* Tab Body */}
            <div style={{ padding: "18px 20px" }}>
              {detailTab === "overview" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <div>
                    <label style={{ fontSize: 10.5, fontWeight: 750, color: "var(--text-muted)", textTransform: "uppercase" }}>
                      Customer / Tenant
                    </label>
                    <div style={{ fontWeight: 650, fontSize: 12.5, marginTop: 3, color: "var(--text)" }}>
                      {selectedLicense.customerOrganization}
                    </div>
                    {selectedLicense.customerContact?.email && (
                      <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                        Contact: {selectedLicense.customerContact.email}
                      </div>
                    )}
                  </div>

                  <div>
                    <label style={{ fontSize: 10.5, fontWeight: 750, color: "var(--text-muted)", textTransform: "uppercase" }}>
                      Current Status
                    </label>
                    <div style={{ marginTop: 3 }}>
                      <span
                        className={`badge ${
                          selectedLicense.status === "ACTIVE"
                            ? "badge-active"
                            : selectedLicense.status === "REVOKED"
                            ? "badge-cancelled"
                            : "badge-pending"
                        }`}
                        style={{ fontSize: "11px" }}
                      >
                        {selectedLicense.status}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: 10.5, fontWeight: 750, color: "var(--text-muted)", textTransform: "uppercase" }}>
                      Vendor Namespace
                    </label>
                    <div style={{ fontWeight: 650, fontSize: 12.5, marginTop: 3, color: "var(--text)" }}>
                      {selectedLicense.vendor.name} ({selectedLicense.vendor.code})
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "monospace" }}>
                      UUID: {selectedLicense.vendor.publicId}
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: 10.5, fontWeight: 750, color: "var(--text-muted)", textTransform: "uppercase" }}>
                      Application Namespace
                    </label>
                    <div style={{ fontWeight: 650, fontSize: 12.5, marginTop: 3, color: "var(--text)" }}>
                      {selectedLicense.application.name} ({selectedLicense.application.code})
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "monospace" }}>
                      UUID: {selectedLicense.application.publicId}
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: 10.5, fontWeight: 750, color: "var(--text-muted)", textTransform: "uppercase" }}>
                      Valid From
                    </label>
                    <div style={{ fontWeight: 650, fontSize: 12.5, marginTop: 3, color: "var(--text)" }}>
                      {formatDate(selectedLicense.dates.validFrom)}
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: 10.5, fontWeight: 750, color: "var(--text-muted)", textTransform: "uppercase" }}>
                      Expiration Date
                    </label>
                    <div style={{ fontWeight: 650, fontSize: 12.5, marginTop: 3, color: "var(--text)" }}>
                      {formatDate(selectedLicense.dates.expiresAt)}
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: 10.5, fontWeight: 750, color: "var(--text-muted)", textTransform: "uppercase" }}>
                      Provisioned Seats
                    </label>
                    <div style={{ fontWeight: 650, fontSize: 12.5, marginTop: 3, color: "var(--text)" }}>
                      {selectedLicense.seats.activeActivations} Active / {selectedLicense.seats.maxActivations} Max Allowed
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: 10.5, fontWeight: 750, color: "var(--text-muted)", textTransform: "uppercase" }}>
                      Last Validated Timestamp
                    </label>
                    <div style={{ fontWeight: 650, fontSize: 12.5, marginTop: 3, color: "var(--text)" }}>
                      {selectedLicense.dates.lastValidatedAt
                        ? formatDate(selectedLicense.dates.lastValidatedAt)
                        : "Never validated online"}
                    </div>
                  </div>
                </div>
              )}

              {detailTab === "modules" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div>
                    <h4 style={{ margin: "0 0 8px 0", fontSize: "12.5px", fontWeight: 700, color: "var(--text)" }}>
                      Authorized Application Modules
                    </h4>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      {selectedLicense.modules.map((m) => (
                        <div
                          key={m.code}
                          style={{
                            padding: "8px 10px",
                            borderRadius: "var(--radius-sm)",
                            border: "1px solid var(--line)",
                            background: "var(--soft)",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <CheckCircle2 size={14} color="var(--success)" />
                            <span style={{ fontWeight: 700, fontSize: 12, color: "var(--text)" }}>
                              {m.name}
                            </span>
                          </div>
                          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                            Code: <code style={{ color: "var(--brand)" }}>{m.code}</code>
                            {m.description && ` · ${m.description}`}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {Object.keys(selectedLicense.entitlements || {}).length > 0 && (
                    <div style={{ marginTop: 12 }}>
                      <h4 style={{ margin: "0 0 8px 0", fontSize: "12.5px", fontWeight: 700, color: "var(--text)" }}>
                        Entitlement Parameters &amp; Capacities
                      </h4>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
                          gap: 6,
                        }}
                      >
                        {Object.entries(selectedLicense.entitlements).map(([key, val]) => (
                          <div
                            key={key}
                            style={{
                              padding: "6px 10px",
                              borderRadius: "var(--radius-sm)",
                              background: "var(--soft)",
                              border: "1px solid var(--line)",
                            }}
                          >
                            <div style={{ fontSize: 10.5, color: "var(--text-muted)", fontWeight: 600 }}>{key}</div>
                            <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text)", marginTop: 2 }}>
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
                  <h4 style={{ margin: "0 0 8px 0", fontSize: "12.5px", fontWeight: 700, color: "var(--text)" }}>
                    Registered Hardware Activations
                  </h4>
                  {selectedLicense.activations.length === 0 ? (
                    <div style={{ padding: 20, textAlign: "center", color: "var(--text-muted)", fontSize: 12.5 }}>
                      No client installations have activated this license yet.
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {selectedLicense.activations.map((a) => (
                        <div
                          key={a.id}
                          style={{
                            padding: "10px 12px",
                            borderRadius: "var(--radius-sm)",
                            border: "1px solid var(--line)",
                            background: a.state === "BANNED" ? "var(--danger-soft)" : "var(--soft)",
                            display: "flex",
                            flexWrap: "wrap",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 10,
                          }}
                        >
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <Laptop size={15} color="var(--text-muted)" />
                              <code style={{ fontSize: 11.5, fontWeight: 700 }}>{a.clientId}</code>
                              <span
                                className={`badge ${
                                  a.state === "BANNED"
                                    ? "badge-cancelled"
                                    : a.isSocketOnline
                                    ? "badge-active"
                                    : "badge-pending"
                                }`}
                                style={{ fontSize: "10.5px" }}
                              >
                                {a.state === "BANNED"
                                  ? "BANNED"
                                  : a.isSocketOnline
                                  ? "SOCKET LIVE"
                                  : a.state}
                              </span>
                            </div>
                            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>
                              Platform: <b>{a.platform}</b> · Version: <b>{a.appVersion}</b> · Last IP:{" "}
                              <b>{a.lastIp || "Unknown"}</b>
                            </div>
                            {a.lastHeartbeatAt && (
                              <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 2 }}>
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
                                  className="success-btn"
                                  style={{ minHeight: 28, height: 28, padding: "3px 8px", fontSize: "11px" }}
                                >
                                  Unban
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
                                  className="danger-btn"
                                  style={{ minHeight: 28, height: 28, padding: "3px 8px", fontSize: "11px" }}
                                >
                                  Ban Installation
                                </button>
                              )}
                            </div>
                          ) : (
                            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
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
                padding: "12px 20px",
                borderTop: "1px solid var(--line)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "var(--soft)",
              }}
            >
              <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                Serial: <code style={{ fontWeight: 700 }}>{selectedLicense.serial}</code>
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
                        className="danger-btn"
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
                        className="success-btn"
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
            className="table-card"
            style={{
              width: "100%",
              maxWidth: 460,
              padding: 0,
              boxShadow: "var(--modal-shadow)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <form onSubmit={handleExtendSubmit}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--line)", background: "var(--soft)" }}>
                <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "var(--text)" }}>
                  Extend License Validity
                </h3>
                <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 2 }}>
                  Serial: <code style={{ fontWeight: 700 }}>{extendTarget.serial}</code> ({extendTarget.customerOrganization})
                </div>
              </div>

              <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text)", display: "block", marginBottom: 6 }}>
                    Select Extension Duration
                  </label>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
                    {[30, 90, 180, 365].map((d) => (
                      <button
                        type="button"
                        key={d}
                        onClick={() => setExtendDays(d)}
                        className={extendDays === d ? "primary-btn" : "secondary-btn"}
                        style={{ height: 32, fontSize: 11.5 }}
                      >
                        +{d} Days
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text)", display: "block", marginBottom: 4 }}>
                    Custom Number of Days
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={3650}
                    value={extendDays}
                    onChange={(e) => setExtendDays(Number(e.target.value))}
                    style={{
                      width: "100%",
                      height: 32,
                      borderRadius: "var(--radius-sm)",
                      border: "1px solid var(--line)",
                      background: "var(--surface)",
                      color: "var(--text)",
                      padding: "0 10px",
                      fontSize: 12.5,
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text)", display: "block", marginBottom: 4 }}>
                    Reason / Notes (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Annual renewal paid via Bank transfer"
                    value={extendReason}
                    onChange={(e) => setExtendReason(e.target.value)}
                    style={{
                      width: "100%",
                      height: 32,
                      borderRadius: "var(--radius-sm)",
                      border: "1px solid var(--line)",
                      background: "var(--surface)",
                      color: "var(--text)",
                      padding: "0 10px",
                      fontSize: 12.5,
                    }}
                  />
                </div>
              </div>

              <div
                style={{
                  padding: "12px 20px",
                  borderTop: "1px solid var(--line)",
                  background: "var(--soft)",
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 8,
                }}
              >
                <button
                  type="button"
                  onClick={() => setExtendTarget(null)}
                  className="secondary-btn"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="primary-btn"
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
            className="table-card"
            style={{
              width: "100%",
              maxWidth: 460,
              padding: 0,
              boxShadow: "var(--modal-shadow)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <form onSubmit={handleRevokeSubmit}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--danger-border)", background: "var(--danger-soft)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <AlertTriangle size={18} color="var(--danger)" />
                  <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "var(--danger)" }}>
                    Revoke Commercial License
                  </h3>
                </div>
                <div style={{ fontSize: 11.5, color: "var(--danger)", marginTop: 2 }}>
                  Serial: <code style={{ fontWeight: 700 }}>{revokeTarget.serial}</code>
                </div>
              </div>

              <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
                <p style={{ margin: 0, fontSize: "12.5px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                  Warning: Revoking this license will immediately lock licensed features and terminate active
                  client socket connections across all registered machines.
                </p>

                <div>
                  <label style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text)", display: "block", marginBottom: 4 }}>
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
                      height: 32,
                      borderRadius: "var(--radius-sm)",
                      border: "1px solid var(--line)",
                      background: "var(--surface)",
                      color: "var(--text)",
                      padding: "0 10px",
                      fontSize: 12.5,
                    }}
                  />
                </div>
              </div>

              <div
                style={{
                  padding: "12px 20px",
                  borderTop: "1px solid var(--line)",
                  background: "var(--soft)",
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 8,
                }}
              >
                <button
                  type="button"
                  onClick={() => setRevokeTarget(null)}
                  className="secondary-btn"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="danger-btn"
                >
                  {isPending ? "Revoking..." : "Confirm Revoke"}
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
            className="table-card"
            style={{
              width: "100%",
              maxWidth: 460,
              padding: 0,
              boxShadow: "var(--modal-shadow)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <form onSubmit={handleRestoreSubmit}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--success-border)", background: "var(--success-soft)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Unlock size={18} color="var(--success)" />
                  <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "var(--success)" }}>
                    Restore License to Active Status
                  </h3>
                </div>
                <div style={{ fontSize: 11.5, color: "var(--success)", marginTop: 2 }}>
                  Serial: <code style={{ fontWeight: 700 }}>{restoreTarget.serial}</code>
                </div>
              </div>

              <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
                <p style={{ margin: 0, fontSize: "12.5px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                  Restoring will re-enable all authorized features for registered client activations.
                </p>

                <div>
                  <label style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text)", display: "block", marginBottom: 4 }}>
                    Restoration Reason / Notes (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Account settled or payment verified"
                    value={restoreReason}
                    onChange={(e) => setRestoreReason(e.target.value)}
                    style={{
                      width: "100%",
                      height: 32,
                      borderRadius: "var(--radius-sm)",
                      border: "1px solid var(--line)",
                      background: "var(--surface)",
                      color: "var(--text)",
                      padding: "0 10px",
                      fontSize: 12.5,
                    }}
                  />
                </div>
              </div>

              <div
                style={{
                  padding: "12px 20px",
                  borderTop: "1px solid var(--line)",
                  background: "var(--soft)",
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 8,
                }}
              >
                <button
                  type="button"
                  onClick={() => setRestoreTarget(null)}
                  className="secondary-btn"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="success-btn"
                >
                  {isPending ? "Restoring..." : "Confirm Restore"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* BAN CLIENT ACTIVATION MODAL (ADMIN ONLY)                                 */}
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
            className="table-card"
            style={{
              width: "100%",
              maxWidth: 460,
              padding: 0,
              boxShadow: "var(--modal-shadow)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <form onSubmit={handleBanClientSubmit}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--danger-border)", background: "var(--danger-soft)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Ban size={18} color="var(--danger)" />
                  <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "var(--danger)" }}>
                    Ban Client Hardware Activation
                  </h3>
                </div>
                <div style={{ fontSize: 11.5, color: "var(--danger)", marginTop: 2 }}>
                  Client ID: <code style={{ fontWeight: 700 }}>{banClientTarget.clientId}</code>
                </div>
              </div>

              <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
                <p style={{ margin: 0, fontSize: "12.5px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                  This specific machine/installation will be barred from communicating with the license server
                  under this license key.
                </p>

                <div>
                  <label style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text)", display: "block", marginBottom: 4 }}>
                    Ban Reason (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Unauthorized hardware deployment or device decommissioned"
                    value={banReason}
                    onChange={(e) => setBanReason(e.target.value)}
                    style={{
                      width: "100%",
                      height: 32,
                      borderRadius: "var(--radius-sm)",
                      border: "1px solid var(--line)",
                      background: "var(--surface)",
                      color: "var(--text)",
                      padding: "0 10px",
                      fontSize: 12.5,
                    }}
                  />
                </div>
              </div>

              <div
                style={{
                  padding: "12px 20px",
                  borderTop: "1px solid var(--line)",
                  background: "var(--soft)",
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 8,
                }}
              >
                <button
                  type="button"
                  onClick={() => setBanClientTarget(null)}
                  className="secondary-btn"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="danger-btn"
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
