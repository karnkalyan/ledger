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
} from "lucide-react";

function OAuthAuthorizeContent() {
  const searchParams = useSearchParams();
  const redirectUri = searchParams.get("redirect_uri") || "";
  const state = searchParams.get("state") || "";
  const clientId = searchParams.get("client_id") || "ChatGPT";
  const scope = searchParams.get("scope") || "mcp:all";
  const codeChallenge = searchParams.get("code_challenge") || "";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [useApiKey, setUseApiKey] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/oauth/authorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: useApiKey ? "" : email,
          password: useApiKey ? "" : password,
          apiKey: useApiKey ? apiKey : "",
          redirectUri,
          state,
          codeChallenge,
          scope,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Authorization failed");
      }

      // Redirect back to ChatGPT or client app
      window.location.href = data.redirectUrl;
    } catch (err: any) {
      setError(err.message || "Failed to authorize application");
      setSubmitting(false);
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
        padding: 20,
        fontFamily: "var(--font-sans, system-ui, sans-serif)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 460,
          background: "#ffffff",
          borderRadius: 20,
          boxShadow: "0 25px 60px -15px rgba(0, 0, 0, 0.5)",
          overflow: "hidden",
          border: "1px solid rgba(255, 255, 255, 0.2)",
        }}
      >
        {/* Header Banner */}
        <div
          style={{
            padding: "28px 24px 20px",
            background: "linear-gradient(135deg, #4a086b 0%, #ef086f 100%)",
            color: "#ffffff",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: 54,
              height: 54,
              borderRadius: 16,
              background: "rgba(255, 255, 255, 0.15)",
              backdropFilter: "blur(8px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 14px",
              boxShadow: "0 8px 16px rgba(0, 0, 0, 0.15)",
            }}
          >
            <Sparkles size={28} />
          </div>
          <h2 style={{ margin: "0 0 6px", fontSize: 21, fontWeight: 800, letterSpacing: -0.4 }}>
            Connect to Flowledger
          </h2>
          <p style={{ margin: 0, fontSize: 13, opacity: 0.9 }}>
            Authorize <strong>{clientId}</strong> to access your organization ledger and banking tools.
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
            <div style={{ fontWeight: 700, color: "#0f172a", marginBottom: 6, display: "flex", alignItems: "center", gap: 5 }}>
              <ShieldCheck size={14} color="#059669" />
              Permissions Requested:
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6 }}>
              <li>Read & list Bank Accounts and Ledgers</li>
              <li>Extract statements & record transactions</li>
              <li>Manage Invoices, Expenses, Purchases, and Incomes</li>
              <li>Read organization financial balance summaries</li>
            </ul>
          </div>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {!useApiKey ? (
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
                    placeholder="you@company.com"
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

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setUseApiKey((prev) => !prev)}
                style={{
                  background: "none",
                  border: "none",
                  color: "#4a086b",
                  fontSize: 11.5,
                  fontWeight: 650,
                  cursor: "pointer",
                }}
              >
                {useApiKey ? "← Use Email & Password" : "Use Master Key instead →"}
              </button>
            </div>

            <button
              type="submit"
              disabled={submitting}
              style={{
                marginTop: 6,
                padding: "12px 18px",
                borderRadius: 10,
                border: "none",
                background: "linear-gradient(135deg, #4a086b 0%, #ef086f 100%)",
                color: "#ffffff",
                fontSize: 14,
                fontWeight: 750,
                cursor: submitting ? "not-allowed" : "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                boxShadow: "0 6px 18px rgba(74, 8, 107, 0.3)",
              }}
            >
              {submitting ? (
                <>
                  <Loader2 size={16} className="spin" />
                  <span>Authorizing...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={16} />
                  <span>Authorize & Connect ChatGPT</span>
                </>
              )}
            </button>
          </form>

          <div style={{ marginTop: 20, textAlign: "center", fontSize: 11, color: "#94a3b8" }}>
            Secured with end-to-end OAuth 2.0 & Model Context Protocol
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
