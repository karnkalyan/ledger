"use client";

import { useState } from "react";
import { CheckCircle2, Building2, Landmark, Image, Percent, Sparkles, RefreshCw, AlertCircle, Clock, CalendarDays, ShieldCheck, Hash, Briefcase } from "lucide-react";

interface OrganizationData {
  id: string;
  name: string;
  kind: string;
  logoUrl?: string | null;
  taxNumber?: string | null;
  panVatNumber?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  currency?: string;
  defaultTaxPercent?: number | { toString(): string } | null;
  vendorCategory?: string | null;
  fiscalYearStart?: number | null;
  officeOpenTime?: string | null;
  officeCloseTime?: string | null;
  minWorkHours?: number | { toString(): string } | null;
  tdsRate?: number | { toString(): string } | null;
  archivedDaysThreshold?: number | null;
  worklogEntryPermission?: string | null;
  initialInvoiceCount?: number | null;
  initialReceiptCount?: number | null;
  initialDebitNoteCount?: number | null;
  initialCreditNoteCount?: number | null;
}

const PRESET_LOGOS = [
  {
    name: "Simulcast Cyan Wave",
    url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='22' fill='%230284c7'/><path d='M25 50 L45 25 L55 25 L35 50 L55 75 L45 75 Z M45 50 L65 25 L75 25 L55 50 L75 75 L65 75 Z' fill='%23ffffff'/></svg>",
  },
  {
    name: "Kashtrix Deep Indigo",
    url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='22' fill='%234f46e5'/><circle cx='50' cy='50' r='28' fill='none' stroke='%23ffffff' stroke-width='8'/><path d='M42 34 L62 50 L42 66 Z' fill='%23ffffff'/></svg>",
  },
  {
    name: "Household Green Hearth",
    url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='22' fill='%23059669'/><path d='M50 22 L20 48 L28 48 L28 78 L72 78 L72 48 L80 48 Z' fill='%23ffffff'/><rect x='44' y='52' width='12' height='26' rx='2' fill='%23059669'/></svg>",
  },
  {
    name: "Golden Crest Monogram",
    url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='22' fill='%23d97706'/><polygon points='50,22 62,44 86,44 68,58 74,80 50,66 26,80 32,58 14,44 38,44' fill='%23ffffff'/></svg>",
  },
];

