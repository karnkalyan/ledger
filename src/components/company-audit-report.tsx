import { CompanyPrintLogo, type PrintableOrganization } from "@/components/company-print-logo";
import { DataTable } from "@/components/data-table";
import { PrintButton } from "@/components/print-button";
import { money } from "@/lib/format";
import { formatDualDate } from "@/lib/nepali-calendar";

type Line = { label: string; amount: number; note?: string };
type AccountLine = { name: string; number: string; type: string; balance: number; hold: number; available: number; cycle?: string };

export function CompanyAuditReport({
  organization,
  currency,
  fiscalYear,
  generatedAt,
  income,
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
}: {
  organization: PrintableOrganization;
  currency: string;
  fiscalYear: { label: string; start: string; end: string };
  generatedAt: Date;
  income: number;
  expenses: number;
  categoryExpenses: Line[];
  cashFlow: { deposits: number; withdrawals: number };
  accounts: AccountLine[];
  receivables: number;
  payables: number;
  inventory: number;
  loansTaken: number;
  loansGiven: number;
  rentBilled: number;
  rentPaid: number;
  invoiceTax: number;
}) {
  const bankBalance = accounts.reduce((sum, account) => sum + account.balance, 0);
  const totalHold = accounts.reduce((sum, account) => sum + account.hold, 0);
  const availableCash = accounts.reduce((sum, account) => sum + account.available, 0);
  const profit = income - expenses;
  const currentAssets = bankBalance + receivables + inventory + loansGiven;
  const liabilities = payables + loansTaken;
  const equity = currentAssets - liabilities;
  const rentDue = Math.max(0, rentBilled - rentPaid);
  const taxRate = 25;
  const estimatedIncomeTax = Math.max(0, profit * (taxRate / 100));

  const statement = (title: string, lines: Line[], totalLabel: string, total: number) => (
    <section className="report-section-block audit-avoid-break">
      <div className="section-heading"><h3>{title}</h3></div>
      <DataTable className="report-table">
        <thead><tr><th>Particulars</th><th>Notes</th><th style={{ textAlign: "right" }}>Amount ({currency})</th></tr></thead>
        <tbody>{lines.map((line, index) => <tr key={`${title}-${line.label}`}><td>{line.label}</td><td>{line.note || index + 1}</td><td style={{ textAlign: "right" }}>{money(line.amount, currency)}</td></tr>)}</tbody>
        <tfoot><tr><td colSpan={2}><strong>{totalLabel}</strong></td><td style={{ textAlign: "right" }}><strong>{money(total, currency)}</strong></td></tr></tfoot>
      </DataTable>
    </section>
  );

  return (
    <main className="page-wrap printable-report-page audit-report-page">
      <div className="report-filter-bar no-print">
        <div><h2 className="report-filter-title">Company Audit Report</h2><p className="report-filter-desc">Complete fiscal-year financial statements generated from the live ledger.</p></div>
        <PrintButton label="Print Audit Report / Save PDF" defaultOrientation="portrait" />
      </div>

      <article className="report-document-sheet audit-sheet">
        <header className="report-sheet-header">
          <div className="report-brand-col"><CompanyPrintLogo organization={organization} /><div className="report-company-name">{organization.name}</div><div className="report-company-meta">{organization.address || "Nepal"}<br />PAN / VAT: {organization.taxNumber || organization.panVatNumber || "Not configured"}</div></div>
          <div className="report-meta-col"><div className="report-doc-title">FINANCIAL STATEMENTS &amp; AUDIT WORKING REPORT</div><div className="report-period-badge">{fiscalYear.label}</div><div className="report-period-sub">{fiscalYear.start} to {fiscalYear.end}</div><div className="report-generated-timestamp">Generated: {formatDualDate(generatedAt)}</div></div>
        </header>

        <section className="report-section-block">
          <div className="section-heading"><h3>Independent Auditor&apos;s Report - Draft for Professional Review</h3></div>
          <p>To the shareholders of {organization.name}</p>
          <p><strong>Opinion status.</strong> These statements were generated from records maintained in FlowLedger. They are a complete management working report, but they do not become an independent statutory audit opinion until reviewed and signed by a licensed auditor.</p>
          <p><strong>Management responsibility.</strong> Management is responsible for completeness of source documents, bank reconciliation, inventory valuation, tax classification, internal controls, and preparation of financial statements that are free from material misstatement.</p>
          <p><strong>Auditor responsibility.</strong> The appointed auditor should test material balances, supporting vouchers, revenue recognition, expense cut-off, receivables, payables, inventory, related-party balances, taxation, and subsequent events before issuing an opinion.</p>
        </section>

        {statement("Statement of Financial Position", [
          { label: "Cash and financial account balances", amount: bankBalance, note: `Available ${money(availableCash, currency)}; hold/lien ${money(totalHold, currency)}` },
          { label: "Trade receivables", amount: receivables },
          { label: "Inventory at recorded purchase cost", amount: inventory },
          { label: "Loans and advances given", amount: loansGiven },
          { label: "Trade and operating payables", amount: -payables },
          { label: "Loans and borrowings", amount: -loansTaken },
        ], "Net assets / recorded equity", equity)}

        {statement("Statement of Profit or Loss", [
          { label: "Revenue and other income", amount: income },
          ...categoryExpenses.map((line) => ({ ...line, amount: -line.amount })),
        ], "Profit / (loss) before income tax", profit)}

        {statement("Statement of Cash Flows", [
          { label: "Gross deposits and cash inflows", amount: cashFlow.deposits },
          { label: "Gross withdrawals and cash outflows", amount: -cashFlow.withdrawals },
        ], "Net movement in financial accounts", cashFlow.deposits - cashFlow.withdrawals)}

        {statement("Statement of Changes in Equity", [
          { label: "Current fiscal-year operating result", amount: profit },
          { label: "Other recorded net assets and prior balances", amount: equity - profit },
        ], "Closing recorded equity", equity)}

        <div style={{ breakBefore: "page" }} />
        <section className="report-section-block">
          <div className="section-heading"><h3>Supporting Schedule A - Financial Accounts and Restricted Balances</h3><span className="section-total-badge">Hold / lien: {money(totalHold, currency)}</span></div>
          <DataTable className="report-table"><thead><tr><th>Account</th><th>Type / Cycle</th><th>Number</th><th style={{ textAlign: "right" }}>Ledger balance</th><th style={{ textAlign: "right" }}>Hold</th><th style={{ textAlign: "right" }}>Available</th></tr></thead><tbody>{accounts.map((account) => <tr key={`${account.name}-${account.number}`}><td><strong>{account.name}</strong></td><td>{account.type}{account.cycle ? <div className="muted-text">{account.cycle}</div> : null}</td><td>{account.number}</td><td style={{ textAlign: "right" }}>{money(account.balance, currency)}</td><td style={{ textAlign: "right", color: account.hold ? "var(--red)" : undefined }}>{money(account.hold, currency)}</td><td style={{ textAlign: "right" }}>{money(account.available, currency)}</td></tr>)}</tbody></DataTable>
        </section>

        {statement("Supporting Schedule B - Receivables, Payables and Loans", [
          { label: "Outstanding customer invoices", amount: receivables },
          { label: "Outstanding purchase obligations", amount: payables },
          { label: "Loans taken - principal outstanding", amount: loansTaken },
          { label: "Loans given - principal outstanding", amount: loansGiven },
        ], "Net receivable / (payable) position", receivables + loansGiven - payables - loansTaken)}

        {statement("Supporting Schedule C - Premises and Utility Reconciliation", [
          { label: "Rent and utility bills recorded", amount: rentBilled },
          { label: "Actual rent and utility payments", amount: -rentPaid },
        ], "Rent and utility dues remaining", rentDue)}

        {statement("Tax Reconciliation Working Schedule", [
          { label: "Output tax recorded on invoices", amount: invoiceTax },
          { label: "Accounting profit before tax", amount: profit },
          { label: `Indicative corporate income tax at ${taxRate}%`, amount: estimatedIncomeTax },
        ], "Indicative tax provision (subject to auditor adjustment)", estimatedIncomeTax)}

        <section className="report-section-block" style={{ breakBefore: "page" }}>
          <div className="section-heading"><h3>Significant Accounting Policies and Notes</h3></div>
          <ol className="audit-notes">
            <li><strong>Basis of preparation.</strong> Historical-cost working statements prepared from transaction records in the selected Nepal fiscal year.</li>
            <li><strong>Revenue.</strong> Income is reported from recorded receipts and invoice data; the auditor should verify cut-off and collectability.</li>
            <li><strong>Expenses.</strong> Only actual, non-estimated expense entries are included in profit or loss. Recurring rules remain commitments until materialized or paid.</li>
            <li><strong>Financial accounts.</strong> Ledger balances are shown separately from hold/lien amounts. Available liquidity is balance less restricted hold.</li>
            <li><strong>Inventory.</strong> Inventory is valued from recorded quantity multiplied by recorded purchase price; impairment and physical verification require review.</li>
            <li><strong>Receivables and payables.</strong> Balances are based on document totals less recorded payments and require external confirmation where material.</li>
            <li><strong>Rent and utilities.</strong> Monthly bills, actual payments, partial payments, and remaining dues are reconciled in Supporting Schedule C.</li>
            <li><strong>Taxation.</strong> Tax figures are working estimates only. Final taxable income, disallowances, depreciation, TDS, VAT credits, and filings require professional review.</li>
            <li><strong>Related parties and commitments.</strong> Director, employee, family, or custom person accounts should be reviewed and disclosed when applicable.</li>
            <li><strong>Subsequent events.</strong> Management should disclose material events occurring after the fiscal-year closing date and before authorization.</li>
          </ol>
        </section>

        <footer className="report-sign-off-block">
          <div className="sign-cell"><div className="sign-line" /><span>Prepared By</span><small>Date: __________________</small></div>
          <div className="sign-cell"><div className="sign-line" /><span>Independent Auditor</span><small>Firm / Reg. No.: __________________</small></div>
          <div className="sign-cell"><div className="sign-line" /><span>Authorized Signatory</span><small>{organization.name}</small></div>
        </footer>
      </article>
    </main>
  );
}
