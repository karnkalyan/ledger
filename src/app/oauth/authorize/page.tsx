"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  ShieldCheck,
  Building2,
  Lock,
  ArrowRight,
  CheckCircle2,
  Key,
  Bot,
  Sparkles,
  AlertCircle,
  Loader2,
  XCircle,
  Home,
} from "lucide-react";

interface UserOrg {
  id: string;
  name: string;
  slug: string;
  kind: string;
  role: string;
}

interface ActiveSessionData {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  organizations: UserOrg[];
}

function OAuthAuthorizeContent() {
  const searchParams = useSearchParams();
  const redirectUri = searchParams.get("redirect_uri") || "";
  const state = searchParams.get("state") || "";
  const clientId = searchParams.get("client_id") || "ChatGPT";
  const scope = searchParams.get("scope") || "mcp:all";
  const codeChallenge = searchParams.get("code_challenge") || "";

  const [authMode, setAuthMode] = useState<"login" | "key">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [selectedOrgId, setSelectedOrgId] = useState("");
  const [activeSession, setActiveSession] = useState<ActiveSessionData | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if user is already logged into Kashtrix ERP in this browser
  useEffect(() => {
    fetch("/api/oauth/session")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.authenticated && data?.user) {
          setActiveSession(data);
          if (data.organizations?.length > 0) {
            setSelectedOrgId(data.organizations[0].id);
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoadingSession(false));
  }, []);

  const handleAuthorize = async (e?: React.FormEvent, useSession = false) => {
    if (e) e.preventDefault();
    setError(null);

    if (!redirectUri) {
      setError("Missing redirect_uri in OAuth authorization request.");
      return;
    }

    setSubmitting(true);

    try {
      const payload: Record<string, string> = {
        redirectUri,
        state,
        codeChallenge,
        scope,
        orgId: selectedOrgId,
      };

      if (!useSession) {
        if (authMode === "login") {
          if (!email || !password) {
            throw new Error("Please enter your account email and password.");
          }
          payload.email = email;
          payload.password = password;
        } else {
          if (!apiKey) {
            throw new Error("Please enter your MCP Master Key.");
          }
          payload.apiKey = apiKey;
        }
      }

      const res = await fetch("/api/oauth/authorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Authorization failed.");
      }

      // Redirect browser back to ChatGPT / OAuth client with code & state
      window.location.href = data.redirectUrl;
    } catch (err: any) {
      setError(err.message || "Failed to authorize application.");
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (redirectUri) {
      const target = new URL(redirectUri);
      target.searchParams.set("error", "access_denied");
      target.searchParams.set("error_description", "User rejected authorization");
      if (state) target.searchParams.set("state", state);
      window.location.href = target.toString();
    } else {
      window.close();
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "radial-gradient(ellipse at top, #2b0840 0%, #0f172a 100%)",
        padding: "20px 16px",
        fontFamily: "var(--font-sans, system-ui, -apple-system, sans-serif)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 480,
          background: "#ffffff",
          borderRadius: 20,
          boxShadow: "0 25px 60px -15px rgba(0, 0, 0, 0.5)",
          overflow: "hidden",
          border: "1px solid rgba(255, 255, 255, 0.15)",
        }}
      >
        {/* Header Banner */}
        <div
          style={{
            padding: "28px 24px 22px",
            background: "linear-gradient(135deg, #4a086b 0%, #ef086f 100%)",
            color: "#ffffff",
            textAlign: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
              marginBottom: 14,
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                background: "rgba(255, 255, 255, 0.2)",
                backdropFilter: "blur(8px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <img
                src="/logo-mark.png"
                alt="Kashtrix Logo"
                style={{ width: 34, height: 34, objectFit: "contain" }}
              />
            </div>
            <ArrowRight size={18} style={{ opacity: 0.8 }} />
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                background: "rgba(255, 255, 255, 0.2)",
                backdropFilter: "blur(8px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Bot size={26} color="#ffffff" />
            </div>
          </div>

          <h2 style={{ margin: "0 0 6px", fontSize: 21, fontWeight: 800, letterSpacing: "-0.02em" }}>
            Connect {clientId} to Kashtrix ERP
          </h2>
          <p style={{ margin: 0, fontSize: 13, opacity: 0.92, lineHeight: 1.45 }}>
            Sign in to authorize <strong>{clientId}</strong> to access your financial ledger, accounts, and bank tools.
          </p>
        </div>

        {/* Content Body */}
        <div style={{ padding: 24 }}>
          {error && (
            <div
              style={{
                padding: "10px 14px",
                borderRadius: 8,
                background: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#dc2626",
                fontSize: 12.5,
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 16,
              }}
            >
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* Permissions requested strip */}
          <div
            style={{
              padding: "12px 14px",
              borderRadius: 10,
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              fontSize: 12,
              color: "#475569",
              marginBottom: 18,
            }}
          >
            <div
              style={{
                fontWeight: 700,
                color: "#0f172a",
                marginBottom: 6,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <ShieldCheck size={14} color="#059669" />
              <span>Requested Ledger Permissions:</span>
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6 }}>
              <li>List Bank Accounts, balances & transactions</li>
              <li>Extract statements & record journal entries</li>
              <li>Manage Invoices, Expenses, Purchases, and Incomes</li>
              <li>Read real-time financial KPI summaries</li>
            </ul>
          </div>

          {/* Active Session Detected Banner */}
          {activeSession && (
            <div
              style={{
                background: "rgba(74, 8, 107, 0.05)",
                border: "1px solid rgba(74, 8, 107, 0.2)",
                borderRadius: 12,
                padding: "14px 16px",
                marginBottom: 18,
                textAlign: "center",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 4 }}>
                <CheckCircle2 size={16} color="#059669" />
                <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>
                  Signed in as {activeSession.user.name} ({activeSession.user.email})
                </span>
              </div>
              <div style={{ fontSize: 11.5, color: "#64748b", marginBottom: 10 }}>
                Role: {activeSession.user.role} · Authorized Organization Access
              </div>

              {activeSession.organizations.length > 1 && (
                <div style={{ textAlign: "left", marginBottom: 10 }}>
                  <label style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: "#334155", marginBottom: 4 }}>
                    Select Organization / Workspace:
                  </label>
                  <select
                    value={selectedOrgId}
                    onChange={(e) => setSelectedOrgId(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: 6,
                      border: "1px solid #cbd5e1",
                      fontSize: 12.5,
                      background: "#ffffff",
                    }}
                  >
                    {activeSession.organizations.map((org) => (
                      <option key={org.id} value={org.id}>
                        {org.name} ({org.kind === "COMPANY" ? "Company" : "Household"})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                <button
                  type="button"
                  onClick={() => handleAuthorize(undefined, true)}
                  disabled={submitting}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 8,
                    border: "none",
                    background: "linear-gradient(135deg, #4a086b 0%, #ef086f 100%)",
                    color: "#ffffff",
                    fontSize: 12.5,
                    fontWeight: 700,
                    cursor: submitting ? "not-allowed" : "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  {submitting ? <Loader2 size={14} className="spin" /> : <CheckCircle2 size={14} />}
                  <span>Authorize As {activeSession.user.name.split(" ")[0]}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSession(null)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#64748b",
                    fontSize: 11.5,
                    textDecoration: "underline",
                    cursor: "pointer",
                  }}
                >
                  Use different account
                </button>
              </div>
            </div>
          )}

          {/* Form to login and authorize if no active session or switching account */}
          {!activeSession && !loadingSession && (
            <div>
              {/* Tab Selector: Account Login vs Master Key */}
              <div
                style={{
                  display: "flex",
                  gap: 6,
                  background: "#f1f5f9",
                  padding: 3,
                  borderRadius: 10,
                  marginBottom: 16,
                }}
              >
                <button
                  type="button"
                  onClick={() => setAuthMode("login")}
                  style={{
                    flex: 1,
                    padding: "7px 10px",
                    fontSize: 12.5,
                    fontWeight: 700,
                    borderRadius: 7,
                    border: "none",
                    cursor: "pointer",
                    background: authMode === "login" ? "#ffffff" : "transparent",
                    color: authMode === "login" ? "#4a086b" : "#64748b",
                    boxShadow: authMode === "login" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                    transition: "all 0.15s ease",
                  }}
                >
                  Kashtrix User Login
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMode("key")}
                  style={{
                    flex: 1,
                    padding: "7px 10px",
                    fontSize: 12.5,
                    fontWeight: 700,
                    borderRadius: 7,
                    border: "none",
                    cursor: "pointer",
                    background: authMode === "key" ? "#ffffff" : "transparent",
                    color: authMode === "key" ? "#4a086b" : "#64748b",
                    boxShadow: authMode === "key" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                    transition: "all 0.15s ease",
                  }}
                >
                  Master MCP Key
                </button>
              </div>

              <form onSubmit={(e) => handleAuthorize(e, false)} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {authMode === "login" ? (
                  <>
                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 5 }}>
                        Account Email
                      </label>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="admin@simulcast.local"
                        style={{
                          width: "100%",
                          padding: "10px 12px",
                          borderRadius: 8,
                          border: "1px solid #cbd5e1",
                          fontSize: 13,
                          outline: "none",
                          boxSizing: "border-box",
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 5 }}>
                        Password
                      </label>
                      <input
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••••••"
                        style={{
                          width: "100%",
                          padding: "10px 12px",
                          borderRadius: 8,
                          border: "1px solid #cbd5e1",
                          fontSize: 13,
                          outline: "none",
                          boxSizing: "border-box",
                        }}
                      />
                    </div>
                  </>
                ) : (
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 5 }}>
                      Master MCP API Key
                    </label>
                    <input
                      type="password"
                      required
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="leader_master_mcp_api_key_..."
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: 8,
                        border: "1px solid #cbd5e1",
                        fontSize: 13,
                        outline: "none",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                )}

                <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                  <button
                    type="button"
                    onClick={handleCancel}
                    disabled={submitting}
                    style={{
                      flex: 1,
                      padding: "11px 16px",
                      borderRadius: 8,
                      border: "1px solid #cbd5e1",
                      background: "#ffffff",
                      color: "#475569",
                      fontSize: 13,
                      fontWeight: 650,
                      cursor: submitting ? "not-allowed" : "pointer",
                    }}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={submitting}
                    style={{
                      flex: 2,
                      padding: "11px 18px",
                      borderRadius: 8,
                      border: "none",
                      background: "linear-gradient(135deg, #4a086b 0%, #ef086f 100%)",
                      color: "#ffffff",
                      fontSize: 13.5,
                      fontWeight: 750,
                      cursor: submitting ? "not-allowed" : "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      boxShadow: "0 4px 12px rgba(74, 8, 107, 0.25)",
                    }}
                  >
                    {submitting ? (
                      <>
                        <Loader2 size={15} className="spin" />
                        <span>Authorizing...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={15} />
                        <span>Sign In & Authorize</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          <div style={{ marginTop: 22, textAlign: "center", fontSize: 11, color: "#94a3b8" }}>
            Kashtrix ERP · OAuth 2.0 &amp; Model Context Protocol Standard
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OAuthAuthorizePage() {
  return (
    <Suspense
      fallback={
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Loader2 size={24} className="spin" />
        </div>
      }
    >
      <OAuthAuthorizeContent />
    </Suspense>
  );
}
