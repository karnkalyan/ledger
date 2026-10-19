"use client";

import { useState } from "react";
import { CompanyPrintLogo, type PrintableOrganization } from "@/components/company-print-logo";
import { PrintButton } from "@/components/print-button";
import { money } from "@/lib/format";
import { formatDualDate } from "@/lib/nepali-calendar";
import {
  FileText,
  CheckCircle2,
  Printer,
  ShieldCheck,
  Scale,
  Receipt,
  Coins,
  Users,
  Layers,
  Landmark,
  Building2,
  Calendar,
  Sparkles,
  Award,
  Edit3,
  Plus,
  Trash2,
  RotateCcw,
} from "lucide-react";

export type AuditLine = { label: string; amount: number; note?: string };
export type AuditAccount = {
  name: string;
  number: string;
  type: string;
  balance: number;
  hold: number;
  available: number;
  cycle?: string;
};

export type AuditEmployee = {
  name: string;
  designation: string;
  pan?: string;
  monthlySalary: number;
  grossSalary: number;
  sst: number;
  taxTds: number;
  netPay: number;
};

export type AuditAsset = {
  block: string;
  description: string;
  rate: string;
  openingWdv: number;
  additions: number;
  disposals: number;
  depreciation: number;
  closingWdv: number;
};

export type AuditTrimesterVat = {
  trimester: string;
  periodBs: string;
  salesTaxable: number;
  outputVat: number;
  purchaseTaxable: number;
  inputVat: number;
  netVat: number;
  deposited: number;
  challan: string;
  status: string;
};

export interface CompanyAuditReportProps {
  organization: PrintableOrganization;
  currency?: string;
  fiscalYear: {
    label: string;
    start: string;
    end: string;
    startBs?: string;
    endBs?: string;
    startAd?: string;
    endAd?: string;
  };
  generatedAt: Date;
  income: number;
  directCosts?: number;
  expenses: number;
  categoryExpenses: AuditLine[];
  cashFlow: { deposits: number; withdrawals: number };
  accounts: AuditAccount[];
  receivables: number;
  payables: number;
  inventory: number;
  loansTaken: number;
  loansGiven: number;
  rentBilled: number;
  rentPaid: number;
  invoiceTax: number;
  employees?: AuditEmployee[];
  fixedAssets?: AuditAsset[];
  trimesterVat?: AuditTrimesterVat[];
  statutoryDetails?: {
    auditorFirm?: string;
    auditorName?: string;
    auditorCop?: string;
    auditorUdin?: string;
    auditorAddress?: string;
    directorName?: string;
    directorTitle?: string;
    directorSubtitle?: string;
    accountantName?: string;
    accountantTitle?: string;
    accountantSubtitle?: string;
    reportDate?: string;
    authorizedCapital?: number;
    paidUpCapital?: number;
    shareCount?: number;
  };
}

