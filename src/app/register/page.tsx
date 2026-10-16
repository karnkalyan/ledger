import Link from "next/link";
import { registerVendorAction } from "./actions";
import { ArrowLeft, Building2, CheckCircle2, ShieldCheck, Store, UserPlus } from "lucide-react";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const errorMessages: Record<string, string> = {
    missing_fields: "Please fill in all required fields.",
    email_exists: "An account with this email already exists. Please log in.",
    weak_password: "Password must be at least 6 characters.",
  };

  return (
    <main className="login-shell">
      <section className="login-brand-panel">
        <div className="brand-mark">
          <span className="brand-symbol">K</span>
          <div>
            <span>KASHTRIX</span>
            <div className="brand-sub">LEDGER</div>
          </div>
        </div>
        <div className="login-copy">
          <span className="eyebrow">Multi-Vendor Business Suite</span>
          <h1>Empower your business with autonomous ledger & ERP.</h1>
          <p>
            Register your enterprise or store to manage commercial invoicing, sales orders, inventory, staff payroll, and daily expense calculations in Nepali Bikram Sambat & English dates.
          </p>
          <div className="feature-stack">
            <div>
              <CheckCircle2 /> Dedicated isolated workspace with private data
            </div>
            <div>
              <Store /> Full Nepali BS date system, VAT/PAN invoices, & PDF reports
            </div>
            <div>
              <ShieldCheck /> Admin reviewed & approved secure business access
            </div>
          </div>
        </div>
        <div className="login-brand-footer">
          <span>KASHTRIX MULTI-VENDOR ENTERPRISE</span>
        </div>
      </section>

      <section className="login-form-panel">
        <form action={registerVendorAction} className="auth-card register-card">
          <div className="auth-icon">
            <UserPlus />
          </div>
          <h2>Register Vendor Account</h2>
          <p>Create your enterprise profile. Your application will be verified by the administrator.</p>

          {error && <div className="alert error">{errorMessages[error] || "Registration failed. Please try again."}</div>}

          <div className="form-grid">
            <label className="field full">
              <span>Company / Store Name *</span>
              <input name="companyName" placeholder="e.g. Himalayan Tech Solutions Pvt Ltd" required />
            </label>

            <label className="field">
              <span>Owner / Manager Full Name *</span>
              <input name="ownerName" placeholder="e.g. Ramesh Adhikari" required />
            </label>

            <label className="field">
              <span>Business Category</span>
              <select name="vendorCategory" defaultValue="IT & Software">
                <option value="IT & Software">IT & Software</option>
                <option value="Trading & Retail">Trading & Retail</option>
                <option value="Manufacturing">Manufacturing</option>
                <option value="Hospitality & Restaurant">Hospitality & Restaurant</option>
                <option value="Healthcare & Pharmacy">Healthcare & Pharmacy</option>
                <option value="Consultancy & Services">Consultancy & Services</option>
                <option value="Construction & Hardware">Construction & Hardware</option>
                <option value="General Commercial">General Commercial</option>
              </select>
            </label>

            <label className="field">
              <span>Business Email *</span>
              <input name="email" type="email" placeholder="owner@company.com" required />
            </label>

            <label className="field">
              <span>Phone / Mobile</span>
              <input name="phone" placeholder="+977-98XXXXXXXX" />
            </label>

            <label className="field">
              <span>PAN / VAT Registration No</span>
              <input name="panVatNumber" placeholder="e.g. 601234567" />
            </label>

            <label className="field">
              <span>Business City / Address</span>
              <input name="address" placeholder="Kathmandu, Nepal" />
            </label>

            <label className="field full">
              <span>Password *</span>
              <input name="password" type="password" placeholder="Create a strong password (min 6 chars)" required />
            </label>
          </div>

          <button className="primary-btn full-btn" type="submit">
            Submit Registration
          </button>

          <div className="auth-footer-links">
            <span>Already have an account?</span>
            <Link href="/login" className="login-link">
              Sign in here
            </Link>
          </div>
        </form>
      </section>
    </main>
  );
}
