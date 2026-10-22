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
      p.slug.toLowerCase().includes(q) ||
      (p.baseUrl && p.baseUrl.toLowerCase().includes(q)) ||
      (p.description && p.description.toLowerCase().includes(q));

    const matchesCategory =
      categoryFilter === "ALL" || p.category === categoryFilter;

    const matchesStatus =
      statusFilter === "ALL" || p.status === statusFilter;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  const connectedCount = plugins.filter((p) => p.status === "CONNECTED").length;
  const disconnectedCount = plugins.length - connectedCount;

  // Handlers
  const handleOpenConnect = (p: PluginItem) => {
    setConnectTarget(p);
    setConnectBaseUrl(p.baseUrl || "https://license.simulcast.com.np");
    setConnectApiKey("");
    setShowApiKey(false);
  };

  const handleConnectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!connectTarget || !isAdmin) return;
    setActionNotice(null);

    const fd = new FormData();
    fd.append("orgId", orgId);
    fd.append("pluginId", connectTarget.id);
    fd.append("apiKey", connectApiKey);
    fd.append("baseUrl", connectBaseUrl);

    startTransition(async () => {
      try {
        await connectPluginWithApiKeyAction(fd);
        setActionNotice({
          type: "success",
          text: `Plugin "${connectTarget.name}" connected and verified successfully!`,
        });
        setConnectTarget(null);
        setConnectApiKey("");
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
    fd.append("name", newName);
    fd.append("slug", newSlug || newName.toLowerCase().replace(/[^a-z0-9]+/g, "-"));
    fd.append("category", newCategory);
    fd.append("baseUrl", newBaseUrl);
    fd.append("allowedDomains", newAllowedDomains);
    fd.append("logoUrl", newLogoUrl);
    fd.append("authType", newAuthType);
    fd.append("apiKey", newApiKey);
    fd.append("description", newDescription);

    startTransition(async () => {
      try {
        await createPluginAction(fd);
        setActionNotice({
          type: "success",
          text: `Plugin "${newName}" created successfully.`,
        });
        setShowCreateModal(false);
        setNewName("");
        setNewSlug("");
        setNewBaseUrl("");
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
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Alert Notice */}
      {actionNotice && (
        <div
          style={{
            padding: "10px 14px",
            borderRadius: "var(--radius-sm)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: actionNotice.type === "success" ? "var(--success-soft)" : "var(--danger-soft)",
            border: `1px solid ${actionNotice.type === "success" ? "var(--success-border)" : "var(--danger-border)"}`,
            color: actionNotice.type === "success" ? "var(--success)" : "var(--danger)",
            fontSize: "12.5px",
            fontWeight: 600,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {actionNotice.type === "success" ? (
              <CheckCircle2 size={16} />
            ) : (
              <AlertCircle size={16} />
            )}
            <span>{actionNotice.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionNotice(null)}
            style={{ color: "inherit", opacity: 0.8 }}
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* Hero Header & Quick Action - Kashtrix Theme */}
      <div
        className="table-card"
        style={{
          padding: "16px 20px",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 14,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 40,
              height: 40,
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
            <Plug size={22} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "var(--text)" }}>
              Plugins &amp; External Integrations Hub
            </h2>
            <p style={{ margin: "2px 0 0", fontSize: "12px", color: "var(--text-muted)" }}>
              Connect third-party microservices, license managers, and payment gateways with API Keys or OAuth.
            </p>
          </div>
        </div>

        <div>
          {isAdmin ? (
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="primary-btn"
            >
              <Plus size={14} />
              <span>Add / Create Plugin</span>
            </button>
          ) : (
            <span className="badge badge-pending">
              <Lock size={12} style={{ marginRight: 4 }} />
              Read-Only User
            </span>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <section className="grid-kpis no-print">
        <div className="kpi-card">
          <div className="kpi-top">
            <span>Total Plugins</span>
            <Layers size={15} color="var(--text-muted)" />
          </div>
          <div className="kpi-value">{plugins.length}</div>
          <div className="kpi-meta">Catalog connectors</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-top">
            <span>Active &amp; Connected</span>
            <CheckCircle2 size={15} color="var(--success)" />
          </div>
          <div className="kpi-value" style={{ color: "var(--success)" }}>
            {connectedCount}
          </div>
          <div className="kpi-meta">Authenticated via API/OAuth</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-top">
            <span>Available / Disconnected</span>
            <Power size={15} color="var(--warning)" />
          </div>
          <div className="kpi-value" style={{ color: disconnectedCount > 0 ? "var(--warning)" : "inherit" }}>
            {disconnectedCount}
          </div>
          <div className="kpi-meta">Ready to connect with key</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-top">
            <span>Auth Protocol</span>
            <KeyRound size={15} color="var(--brand)" />
          </div>
          <div className="kpi-value" style={{ fontSize: "15px" }}>API &amp; OAuth</div>
          <div className="kpi-meta">Zero hardcoding in .env</div>
        </div>
      </section>

      {/* Filter and Search Bar */}
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
        <div style={{ position: "relative", width: "100%", maxWidth: 360 }}>
          <Search
            size={14}
            style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }}
          />
          <input
            type="text"
            placeholder="Search plugins by name, URL, or service..."
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

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: "11.5px", color: "var(--text-muted)", fontWeight: 650 }}>Status:</span>
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
          gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
          gap: 14,
        }}
      >
        {filtered.map((plugin) => {
          const isConnected = plugin.status === "CONNECTED";
          const isLicenseManager = plugin.slug.includes("license") || plugin.name.toLowerCase().includes("license");

          return (
            <div
              key={plugin.id}
              className="table-card"
              style={{
                display: "flex",
                flexDirection: "column",
                padding: 0,
                overflow: "hidden",
                border: isConnected ? "1px solid var(--brand-border)" : "1px solid var(--line)",
              }}
            >
              {/* Card Header */}
              <div
                style={{
                  padding: "14px 16px",
                  borderBottom: "1px solid var(--line)",
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 10,
                  background: isConnected ? "var(--brand-soft)" : "var(--soft)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {plugin.logoUrl ? (
                    <img
                      src={plugin.logoUrl}
                      alt={plugin.name}
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: "var(--radius-sm)",
                        objectFit: "contain",
                        border: "1px solid var(--line)",
                        background: "var(--surface)",
                        padding: 2,
                      }}
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: "var(--radius-sm)",
                        background: "var(--brand)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#fff",
                      }}
                    >
                      {isLicenseManager ? <FileCheck2 size={18} /> : <Plug size={18} />}
                    </div>
                  )}

                  <div>
                    <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "var(--text)" }}>
                      {plugin.name}
                    </h3>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                      <span
                        style={{
                          fontSize: "10px",
                          fontWeight: 700,
                          padding: "1px 5px",
                          borderRadius: 4,
                          background: "var(--soft-hover)",
                          color: "var(--text-secondary)",
                          textTransform: "uppercase",
                        }}
                      >
                        {plugin.category || "INTEGRATION"}
                      </span>
                      <span
                        style={{
                          fontSize: "10px",
                          fontWeight: 600,
                          padding: "1px 5px",
                          borderRadius: 4,
                          background: "var(--soft)",
                          color: "var(--text-muted)",
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
                    className={`badge ${isConnected ? "badge-active" : "badge-cancelled"}`}
                    style={{ fontSize: "10.5px" }}
                  >
                    {isConnected ? "Connected" : "Disconnected"}
                  </span>
                </div>
              </div>

              {/* Card Body */}
              <div style={{ padding: "14px 16px", flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                <p style={{ margin: 0, fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                  {plugin.description || "External service connector and API synchronizer."}
                </p>

                {plugin.baseUrl && (
                  <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "auto" }}>
                    Endpoint: <code style={{ color: "var(--brand)", fontWeight: 600 }}>{plugin.baseUrl}</code>
                  </div>
                )}
              </div>

              {/* Card Actions Footer */}
              <div
                style={{
                  padding: "10px 16px",
                  borderTop: "1px solid var(--line)",
                  background: "var(--soft)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                }}
              >
                <div>
                  {isConnected && isLicenseManager ? (
                    <Link
                      href={`/${orgId}/licenses`}
                      className="primary-btn"
                      style={{ height: 28, fontSize: "11px", padding: "0 8px" }}
                    >
                      <span>Open License Suite</span>
                      <ExternalLink size={12} />
                    </Link>
                  ) : null}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {isAdmin ? (
                    <>
                      {isConnected ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleOpenConnect(plugin)}
                            className="secondary-btn"
                            style={{ height: 28, fontSize: "11px", padding: "0 8px" }}
                            title="Update API Key or Endpoint"
                          >
                            <Settings size={12} />
                            <span>Config</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDisconnect(plugin.id, plugin.name)}
                            disabled={isPending}
                            className="danger-btn"
                            style={{ height: 28, fontSize: "11px", padding: "0 8px" }}
                          >
                            Disconnect
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleOpenConnect(plugin)}
                          className="primary-btn"
                          style={{ height: 28, fontSize: "11px", padding: "0 8px" }}
                        >
                          <KeyRound size={12} />
                          <span>Use API Key &amp; Connect</span>
                        </button>
                      )}

                      {plugin.slug !== "kashtrix-license-manager" && (
                        <button
                          type="button"
                          onClick={() => handleDelete(plugin.id, plugin.name)}
                          style={{
                            background: "none",
                            border: "none",
                            color: "var(--text-muted)",
                            cursor: "pointer",
                            padding: 4,
                          }}
                          title="Delete Plugin"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </>
                  ) : (
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Admin required</span>
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
            className="table-card"
            style={{
              width: "100%",
              maxWidth: 460,
              padding: 0,
              boxShadow: "var(--modal-shadow)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <form onSubmit={handleConnectSubmit}>
              <div
                style={{
                  padding: "16px 20px",
                  borderBottom: "1px solid var(--line)",
                  background: "var(--soft)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "var(--text)" }}>
                    Connect {connectTarget.name}
                  </h3>
                  <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 2 }}>
                    Provide API Key credentials to authenticate this service.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setConnectTarget(null)}
                  style={{ color: "var(--text-muted)" }}
                >
                  <X size={16} />
                </button>
              </div>

              <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={{ fontSize: 11.5, fontWeight: 650, color: "var(--text)", display: "block", marginBottom: 4 }}>
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
                  <label style={{ fontSize: 11.5, fontWeight: 650, color: "var(--text)", display: "block", marginBottom: 4 }}>
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
                        height: 32,
                        borderRadius: "var(--radius-sm)",
                        border: "1px solid var(--line)",
                        background: "var(--surface)",
                        color: "var(--text)",
                        padding: "0 34px 0 10px",
                        fontSize: 12.5,
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
                        color: "var(--text-muted)",
                      }}
                    >
                      {showApiKey ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: 4 }}>
                    The API Key is securely stored for this organization.
                  </div>
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
                  onClick={() => setConnectTarget(null)}
                  className="secondary-btn"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="primary-btn"
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
            className="table-card"
            style={{
              width: "100%",
              maxWidth: 500,
              padding: 0,
              boxShadow: "var(--modal-shadow)",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <form onSubmit={handleCreateSubmit}>
              <div
                style={{
                  padding: "16px 20px",
                  borderTop: 0,
                  borderBottom: "1px solid var(--line)",
                  background: "var(--soft)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "var(--text)" }}>
                    Create / Add Plugin Connector
                  </h3>
                  <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 2 }}>
                    Add a new microservice, license engine, or payment gateway.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={{ color: "var(--text-muted)" }}
                >
                  <X size={16} />
                </button>
              </div>

              <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11.5, fontWeight: 650, color: "var(--text)", display: "block", marginBottom: 4 }}>
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

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 11.5, fontWeight: 650, color: "var(--text)", display: "block", marginBottom: 4 }}>
                      Category
                    </label>
                    <select
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      style={{
                        width: "100%",
                        height: 32,
                        borderRadius: "var(--radius-sm)",
                        border: "1px solid var(--line)",
                        background: "var(--surface)",
                        color: "var(--text)",
                        padding: "0 8px",
                        fontSize: 12,
                      }}
                    >
                      <option value="SECURITY_LICENSING">Security &amp; Licensing</option>
                      <option value="PAYMENT_GATEWAY">Payment Gateway</option>
                      <option value="NETWORK_AAA">Network &amp; RADIUS</option>
                      <option value="CRM_COMMUNICATION">CRM &amp; Telephony</option>
                      <option value="GENERAL">General Tool</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: 11.5, fontWeight: 650, color: "var(--text)", display: "block", marginBottom: 4 }}>
                      Auth Type *
                    </label>
                    <select
                      value={newAuthType}
                      onChange={(e) => setNewAuthType(e.target.value as any)}
                      style={{
                        width: "100%",
                        height: 32,
                        borderRadius: "var(--radius-sm)",
                        border: "1px solid var(--line)",
                        background: "var(--surface)",
                        color: "var(--text)",
                        padding: "0 8px",
                        fontSize: 12,
                      }}
                    >
                      <option value="API_KEY">API (API Key / Token)</option>
                      <option value="OAUTH">OAuth 2.0</option>
                      <option value="LOGIN">Login (User &amp; Pass)</option>
                      <option value="NONE">None / Public API</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: 11.5, fontWeight: 650, color: "var(--text)", display: "block", marginBottom: 4 }}>
                    Base URL / Domain Endpoint
                  </label>
                  <input
                    type="url"
                    placeholder="https://license.simulcast.com.np"
                    value={newBaseUrl}
                    onChange={(e) => setNewBaseUrl(e.target.value)}
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

                {newAuthType === "API_KEY" && (
                  <div>
                    <label style={{ fontSize: 11.5, fontWeight: 650, color: "var(--text)", display: "block", marginBottom: 4 }}>
                      API Key (Can also connect later)
                    </label>
                    <input
                      type="password"
                      placeholder="e.g. KTX_LzxJHUeIfpTcNO8LAvHNaYBQSFqHkLz5"
                      value={newApiKey}
                      onChange={(e) => setNewApiKey(e.target.value)}
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
                )}

                <div>
                  <label style={{ fontSize: 11.5, fontWeight: 650, color: "var(--text)", display: "block", marginBottom: 4 }}>
                    Description
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Brief description of the service and tools provided..."
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    style={{
                      width: "100%",
                      borderRadius: "var(--radius-sm)",
                      border: "1px solid var(--line)",
                      background: "var(--surface)",
                      color: "var(--text)",
                      padding: "6px 10px",
                      fontSize: 12,
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
                  onClick={() => setShowCreateModal(false)}
                  className="secondary-btn"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="primary-btn"
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
