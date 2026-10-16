import Link from "next/link";
import { loginAction } from "./actions";
import { ArrowUpRight, BarChart3, CheckCircle2, LockKeyhole, Store } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const errorMessages: Record<string, string> = {
    invalid: "Invalid email or password.",
    suspended: "This vendor account is suspended or rejected. Please contact the administrator.",
  };

  return (
    <main className="login-shell">
      <div className="login-theme-pos">
        <ThemeToggle />
      </div>

      <section className="login-brand-panel">
        <div className="brand-mark" style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <img 
            src="/logo-mark.png" 
            alt="Simulcast Technologies Logo" 
            style={{ width: 42, height: 42, objectFit: "contain", filter: "drop-shadow(0 4px 10px rgba(239, 8, 111, 0.45))" }} 
          />
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "0.06em", color: "#ffffff", lineHeight: 1.1 }}>SIMULCAST</div>
            <div className="brand-sub" style={{ color: "#f472b6", fontWeight: 700, letterSpacing: "0.14em", marginTop: 2 }}>TECHNOLOGIES · LEDGER</div>
          </div>
        </div>
        <div className="login-copy">
          <span className="eyebrow">Enterprise Finance & Commercial Operations Suite</span>
          <h1>Precision financial ledger & ERP management.</h1>
          <p>
            Streamline commercial invoicing, vendor orders, team payroll, customer CRM, and real-time bank reconciliation in one unified system with complete Nepali Bikram Sambat date support.
          </p>
          <div className="feature-stack">
            <div>
              <CheckCircle2 /> Commercial tenant management with dedicated workspace isolation
            </div>
            <div>
              <BarChart3 /> Real-time Siddhartha Bank statement matching & Bikram Sambat (BS) ledgers
            </div>
            <div>
              <LockKeyhole /> Role-based access, automated recurring expenses & printable reports
            </div>
          </div>
        </div>
        <div className="login-brand-footer">
          <span>SIMULCAST TECHNOLOGIES PVT. LTD.</span>
          <ArrowUpRight size={18} />
        </div>
      </section>

      <section className="login-form-panel">
        <form action={loginAction} className="auth-card">
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 6 }}>
            <img 
              src="/logo-mark.png" 
              alt="Simulcast Logo" 
              style={{ width: 46, height: 46, objectFit: "contain", flexShrink: 0 }} 
            />
            <div>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "var(--text)" }}>Welcome back</h2>
              <p style={{ margin: "2px 0 0 0", fontSize: 12, color: "var(--text-muted)" }}>Sign in to your Simulcast Enterprise account</p>
            </div>
          </div>

          {error && <div className="alert error">{errorMessages[error] || "Authentication failed."}</div>}

          <label className="field">
            <span>Email</span>
            <input 
              name="email" 
              type="email" 
              placeholder="name@company.com" 
              autoComplete="email" 
              required 
            />
          </label>

          <label className="field">
            <span>Password</span>
            <input 
              name="password" 
              type="password" 
              placeholder="••••••••" 
              autoComplete="current-password" 
              required 
            />
          </label>

          <button className="primary-btn full-btn" type="submit">
            Sign in
          </button>

          <div className="auth-footer-links">
            <span>Need to register your business?</span>
            <Link href="/register" className="register-link-btn">
              <Store size={13} style={{ verticalAlign: "middle", marginRight: 4 }} />
              Register as New Vendor
            </Link>
          </div>
        </form>
      </section>
    </main>
  );
}