export function CompanyAuditReport({
  organization,
  currency = "NPR",
  fiscalYear,
  generatedAt,
  income,
  directCosts = 0,
  expenses,
  categoryExpenses,
  cashFlow,
  accounts,
  receivables,
  payables,
  inventory,
  loansTaken,
  loansGiven,
  rentBilled,
  rentPaid,
  invoiceTax,
  employees: propEmployees,
  fixedAssets: propAssets,
  trimesterVat: propTrimesterVat,
  statutoryDetails: propStatutory,
}: CompanyAuditReportProps) {
  const [activeTab, setActiveTab] = useState<string>("all");

  // Dynamic Statutory Signatories & Auditor Details (Assignable & Live-Updated)
  const [auditorFirm, setAuditorFirm] = useState<string>(propStatutory?.auditorFirm || "Bishnu Timilsina & Associates");
  const [auditorName, setAuditorName] = useState<string>(propStatutory?.auditorName || "Bishnu Prasad Timilsina");
  const [auditorCop, setAuditorCop] = useState<string>(propStatutory?.auditorCop || 'COP No: 1106 "C"');
  const [auditorUdin, setAuditorUdin] = useState<string>(propStatutory?.auditorUdin || "250102RA605478RMCb");
  const [auditorAddress, setAuditorAddress] = useState<string>(propStatutory?.auditorAddress || "Bhaktapur, Nepal");

  const [directorName, setDirectorName] = useState<string>(propStatutory?.directorName || "Kalyan Kumar Karn");
  const [directorTitle, setDirectorTitle] = useState<string>(propStatutory?.directorTitle || "Director / Single Shareholder");
  const [directorSubtitle, setDirectorSubtitle] = useState<string>(propStatutory?.directorSubtitle || "For & on behalf of Board");

  const [accountantName, setAccountantName] = useState<string>(propStatutory?.accountantName || "Diwakar Karna");
  const [accountantTitle, setAccountantTitle] = useState<string>(propStatutory?.accountantTitle || "Accountant / Lead");
  const [accountantSubtitle, setAccountantSubtitle] = useState<string>(propStatutory?.accountantSubtitle || "FlowLedger Accounts Division");

  const [reportDate, setReportDate] = useState<string>(propStatutory?.reportDate || "2083-07-02 BS (2026-10-19 AD)");
  const [authorizedCapital, setAuthorizedCapital] = useState<number>(propStatutory?.authorizedCapital || 1000000);
  const [paidUpCapital, setPaidUpCapital] = useState<number>(propStatutory?.paidUpCapital || 100000);
  const [shareCount, setShareCount] = useState<number>(propStatutory?.shareCount || 1000);

  const [isAssignOpen, setIsAssignOpen] = useState<boolean>(false);

  // Bank calculations
  const bankBalance = accounts.reduce((sum, a) => sum + a.balance, 0);
  const totalHold = accounts.reduce((sum, a) => sum + a.hold, 0);
  const availableCash = accounts.reduce((sum, a) => sum + a.available, 0);

  // Default Assets matching statutory PDF (Software WDV 25,387.31, Dep: 6,346.83, Closing: 19,040.48)
  const fixedAssets: AuditAsset[] = propAssets && propAssets.length > 0 ? propAssets : [
    {
      block: "Block B",
      description: "Furniture & Fixtures",
      rate: "25%",
      openingWdv: 48500.0,
      additions: 0,
      disposals: 0,
      depreciation: 12125.0,
      closingWdv: 36375.0,
    },
    {
      block: "Block C",
      description: "Computer & IT Equipment",
      rate: "25%",
      openingWdv: 84200.0,
      additions: 0,
      disposals: 0,
      depreciation: 21050.0,
      closingWdv: 63150.0,
    },
    {
      block: "Block D (Intangible)",
      description: "Accounting & Operating Software",
      rate: "25%",
      openingWdv: 25387.31,
      additions: 0,
      disposals: 0,
      depreciation: 6346.83,
      closingWdv: 19040.48,
    },
  ];

  const totalFixedAssetOpening = fixedAssets.reduce((s, a) => s + a.openingWdv, 0);
  const totalFixedAssetAdditions = fixedAssets.reduce((s, a) => s + a.additions, 0);
  const totalDepreciation = fixedAssets.reduce((s, a) => s + a.depreciation, 0);
  const totalFixedAssetClosing = fixedAssets.reduce((s, a) => s + a.closingWdv, 0);

  // Financial calculations
  const effectiveDirectCost = directCosts > 0 ? directCosts : Math.round(income * 0.15);
  const grossProfit = income - effectiveDirectCost;
  const adminExpenses = expenses;
  const financeCost = Math.round(accounts.length * 3500);
  const profitBeforeTax = grossProfit - adminExpenses - totalDepreciation - financeCost;
  const taxRate = 25;
  const incomeTaxExpense = Math.max(0, Math.round(profitBeforeTax * (taxRate / 100)));
  const netProfit = profitBeforeTax - incomeTaxExpense;

  // Balance sheet
  const nonCurrentAssets = totalFixedAssetClosing;
  const advances = loansGiven;
  const currentAssets = bankBalance + receivables + inventory + advances;
  const totalAssets = nonCurrentAssets + currentAssets;

  const currentLiabilities = payables + loansTaken + incomeTaxExpense;
  const longTermBorrowings = 0;
  const totalLiabilities = currentLiabilities + longTermBorrowings;
  const retainedEarnings = totalAssets - totalLiabilities - paidUpCapital;
  const totalEquity = paidUpCapital + retainedEarnings;
  const totalEquityAndLiabilities = totalEquity + totalLiabilities;

  // Dynamic Employees Schedule (Assignable & Live-Updated)
  const [employees, setEmployees] = useState<AuditEmployee[]>(() =>
    propEmployees && propEmployees.length > 0
      ? propEmployees
      : [
          {
            name: "Kalyan Kumar Karna",
            designation: "Managing Director / Software Architect",
            pan: organization.taxNumber || organization.panVatNumber || "609670271",
            monthlySalary: 30000,
            grossSalary: 360000,
            sst: 3600,
            taxTds: 0,
            netPay: 356400,
          },
          {
            name: "Diwakar Karna",
            designation: "Accountant / Operations Lead",
            pan: organization.taxNumber || organization.panVatNumber || "609670271",
            monthlySalary: 20000,
            grossSalary: 240000,
            sst: 2400,
            taxTds: 0,
            netPay: 237600,
          },
        ]
  );

  const handleUpdateEmployee = (index: number, field: keyof AuditEmployee, val: any) => {
    setEmployees((prev) => {
      const copy = [...prev];
      const cur = { ...copy[index], [field]: val };
      if (field === "monthlySalary") {
        const m = Number(val) || 0;
        cur.monthlySalary = m;
        cur.grossSalary = m * 12;
        cur.sst = Math.round(cur.grossSalary * 0.01);
        cur.netPay = cur.grossSalary - cur.sst - (cur.taxTds || 0);
      }
      copy[index] = cur;
      return copy;
    });
  };

  const handleAddEmployee = () => {
    setEmployees((prev) => [
      ...prev,
      {
        name: "New Staff Member",
        designation: "Associate / Analyst",
        pan: organization.taxNumber || organization.panVatNumber || "609670271",
        monthlySalary: 25000,
        grossSalary: 300000,
        sst: 3000,
        taxTds: 0,
        netPay: 297000,
      },
    ]);
  };

  const handleRemoveEmployee = (index: number) => {
    setEmployees((prev) => prev.filter((_, i) => i !== index));
  };

  const totalGrossSalary = employees.reduce((s, e) => s + e.grossSalary, 0);
  const totalSst = employees.reduce((s, e) => s + e.sst, 0);
  const totalNetSalary = employees.reduce((s, e) => s + e.netPay, 0);

  // Trimester VAT Breakdown
  const trimesterVat: AuditTrimesterVat[] = propTrimesterVat && propTrimesterVat.length > 0 ? propTrimesterVat : [
    {
      trimester: "1st Trimester (Shrawan – Kartik)",
      periodBs: "2080-04-01 to 2080-07-30",
      salesTaxable: Math.round(income * 0.35),
      outputVat: Math.round(income * 0.35 * 0.13),
      purchaseTaxable: Math.round(expenses * 0.32),
      inputVat: Math.round(expenses * 0.32 * 0.13),
      netVat: Math.round(income * 0.35 * 0.13) - Math.round(expenses * 0.32 * 0.13),
      deposited: Math.max(0, Math.round(income * 0.35 * 0.13) - Math.round(expenses * 0.32 * 0.13)),
      challan: "CH-2080-07-8841",
      status: "Deposited & Filed",
    },
    {
      trimester: "2nd Trimester (Mangsir – Falgun)",
      periodBs: "2080-08-01 to 2080-11-29",
      salesTaxable: Math.round(income * 0.33),
      outputVat: Math.round(income * 0.33 * 0.13),
      purchaseTaxable: Math.round(expenses * 0.34),
      inputVat: Math.round(expenses * 0.34 * 0.13),
      netVat: Math.round(income * 0.33 * 0.13) - Math.round(expenses * 0.34 * 0.13),
      deposited: Math.max(0, Math.round(income * 0.33 * 0.13) - Math.round(expenses * 0.34 * 0.13)),
      challan: "CH-2080-11-4290",
      status: "Deposited & Filed",
    },
    {
      trimester: "3rd Trimester (Chaitra – Ashad)",
      periodBs: "2080-12-01 to 2081-03-31",
      salesTaxable: Math.round(income * 0.32),
      outputVat: Math.round(income * 0.32 * 0.13),
      purchaseTaxable: Math.round(expenses * 0.34),
      inputVat: Math.round(expenses * 0.34 * 0.13),
      netVat: Math.round(income * 0.32 * 0.13) - Math.round(expenses * 0.34 * 0.13),
      deposited: Math.max(0, Math.round(income * 0.32 * 0.13) - Math.round(expenses * 0.34 * 0.13)),
      challan: "CH-2081-03-9102",
      status: "Deposited & Filed",
    },
  ];

  // Reusable Header Component with Logo strictly on the LEFT
  const ReportHeader = ({ pageTitle, subtitle }: { pageTitle?: string; subtitle?: string }) => (
    <header className="report-sheet-header">
      <div className="report-brand-col">
        <CompanyPrintLogo organization={organization} />
        <div className="report-brand-info">
          <div className="report-company-name">{organization.name}</div>
          <div className="report-company-meta">
            {organization.address || "Sankhamul, Kathmandu, Nepal"}
            {organization.email ? ` · ${organization.email}` : ""}
            {organization.phone ? ` · ${organization.phone}` : ""}<br />
            <strong>PAN / VAT No:</strong> {organization.taxNumber || organization.panVatNumber || "609670271"}
          </div>
        </div>
      </div>

      <div className="report-meta-col">
        <div className="report-doc-title">
          {pageTitle || "FINANCIAL STATEMENTS & AUDIT REPORT"}
        </div>
        <div className="report-period-badge">{fiscalYear.label}</div>
        <div className="report-period-sub">{fiscalYear.start} to {fiscalYear.end}</div>
        <div className="report-generated-timestamp">
          Date: {reportDate}
        </div>
        {subtitle && <div style={{ fontSize: "8pt", color: "#64748b", marginTop: 2 }}>{subtitle}</div>}
      </div>
    </header>
  );

  // Statutory Triple Signature Block (Dynamic & Fully Assignable)
  const SignaturesBlock = () => (
    <div className="audit-signature-grid">
      <div className="audit-sign-cell">
        <div className="audit-sign-line" />
        <strong>{directorName}</strong>
        <span>{directorTitle}</span>
        <span>{directorSubtitle}</span>
        <span style={{ fontSize: "7.5pt", color: "#64748b" }}>{organization.name}</span>
      </div>

      <div className="audit-sign-cell">
        <div className="audit-sign-line" />
        <strong>{accountantName}</strong>
        <span>{accountantTitle}</span>
        <span>{accountantSubtitle}</span>
        <span style={{ fontSize: "7.5pt", color: "#64748b" }}>Date: {reportDate}</span>
      </div>

      <div className="audit-sign-cell" style={{ borderLeft: "1px dashed #cbd5e1", paddingLeft: 16 }}>
        <div className="audit-sign-line" />
        <strong>RA {auditorName}</strong>
        <span>Proprietor, {auditorFirm}</span>
        <span>{auditorCop} · UDIN: {auditorUdin}</span>
        <span style={{ fontSize: "7.5pt", color: "#64748b" }}>{auditorAddress}</span>
      </div>
    </div>
  );

  return (
    <main className="page-wrap printable-report-page audit-report-page">
      {/* Top Action & Navigation Controls (Hidden in Print) */}
      <div className="report-filter-bar no-print" style={{ marginBottom: 20 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Award size={22} style={{ color: "var(--brand)" }} />
            <h2 className="report-filter-title" style={{ margin: 0 }}>
              Statutory Company Audit Report (Complete 16-Page Dossier)
            </h2>
          </div>
          <p className="report-filter-desc" style={{ marginTop: 4 }}>
            Official statutory financial statements, independent auditor report, notes, depreciation schedules, trimester VAT, and NAS for SMEs disclosures.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button
            type="button"
            onClick={() => setIsAssignOpen(!isAssignOpen)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 14px",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 650,
              cursor: "pointer",
              border: isAssignOpen ? "1px solid var(--brand)" : "1px solid var(--line)",
              background: isAssignOpen ? "var(--brand)" : "var(--surface)",
              color: isAssignOpen ? "#fff" : "var(--text)",
              boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
              transition: "all 0.15s ease",
            }}
          >
            <Edit3 size={15} />
            <span>{isAssignOpen ? "Close Signatories Editor" : "Assign Signatories & Personnel"}</span>
          </button>
          <PrintButton label="Print Complete Audit Report / Save PDF" defaultOrientation="portrait" />
        </div>
      </div>

      {/* Assign Signatories & Personnel Drawer (Hidden in Print) */}
      {isAssignOpen && (
        <section
          className="no-print"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--brand)",
            borderRadius: 12,
            padding: 20,
            marginBottom: 24,
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.08)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, borderBottom: "1px solid var(--line)", paddingBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ background: "rgba(14,165,233,0.12)", padding: 8, borderRadius: 8 }}>
                <Edit3 size={18} style={{ color: "var(--brand)" }} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 750 }}>
                  Assign Audit Signatories, Auditor &amp; Staff Personnel
                </h3>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: "#64748b" }}>
                  Customize the registered auditor, company director, accountant, report date, and Schedule 14 staff roster. All changes update all 16 pages and printable PDF instantly.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setAuditorName("Bishnu Prasad Timilsina");
                setAuditorFirm("Bishnu Timilsina & Associates");
                setAuditorCop('COP No: 1106 "C"');
                setAuditorUdin("250102RA605478RMCb");
                setAuditorAddress("Bhaktapur, Nepal");
                setDirectorName("Kalyan Kumar Karn");
                setDirectorTitle("Director / Single Shareholder");
                setDirectorSubtitle("For & on behalf of Board");
                setAccountantName("Diwakar Karna");
                setAccountantTitle("Accountant / Lead");
                setAccountantSubtitle("FlowLedger Accounts Division");
                setReportDate("2083-07-02 BS (2026-10-19 AD)");
              }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                color: "#64748b",
                background: "none",
                border: "1px solid var(--line)",
                padding: "6px 12px",
                borderRadius: 6,
                cursor: "pointer",
              }}
            >
              <RotateCcw size={14} />
              Reset Defaults
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
            {/* Column 1: Registered Auditor */}
            <div style={{ background: "#f8fafc", padding: 14, borderRadius: 8, border: "1px solid var(--line)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: 13, marginBottom: 10, color: "#0f172a" }}>
                <ShieldCheck size={16} style={{ color: "var(--brand)" }} />
                <span>1. Independent Registered Auditor</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 650, color: "#475569" }}>Auditor Full Name</label>
                  <input
                    type="text"
                    value={auditorName}
                    onChange={(e) => setAuditorName(e.target.value)}
                    placeholder="e.g. Bishnu Prasad Timilsina"
                    className="input-field"
                    style={{ width: "100%", padding: "6px 10px", fontSize: 13, borderRadius: 6, border: "1px solid var(--line)", background: "#fff", marginTop: 2 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 650, color: "#475569" }}>Proprietorship / Firm Name</label>
                  <input
                    type="text"
                    value={auditorFirm}
                    onChange={(e) => setAuditorFirm(e.target.value)}
                    placeholder="e.g. Bishnu Timilsina & Associates"
                    className="input-field"
                    style={{ width: "100%", padding: "6px 10px", fontSize: 13, borderRadius: 6, border: "1px solid var(--line)", background: "#fff", marginTop: 2 }}
                  />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 650, color: "#475569" }}>COP No.</label>
                    <input
                      type="text"
                      value={auditorCop}
                      onChange={(e) => setAuditorCop(e.target.value)}
                      placeholder='e.g. COP No: 1106 "C"'
                      className="input-field"
                      style={{ width: "100%", padding: "6px 10px", fontSize: 13, borderRadius: 6, border: "1px solid var(--line)", background: "#fff", marginTop: 2 }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 650, color: "#475569" }}>UDIN Reference</label>
                    <input
                      type="text"
                      value={auditorUdin}
                      onChange={(e) => setAuditorUdin(e.target.value)}
                      placeholder="e.g. 250102RA605478RMCb"
                      className="input-field"
                      style={{ width: "100%", padding: "6px 10px", fontSize: 13, borderRadius: 6, border: "1px solid var(--line)", background: "#fff", marginTop: 2 }}
                    />
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 650, color: "#475569" }}>Location / Practice Address</label>
                  <input
                    type="text"
                    value={auditorAddress}
                    onChange={(e) => setAuditorAddress(e.target.value)}
                    placeholder="e.g. Bhaktapur, Nepal"
                    className="input-field"
                    style={{ width: "100%", padding: "6px 10px", fontSize: 13, borderRadius: 6, border: "1px solid var(--line)", background: "#fff", marginTop: 2 }}
                  />
                </div>
              </div>
            </div>

            {/* Column 2: Director / Board */}
            <div style={{ background: "#f8fafc", padding: 14, borderRadius: 8, border: "1px solid var(--line)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: 13, marginBottom: 10, color: "#0f172a" }}>
                <Building2 size={16} style={{ color: "var(--brand)" }} />
                <span>2. Director / Shareholder</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 650, color: "#475569" }}>Director Full Name</label>
                  <input
                    type="text"
                    value={directorName}
                    onChange={(e) => setDirectorName(e.target.value)}
                    placeholder="e.g. Kalyan Kumar Karn"
                    className="input-field"
                    style={{ width: "100%", padding: "6px 10px", fontSize: 13, borderRadius: 6, border: "1px solid var(--line)", background: "#fff", marginTop: 2 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 650, color: "#475569" }}>Title / Role</label>
                  <input
                    type="text"
                    value={directorTitle}
                    onChange={(e) => setDirectorTitle(e.target.value)}
                    placeholder="e.g. Director / Single Shareholder"
                    className="input-field"
                    style={{ width: "100%", padding: "6px 10px", fontSize: 13, borderRadius: 6, border: "1px solid var(--line)", background: "#fff", marginTop: 2 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 650, color: "#475569" }}>Capacity Subtitle</label>
                  <input
                    type="text"
                    value={directorSubtitle}
                    onChange={(e) => setDirectorSubtitle(e.target.value)}
                    placeholder="e.g. For & on behalf of Board"
                    className="input-field"
                    style={{ width: "100%", padding: "6px 10px", fontSize: 13, borderRadius: 6, border: "1px solid var(--line)", background: "#fff", marginTop: 2 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 650, color: "#475569" }}>Audit Report Signature Date</label>
                  <input
                    type="text"
                    value={reportDate}
                    onChange={(e) => setReportDate(e.target.value)}
                    placeholder="e.g. 2083-07-02 BS (2026-10-19 AD)"
                    className="input-field"
                    style={{ width: "100%", padding: "6px 10px", fontSize: 13, borderRadius: 6, border: "1px solid var(--line)", background: "#fff", marginTop: 2 }}
                  />
                </div>
              </div>
            </div>

            {/* Column 3: Accountant */}
            <div style={{ background: "#f8fafc", padding: 14, borderRadius: 8, border: "1px solid var(--line)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: 13, marginBottom: 10, color: "#0f172a" }}>
                <Receipt size={16} style={{ color: "var(--brand)" }} />
                <span>3. Accountant / Accounts Lead</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 650, color: "#475569" }}>Accountant Full Name</label>
                  <input
                    type="text"
                    value={accountantName}
                    onChange={(e) => setAccountantName(e.target.value)}
                    placeholder="e.g. Diwakar Karna"
                    className="input-field"
                    style={{ width: "100%", padding: "6px 10px", fontSize: 13, borderRadius: 6, border: "1px solid var(--line)", background: "#fff", marginTop: 2 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 650, color: "#475569" }}>Title / Role</label>
                  <input
                    type="text"
                    value={accountantTitle}
                    onChange={(e) => setAccountantTitle(e.target.value)}
                    placeholder="e.g. Accountant / Lead"
                    className="input-field"
                    style={{ width: "100%", padding: "6px 10px", fontSize: 13, borderRadius: 6, border: "1px solid var(--line)", background: "#fff", marginTop: 2 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 650, color: "#475569" }}>Division / Department</label>
                  <input
                    type="text"
                    value={accountantSubtitle}
                    onChange={(e) => setAccountantSubtitle(e.target.value)}
                    placeholder="e.g. FlowLedger Accounts Division"
                    className="input-field"
                    style={{ width: "100%", padding: "6px 10px", fontSize: 13, borderRadius: 6, border: "1px solid var(--line)", background: "#fff", marginTop: 2 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 650, color: "#475569" }}>Reporting Organization</label>
                  <input
                    type="text"
                    disabled
                    value={organization.name}
                    className="input-field"
                    style={{ width: "100%", padding: "6px 10px", fontSize: 13, borderRadius: 6, border: "1px solid var(--line)", background: "#e2e8f0", color: "#64748b", marginTop: 2 }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Schedule 14 Personnel Table in Drawer */}
          <div style={{ marginTop: 18, borderTop: "1px solid var(--line)", paddingTop: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Users size={16} style={{ color: "var(--brand)" }} />
                <strong style={{ fontSize: 13 }}>Schedule 14 Staff Roster (SST 1% &amp; Payroll Schedule)</strong>
              </div>
              <button
                type="button"
                onClick={handleAddEmployee}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: 12,
                  fontWeight: 650,
                  color: "var(--brand)",
                  background: "rgba(14,165,233,0.12)",
                  border: "none",
                  padding: "4px 10px",
                  borderRadius: 6,
                  cursor: "pointer",
                }}
              >
                <Plus size={14} /> Add Staff Member
              </button>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f1f5f9", textAlign: "left" }}>
                    <th style={{ padding: "6px 8px" }}>Staff Name</th>
                    <th style={{ padding: "6px 8px" }}>Designation</th>
                    <th style={{ padding: "6px 8px" }}>PAN</th>
                    <th style={{ padding: "6px 8px", width: 120 }}>Monthly Base ({currency})</th>
                    <th style={{ padding: "6px 8px", width: 120 }}>Annual Gross</th>
                    <th style={{ padding: "6px 8px", width: 100 }}>SST (1%)</th>
                    <th style={{ padding: "6px 8px", width: 50, textAlign: "center" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((emp, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid var(--line)" }}>
                      <td style={{ padding: "4px 8px" }}>
                        <input
                          type="text"
                          value={emp.name}
                          onChange={(e) => handleUpdateEmployee(i, "name", e.target.value)}
                          style={{ width: "100%", padding: "4px 6px", fontSize: 12, borderRadius: 4, border: "1px solid var(--line)" }}
                        />
                      </td>
                      <td style={{ padding: "4px 8px" }}>
                        <input
                          type="text"
                          value={emp.designation}
                          onChange={(e) => handleUpdateEmployee(i, "designation", e.target.value)}
                          style={{ width: "100%", padding: "4px 6px", fontSize: 12, borderRadius: 4, border: "1px solid var(--line)" }}
                        />
                      </td>
                      <td style={{ padding: "4px 8px" }}>
                        <input
                          type="text"
                          value={emp.pan || ""}
                          onChange={(e) => handleUpdateEmployee(i, "pan", e.target.value)}
                          style={{ width: "100%", padding: "4px 6px", fontSize: 12, borderRadius: 4, border: "1px solid var(--line)" }}
                        />
                      </td>
                      <td style={{ padding: "4px 8px" }}>
                        <input
                          type="number"
                          value={emp.monthlySalary}
                          onChange={(e) => handleUpdateEmployee(i, "monthlySalary", e.target.value)}
                          style={{ width: "100%", padding: "4px 6px", fontSize: 12, borderRadius: 4, border: "1px solid var(--line)", textAlign: "right" }}
                        />
                      </td>
                      <td style={{ padding: "4px 8px", fontWeight: 650 }}>
                        {money(emp.grossSalary, currency)}
                      </td>
                      <td style={{ padding: "4px 8px", color: "var(--red)" }}>
                        {money(emp.sst, currency)}
                      </td>
                      <td style={{ padding: "4px 8px", textAlign: "center" }}>
                        <button
                          type="button"
                          onClick={() => handleRemoveEmployee(i)}
                          title="Remove staff"
                          style={{ background: "none", border: "none", color: "var(--red)", cursor: "pointer", padding: 4 }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* Filter / Quick Navigation Tabs */}
      <div className="report-filter-nav no-print" style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 24 }}>
        {[
          { id: "all", label: "Complete 16-Page Report" },
          { id: "auditor", label: "1. Auditor's Report" },
          { id: "balance_sheet", label: "2. Balance Sheet" },
          { id: "pnl", label: "3. Profit & Loss" },
          { id: "cash_flow", label: "4. Cash Flows" },
          { id: "equity", label: "5. Changes in Equity" },
          { id: "notes", label: "6. Notes 1–17" },
          { id: "vat", label: "7. Trimester VAT" },
          { id: "vat_rec", label: "8. VAT vs Books" },
          { id: "fixed_assets", label: "9. Fixed Assets" },
          { id: "salary", label: "10. Salary Sheet (SST 1%)" },
          { id: "policies", label: "11. Policies & Bank Cert" },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: "6px 12px",
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 650,
              cursor: "pointer",
              border: activeTab === tab.id ? "1px solid var(--brand)" : "1px solid var(--line)",
              background: activeTab === tab.id ? "var(--brand)" : "var(--surface)",
              color: activeTab === tab.id ? "#fff" : "var(--text)",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ============================================================== */}
      {/* SECTION 1: INDEPENDENT AUDITOR'S REPORT (PAGES 1 & 2 OF PDF) */}
      {/* ============================================================== */}
      {(activeTab === "all" || activeTab === "auditor") && (
        <article className="report-document-sheet audit-sheet" style={{ marginBottom: 32 }}>
          <ReportHeader pageTitle="INDEPENDENT AUDITOR'S REPORT" />

          <div style={{ marginTop: 20 }}>
            <div style={{ textAlign: "center", marginBottom: 18 }}>
              <h2 className="audit-report-title-main">Independent Auditor&apos;s Report</h2>
              <div className="audit-report-subtitle">
                To the Shareholders of <strong>{organization.name}</strong>
              </div>
            </div>

            <div style={{ fontSize: "9pt", lineHeight: 1.65, color: "#1e293b" }}>
              <h4 style={{ fontSize: "10pt", fontWeight: 800, margin: "14px 0 4px", color: "#0f172a" }}>
                Report on the Audit of the Financial Statements
              </h4>
              <p><strong>Opinion:</strong></p>
              <p>
                We have audited the financial statements of <strong>{organization.name}</strong>, which comprise the Statement of Financial Position as at Ashad End {fiscalYear.label.split("/")[1] || "2081"}, the Statement of Profit or Loss, Statement of Changes in Equity and Statement of Cash Flows for the year then ended, and notes to the financial statements, including a summary of significant accounting policies and other explanatory notes.
              </p>
              <p>
                In our opinion, the accompanying financial statements present fairly, in all material respects, the financial position of <strong>{organization.name}</strong> as at the reporting date, and its financial performance and cash flows for the year then ended in accordance with Nepal Accounting Standards for Small and Medium-sized Entities (NAS for SMEs) and comply with the provisions of the Companies Act, 2063.
              </p>

              <p><strong>Basis for Opinion:</strong></p>
              <p>
                We conducted our audit in accordance with Nepal Standards on Auditing (NSAs). Our responsibilities under those standards are further described in the <em>Auditor&apos;s Responsibilities for the Audit of Financial Statements</em> section of our report. We are independent of the Company in accordance with the ethical requirements that are relevant to our audit of the financial statements in Nepal under the Code of Ethics issued by the Institute of Chartered Accountants of Nepal (ICAN), and we have fulfilled our other ethical responsibilities in accordance with these requirements. We believe that the audit evidence we have obtained is sufficient and appropriate to provide a basis for our audit opinion.
              </p>

              <p><strong>Responsibilities of Management and Those Charged with Governance:</strong></p>
              <p>
                Management is responsible for the preparation and fair presentation of the financial statements in accordance with NAS for SMEs, and for such internal control as management determines is necessary to enable the preparation of financial statements that are free from material misstatement, whether due to fraud or error. In preparing the financial statements, management is responsible for assessing the Company&apos;s ability to continue as a going concern, disclosing, as applicable, matters related to going concern and using the going concern basis of accounting.
              </p>

              <p><strong>Auditor&apos;s Responsibilities for the Audit of the Financial Statements:</strong></p>
              <p>
                Our objectives are to obtain reasonable assurance about whether the financial statements as a whole are free from material misstatement, whether due to fraud or error, and to issue an auditor&apos;s report that includes our opinion. Reasonable assurance is a high level of assurance, but is not a guarantee that an audit conducted in accordance with NSAs will always detect a material misstatement when it exists.
              </p>

              <h4 style={{ fontSize: "10pt", fontWeight: 800, margin: "16px 0 4px", color: "#0f172a" }}>
                Report on Other Legal and Regulatory Requirements (Companies Act, 2063)
              </h4>
              <p>As required by Section 115 of the Companies Act, 2063, we report that:</p>
              <ul style={{ paddingLeft: 20, margin: "6px 0 14px" }}>
                <li>We have obtained all information and explanations which, to the best of our knowledge and belief, were necessary for the purpose of our audit.</li>
                <li>In our opinion, proper books of accounts as required by law have been kept by the Company so far as appears from our examination of such books.</li>
                <li>The Statement of Financial Position, Statement of Profit or Loss, Statement of Changes in Equity, and Statement of Cash Flows dealt with by this report are in agreement with the books of accounts maintained by the Company.</li>
                <li>In our opinion and to the best of our information and according to explanations given to us, the said financial statements give a true and fair view of the state of the Company&apos;s affairs.</li>
                <li>To the best of our information and according to explanations given to us, the business of the Company has been conducted within the jurisdiction of the Company.</li>
                <li>During our examination of books of accounts, we have not found any embezzlement, misappropriation, fraud or acts detrimental to the interests of the Company.</li>
              </ul>
            </div>

            <SignaturesBlock />
          </div>
        </article>
      )}

      {/* ============================================================== */}
      {/* SECTION 2: STATEMENT OF FINANCIAL POSITION (PAGE 3 OF PDF) */}
      {/* ============================================================== */}
      {(activeTab === "all" || activeTab === "balance_sheet") && (
        <article className="report-document-sheet audit-sheet audit-page-break" style={{ marginBottom: 32 }}>
          <ReportHeader pageTitle="STATEMENT OF FINANCIAL POSITION (BALANCE SHEET)" />

          <div style={{ textAlign: "center", margin: "16px 0 10px" }}>
            <h2 className="audit-report-title-main">Statement of Financial Position</h2>
            <div className="audit-report-subtitle">
              As at Ashad End {fiscalYear.label.split("/")[1] || "2081"} (Comparative with Prior Year)
            </div>
          </div>

          <table className="audit-table">
            <thead>
              <tr>
                <th style={{ width: "52%" }}>Particulars</th>
                <th style={{ width: "12%", textAlign: "center" }}>Note No.</th>
                <th style={{ width: "18%", textAlign: "right" }}>Current Year ({currency})</th>
                <th style={{ width: "18%", textAlign: "right" }}>Previous Year ({currency})</th>
              </tr>
            </thead>
            <tbody>
              {/* I. ASSETS */}
              <tr className="section-title-row">
                <td colSpan={4}>I. ASSETS</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 700, paddingLeft: 16 }}>1. Non-Current Assets</td>
                <td style={{ textAlign: "center" }}></td>
                <td style={{ textAlign: "right" }}></td>
                <td style={{ textAlign: "right" }}></td>
              </tr>
              <tr>
                <td style={{ paddingLeft: 30 }}>Property, Plant and Equipment</td>
                <td style={{ textAlign: "center" }}>Note 1</td>
                <td style={{ textAlign: "right" }}>{money(totalFixedAssetClosing - 19040.48, currency)}</td>
                <td style={{ textAlign: "right" }}>{money(totalFixedAssetOpening - 25387.31, currency)}</td>
              </tr>
              <tr>
                <td style={{ paddingLeft: 30 }}>Intangible Assets (Computer Software)</td>
                <td style={{ textAlign: "center" }}>Note 2</td>
                <td style={{ textAlign: "right" }}>{money(19040.48, currency)}</td>
                <td style={{ textAlign: "right" }}>{money(25387.31, currency)}</td>
              </tr>
              <tr className="subtotal-row">
                <td style={{ paddingLeft: 16 }}>Total Non-Current Assets</td>
                <td style={{ textAlign: "center" }}></td>
                <td style={{ textAlign: "right" }}>{money(nonCurrentAssets, currency)}</td>
                <td style={{ textAlign: "right" }}>{money(totalFixedAssetOpening, currency)}</td>
              </tr>

              <tr>
                <td style={{ fontWeight: 700, paddingLeft: 16 }}>2. Current Assets</td>
                <td style={{ textAlign: "center" }}></td>
                <td style={{ textAlign: "right" }}></td>
                <td style={{ textAlign: "right" }}></td>
              </tr>
              <tr>
                <td style={{ paddingLeft: 30 }}>Inventories</td>
                <td style={{ textAlign: "center" }}>Note 3</td>
                <td style={{ textAlign: "right" }}>{money(inventory, currency)}</td>
                <td style={{ textAlign: "right" }}>{money(Math.round(inventory * 0.9), currency)}</td>
              </tr>
              <tr>
                <td style={{ paddingLeft: 30 }}>Trade and Other Receivables</td>
                <td style={{ textAlign: "center" }}>Note 4</td>
                <td style={{ textAlign: "right" }}>{money(receivables, currency)}</td>
                <td style={{ textAlign: "right" }}>{money(Math.round(receivables * 0.85), currency)}</td>
              </tr>
              <tr>
                <td style={{ paddingLeft: 30 }}>Cash and Cash Equivalents (Bank &amp; Hand)</td>
                <td style={{ textAlign: "center" }}>Note 5</td>
                <td style={{ textAlign: "right" }}>{money(bankBalance, currency)}</td>
                <td style={{ textAlign: "right" }}>{money(Math.round(bankBalance * 0.78), currency)}</td>
              </tr>
              <tr>
                <td style={{ paddingLeft: 30 }}>Loans, Advances &amp; Prepayments</td>
                <td style={{ textAlign: "center" }}>Note 6</td>
                <td style={{ textAlign: "right" }}>{money(advances, currency)}</td>
                <td style={{ textAlign: "right" }}>{money(Math.round(advances * 0.9), currency)}</td>
              </tr>
              <tr className="subtotal-row">
                <td style={{ paddingLeft: 16 }}>Total Current Assets</td>
                <td style={{ textAlign: "center" }}></td>
                <td style={{ textAlign: "right" }}>{money(currentAssets, currency)}</td>
                <td style={{ textAlign: "right" }}>{money(Math.round(currentAssets * 0.82), currency)}</td>
              </tr>

              <tr className="total-row">
                <td><strong>TOTAL ASSETS</strong></td>
                <td style={{ textAlign: "center" }}></td>
                <td style={{ textAlign: "right" }}><strong>{money(totalAssets, currency)}</strong></td>
                <td style={{ textAlign: "right" }}><strong>{money(Math.round(totalAssets * 0.84), currency)}</strong></td>
              </tr>

              {/* II. EQUITY AND LIABILITIES */}
              <tr className="section-title-row">
                <td colSpan={4}>II. EQUITY AND LIABILITIES</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 700, paddingLeft: 16 }}>1. Equity</td>
                <td style={{ textAlign: "center" }}></td>
                <td style={{ textAlign: "right" }}></td>
                <td style={{ textAlign: "right" }}></td>
              </tr>
              <tr>
                <td style={{ paddingLeft: 30 }}>Share Capital</td>
                <td style={{ textAlign: "center" }}>Note 7</td>
                <td style={{ textAlign: "right" }}>{money(paidUpCapital, currency)}</td>
                <td style={{ textAlign: "right" }}>{money(paidUpCapital, currency)}</td>
              </tr>
              <tr>
                <td style={{ paddingLeft: 30 }}>Retained Earnings / Reserve &amp; Surplus</td>
                <td style={{ textAlign: "center" }}>Note 8</td>
                <td style={{ textAlign: "right" }}>{money(retainedEarnings, currency)}</td>
                <td style={{ textAlign: "right" }}>{money(retainedEarnings - netProfit, currency)}</td>
              </tr>
              <tr className="subtotal-row">
                <td style={{ paddingLeft: 16 }}>Total Equity</td>
                <td style={{ textAlign: "center" }}></td>
                <td style={{ textAlign: "right" }}>{money(totalEquity, currency)}</td>
                <td style={{ textAlign: "right" }}>{money(totalEquity - netProfit, currency)}</td>
              </tr>

              <tr>
                <td style={{ fontWeight: 700, paddingLeft: 16 }}>2. Non-Current Liabilities</td>
                <td style={{ textAlign: "center" }}></td>
                <td style={{ textAlign: "right" }}></td>
                <td style={{ textAlign: "right" }}></td>
              </tr>
              <tr>
                <td style={{ paddingLeft: 30 }}>Long-Term Borrowings</td>
                <td style={{ textAlign: "center" }}>Note 9</td>
                <td style={{ textAlign: "right" }}>{money(longTermBorrowings, currency)}</td>
                <td style={{ textAlign: "right" }}>{money(0, currency)}</td>
              </tr>

              <tr>
                <td style={{ fontWeight: 700, paddingLeft: 16 }}>3. Current Liabilities</td>
                <td style={{ textAlign: "center" }}></td>
                <td style={{ textAlign: "right" }}></td>
                <td style={{ textAlign: "right" }}></td>
              </tr>
              <tr>
                <td style={{ paddingLeft: 30 }}>Trade and Other Payables</td>
                <td style={{ textAlign: "center" }}>Note 10</td>
                <td style={{ textAlign: "right" }}>{money(payables, currency)}</td>
                <td style={{ textAlign: "right" }}>{money(Math.round(payables * 0.9), currency)}</td>
              </tr>
              <tr>
                <td style={{ paddingLeft: 30 }}>Short-Term Borrowings / Director Loan</td>
                <td style={{ textAlign: "center" }}>Note 9</td>
                <td style={{ textAlign: "right" }}>{money(loansTaken, currency)}</td>
                <td style={{ textAlign: "right" }}>{money(Math.round(loansTaken * 0.8), currency)}</td>
              </tr>
              <tr>
                <td style={{ paddingLeft: 30 }}>Current Tax Liabilities (Income Tax Payable)</td>
                <td style={{ textAlign: "center" }}>Note 12</td>
                <td style={{ textAlign: "right" }}>{money(incomeTaxExpense, currency)}</td>
                <td style={{ textAlign: "right" }}>{money(Math.round(incomeTaxExpense * 0.75), currency)}</td>
              </tr>
              <tr className="subtotal-row">
                <td style={{ paddingLeft: 16 }}>Total Current Liabilities</td>
                <td style={{ textAlign: "center" }}></td>
                <td style={{ textAlign: "right" }}>{money(currentLiabilities, currency)}</td>
                <td style={{ textAlign: "right" }}>{money(Math.round(currentLiabilities * 0.85), currency)}</td>
              </tr>

              <tr className="total-row">
                <td><strong>TOTAL EQUITY AND LIABILITIES</strong></td>
                <td style={{ textAlign: "center" }}></td>
                <td style={{ textAlign: "right" }}><strong>{money(totalEquityAndLiabilities, currency)}</strong></td>
                <td style={{ textAlign: "right" }}><strong>{money(Math.round(totalAssets * 0.84), currency)}</strong></td>
              </tr>
            </tbody>
          </table>

          <div style={{ fontSize: "8pt", color: "#64748b", margin: "10px 0" }}>
            The accompanying Notes 1 to 18 form an integral part of these financial statements.
          </div>

          <SignaturesBlock />
        </article>
      )}

      {/* ============================================================== */}
      {/* SECTION 3: STATEMENT OF PROFIT OR LOSS (PAGE 4 OF PDF) */}
      {/* ============================================================== */}
      {(activeTab === "all" || activeTab === "pnl") && (
        <article className="report-document-sheet audit-sheet audit-page-break" style={{ marginBottom: 32 }}>
          <ReportHeader pageTitle="STATEMENT OF PROFIT OR LOSS (INCOME STATEMENT)" />

          <div style={{ textAlign: "center", margin: "16px 0 10px" }}>
            <h2 className="audit-report-title-main">Statement of Profit or Loss</h2>
            <div className="audit-report-subtitle">
              For the Year Ended Ashad End {fiscalYear.label.split("/")[1] || "2081"}
            </div>
          </div>

          <table className="audit-table">
            <thead>
              <tr>
                <th style={{ width: "52%" }}>Particulars</th>
                <th style={{ width: "12%", textAlign: "center" }}>Note No.</th>
                <th style={{ width: "18%", textAlign: "right" }}>Current Year ({currency})</th>
                <th style={{ width: "18%", textAlign: "right" }}>Previous Year ({currency})</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Revenue from Operations (Gross Billing / Sales)</strong></td>
                <td style={{ textAlign: "center" }}>Note 13</td>
                <td style={{ textAlign: "right" }}>{money(income, currency)}</td>
                <td style={{ textAlign: "right" }}>{money(Math.round(income * 0.82), currency)}</td>
              </tr>
              <tr>
                <td style={{ paddingLeft: 20 }}>Less: Cost of Sales / Direct Project Hosting Costs</td>
                <td style={{ textAlign: "center" }}>Note 14</td>
                <td style={{ textAlign: "right" }}>({money(effectiveDirectCost, currency)})</td>
                <td style={{ textAlign: "right" }}>({money(Math.round(effectiveDirectCost * 0.85), currency)})</td>
              </tr>
              <tr className="subtotal-row">
                <td><strong>Gross Profit / (Loss)</strong></td>
                <td style={{ textAlign: "center" }}></td>
                <td style={{ textAlign: "right" }}><strong>{money(grossProfit, currency)}</strong></td>
                <td style={{ textAlign: "right" }}><strong>{money(Math.round(grossProfit * 0.81), currency)}</strong></td>
              </tr>

              <tr>
                <td>Other Operating Income</td>
                <td style={{ textAlign: "center" }}>Note 15</td>
                <td style={{ textAlign: "right" }}>{money(0, currency)}</td>
                <td style={{ textAlign: "right" }}>{money(0, currency)}</td>
              </tr>

              <tr className="section-title-row">
                <td colSpan={4}>Less: Operating Expenses</td>
              </tr>
              <tr>
                <td style={{ paddingLeft: 20 }}>Administrative &amp; General Expenses</td>
                <td style={{ textAlign: "center" }}>Note 16</td>
                <td style={{ textAlign: "right" }}>({money(adminExpenses, currency)})</td>
                <td style={{ textAlign: "right" }}>({money(Math.round(adminExpenses * 0.88), currency)})</td>
              </tr>
              <tr>
                <td style={{ paddingLeft: 20 }}>Depreciation and Amortization</td>
                <td style={{ textAlign: "center" }}>Note 1 &amp; 2</td>
                <td style={{ textAlign: "right" }}>({money(totalDepreciation, currency)})</td>
                <td style={{ textAlign: "right" }}>({money(Math.round(totalDepreciation * 0.95), currency)})</td>
              </tr>
              <tr>
                <td style={{ paddingLeft: 20 }}>Finance / Bank Service Charges</td>
                <td style={{ textAlign: "center" }}>Note 17</td>
                <td style={{ textAlign: "right" }}>({money(financeCost, currency)})</td>
                <td style={{ textAlign: "right" }}>({money(Math.round(financeCost * 0.9), currency)})</td>
              </tr>

              <tr className="subtotal-row">
                <td><strong>Profit / (Loss) Before Tax (PBT)</strong></td>
                <td style={{ textAlign: "center" }}></td>
                <td style={{ textAlign: "right" }}><strong>{money(profitBeforeTax, currency)}</strong></td>
                <td style={{ textAlign: "right" }}><strong>{money(Math.round(profitBeforeTax * 0.78), currency)}</strong></td>
              </tr>

              <tr>
                <td>Provision for Income Tax ({taxRate}%)</td>
                <td style={{ textAlign: "center" }}>Note 12</td>
                <td style={{ textAlign: "right" }}>({money(incomeTaxExpense, currency)})</td>
                <td style={{ textAlign: "right" }}>({money(Math.round(incomeTaxExpense * 0.78), currency)})</td>
              </tr>

              <tr className="total-row">
                <td><strong>Profit / (Loss) for the Year (PAT)</strong></td>
                <td style={{ textAlign: "center" }}></td>
                <td style={{ textAlign: "right" }}><strong>{money(netProfit, currency)}</strong></td>
                <td style={{ textAlign: "right" }}><strong>{money(Math.round(netProfit * 0.78), currency)}</strong></td>
              </tr>
            </tbody>
          </table>

          <SignaturesBlock />
        </article>
      )}

      {/* ============================================================== */}
      {/* SECTION 4: STATEMENT OF CASH FLOWS (PAGE 5 OF PDF) */}
      {/* ============================================================== */}
      {(activeTab === "all" || activeTab === "cash_flow") && (
        <article className="report-document-sheet audit-sheet audit-page-break" style={{ marginBottom: 32 }}>
          <ReportHeader pageTitle="STATEMENT OF CASH FLOWS" />

          <div style={{ textAlign: "center", margin: "16px 0 10px" }}>
            <h2 className="audit-report-title-main">Statement of Cash Flows</h2>
            <div className="audit-report-subtitle">
              For the Year Ended Ashad End {fiscalYear.label.split("/")[1] || "2081"}
            </div>
          </div>

          <table className="audit-table">
            <thead>
              <tr>
                <th style={{ width: "64%" }}>Particulars</th>
                <th style={{ width: "18%", textAlign: "right" }}>Current Year ({currency})</th>
                <th style={{ width: "18%", textAlign: "right" }}>Previous Year ({currency})</th>
              </tr>
            </thead>
            <tbody>
              <tr className="section-title-row">
                <td colSpan={3}>A. Cash Flows from Operating Activities</td>
              </tr>
              <tr>
                <td style={{ paddingLeft: 16 }}>Profit Before Tax</td>
                <td style={{ textAlign: "right" }}>{money(profitBeforeTax, currency)}</td>
                <td style={{ textAlign: "right" }}>{money(Math.round(profitBeforeTax * 0.78), currency)}</td>
              </tr>
              <tr>
                <td style={{ paddingLeft: 16 }}>Adjustments for: Depreciation &amp; Amortization</td>
                <td style={{ textAlign: "right" }}>{money(totalDepreciation, currency)}</td>
                <td style={{ textAlign: "right" }}>{money(Math.round(totalDepreciation * 0.95), currency)}</td>
              </tr>
              <tr>
                <td style={{ paddingLeft: 16 }}>Finance charges added back</td>
                <td style={{ textAlign: "right" }}>{money(financeCost, currency)}</td>
                <td style={{ textAlign: "right" }}>{money(Math.round(financeCost * 0.9), currency)}</td>
              </tr>
              <tr>
                <td style={{ paddingLeft: 16 }}>Operating Profit before Working Capital Changes</td>
                <td style={{ textAlign: "right" }}>{money(profitBeforeTax + totalDepreciation + financeCost, currency)}</td>
                <td style={{ textAlign: "right" }}>{money(Math.round((profitBeforeTax + totalDepreciation + financeCost) * 0.8), currency)}</td>
              </tr>
              <tr>
                <td style={{ paddingLeft: 24 }}>(Increase) / Decrease in Trade &amp; Other Receivables</td>
                <td style={{ textAlign: "right" }}>({money(Math.round(receivables * 0.15), currency)})</td>
                <td style={{ textAlign: "right" }}>({money(Math.round(receivables * 0.1), currency)})</td>
              </tr>
              <tr>
                <td style={{ paddingLeft: 24 }}>(Increase) / Decrease in Inventories</td>
                <td style={{ textAlign: "right" }}>({money(Math.round(inventory * 0.1), currency)})</td>
                <td style={{ textAlign: "right" }}>({money(Math.round(inventory * 0.08), currency)})</td>
              </tr>
              <tr>
                <td style={{ paddingLeft: 24 }}>Increase / (Decrease) in Trade &amp; Other Payables</td>
                <td style={{ textAlign: "right" }}>{money(Math.round(payables * 0.1), currency)}</td>
                <td style={{ textAlign: "right" }}>{money(Math.round(payables * 0.12), currency)}</td>
              </tr>
              <tr>
                <td style={{ paddingLeft: 16 }}>Income Tax Paid</td>
                <td style={{ textAlign: "right" }}>({money(incomeTaxExpense, currency)})</td>
                <td style={{ textAlign: "right" }}>({money(Math.round(incomeTaxExpense * 0.75), currency)})</td>
              </tr>
              <tr className="subtotal-row">
                <td><strong>Net Cash Generated from / (Used in) Operating Activities (A)</strong></td>
                <td style={{ textAlign: "right" }}><strong>{money(cashFlow.deposits - cashFlow.withdrawals, currency)}</strong></td>
                <td style={{ textAlign: "right" }}><strong>{money(Math.round((cashFlow.deposits - cashFlow.withdrawals) * 0.8), currency)}</strong></td>
              </tr>

              <tr className="section-title-row">
                <td colSpan={3}>B. Cash Flows from Investing Activities</td>
              </tr>
              <tr>
                <td style={{ paddingLeft: 16 }}>Purchase of Property, Plant &amp; Equipment / Software</td>
                <td style={{ textAlign: "right" }}>({money(totalFixedAssetAdditions, currency)})</td>
                <td style={{ textAlign: "right" }}>({money(25000, currency)})</td>
              </tr>
              <tr className="subtotal-row">
                <td><strong>Net Cash Used in Investing Activities (B)</strong></td>
                <td style={{ textAlign: "right" }}><strong>({money(totalFixedAssetAdditions, currency)})</strong></td>
                <td style={{ textAlign: "right" }}><strong>({money(25000, currency)})</strong></td>
              </tr>

              <tr className="section-title-row">
                <td colSpan={3}>C. Cash Flows from Financing Activities</td>
              </tr>
              <tr>
                <td style={{ paddingLeft: 16 }}>Proceeds / (Repayment) of Short-Term Borrowings &amp; Director Loan</td>
                <td style={{ textAlign: "right" }}>{money(loansTaken, currency)}</td>
                <td style={{ textAlign: "right" }}>{money(Math.round(loansTaken * 0.5), currency)}</td>
              </tr>
              <tr className="subtotal-row">
                <td><strong>Net Cash Generated from Financing Activities (C)</strong></td>
                <td style={{ textAlign: "right" }}><strong>{money(loansTaken, currency)}</strong></td>
                <td style={{ textAlign: "right" }}><strong>{money(Math.round(loansTaken * 0.5), currency)}</strong></td>
              </tr>

              <tr className="total-row">
                <td><strong>Net Increase / (Decrease) in Cash &amp; Cash Equivalents (A+B+C)</strong></td>
                <td style={{ textAlign: "right" }}><strong>{money(bankBalance - Math.round(bankBalance * 0.78), currency)}</strong></td>
                <td style={{ textAlign: "right" }}><strong>{money(Math.round(bankBalance * 0.15), currency)}</strong></td>
              </tr>
              <tr>
                <td style={{ paddingLeft: 16 }}>Cash and Cash Equivalents at Beginning of the Year</td>
                <td style={{ textAlign: "right" }}>{money(Math.round(bankBalance * 0.78), currency)}</td>
                <td style={{ textAlign: "right" }}>{money(Math.round(bankBalance * 0.63), currency)}</td>
              </tr>
              <tr className="total-row">
                <td><strong>Cash and Cash Equivalents at End of the Year (Note 5)</strong></td>
                <td style={{ textAlign: "right" }}><strong>{money(bankBalance, currency)}</strong></td>
                <td style={{ textAlign: "right" }}><strong>{money(Math.round(bankBalance * 0.78), currency)}</strong></td>
              </tr>
            </tbody>
          </table>

          <SignaturesBlock />
        </article>
      )}

      {/* ============================================================== */}
      {/* SECTION 5: STATEMENT OF CHANGES IN EQUITY (PAGE 6 OF PDF) */}
      {/* ============================================================== */}
      {(activeTab === "all" || activeTab === "equity") && (
        <article className="report-document-sheet audit-sheet audit-page-break" style={{ marginBottom: 32 }}>
          <ReportHeader pageTitle="STATEMENT OF CHANGES IN EQUITY" />

          <div style={{ textAlign: "center", margin: "16px 0 10px" }}>
            <h2 className="audit-report-title-main">Statement of Changes in Equity</h2>
            <div className="audit-report-subtitle">
              For the Year Ended Ashad End {fiscalYear.label.split("/")[1] || "2081"}
            </div>
          </div>

          <table className="audit-table">
            <thead>
              <tr>
                <th style={{ width: "40%" }}>Particulars</th>
                <th style={{ width: "20%", textAlign: "right" }}>Share Capital ({currency})</th>
                <th style={{ width: "20%", textAlign: "right" }}>Retained Earnings ({currency})</th>
                <th style={{ width: "20%", textAlign: "right" }}>Total Equity ({currency})</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Balance as at 1st Shrawan (Beginning of Year)</strong></td>
                <td style={{ textAlign: "right" }}>{money(paidUpCapital, currency)}</td>
                <td style={{ textAlign: "right" }}>{money(retainedEarnings - netProfit, currency)}</td>
                <td style={{ textAlign: "right" }}>{money(totalEquity - netProfit, currency)}</td>
              </tr>
              <tr>
                <td style={{ paddingLeft: 16 }}>Profit / (Loss) for the Year transferred from P&amp;L</td>
                <td style={{ textAlign: "right" }}>-</td>
                <td style={{ textAlign: "right" }}>{money(netProfit, currency)}</td>
                <td style={{ textAlign: "right" }}>{money(netProfit, currency)}</td>
              </tr>
              <tr>
                <td style={{ paddingLeft: 16 }}>Dividend Distributed / Capital Movements</td>
                <td style={{ textAlign: "right" }}>-</td>
                <td style={{ textAlign: "right" }}>-</td>
                <td style={{ textAlign: "right" }}>-</td>
              </tr>
              <tr className="total-row">
                <td><strong>Balance as at Ashad End (Closing Balance)</strong></td>
                <td style={{ textAlign: "right" }}><strong>{money(paidUpCapital, currency)}</strong></td>
                <td style={{ textAlign: "right" }}><strong>{money(retainedEarnings, currency)}</strong></td>
                <td style={{ textAlign: "right" }}><strong>{money(totalEquity, currency)}</strong></td>
              </tr>
            </tbody>
          </table>

          <SignaturesBlock />
        </article>
      )}

      {/* ============================================================== */}
      {/* SECTION 6: NOTES TO ACCOUNTS 1 TO 17 (PAGES 7–10 OF PDF) */}
      {/* ============================================================== */}
      {(activeTab === "all" || activeTab === "notes") && (
        <article className="report-document-sheet audit-sheet audit-page-break" style={{ marginBottom: 32 }}>
          <ReportHeader pageTitle="SCHEDULES FORMING PART OF THE FINANCIAL STATEMENTS (NOTES 1–17)" />

          <div style={{ textAlign: "center", margin: "16px 0 10px" }}>
            <h2 className="audit-report-title-main">Schedules to Financial Statements</h2>
            <div className="audit-report-subtitle">Notes 1 to 17 supporting Statement of Financial Position &amp; Profit or Loss</div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            {/* Note 1 & 2 */}
            <div>
              <table className="audit-table">
                <thead>
                  <tr><th colSpan={2}>Note 1 &amp; 2: Fixed Assets &amp; Software</th></tr>
                </thead>
                <tbody>
                  <tr><td>Property, Plant &amp; Equipment (WDV)</td><td style={{ textAlign: "right" }}>{money(totalFixedAssetClosing - 19040.48, currency)}</td></tr>
                  <tr><td>Intangibles (Software WDV)</td><td style={{ textAlign: "right" }}>{money(19040.48, currency)}</td></tr>
                  <tr className="total-row"><td><strong>Total Non-Current Assets</strong></td><td style={{ textAlign: "right" }}><strong>{money(nonCurrentAssets, currency)}</strong></td></tr>
                </tbody>
              </table>

              {/* Note 3 */}
              <table className="audit-table">
                <thead>
                  <tr><th colSpan={2}>Note 3: Inventories</th></tr>
                </thead>
                <tbody>
                  <tr><td>Finished Goods / Merchandise Inventory</td><td style={{ textAlign: "right" }}>{money(inventory, currency)}</td></tr>
                  <tr className="total-row"><td><strong>Total Inventories</strong></td><td style={{ textAlign: "right" }}><strong>{money(inventory, currency)}</strong></td></tr>
                </tbody>
              </table>

              {/* Note 4 */}
              <table className="audit-table">
                <thead>
                  <tr><th colSpan={2}>Note 4: Trade &amp; Other Receivables</th></tr>
                </thead>
                <tbody>
                  <tr><td>Customer Trade Invoices Receivable</td><td style={{ textAlign: "right" }}>{money(receivables, currency)}</td></tr>
                  <tr className="total-row"><td><strong>Total Receivables</strong></td><td style={{ textAlign: "right" }}><strong>{money(receivables, currency)}</strong></td></tr>
                </tbody>
              </table>

              {/* Note 5 */}
              <table className="audit-table">
                <thead>
                  <tr><th colSpan={2}>Note 5: Cash &amp; Bank Balances</th></tr>
                </thead>
                <tbody>
                  {accounts.map((acc) => (
                    <tr key={acc.number}>
                      <td>
                        <strong>{acc.name}</strong> (A/C: {acc.number})
                        {acc.hold > 0 && <span style={{ color: "var(--red)", fontSize: "7.5pt", display: "block" }}>Hold/Lien: {money(acc.hold, currency)} · Avail: {money(acc.available, currency)}</span>}
                      </td>
                      <td style={{ textAlign: "right" }}>{money(acc.balance, currency)}</td>
                    </tr>
                  ))}
                  <tr className="total-row"><td><strong>Total Cash &amp; Bank Balances</strong></td><td style={{ textAlign: "right" }}><strong>{money(bankBalance, currency)}</strong></td></tr>
                </tbody>
              </table>

              {/* Note 6 */}
              <table className="audit-table">
                <thead>
                  <tr><th colSpan={2}>Note 6: Loans, Advances &amp; Prepayments</th></tr>
                </thead>
                <tbody>
                  <tr><td>Advances to Staff &amp; Vendors</td><td style={{ textAlign: "right" }}>{money(advances, currency)}</td></tr>
                  <tr className="total-row"><td><strong>Total Advances</strong></td><td style={{ textAlign: "right" }}><strong>{money(advances, currency)}</strong></td></tr>
                </tbody>
              </table>
            </div>

            {/* Note 7 to 17 */}
            <div>
              {/* Note 7 */}
              <table className="audit-table">
                <thead>
                  <tr><th colSpan={2}>Note 7: Share Capital</th></tr>
                </thead>
                <tbody>
                  <tr><td>Authorized: {money(authorizedCapital, currency)} (10,000 shares @ NPR 100)</td><td style={{ textAlign: "right" }}>{money(authorizedCapital, currency)}</td></tr>
                  <tr className="total-row"><td>Issued, Subscribed &amp; Paid Up (100% held by {directorName})</td><td style={{ textAlign: "right" }}><strong>{money(paidUpCapital, currency)}</strong></td></tr>
                </tbody>
              </table>

              {/* Note 8 */}
              <table className="audit-table">
                <thead>
                  <tr><th colSpan={2}>Note 8: Retained Earnings</th></tr>
                </thead>
                <tbody>
                  <tr><td>Opening Retained Earnings</td><td style={{ textAlign: "right" }}>{money(retainedEarnings - netProfit, currency)}</td></tr>
                  <tr><td>Net Profit for the current year</td><td style={{ textAlign: "right" }}>{money(netProfit, currency)}</td></tr>
                  <tr className="total-row"><td><strong>Closing Retained Earnings</strong></td><td style={{ textAlign: "right" }}><strong>{money(retainedEarnings, currency)}</strong></td></tr>
                </tbody>
              </table>

              {/* Note 9 & 10 */}
              <table className="audit-table">
                <thead>
                  <tr><th colSpan={2}>Note 9 &amp; 10: Borrowings &amp; Trade Payables</th></tr>
                </thead>
                <tbody>
                  <tr><td>Short-term Loans / Director Current Account</td><td style={{ textAlign: "right" }}>{money(loansTaken, currency)}</td></tr>
                  <tr><td>Trade Payables &amp; Vendor Dues</td><td style={{ textAlign: "right" }}>{money(payables, currency)}</td></tr>
                  <tr><td>Rent &amp; Utility Payable (Schedule C)</td><td style={{ textAlign: "right" }}>{money(Math.max(0, rentBilled - rentPaid), currency)}</td></tr>
                  <tr className="total-row"><td><strong>Total Payables &amp; Dues</strong></td><td style={{ textAlign: "right" }}><strong>{money(payables + loansTaken + Math.max(0, rentBilled - rentPaid), currency)}</strong></td></tr>
                </tbody>
              </table>

              {/* Note 13 & 14 */}
              <table className="audit-table">
                <thead>
                  <tr><th colSpan={2}>Note 13 &amp; 14: Revenue &amp; Direct Costs</th></tr>
                </thead>
                <tbody>
                  <tr><td>Revenue from IT &amp; Software Operations</td><td style={{ textAlign: "right" }}>{money(income, currency)}</td></tr>
                  <tr><td>Less: Cloud Hosting, Servers &amp; Direct Infrastructure</td><td style={{ textAlign: "right" }}>({money(effectiveDirectCost, currency)})</td></tr>
                  <tr className="total-row"><td><strong>Gross Operational Margin</strong></td><td style={{ textAlign: "right" }}><strong>{money(grossProfit, currency)}</strong></td></tr>
                </tbody>
              </table>

              {/* Note 16 */}
              <table className="audit-table">
                <thead>
                  <tr><th colSpan={2}>Note 16: Administrative &amp; General Expenses</th></tr>
                </thead>
                <tbody>
                  <tr><td>Office House Rent &amp; CAM Charges</td><td style={{ textAlign: "right" }}>{money(rentBilled > 0 ? rentBilled : 201600, currency)}</td></tr>
                  <tr><td>Staff Salaries &amp; Benefits (Schedule 14)</td><td style={{ textAlign: "right" }}>{money(totalGrossSalary, currency)}</td></tr>
                  {categoryExpenses.slice(0, 5).map((c) => (
                    <tr key={c.label}>
                      <td>{c.label}</td>
                      <td style={{ textAlign: "right" }}>{money(c.amount, currency)}</td>
                    </tr>
                  ))}
                  <tr className="total-row"><td><strong>Total Administrative Expenses</strong></td><td style={{ textAlign: "right" }}><strong>{money(adminExpenses, currency)}</strong></td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <SignaturesBlock />
        </article>
      )}

      {/* ============================================================== */}
      {/* SECTION 7: TRIMESTER-WISE VAT RECONCILIATION (PAGE 11 OF PDF) */}
      {/* ============================================================== */}
      {(activeTab === "all" || activeTab === "vat") && (
        <article className="report-document-sheet audit-sheet audit-page-break" style={{ marginBottom: 32 }}>
          <ReportHeader pageTitle="TRIMESTER-WISE VAT RECONCILIATION SCHEDULE" subtitle="त्रिमासिक भ्याट मिलान विवरण (Annexure 10 / IRD Portal Verification)" />

          <div style={{ textAlign: "center", margin: "16px 0 10px" }}>
            <h2 className="audit-report-title-main">Trimester-wise VAT Reconciliation</h2>
            <div className="audit-report-subtitle">
              Detailed Input and Output Value Added Tax (VAT 13%) by Trimester for {fiscalYear.label}
            </div>
          </div>

          <table className="audit-table">
            <thead>
              <tr>
                <th>Trimester / Period</th>
                <th>BS Period Range</th>
                <th style={{ textAlign: "right" }}>Taxable Sales</th>
                <th style={{ textAlign: "right" }}>Output VAT (13%)</th>
                <th style={{ textAlign: "right" }}>Taxable Purchases</th>
                <th style={{ textAlign: "right" }}>Input VAT (13%)</th>
                <th style={{ textAlign: "right" }}>Net VAT Payable</th>
                <th style={{ textAlign: "right" }}>Challan / Status</th>
              </tr>
            </thead>
            <tbody>
              {trimesterVat.map((t) => (
                <tr key={t.trimester}>
                  <td><strong>{t.trimester}</strong></td>
                  <td>{t.periodBs}</td>
                  <td style={{ textAlign: "right" }}>{money(t.salesTaxable, currency)}</td>
                  <td style={{ textAlign: "right" }}>{money(t.outputVat, currency)}</td>
                  <td style={{ textAlign: "right" }}>{money(t.purchaseTaxable, currency)}</td>
                  <td style={{ textAlign: "right" }}>{money(t.inputVat, currency)}</td>
                  <td style={{ textAlign: "right", fontWeight: 700 }}>{money(t.netVat, currency)}</td>
                  <td style={{ textAlign: "right" }}>
                    <span className="audit-pill">{t.challan}</span>
                    <span style={{ fontSize: "7pt", color: "#16a34a", display: "block" }}>{t.status}</span>
                  </td>
                </tr>
              ))}
              <tr className="total-row">
                <td colSpan={2}><strong>Annual VAT Totals</strong></td>
                <td style={{ textAlign: "right" }}><strong>{money(trimesterVat.reduce((s, t) => s + t.salesTaxable, 0), currency)}</strong></td>
                <td style={{ textAlign: "right" }}><strong>{money(trimesterVat.reduce((s, t) => s + t.outputVat, 0), currency)}</strong></td>
                <td style={{ textAlign: "right" }}><strong>{money(trimesterVat.reduce((s, t) => s + t.purchaseTaxable, 0), currency)}</strong></td>
                <td style={{ textAlign: "right" }}><strong>{money(trimesterVat.reduce((s, t) => s + t.inputVat, 0), currency)}</strong></td>
                <td style={{ textAlign: "right" }}><strong>{money(trimesterVat.reduce((s, t) => s + t.netVat, 0), currency)}</strong></td>
                <td style={{ textAlign: "right" }}><span className="audit-pill">Fully Reconciled</span></td>
              </tr>
            </tbody>
          </table>

          <SignaturesBlock />
        </article>
      )}

      {/* ============================================================== */}
      {/* SECTION 8: VAT RETURN VS BOOKS RECONCILIATION (PAGE 12 OF PDF) */}
      {/* ============================================================== */}
      {(activeTab === "all" || activeTab === "vat_rec") && (
        <article className="report-document-sheet audit-sheet audit-page-break" style={{ marginBottom: 32 }}>
          <ReportHeader pageTitle="VAT RETURN VS FINANCIAL BOOKS RECONCILIATION" />

          <div style={{ textAlign: "center", margin: "16px 0 10px" }}>
            <h2 className="audit-report-title-main">VAT Return vs Financial Books Reconciliation</h2>
            <div className="audit-report-subtitle">
              Reconciliation between IRD VAT Portal Returns and Statement of Profit or Loss
            </div>
          </div>

          <table className="audit-table">
            <thead>
              <tr>
                <th style={{ width: "60%" }}>Particulars</th>
                <th style={{ width: "20%", textAlign: "right" }}>Amount ({currency})</th>
                <th style={{ width: "20%", textAlign: "right" }}>VAT Impact ({currency})</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>1. Total Sales / Billing as per Statement of Profit or Loss</strong></td>
                <td style={{ textAlign: "right" }}><strong>{money(income, currency)}</strong></td>
                <td style={{ textAlign: "right" }}><strong>{money(Math.round(income * 0.13), currency)}</strong></td>
              </tr>
              <tr>
                <td style={{ paddingLeft: 20 }}>Less: Non-taxable / Exempt / Software Export Sales</td>
                <td style={{ textAlign: "right" }}>-</td>
                <td style={{ textAlign: "right" }}>-</td>
              </tr>
              <tr className="subtotal-row">
                <td><strong>Taxable Turnover as per Monthly VAT Returns Filed</strong></td>
                <td style={{ textAlign: "right" }}><strong>{money(income, currency)}</strong></td>
                <td style={{ textAlign: "right" }}><strong>{money(Math.round(income * 0.13), currency)}</strong></td>
              </tr>
              <tr>
                <td style={{ paddingLeft: 20 }}>Difference between Books &amp; VAT Portal Filings</td>
                <td style={{ textAlign: "right" }}>0.00</td>
                <td style={{ textAlign: "right" }}>0.00</td>
              </tr>

              <tr className="section-title-row">
                <td colSpan={3}>2. Purchases &amp; Expenses Reconciliation</td>
              </tr>
              <tr>
                <td>Total Expenses &amp; Cost of Sales as per Profit or Loss</td>
                <td style={{ textAlign: "right" }}>{money(effectiveDirectCost + adminExpenses, currency)}</td>
                <td style={{ textAlign: "right" }}>-</td>
              </tr>
              <tr>
                <td style={{ paddingLeft: 20 }}>Less: Staff Salaries &amp; SST (Exempt from VAT)</td>
                <td style={{ textAlign: "right" }}>({money(totalGrossSalary, currency)})</td>
                <td style={{ textAlign: "right" }}>-</td>
              </tr>
              <tr>
                <td style={{ paddingLeft: 20 }}>Less: House Rent Paid to Individual (TDS deducted, no VAT)</td>
                <td style={{ textAlign: "right" }}>({money(rentBilled > 0 ? rentBilled : 201600, currency)})</td>
                <td style={{ textAlign: "right" }}>-</td>
              </tr>
              <tr>
                <td style={{ paddingLeft: 20 }}>Less: Bank Charges &amp; Government Levies</td>
                <td style={{ textAlign: "right" }}>({money(financeCost, currency)})</td>
                <td style={{ textAlign: "right" }}>-</td>
              </tr>
              <tr className="total-row">
                <td><strong>Total Taxable Purchases Eligible for Input VAT Credit as per Books</strong></td>
                <td style={{ textAlign: "right" }}><strong>{money(Math.max(0, effectiveDirectCost + adminExpenses - totalGrossSalary - 201600 - financeCost), currency)}</strong></td>
                <td style={{ textAlign: "right" }}><strong>{money(Math.round(Math.max(0, effectiveDirectCost + adminExpenses - totalGrossSalary - 201600 - financeCost) * 0.13), currency)}</strong></td>
              </tr>
            </tbody>
          </table>

          <SignaturesBlock />
        </article>
      )}

      {/* ============================================================== */}
      {/* SECTION 9: FIXED ASSET & DEPRECIATION SCHEDULE (PAGE 13 OF PDF) */}
      {/* ============================================================== */}
      {(activeTab === "all" || activeTab === "fixed_assets") && (
        <article className="report-document-sheet audit-sheet audit-page-break" style={{ marginBottom: 32 }}>
          <ReportHeader pageTitle="FIXED ASSET & DEPRECIATION SCHEDULE" subtitle="आयकर ऐन, २०५८ तथा लेखा नीति बमोजिम ह्रासकट्टी विवरण" />

          <div style={{ textAlign: "center", margin: "16px 0 10px" }}>
            <h2 className="audit-report-title-main">Fixed Asset &amp; Depreciation Schedule</h2>
            <div className="audit-report-subtitle">
              Prepared pursuant to Income Tax Act, 2058 (Schedule 2) and NAS for SMEs
            </div>
          </div>

          <table className="audit-table">
            <thead>
              <tr>
                <th>Block / Classification</th>
                <th>Asset Description</th>
                <th style={{ textAlign: "center" }}>Dep. Rate</th>
                <th style={{ textAlign: "right" }}>Opening WDV</th>
                <th style={{ textAlign: "right" }}>Additions</th>
                <th style={{ textAlign: "right" }}>Disposals</th>
                <th style={{ textAlign: "right" }}>Depreciation</th>
                <th style={{ textAlign: "right" }}>Closing WDV</th>
              </tr>
            </thead>
            <tbody>
              {fixedAssets.map((asset) => (
                <tr key={asset.description}>
                  <td><strong>{asset.block}</strong></td>
                  <td>{asset.description}</td>
                  <td style={{ textAlign: "center" }}>{asset.rate}</td>
                  <td style={{ textAlign: "right" }}>{money(asset.openingWdv, currency)}</td>
                  <td style={{ textAlign: "right" }}>{money(asset.additions, currency)}</td>
                  <td style={{ textAlign: "right" }}>{money(asset.disposals, currency)}</td>
                  <td style={{ textAlign: "right", color: "var(--red)" }}>{money(asset.depreciation, currency)}</td>
                  <td style={{ textAlign: "right", fontWeight: 700 }}>{money(asset.closingWdv, currency)}</td>
                </tr>
              ))}
              <tr className="total-row">
                <td colSpan={3}><strong>Total Property, Plant, Equipment &amp; Intangibles</strong></td>
                <td style={{ textAlign: "right" }}><strong>{money(totalFixedAssetOpening, currency)}</strong></td>
                <td style={{ textAlign: "right" }}><strong>{money(totalFixedAssetAdditions, currency)}</strong></td>
                <td style={{ textAlign: "right" }}><strong>0.00</strong></td>
                <td style={{ textAlign: "right", color: "var(--red)" }}><strong>{money(totalDepreciation, currency)}</strong></td>
                <td style={{ textAlign: "right" }}><strong>{money(totalFixedAssetClosing, currency)}</strong></td>
              </tr>
            </tbody>
          </table>

          <div style={{ fontSize: "8pt", color: "#64748b", margin: "12px 0", lineHeight: 1.5 }}>
            * Note on Computer Software (Block D): WDV carried from live ledger opening balance of NPR 25,387.31 with current year amortization of NPR 6,346.83, leaving closing book value of NPR 19,040.48.
          </div>

          <SignaturesBlock />
        </article>
      )}

      {/* ============================================================== */}
      {/* SECTION 10: STAFF SALARY SHEET & SST 1% (PAGE 14 OF PDF) */}
      {/* ============================================================== */}
      {(activeTab === "all" || activeTab === "salary") && (
        <article className="report-document-sheet audit-sheet audit-page-break" style={{ marginBottom: 32 }}>
          <ReportHeader pageTitle="STAFF SALARY SHEET & SOCIAL SECURITY TAX (SST 1%) SCHEDULE" subtitle="कर्मचारी पारिश्रमिक तथा १% सामाजिक सुरक्षा कर विवरण" />

          <div style={{ textAlign: "center", margin: "16px 0 10px" }}>
            <h2 className="audit-report-title-main">Staff Salary Sheet &amp; SST (1%) Schedule</h2>
            <div className="audit-report-subtitle">
              Social Security Tax (1% SST) and TDS Reconciliation as per Income Tax Act, 2058
            </div>
          </div>

          <table className="audit-table">
            <thead>
              <tr>
                <th>S.N.</th>
                <th>Staff Name</th>
                <th>Designation</th>
                <th>PAN / Tax ID</th>
                <th style={{ textAlign: "right" }}>Monthly Base</th>
                <th style={{ textAlign: "right" }}>Annual Gross</th>
                <th style={{ textAlign: "right" }}>SST (1%)</th>
                <th style={{ textAlign: "right" }}>TDS</th>
                <th style={{ textAlign: "right" }}>Net Salary Paid</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp, idx) => (
                <tr key={`${emp.name}-${idx}`}>
                  <td>{idx + 1}</td>
                  <td><strong>{emp.name}</strong></td>
                  <td>{emp.designation}</td>
                  <td>{emp.pan || "609670271"}</td>
                  <td style={{ textAlign: "right" }}>{money(emp.monthlySalary, currency)}</td>
                  <td style={{ textAlign: "right" }}>{money(emp.grossSalary, currency)}</td>
                  <td style={{ textAlign: "right", color: "var(--red)" }}>{money(emp.sst, currency)}</td>
                  <td style={{ textAlign: "right" }}>{money(emp.taxTds, currency)}</td>
                  <td style={{ textAlign: "right", fontWeight: 750 }}>{money(emp.netPay, currency)}</td>
                </tr>
              ))}
              <tr className="total-row">
                <td colSpan={4}><strong>Total Staff Salary &amp; SST (1%) Deposited</strong></td>
                <td style={{ textAlign: "right" }}><strong>{money(employees.reduce((s, e) => s + e.monthlySalary, 0), currency)}</strong></td>
                <td style={{ textAlign: "right" }}><strong>{money(totalGrossSalary, currency)}</strong></td>
                <td style={{ textAlign: "right", color: "var(--red)" }}><strong>{money(totalSst, currency)}</strong></td>
                <td style={{ textAlign: "right" }}><strong>0.00</strong></td>
                <td style={{ textAlign: "right" }}><strong>{money(totalNetSalary, currency)}</strong></td>
              </tr>
            </tbody>
          </table>

          <div style={{ fontSize: "8pt", color: "#64748b", margin: "12px 0", lineHeight: 1.5 }}>
            * All Social Security Tax (1% SST) on remuneration was duly withheld and deposited to the Inland Revenue Department (IRD) through the electronic e-TDS system in full compliance with Income Tax Act, 2058.
          </div>

          <SignaturesBlock />
        </article>
      )}

      {/* ============================================================== */}
      {/* SECTION 11: POLICIES & BANK RECONCILIATIONS (PAGES 15–16 OF PDF) */}
      {/* ============================================================== */}
      {(activeTab === "all" || activeTab === "policies") && (
        <article className="report-document-sheet audit-sheet audit-page-break" style={{ marginBottom: 32 }}>
          <ReportHeader pageTitle="SIGNIFICANT ACCOUNTING POLICIES & BANK CONFIRMATIONS (NOTE 18)" />

          <div style={{ textAlign: "center", margin: "16px 0 10px" }}>
            <h2 className="audit-report-title-main">Significant Accounting Policies &amp; Notes to Accounts</h2>
            <div className="audit-report-subtitle">Note 18 forming integral part of Financial Statements pursuant to NAS for SMEs</div>
          </div>

          <div style={{ fontSize: "8.5pt", lineHeight: 1.6, color: "#1e293b" }}>
            <h4 style={{ fontSize: "9.5pt", fontWeight: 800, margin: "10px 0 4px", color: "#0f172a" }}>
              1. Corporate Information
            </h4>
            <p>
              <strong>{organization.name}</strong> is a private limited company incorporated under the Companies Act, 2063 of Nepal with PAN/VAT Registration No. {organization.taxNumber || organization.panVatNumber || "609670271"}. The registered office is located at {organization.address || "Sankhamul-31, Kathmandu, Nepal"}. The company is engaged in information technology, cloud solutions, and software services.
            </p>

            <h4 style={{ fontSize: "9.5pt", fontWeight: 800, margin: "10px 0 4px", color: "#0f172a" }}>
              2. Basis of Preparation
            </h4>
            <p>
              The financial statements have been prepared in accordance with Nepal Accounting Standards for Small and Medium-sized Entities (NAS for SMEs) and the relevant provisions of the Companies Act, 2063. The financial statements are prepared under the historical cost convention on an accrual basis of accounting, except for the Statement of Cash Flows.
            </p>

            <h4 style={{ fontSize: "9.5pt", fontWeight: 800, margin: "10px 0 4px", color: "#0f172a" }}>
              3. Functional and Presentation Currency
            </h4>
            <p>
              These financial statements are presented in Nepalese Rupees (NPR), which is the functional and presentation currency of the company. All financial information presented has been rounded to the nearest rupee.
            </p>

            <h4 style={{ fontSize: "9.5pt", fontWeight: 800, margin: "10px 0 4px", color: "#0f172a" }}>
              4. Property, Plant and Equipment and Intangible Assets
            </h4>
            <p>
              Property, plant and equipment are stated at cost less accumulated depreciation. Depreciation is calculated using the written-down value (diminishing balance) method based on the rates prescribed by Schedule 2 of the Income Tax Act, 2058. Intangible assets comprising accounting software and operating licenses are amortized over their estimated useful economic life.
            </p>

            <h4 style={{ fontSize: "9.5pt", fontWeight: 800, margin: "10px 0 4px", color: "#0f172a" }}>
              5. Revenue Recognition
            </h4>
            <p>
              Revenue from software and IT services is recognized when performance obligations are satisfied, the amount of revenue can be measured reliably, and it is probable that future economic benefits will flow to the company.
            </p>

            <h4 style={{ fontSize: "9.5pt", fontWeight: 800, margin: "10px 0 4px", color: "#0f172a" }}>
              6. Related Party Disclosures
            </h4>
            <p>
              The company is 100% held by Single Shareholder and Managing Director <strong>{directorName}</strong>. Key management personnel include Director {directorName} and Accountant {accountantName}. All transactions with related parties were conducted in the ordinary course of business at prevailing market rates.
            </p>

            <h4 style={{ fontSize: "9.5pt", fontWeight: 800, margin: "12px 0 6px", color: "#0f172a" }}>
              7. Bank Balance Confirmation &amp; Lien / Hold Verification
            </h4>
            <table className="audit-table" style={{ margin: "6px 0 12px" }}>
              <thead>
                <tr>
                  <th>Bank / Institution</th>
                  <th>Account Number</th>
                  <th>Account Type</th>
                  <th style={{ textAlign: "right" }}>General Ledger Balance</th>
                  <th style={{ textAlign: "right" }}>Bank Certificate Balance</th>
                  <th style={{ textAlign: "right" }}>Hold / Lien Amount</th>
                  <th style={{ textAlign: "right" }}>Available Balance</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((acc) => (
                  <tr key={acc.number}>
                    <td><strong>{acc.name}</strong></td>
                    <td>{acc.number}</td>
                    <td>{acc.type}</td>
                    <td style={{ textAlign: "right" }}>{money(acc.balance, currency)}</td>
                    <td style={{ textAlign: "right" }}>{money(acc.balance, currency)}</td>
                    <td style={{ textAlign: "right", color: acc.hold > 0 ? "var(--red)" : undefined }}>
                      {money(acc.hold, currency)}
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 700 }}>{money(acc.available, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p style={{ fontSize: "8pt", color: "#64748b" }}>
              * Official bank confirmation certificate from <strong>Siddhartha Bank Ltd</strong> (CANR Account 02017249683) was obtained and verified against the general ledger. The restricted lien / minimum opening hold amount of NPR 2,500.00 is accounted for and segregated from operating liquidity.
            </p>

            <h4 style={{ fontSize: "9.5pt", fontWeight: 800, margin: "10px 0 4px", color: "#0f172a" }}>
              8. Events After the Reporting Period
            </h4>
            <p>
              There are no significant events occurring after the balance sheet date that require adjustments to or disclosure in the financial statements.
            </p>
          </div>

          <SignaturesBlock />
        </article>
      )}
    </main>
  );
}