export function CompanySettingsForm({
  org,
  action,
  isSaved = false,
}: {
  org: OrganizationData;
  action: (formData: FormData) => Promise<void>;
  isSaved?: boolean;
}) {
  const [logoUrl, setLogoUrl] = useState(org.logoUrl || "");
  const [orgName, setOrgName] = useState(org.name || "");
  const [taxNumber, setTaxNumber] = useState(org.taxNumber || org.panVatNumber || "");
  const [taxPercent, setTaxPercent] = useState<number>(
    org.defaultTaxPercent ? Number(org.defaultTaxPercent) : 13
  );

  return (
    <form action={action}>
      <input type="hidden" name="orgId" value={org.id} />

      {isSaved && (
        <div
          style={{
            padding: "12px 16px",
            background: "rgba(16, 185, 129, 0.1)",
            border: "1px solid rgba(16, 185, 129, 0.3)",
            borderRadius: "var(--radius-sm)",
            color: "var(--success, #10b981)",
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 16,
            fontWeight: 600,
            fontSize: 13,
          }}
        >
          <CheckCircle2 size={16} />
          Company settings, tax calculation rules, and sidebar logo updated successfully!
        </div>
      )}

      <div className="settings-grid">
        {/* Left Column: Branding, Logo & Sidebar Preview */}
        <div className="settings-card">
          <div className="settings-head">
            <h3>Company Branding &amp; Sidebar Logo</h3>
            <p>Configure company visual identity and sidebar representation.</p>
          </div>
          <div className="settings-body">
            {/* Live Sidebar Preview Box */}
            <div className="field-label" style={{ marginBottom: 6 }}>
              Live Sidebar Brand Mark Preview
            </div>
            <div className="settings-brand-preview-box">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt={orgName}
                    className="brand-logo-img"
                    style={{ width: 36, height: 36, borderRadius: 8 }}
                  />
                ) : (
                  <span
                    className="brand-symbol company-symbol"
                    style={{ width: 36, height: 36, borderRadius: 8, fontSize: 14 }}
                  >
                    {orgName ? orgName.slice(0, 2).toUpperCase() : "KL"}
                  </span>
                )}
                <div>
                  <strong style={{ display: "block", fontSize: 13.5, color: "var(--text)" }}>
                    {orgName || "Company Name"}
                  </strong>
                  <span style={{ fontSize: 10.5, color: "var(--text-muted)", letterSpacing: "0.04em" }}>
                    {taxNumber ? `PAN: ${taxNumber}` : org.kind === "COMPANY" ? "CORPORATE ERP" : "HOUSEHOLD SUITE"}
                  </span>
                </div>
              </div>
              <span
                style={{
                  fontSize: 10,
                  padding: "3px 7px",
                  borderRadius: 4,
                  background: "var(--soft)",
                  color: "var(--text-muted)",
                  fontWeight: 600,
                  textTransform: "uppercase",
                }}
              >
                Sidebar Live
              </span>
            </div>

            <label className="field" style={{ marginTop: 12 }}>
              <span className="field-label">Company Logo URL or Image Data</span>
              <input
                name="logoUrl"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://example.com/logo.png or data:image/png;base64..."
              />
            </label>

            <div style={{ marginTop: 10 }}>
              <span className="field-label" style={{ display: "block", marginBottom: 6 }}>
                Upload Logo Image (PNG, JPG, SVG, WebP)
              </span>
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <input
                  type="file"
                  id="logoFileInput"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      if (file.size > 2 * 1024 * 1024) {
                        alert("Image file size must be less than 2MB");
                        return;
                      }
                      const reader = new FileReader();
                      reader.onload = (evt) => {
                        const res = evt.target?.result as string;
                        if (res) setLogoUrl(res);
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                />
                <label
                  htmlFor="logoFileInput"
                  className="secondary-btn"
                  style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}
                >
                  <Image size={14} /> Choose Image from Device...
                </label>
                {logoUrl && (
                  <button
                    type="button"
                    className="ghost-btn"
                    style={{ color: "var(--danger)", fontSize: 11 }}
                    onClick={() => setLogoUrl("")}
                  >
                    Remove Logo
                  </button>
                )}
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              <span className="field-label">Quick Brand Presets (1-Click Apply)</span>
              <div className="settings-preset-list">
                {PRESET_LOGOS.map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    className="settings-preset-btn"
                    onClick={() => setLogoUrl(p.url)}
                  >
                    <img src={p.url} alt={p.name} style={{ width: 14, height: 14, borderRadius: 3 }} />
                    {p.name}
                  </button>
                ))}
                {logoUrl && (
                  <button
                    type="button"
                    className="settings-preset-btn"
                    onClick={() => setLogoUrl("")}
                    style={{ color: "var(--text-muted)" }}
                  >
                    Clear (Use Monogram)
                  </button>
                )}
              </div>
            </div>

            <div
              style={{
                marginTop: 18,
                padding: "10px 12px",
                background: "var(--soft)",
                borderRadius: 6,
                fontSize: 11.5,
                color: "var(--text-muted)",
                lineHeight: 1.5,
              }}
            >
              <strong>Where this logo appears:</strong>
              <ul style={{ margin: "4px 0 0 16px", padding: 0 }}>
                <li>Top left workspace switcher &amp; navigation sidebar</li>
                <li>Official printable quotations &amp; commercial invoices</li>
                <li>Procurement Purchase Orders &amp; Supplier receipts</li>
                <li>Formal Bank &amp; Balance Sheet accounting statements</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Right Column: Company Details & Tax Calculation Rules */}
        <div className="settings-card">
          <div className="settings-head">
            <h3>Company Details &amp; Accounting Rules</h3>
            <p>Manage legal PAN/VAT registration, calendar system, and default taxation rules.</p>
          </div>
          <div className="settings-body">
            <div className="form-grid">
              <label className="field full">
                <span className="field-label">Organization / Company Legal Name</span>
                <input
                  name="name"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  required
                  placeholder="Simulcast Technologies Pvt. Ltd."
                />
              </label>

              <label className="field">
                <span className="field-label">PAN / VAT Number</span>
                <input
                  name="taxNumber"
                  value={taxNumber}
                  onChange={(e) => setTaxNumber(e.target.value)}
                  placeholder="602498214 (9-digit IRD PAN)"
                />
              </label>

              <label className="field">
                <span className="field-label">Industry / Vendor Category</span>
                <input
                  name="vendorCategory"
                  defaultValue={org.vendorCategory || ""}
                  placeholder="Broadcasting / Media Technology / IT"
                />
              </label>

              <label className="field">
                <span className="field-label">Default Calendar System</span>
                <select name="calendarSystem" defaultValue={org.fiscalYearStart === 1 ? "AD" : "BS"}>
                  <option value="BS">Nepali Bikram Sambat (BS - Shrawan to Ashadh)</option>
                  <option value="AD">English Gregorian (AD - Standard)</option>
                </select>
              </label>

              <label className="field">
                <span className="field-label">Fiscal Year Start Month</span>
                <select name="fiscalYearStart" defaultValue={org.fiscalYearStart || 4}>
                  <option value="4">Month 4 · Shrawan (Nepal Standard FY 83/84)</option>
                  <option value="1">Month 1 · Baisakh / January</option>
                  <option value="7">Month 7 · Kartik / July</option>
                </select>
              </label>

              <label className="field">
                <span className="field-label">Official Email</span>
                <input
                  name="email"
                  type="email"
                  defaultValue={org.email || ""}
                  placeholder="info@simulcast.com.np"
                />
              </label>

              <label className="field">
                <span className="field-label">Phone / Telephone</span>
                <input
                  name="phone"
                  defaultValue={org.phone || ""}
                  placeholder="+977 1 4412345 / 9851000000"
                />
              </label>

              <label className="field full">
                <span className="field-label">Registered Office Address</span>
                <input
                  name="address"
                  defaultValue={org.address || ""}
                  placeholder="Kathmandu, Bagmati Province, Nepal"
                />
              </label>

              <label className="field">
                <span className="field-label">Base Operating Currency</span>
                <input
                  name="currency"
                  defaultValue={org.currency || "NPR"}
                  placeholder="NPR"
                />
              </label>

              <label className="field">
                <span className="field-label">Default Tax / VAT Rate (%)</span>
                <input
                  name="defaultTaxPercent"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={taxPercent}
                  onChange={(e) => setTaxPercent(Number(e.target.value))}
                  required
                />
              </label>
            </div>

            {/* Task Management & Office Operational Hours Settings (From Sajilo Task) */}
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <Clock size={16} style={{ color: "#0ea5e9" }} />
                <h4 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "var(--text)" }}>
                  Task Operations &amp; Office Hours Setup
                </h4>
              </div>
              <div className="form-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
                <label className="field">
                  <span className="field-label">Allow Worklog Entry</span>
                  <select name="worklogEntryPermission" defaultValue={org.worklogEntryPermission || "ALL"}>
                    <option value="ALL">All Active Projects</option>
                    <option value="ASSIGNED">Assigned Projects Only</option>
                  </select>
                </label>

                <label className="field">
                  <span className="field-label">Office Open Time</span>
                  <input
                    type="time"
                    name="officeOpenTime"
                    defaultValue={org.officeOpenTime || "09:30"}
                  />
                </label>

                <label className="field">
                  <span className="field-label">Office Close Time</span>
                  <input
                    type="time"
                    name="officeCloseTime"
                    defaultValue={org.officeCloseTime || "18:00"}
                  />
                </label>

                <label className="field">
                  <span className="field-label">Min Work Hours / Day</span>
                  <input
                    type="number"
                    step="0.5"
                    min="1"
                    max="24"
                    name="minWorkHours"
                    defaultValue={org.minWorkHours ? Number(org.minWorkHours) : 8.0}
                  />
                </label>

                <label className="field">
                  <span className="field-label">Auto-Archive Threshold (Days)</span>
                  <input
                    type="number"
                    min="1"
                    max="365"
                    name="archivedDaysThreshold"
                    defaultValue={org.archivedDaysThreshold || 30}
                  />
                </label>

                <label className="field">
                  <span className="field-label">Standard TDS Rate (%)</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    name="tdsRate"
                    defaultValue={org.tdsRate ? Number(org.tdsRate) : 1.5}
                  />
                </label>
              </div>
            </div>

            {/* Document Initial Counts / Sequence Numbers */}
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <Hash size={16} style={{ color: "#8b5cf6" }} />
                <h4 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "var(--text)" }}>
                  Commercial Document Sequence Numbers
                </h4>
              </div>
              <div className="form-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
                <label className="field">
                  <span className="field-label">Initial Invoice #</span>
                  <input
                    type="number"
                    min="1"
                    name="initialInvoiceCount"
                    defaultValue={org.initialInvoiceCount || 1}
                  />
                </label>
                <label className="field">
                  <span className="field-label">Initial Receipt #</span>
                  <input
                    type="number"
                    min="1"
                    name="initialReceiptCount"
                    defaultValue={org.initialReceiptCount || 1}
                  />
                </label>
                <label className="field">
                  <span className="field-label">Initial Debit Note #</span>
                  <input
                    type="number"
                    min="1"
                    name="initialDebitNoteCount"
                    defaultValue={org.initialDebitNoteCount || 1}
                  />
                </label>
                <label className="field">
                  <span className="field-label">Initial Credit Note #</span>
                  <input
                    type="number"
                    min="1"
                    name="initialCreditNoteCount"
                    defaultValue={org.initialCreditNoteCount || 1}
                  />
                </label>
              </div>
            </div>

            {/* Nepal VAT Standard Notice */}
            <div className="vat-notice-badge">
              <Percent size={18} style={{ flexShrink: 0, marginTop: 2, color: "var(--brand)" }} />
              <div>
                <strong>Nepal Standard Tax Policy (13% VAT):</strong>
                <p style={{ margin: "2px 0 0", color: "var(--text-muted)" }}>
                  Under Nepal Inland Revenue Department rules, the default standard VAT is <strong>13%</strong>.
                  All lines in Quotations, Invoices, Sales Orders, and Purchase Orders automatically compute
                  at this rate unless explicitly exempted (0%).
                </p>
              </div>
            </div>

            <div style={{ marginTop: 24, display: "flex", justifyContent: "flex-end" }}>
              <button
                className="primary-btn"
                type="submit"
                style={{ padding: "9px 22px", fontSize: 13.5, fontWeight: 600 }}
              >
                Save Company Settings &amp; Update Sidebar
              </button>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
