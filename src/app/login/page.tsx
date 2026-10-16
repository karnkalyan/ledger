import Link from "next/link";
import { loginAction } from "./actions";
import { ArrowUpRight, BarChart3, Building2, CheckCircle2, LockKeyhole, Shield, Store, UserPlus } from "lucide-react";
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
        <div className="brand-mark">
          <span className="brand-symbol">K</span>
          <div>
            <span>KASHTRIX</span>
            <div className="brand-sub">LEDGER</div>
          </div>
        </div>
        <div className="login-copy">
          <span className="eyebrow">Enterprise Finance & Multi-Vendor ERP</span>
          <h1>Precision ledger for office, vendor business & home.</h1>
          <p>
            Streamline commercial invoicing, team payroll, customer CRM, and personal household expenses in one unified system with complete Nepali Bikram Sambat date support.
          </p>
          <div className="feature-stack">
            <div>
              <CheckCircle2 /> Multi-vendor tenant isolation with dedicated admin approval
            </div>
            <div>
              <BarChart3 /> Bikram Sambat (BS) & AD calendar financial reports & formulas
            </div>
            <div>
              <LockKeyhole /> Role-based security, dark/light theme & printable ledger reports
            </div>
          </div>
        </div>
        <div className="login-brand-footer">
          <span>KASHTRIX LEDGER · COMMERCIAL MULTI-VENDOR ERP</span>
          <ArrowUpRight size={18} />
        </div>
      </section>

      <section className="login-form-panel">
        <form action={loginAction} className="auth-card">
          <div className="auth-icon">
            <LockKeyhole />
          </div>
          <h2>Welcome back</h2>
          <p>Sign in with your vendor enterprise, personal workspace, or admin account.</p>

          {error && <div className="alert error">{errorMessages[error] || "Authentication failed."}</div>}

          <label className="field">
            <span>Email</span>
            <input name="email" type="email" defaultValue="admin@simulcast.local" required />
          </label>

          <label className="field">
            <span>Password</span>
            <input name="password" type="password" defaultValue="Admin@123" required />
          </label>

          <button className="primary-btn full-btn" type="submit">
            Sign in
          </button>

          <div className="demo-credentials-box">
            <div className="demo-title">Quick Demo Logins:</div>
            <div><Building2 size={13} style={{ verticalAlign: "middle", marginRight: 4 }} /> <strong>Vendor:</strong> <code>admin@simulcast.local</code> / <code>Admin@123</code></div>
            <div><Shield size={13} style={{ verticalAlign: "middle", marginRight: 4 }} /> <strong>Super Admin:</strong> <code>superadmin@kashtrix.com</code> / <code>Admin@123</code></div>
          </div>

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
