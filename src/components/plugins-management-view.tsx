"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import {
  Plug,
  Plus,
  KeyRound,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Lock,
  Unlock,
  Settings,
  Power,
  Trash2,
  Server,
  Globe,
  RefreshCw,
  Layers,
  CreditCard,
  Radio,
  Search,
  X,
  Eye,
  EyeOff,
  Check,
  Building2,
  FileCheck2,
} from "lucide-react";
import {
  createPluginAction,
  connectPluginWithApiKeyAction,
  disconnectPluginAction,
  togglePluginAction,
  deletePluginAction,
} from "@/app/(dashboard)/actions";

export interface PluginItem {
  id: string;
  name: string;
  slug: string;
  category: string | null;
  description: string | null;
  logoUrl: string | null;
  baseUrl: string | null;
  allowedDomains: string | null;
  authType: "API_KEY" | "OAUTH" | "LOGIN" | "NONE" | string;
  apiKey?: string | null;
  status: "CONNECTED" | "DISCONNECTED" | "CONFIGURED" | string;
  lastSyncAt: Date | string | null;
  lastError: string | null;
  metadata: string | null;
  isEnabled: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
}

interface PluginsManagementViewProps {
  plugins: PluginItem[];
  isAdmin: boolean;
  orgId: string;
}

export function PluginsManagementView({
  plugins,
  isAdmin,
  orgId,
}: PluginsManagementViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [connectTarget, setConnectTarget] = useState<PluginItem | null>(null);
  const [connectApiKey, setConnectApiKey] = useState("");
  const [connectBaseUrl, setConnectBaseUrl] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);

  // New Plugin Form State
  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [newCategory, setNewCategory] = useState("SECURITY_LICENSING");
  const [newBaseUrl, setNewBaseUrl] = useState("");
  const [newAllowedDomains, setNewAllowedDomains] = useState("");
  const [newLogoUrl, setNewLogoUrl] = useState("");
  const [newAuthType, setNewAuthType] = useState<"API_KEY" | "OAUTH" | "LOGIN" | "NONE">("API_KEY");
  const [newApiKey, setNewApiKey] = useState("");
  const [newDescription, setNewDescription] = useState("");

  const [isPending, startTransition] = useTransition();
  const [actionNotice, setActionNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Filter plugins
  const filtered = plugins.filter((p) => {
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      !searchTerm ||
      p.name.toLowerCase().includes(q) ||
      (p.description && p.description.toLowerCase().includes(q)) ||
      (p.baseUrl && p.baseUrl.toLowerCase().includes(q));

    const matchesCategory = categoryFilter === "ALL" || p.category === categoryFilter;
    const matchesStatus = statusFilter === "ALL" || p.status === statusFilter;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  const connectedCount = plugins.filter((p) => p.status === "CONNECTED").length;
  const disconnectedCount = plugins.filter((p) => p.status !== "CONNECTED").length;

  const handleOpenConnect = (p: PluginItem) => {
    setConnectTarget(p);
    setConnectBaseUrl(p.baseUrl || "https://license.simulcast.com.np");
    setConnectApiKey(p.apiKey || "");
    setShowApiKey(false);
    setActionNotice(null);
  };

  const handleConnectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!connectTarget || !isAdmin) return;
    setActionNotice(null);

    const fd = new FormData();
    fd.append("orgId", orgId);
    fd.append("pluginId", connectTarget.id);
    fd.append("apiKey", connectApiKey.trim());
    fd.append("baseUrl", connectBaseUrl.trim());

    startTransition(async () => {
      try {
        await connectPluginWithApiKeyAction(fd);
        setActionNotice({
          type: "success",
          text: `Plugin "${connectTarget.name}" connected and authenticated successfully!`,
        });
        setConnectTarget(null);
      } catch (err: any) {
        setActionNotice({
          type: "error",
          text: err.message || "Failed to connect plugin",
        });
      }
    });
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    setActionNotice(null);

    const fd = new FormData();
    fd.append("orgId", orgId);
    fd.append("name", newName.trim());
    fd.append("slug", newSlug.trim());
    fd.append("category", newCategory);
    fd.append("baseUrl", newBaseUrl.trim());
    fd.append("allowedDomains", newAllowedDomains.trim());
    fd.append("logoUrl", newLogoUrl.trim());
    fd.append("authType", newAuthType);
    fd.append("apiKey", newApiKey.trim());
    fd.append("description", newDescription.trim());

    startTransition(async () => {
      try {
        await createPluginAction(fd);
        setActionNotice({
          type: "success",
          text: `Plugin "${newName}" created and registered successfully!`,
        });
        setShowCreateModal(false);
        // Reset form
        setNewName("");
        setNewSlug("");
        setNewBaseUrl("");
        setNewAllowedDomains("");
        setNewLogoUrl("");
        setNewApiKey("");
        setNewDescription("");
      } catch (err: any) {
        setActionNotice({
          type: "error",
          text: err.message || "Failed to create plugin",
        });
      }
    });
  };

  const handleDisconnect = (pluginId: string, name: string) => {
    if (!isAdmin) return;
    if (!confirm(`Are you sure you want to disconnect ${name}? API requests will be paused.`)) return;

    const fd = new FormData();
    fd.append("orgId", orgId);
    fd.append("pluginId", pluginId);

    startTransition(async () => {
      try {
        await disconnectPluginAction(fd);
        setActionNotice({
          type: "success",
          text: `Plugin "${name}" disconnected.`,
        });
      } catch (err: any) {
        setActionNotice({
          type: "error",
          text: err.message || "Failed to disconnect plugin",
        });
      }
    });
  };

  const handleDelete = (pluginId: string, name: string) => {
    if (!isAdmin) return;
    if (!confirm(`Are you sure you want to delete plugin "${name}"? This action cannot be undone.`)) return;

    const fd = new FormData();
    fd.append("orgId", orgId);
    fd.append("pluginId", pluginId);

    startTransition(async () => {
      try {
        await deletePluginAction(fd);
        setActionNotice({
          type: "success",
          text: `Plugin "${name}" deleted.`,
        });
      } catch (err: any) {
        setActionNotice({
          type: "error",
          text: err.message || "Failed to delete plugin",
        });
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Alert Notice */}
      {actionNotice && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: 8,
            marginBottom: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: actionNotice.type === "success" ? "#ecfdf5" : "#fef2f2",
            border: `1px solid ${actionNotice.type === "success" ? "#a7f3d0" : "#fecaca"}`,
            color: actionNotice.type === "success" ? "#065f46" : "#991b1b",
            fontSize: "13.5px",
            fontWeight: 500,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {actionNotice.type === "success" ? (
              <CheckCircle2 size={18} color="#059669" />
            ) : (
              <AlertCircle size={18} color="#dc2626" />
            )}
            <span>{actionNotice.text}</span>
          </div>
          <button
            onClick={() => setActionNotice(null)}
            style={{ background: "none", border: "none", cursor: "pointer", color: "inherit" }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Hero Header & Quick Action */}
      <div
        style={{
          background: "linear-gradient(135deg, rgba(30, 41, 59, 0.96), rgba(15, 23, 42, 0.98))",
          borderRadius: 14,
          padding: "22px 26px",
          color: "#f8fafc",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.2)",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: "linear-gradient(135deg, #a855f7, #7c3aed)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              boxShadow: "0 4px 14px rgba(168, 85, 247, 0.4)",
            }}
          >
            <Plug size={24} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 700, letterSpacing: "-0.01em" }}>
              Plugins & External Integrations Hub
            </h2>
            <p style={{ margin: "4px 0 0", fontSize: "12.5px", color: "#94a3b8" }}>
              Connect third-party microservices, commercial license managers, RADIUS engines, and payment gateways with API Keys or OAuth.
            </p>
          </div>
        </div>

        <div>
          {isAdmin ? (
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="primary-btn"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                background: "#9333ea",
                fontSize: 13,
                height: 36,
                padding: "0 14px",
              }}
            >
              <Plus size={15} />
              <span>Add / Create Plugin</span>
            </button>
          ) : (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 12px",
                borderRadius: 6,
                background: "rgba(255, 255, 255, 0.08)",
                fontSize: 12,
                color: "#94a3b8",
              }}
            >
              <Lock size={13} />
              <span>Read-Only User</span>
            </span>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <section className="grid-kpis no-print">
        <div className="kpi-card">
          <div className="kpi-top">
            <span>Total Plugins</span>
            <Layers size={16} color="#64748b" />
          </div>
          <div className="kpi-value">{plugins.length}</div>
          <div className="kpi-meta">Catalog connectors</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-top">
            <span>Active & Connected</span>
            <CheckCircle2 size={16} color="#10b981" />
          </div>
          <div className="kpi-value" style={{ color: "#059669" }}>
            {connectedCount}
          </div>
          <div className="kpi-meta">Authenticated via API/OAuth</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-top">
            <span>Available / Disconnected</span>
            <Power size={16} color="#f59e0b" />
          </div>
          <div className="kpi-value" style={{ color: disconnectedCount > 0 ? "#d97706" : "inherit" }}>
            {disconnectedCount}
          </div>
          <div className="kpi-meta">Ready to connect with key</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-top">
            <span>Auth Protocol</span>
            <KeyRound size={16} color="#a855f7" />
          </div>
          <div className="kpi-value">API & OAuth</div>
          <div className="kpi-meta">Zero hardcoding in .env</div>
        </div>
      </section>

      {/* Filter and Search Bar */}
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
        <div style={{ position: "relative", width: "100%", maxWidth: 360 }}>
          <Search
            size={15}
            style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }}
          />
          <input
            type="text"
            placeholder="Search plugins by name, URL, or service..."
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

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: "12px", color: "#64748b", fontWeight: 500 }}>Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ height: 34, padding: "0 8px", fontSize: 12.5, borderRadius: 6, border: "1px solid #cbd5e1" }}
            >
              <option value="ALL">All ({plugins.length})</option>
              <option value="CONNECTED">Connected ({connectedCount})</option>
              <option value="DISCONNECTED">Disconnected ({disconnectedCount})</option>
            </select>
          </div>
        </div>
      </div>

      {/* Plugins Grid Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
          gap: 18,
        }}
      >
        {filtered.map((plugin) => {
          const isConnected = plugin.status === "CONNECTED";
          const isLicenseManager = plugin.slug.includes("license") || plugin.name.toLowerCase().includes("license");

          return (
            <div
              key={plugin.id}
              style={{
                background: "#ffffff",
                borderRadius: 12,
                border: isConnected ? "1px solid #a7f3d0" : "1px solid #e2e8f0",
                boxShadow: isConnected
                  ? "0 4px 15px -2px rgba(16, 185, 129, 0.12)"
                  : "0 2px 8px -2px rgba(0, 0, 0, 0.05)",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                transition: "transform 0.15s ease, box-shadow 0.15s ease",
              }}
            >
              {/* Card Header */}
              <div
                style={{
                  padding: "16px 18px",
                  borderBottom: "1px solid #f1f5f9",
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 12,
                  background: isConnected ? "#f0fdf4" : "#f8fafc",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  {plugin.logoUrl ? (
                    <img
                      src={plugin.logoUrl}
                      alt={plugin.name}
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 8,
                        objectFit: "contain",
                        border: "1px solid #e2e8f0",
                        background: "#fff",
                        padding: 2,
                      }}
                      onError={(e) => {
                        // Fallback icon on image load failure
                        (e.target as HTMLElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 8,
                        background: isLicenseManager ? "#0284c7" : "#8b5cf6",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#fff",
                      }}
                    >
                      {isLicenseManager ? <FileCheck2 size={20} /> : <Plug size={20} />}
                    </div>
                  )}

                  <div>
                    <h3 style={{ margin: 0, fontSize: "14.5px", fontWeight: 700, color: "#0f172a" }}>
                      {plugin.name}
                    </h3>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
                      <span
                        style={{
                          fontSize: "10.5px",
                          fontWeight: 700,
                          padding: "1px 6px",
                          borderRadius: 4,
                          background: "#e2e8f0",
                          color: "#475569",
                          textTransform: "uppercase",
                        }}
                      >
                        {plugin.category || "INTEGRATION"}
                      </span>
                      <span
                        style={{
                          fontSize: "10.5px",
                          fontWeight: 600,
                          padding: "1px 6px",
                          borderRadius: 4,
                          background: "#f1f5f9",
                          color: "#64748b",
                        }}
                      >
                        {plugin.authType === "API_KEY" ? "API KEY" : plugin.authType}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Status Dot */}
                <div style={{ textAlign: "right" }}>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      padding: "2px 8px",
                      borderRadius: 20,
                      fontSize: "11px",
                      fontWeight: 600,
                      background: isConnected ? "#ecfdf5" : "#f1f5f9",
                      color: isConnected ? "#047857" : "#64748b",
                      border: `1px solid ${isConnected ? "#a7f3d0" : "#cbd5e1"}`,
                    }}
                  >
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: isConnected ? "#10b981" : "#94a3b8",
                        boxShadow: isConnected ? "0 0 6px #10b981" : "none",
                      }}
                    />
                    {isConnected ? "Connected" : "Disconnected"}
                  </span>
                </div>
              </div>

              {/* Card Body */}
              <div style={{ padding: "16px 18px", flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
                <p style={{ margin: 0, fontSize: "12.5px", color: "#475569", lineHeight: 1.5 }}>
                  {plugin.description || "External service connector and API synchronizer."}
                </p>

                {plugin.baseUrl && (
                  <div style={{ fontSize: "11.5px", color: "#64748b", marginTop: "auto" }}>
                    Endpoint: <code style={{ color: "#0284c7", fontWeight: 600 }}>{plugin.baseUrl}</code>
                  </div>
                )}

                {isConnected && plugin.metadata && (
                  <div
                    style={{
                      fontSize: "11px",
                      padding: "6px 8px",
                      borderRadius: 6,
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      color: "#334155",
                    }}
                  >
                    Key verified online · Active
                  </div>
                )}
              </div>

              {/* Card Actions Footer */}
              <div
                style={{
                  padding: "12px 18px",
                  borderTop: "1px solid #f1f5f9",
                  background: "#f8fafc",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                }}
              >
                {/* Left Action: Open Connected Tool */}
                <div>
                  {isConnected && isLicenseManager ? (
                    <Link
                      href={`/${orgId}/licenses`}
                      className="primary-btn"
                      style={{
                        fontSize: 11.5,
                        height: 28,
                        padding: "0 10px",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        background: "#0284c7",
                      }}
                    >
                      <span>Open License Suite</span>
                      <ExternalLink size={12} />
                    </Link>
                  ) : null}
                </div>

                {/* Right Action: Connect / Settings */}
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {isAdmin ? (
                    <>
                      {isConnected ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleOpenConnect(plugin)}
                            className="secondary-btn"
                            style={{ fontSize: 11.5, height: 28, padding: "0 8px" }}
                            title="Update API Key or Endpoint"
                          >
                            <Settings size={13} />
                            <span>Config</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDisconnect(plugin.id, plugin.name)}
                            disabled={isPending}
                            style={{
                              fontSize: 11.5,
                              height: 28,
                              padding: "0 8px",
                              borderRadius: 6,
                              background: "#fef2f2",
                              color: "#b91c1c",
                              border: "1px solid #fecaca",
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                          >
                            Disconnect
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleOpenConnect(plugin)}
                          className="primary-btn"
                          style={{
                            fontSize: 11.5,
                            height: 28,
                            padding: "0 10px",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5,
                            background: "#059669",
                          }}
                        >
                          <KeyRound size={13} />
                          <span>Use API Key & Connect</span>
                        </button>
                      )}

                      {/* Delete Custom Plugin button if not core */}
                      {plugin.slug !== "kashtrix-license-manager" && (
                        <button
                          type="button"
                          onClick={() => handleDelete(plugin.id, plugin.name)}
                          style={{
                            background: "none",
                            border: "none",
                            color: "#94a3b8",
                            cursor: "pointer",
                            padding: 4,
                          }}
                          title="Delete Plugin"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </>
                  ) : (
                    <span style={{ fontSize: 11, color: "#94a3b8" }}>Admin required</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* USE API KEY & CONNECT MODAL                                              */}
      {/* ========================================================================= */}
      {connectTarget && (
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
          onClick={() => setConnectTarget(null)}
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
            <form onSubmit={handleConnectSubmit}>
              <div
                style={{
                  padding: "18px 22px",
                  borderBottom: "1px solid #e2e8f0",
                  background: "#f8fafc",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#0f172a" }}>
                    Connect {connectTarget.name}
                  </h3>
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                    Provide API Key credentials to authenticate this service.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setConnectTarget(null)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}
                >
                  <X size={18} />
                </button>
              </div>

              <div style={{ padding: 22, display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#334155", display: "block", marginBottom: 6 }}>
                    Endpoint / Base URL
                  </label>
                  <input
                    type="url"
                    required
                    placeholder="https://license.simulcast.com.np"
                    value={connectBaseUrl}
                    onChange={(e) => setConnectBaseUrl(e.target.value)}
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
                    API Key / Secret Token
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      type={showApiKey ? "text" : "password"}
                      required
                      placeholder="e.g. KTX_LzxJHUeIfpTcNO8LAvHNaYBQSFqHkLz5"
                      value={connectApiKey}
                      onChange={(e) => setConnectApiKey(e.target.value)}
                      style={{
                        width: "100%",
                        height: 36,
                        borderRadius: 6,
                        border: "1px solid #cbd5e1",
                        padding: "0 36px 0 10px",
                        fontSize: 13,
                        fontFamily: showApiKey ? "monospace" : "inherit",
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      style={{
                        position: "absolute",
                        right: 8,
                        top: "50%",
                        transform: "translateY(-50%)",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "#94a3b8",
                      }}
                    >
                      {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <div style={{ fontSize: "11px", color: "#64748b", marginTop: 4 }}>
                    The API Key is stored securely in the database for your workspace and tested online.
                  </div>
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
                  onClick={() => setConnectTarget(null)}
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
                  {isPending ? "Connecting..." : "Test & Connect Plugin"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CREATE NEW PLUGIN MODAL                                                  */}
      {/* ========================================================================= */}
      {showCreateModal && (
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
          onClick={() => setShowCreateModal(false)}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 14,
              width: "100%",
              maxWidth: 540,
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
              border: "1px solid #cbd5e1",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <form onSubmit={handleCreateSubmit}>
              <div
                style={{
                  padding: "18px 22px",
                  borderBottom: "1px solid #e2e8f0",
                  background: "#f8fafc",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#0f172a" }}>
                    Create / Add Plugin Connector
                  </h3>
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                    Add a new microservice, license engine, payment gateway, or webhook.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}
                >
                  <X size={18} />
                </button>
              </div>

              <div style={{ padding: 22, display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#334155", display: "block", marginBottom: 5 }}>
                    Plugin Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Kashtrix License Manager, MikroTik CCR, eSewa"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
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

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#334155", display: "block", marginBottom: 5 }}>
                      Category
                    </label>
                    <select
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      style={{
                        width: "100%",
                        height: 36,
                        borderRadius: 6,
                        border: "1px solid #cbd5e1",
                        padding: "0 8px",
                        fontSize: 12.5,
                      }}
                    >
                      <option value="SECURITY_LICENSING">Security & Licensing</option>
                      <option value="PAYMENT_GATEWAY">Payment Gateway</option>
                      <option value="NETWORK_AAA">Network & RADIUS</option>
                      <option value="NETWORK_INFRASTRUCTURE">Network Hardware</option>
                      <option value="CRM_COMMUNICATION">CRM & Telephony</option>
                      <option value="GENERAL">General Tool</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#334155", display: "block", marginBottom: 5 }}>
                      Auth Type *
                    </label>
                    <select
                      value={newAuthType}
                      onChange={(e) => setNewAuthType(e.target.value as any)}
                      style={{
                        width: "100%",
                        height: 36,
                        borderRadius: 6,
                        border: "1px solid #cbd5e1",
                        padding: "0 8px",
                        fontSize: 12.5,
                      }}
                    >
                      <option value="API_KEY">API (API Key / Token)</option>
                      <option value="OAUTH">OAuth 2.0</option>
                      <option value="LOGIN">Login (User & Pass)</option>
                      <option value="NONE">None / Public API</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#334155", display: "block", marginBottom: 5 }}>
                    Base URL / Domain Endpoint
                  </label>
                  <input
                    type="url"
                    placeholder="https://license.simulcast.com.np"
                    value={newBaseUrl}
                    onChange={(e) => setNewBaseUrl(e.target.value)}
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
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#334155", display: "block", marginBottom: 5 }}>
                    Logo URL (Optional)
                  </label>
                  <input
                    type="url"
                    placeholder="https://example.com/logo.png"
                    value={newLogoUrl}
                    onChange={(e) => setNewLogoUrl(e.target.value)}
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

                {newAuthType === "API_KEY" && (
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#334155", display: "block", marginBottom: 5 }}>
                      API Key (Can also connect later)
                    </label>
                    <input
                      type="password"
                      placeholder="e.g. KTX_LzxJHUeIfpTcNO8LAvHNaYBQSFqHkLz5"
                      value={newApiKey}
                      onChange={(e) => setNewApiKey(e.target.value)}
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
                )}

                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#334155", display: "block", marginBottom: 5 }}>
                    Description
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Brief description of the service and tools provided..."
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    style={{
                      width: "100%",
                      borderRadius: 6,
                      border: "1px solid #cbd5e1",
                      padding: "8px 10px",
                      fontSize: 12.5,
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
                  onClick={() => setShowCreateModal(false)}
                  className="secondary-btn"
                  style={{ fontSize: 12.5, height: 34 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="primary-btn"
                  style={{ fontSize: 12.5, height: 34, background: "#9333ea" }}
                >
                  {isPending ? "Creating..." : "Create & Add Plugin"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
