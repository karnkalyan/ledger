import { DataTable } from "@/components/data-table";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, FileText, Edit3, Landmark, Banknote, RefreshCw } from "lucide-react";
import { db } from "@/lib/db";
import { requireOrganizationAccess } from "@/lib/session";
import { money, shortDate } from "@/lib/format";
import { formatDualDate } from "@/lib/nepali-calendar";
import { convertQuoteToInvoiceAction, recordInvoicePaymentAction, updateStatusAction, recordPurchasePaymentAction, settleLoanAction } from "@/app/(dashboard)/actions";
import { PrintButton } from "@/components/print-button";
import { NepaliDatePicker } from "@/components/nepali-date-picker";
import { LoanSettlementForm } from "@/components/loan-settlement-form";
import { FormPendingFeedback } from "@/components/form-pending-feedback";
import { resolveIncomeChannel } from "../page";

function Badge({ value }: { value: string }) {
  const v = value.toUpperCase();
  const cls = v === "PAID" || v === "ACCEPTED" || v === "COMPLETED" || v === "SETTLED" ? "green" : v === "OVERDUE" || v === "REJECTED" ? "red" : v === "DRAFT" ? "amber" : "cyan";
  return <span className={`badge ${cls}`}>{value.toLowerCase()}</span>;
}

export default async function DocumentDetailPage({ params }: { params: Promise<{ orgId: string; module: string; recordId: string }> }) {
  const { orgId, module, recordId } = await params;
  const { organization } = await requireOrganizationAccess(orgId);
  const allowedModules = ["invoices", "quotes", "purchase", "crm", "contacts", "loans", "sales", "banking"];
  if (!allowedModules.includes(module)) notFound();
  if (organization.kind !== "COMPANY" && ["invoices", "quotes", "purchase", "sales"].includes(module)) notFound();

  if (module === "banking") {
    const bankTx = await db.bankTransaction.findFirst({
      where: { id: recordId, organizationId: orgId },
      include: {
        bankAccount: true,
        contact: true,
        income: true,
        expense: { include: { category: true } },
      },
    });
    if (!bankTx) notFound();

    return (
      <main className="page-wrap">
        <div className="page-header no-print">
          <div>
            <Link href={`/${orgId}/banking`} className="topbar-kicker">
              <ArrowLeft size={12} style={{ verticalAlign: "middle", marginRight: 4 }} />
              Back to Banking Statement
            </Link>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6, flexWrap: "wrap" }}>
              <h1 style={{ margin: 0 }}>
                {bankTx.type === "DEPOSIT" ? "Bank Deposit Receipt" : "Bank Withdrawal Outflow"}
              </h1>
              <span className={`badge ${bankTx.type === "DEPOSIT" ? "green" : "red"}`} style={{ fontSize: 12 }}>
                {bankTx.type === "DEPOSIT" ? "CREDIT (+)" : "DEBIT (-)"}
              </span>
            </div>
            <p style={{ margin: "4px 0 0 0" }}>
              Bank transaction passbook voucher record and ledger sync details.
            </p>
          </div>
          <div className="page-actions">
            <Link className="secondary-btn" href={`/${orgId}/banking/${bankTx.id}/edit`}>
              <Edit3 size={13} /> Edit Transaction
            </Link>
            <PrintButton label="Print Voucher / PDF" />
          </div>
        </div>

        {/* SUMMARY STAT CARDS */}
        <section className="grid-kpis" style={{ marginBottom: 20 }}>
          <div className="kpi-card">
            <div className="kpi-top">
              <span>Transaction Amount</span>
            </div>
            <div className={`kpi-value ${bankTx.type === "DEPOSIT" ? "income-val" : "expense-val"}`}>
              {bankTx.type === "DEPOSIT" ? "+" : "-"} {money(bankTx.amount, organization.currency)}
            </div>
            <div className="kpi-meta">
              {bankTx.type === "DEPOSIT" ? "Credit Inflow to Bank" : "Debit Outflow from Bank"}
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-top">
              <span>Bank Account</span>
            </div>
            <div className="kpi-value" style={{ fontSize: 18 }}>
              {bankTx.bankAccount.bankName}
            </div>
            <div className="kpi-meta" style={{ fontFamily: "monospace" }}>
              A/C: {bankTx.bankAccount.accountNumber} ({bankTx.bankAccount.accountType || "Current"})
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-top">
              <span>Ledger Balance</span>
            </div>
            <div className="kpi-value" style={{ fontSize: 18 }}>
              {bankTx.balance != null ? money(bankTx.balance, organization.currency) : "—"}
            </div>
            <div className="kpi-meta">Running Balance after transaction</div>
          </div>

          <div className="kpi-card">
            <div className="kpi-top">
              <span>Sync Status</span>
            </div>
            <div className="kpi-value" style={{ fontSize: 16 }}>
              {bankTx.incomeId ? "Income Inflow" : bankTx.expenseId ? "Expense Outlay" : "Direct Passbook"}
            </div>
            <div className="kpi-meta">
              {bankTx.incomeId ? "Reflected in Income Ledger" : bankTx.expenseId ? "Reflected in Expenses" : "Bank-only Entry"}
            </div>
          </div>
        </section>

        {/* DETAILED TRANSACTION VOUCHER CARD */}
        <div
          style={{
            background: "var(--surface)",
            borderRadius: 14,
            border: "1px solid var(--line)",
            padding: "24px",
            boxShadow: "0 2px 10px rgba(0,0,0,0.03)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--line)", paddingBottom: 14, marginBottom: 18 }}>
            <div>
              <span className="badge purple" style={{ fontSize: 10 }}>BANK VOUCHER #{bankTx.id.slice(-8).toUpperCase()}</span>
              <h2 style={{ fontSize: 18, margin: "4px 0 0 0", fontWeight: 700 }}>
                {bankTx.description}
              </h2>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontWeight: 700, fontSize: 13 }}>
                {formatDualDate(bankTx.transactionDate)}
              </div>
              <small style={{ color: "var(--text-muted)", fontSize: 11 }}>
                Recorded {shortDate(bankTx.createdAt)}
              </small>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, marginBottom: 20 }}>
            <div style={{ padding: 12, background: "var(--soft)", borderRadius: 10, border: "1px solid var(--line)" }}>
              <span style={{ fontSize: 11, color: "var(--text-muted)", display: "block" }}>Particulars / Description</span>
              <strong style={{ fontSize: 14, display: "block", marginTop: 2 }}>{bankTx.description}</strong>
            </div>

            <div style={{ padding: 12, background: "var(--soft)", borderRadius: 10, border: "1px solid var(--line)" }}>
              <span style={{ fontSize: 11, color: "var(--text-muted)", display: "block" }}>Transaction Category</span>
              <strong style={{ fontSize: 14, display: "block", marginTop: 2 }}>{bankTx.category || "General Transaction"}</strong>
            </div>

            <div style={{ padding: 12, background: "var(--soft)", borderRadius: 10, border: "1px solid var(--line)" }}>
              <span style={{ fontSize: 11, color: "var(--text-muted)", display: "block" }}>Reference / Remittance Code</span>
              <strong style={{ fontSize: 14, display: "block", marginTop: 2, fontFamily: "monospace" }}>
                {bankTx.reference || "None"}
              </strong>
            </div>

            <div style={{ padding: 12, background: "var(--soft)", borderRadius: 10, border: "1px solid var(--line)" }}>
              <span style={{ fontSize: 11, color: "var(--text-muted)", display: "block" }}>Cheque Number</span>
              <strong style={{ fontSize: 14, display: "block", marginTop: 2, fontFamily: "monospace" }}>
                {bankTx.chequeNumber || "N/A (Electronic / Cash)"}
              </strong>
            </div>
          </div>

          {/* CRM PARTY OR SYNCED LEDGER SECTION */}
          {(bankTx.contact || bankTx.income || bankTx.expense) && (
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px dashed var(--line)", display: "flex", gap: 16, flexWrap: "wrap" }}>
              {bankTx.contact && (
                <div style={{ flex: 1, minWidth: 220, padding: 14, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10 }}>
                  <span style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                    👤 Linked CRM Entity
                  </span>
                  <Link href={`/${orgId}/crm/${bankTx.contact.id}`} className="table-clickable-title" style={{ fontSize: 14, fontWeight: 700 }}>
                    {bankTx.contact.companyName || bankTx.contact.name}
                  </Link>
                  <div style={{ fontSize: 11.5, color: "var(--text-secondary)", marginTop: 4 }}>
                    {bankTx.contact.taxNumber ? `PAN/VAT: ${bankTx.contact.taxNumber}` : `Type: ${bankTx.contact.type}`}
                  </div>
                </div>
              )}

              {bankTx.income && (
                <div style={{ flex: 1, minWidth: 220, padding: 14, background: "var(--success-soft)", border: "1px solid rgba(22, 163, 74, 0.2)", borderRadius: 10 }}>
                  <span style={{ fontSize: 11, color: "var(--success)", display: "block", marginBottom: 4, fontWeight: 700 }}>
                    ✓ Linked Income Inflow Record
                  </span>
                  <div style={{ fontSize: 13.5, fontWeight: 700 }}>{bankTx.income.title}</div>
                  <div style={{ fontSize: 11.5, color: "var(--text-secondary)", marginTop: 4 }}>
                    Source: {bankTx.income.source || "Direct Bank Deposit"} · Amount: + {money(bankTx.income.amount, organization.currency)}
                  </div>
                </div>
              )}

              {bankTx.expense && (
                <div style={{ flex: 1, minWidth: 220, padding: 14, background: "var(--danger-soft)", border: "1px solid rgba(239, 68, 68, 0.2)", borderRadius: 10 }}>
                  <span style={{ fontSize: 11, color: "var(--danger)", display: "block", marginBottom: 4, fontWeight: 700 }}>
                    ✓ Linked Expense Outlay Record
                  </span>
                  <div style={{ fontSize: 13.5, fontWeight: 700 }}>{bankTx.expense.title}</div>
                  <div style={{ fontSize: 11.5, color: "var(--text-secondary)", marginTop: 4 }}>
                    Payee: {bankTx.expense.vendor || "Bank Outlay"} · Amount: - {money(bankTx.expense.amount, organization.currency)}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    );
  }

  if (module === "invoices") {
    const [invoice, bankAccounts] = await Promise.all([
      db.invoice.findFirst({
        where: { id: recordId, organizationId: orgId },
        include: { contact: true, items: { include: { product: true } }, payments: { orderBy: { paidAt: "desc" } } },
      }),
      db.bankAccount.findMany({ where: { organizationId: orgId }, orderBy: { createdAt: "asc" } }),
    ]);
    if (!invoice) notFound();
    const balance = Math.max(0, Number(invoice.total) - Number(invoice.paidAmount));

    return (
      <main className="page-wrap">
        <div className="page-header no-print">
          <div>
            <Link href={`/${orgId}/invoices`} className="topbar-kicker">
              <ArrowLeft size={12} style={{ verticalAlign: "middle", marginRight: 4 }} />
              Back to Invoices
            </Link>
            <h1 style={{ marginTop: 6 }}>{invoice.invoiceNumber}</h1>
            <p>Commercial tax invoice document and payment tracking.</p>
          </div>
          <div className="page-actions">
            <Link className="secondary-btn" href={`/${orgId}/invoices/${invoice.id}/edit`}>
              <Edit3 size={13} style={{ marginRight: 4 }} /> Edit Invoice
            </Link>
            <PrintButton label="Print Invoice / Save PDF" defaultOrientation="portrait" />
          </div>
        </div>

        {/* Standard Printable Invoice Container */}
        <div className="invoice-print-container">
          <div className="invoice-brand-row">
            <div className="invoice-company-details">
              <div className="brand-mark" style={{ marginBottom: 10 }}>
                <span className="brand-symbol">K</span>
                <div>
                  <span>KASHTRIX</span>
                  <div className="brand-sub">LEDGER</div>
                </div>
              </div>
              <h2>{organization.name}</h2>
              <p>
                {organization.address && <>{organization.address}<br /></>}
                {organization.email && <span>{organization.email} </span>}
                {organization.phone && <span>· {organization.phone}</span>}
                {organization.taxNumber && <><br /><strong>Tax / PAN / VAT ID:</strong> {organization.taxNumber}</>}
              </p>
            </div>
            <div className="invoice-meta-col">
              <div style={{ marginBottom: 6 }}><Badge value={invoice.status} /></div>
              <div className="invoice-doc-type">COMMERCIAL INVOICE</div>
              <div className="table-sub" style={{ fontSize: 11.5, marginTop: 4 }}>
                <strong>Invoice #:</strong> {invoice.invoiceNumber}<br />
                <strong>Issue Date:</strong> {shortDate(invoice.issueDate)}<br />
                <strong>Due Date:</strong> {shortDate(invoice.dueDate)}
              </div>
            </div>
          </div>

          <div className="invoice-party-grid">
            <div className="invoice-party-box">
              <div className="topbar-kicker" style={{ marginBottom: 4 }}>Bill To:</div>
              <h4>{invoice.contact?.companyName || invoice.contact?.name || "Walk-in Customer"}</h4>
              <p>
                {invoice.contact?.companyName && invoice.contact?.name && <>{invoice.contact.name}<br /></>}
                {invoice.contact?.address && <>{invoice.contact.address}<br /></>}
                {invoice.contact?.email && <>{invoice.contact.email} </>}
                {invoice.contact?.phone && <>{invoice.contact.phone}<br /></>}
                {invoice.contact?.taxNumber && <><strong>Tax / VAT:</strong> {invoice.contact.taxNumber}</>}
              </p>
            </div>
            <div className="invoice-party-box">
              <div className="topbar-kicker" style={{ marginBottom: 4 }}>Payment Information</div>
              <p>
                <strong>Currency:</strong> {organization.currency}<br />
                <strong>Payment Status:</strong> {invoice.status}<br />
                <strong>Total Amount:</strong> {money(invoice.total, organization.currency)}<br />
                <strong>Balance Due:</strong> {money(balance, organization.currency)}
              </p>
            </div>
          </div>

          {(() => {
            const hasTax = Number(invoice.tax) > 0 || invoice.items.some((i) => Number(i.taxRate) > 0);
            return (
              <>
                <DataTable paginate={false} className="invoice-items-table">
                  <thead>
                    <tr>
                      <th style={{ width: "5%" }}>#</th>
                      <th style={{ width: hasTax ? "38%" : "50%" }}>Item Description</th>
                      <th style={{ width: "10%", textAlign: "center" }}>Qty</th>
                      <th style={{ width: "15%", textAlign: "right" }}>Rate</th>
                      {hasTax && <th style={{ width: "15%", textAlign: "right" }}>Tax</th>}
                      <th style={{ width: "17%", textAlign: "right" }}>Amount (Excl. Tax)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.items.map((i, idx) => {
                      const lineSub = Number(i.quantity) * Number(i.unitPrice);
                      const itemTaxRate = Number(i.taxRate) || 0;
                      const lineTax = (lineSub * itemTaxRate) / 100;

                      return (
                        <tr key={i.id}>
                          <td>{idx + 1}</td>
                          <td>
                            <div className="table-title">{i.description}</div>
                            {i.product?.sku && <div className="table-sub">SKU: {i.product.sku}</div>}
                          </td>
                          <td style={{ textAlign: "center" }}>{Number(i.quantity)}</td>
                          <td style={{ textAlign: "right" }}>{money(i.unitPrice, organization.currency)}</td>
                          {hasTax && (
                            <td style={{ textAlign: "right", fontSize: 11.5 }}>
                              {itemTaxRate > 0 ? (
                                <>
                                  <span>{itemTaxRate}%</span>
                                  <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
                                    +{money(lineTax, organization.currency)}
                                  </div>
                                </>
                              ) : (
                                <span style={{ color: "var(--text-muted)", fontSize: 11 }}>0% (Exempt)</span>
                              )}
                            </td>
                          )}
                          <td style={{ textAlign: "right" }}>
                            <strong>{money(lineSub, organization.currency)}</strong>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </DataTable>

                <div className="invoice-calculation-wrap">
                  <div className="invoice-notes-terms">
                    {invoice.terms && (
                      <div style={{ marginBottom: 12 }}>
                        <strong>Payment Terms:</strong>
                        <div>{invoice.terms}</div>
                      </div>
                    )}
                    {invoice.notes && (
                      <div>
                        <strong>Notes:</strong>
                        <div>{invoice.notes}</div>
                      </div>
                    )}
                    {bankAccounts.length > 0 && (
                      <div style={{ marginTop: 14, padding: "10px 14px", border: "1px dashed var(--line-strong)", borderRadius: 6, background: "var(--soft)" }}>
                        <div className="topbar-kicker" style={{ marginBottom: 4 }}>Bank Transfer / Remittance Details</div>
                        {bankAccounts.map((b) => (
                          <div key={b.id} style={{ fontSize: 11.5, lineHeight: 1.5 }}>
                            <strong>Bank:</strong> {b.bankName}<br />
                            <strong>Account Name:</strong> {organization.name}<br />
                            <strong>Account No:</strong> <span style={{ fontFamily: "monospace" }}>{b.accountNumber}</span>
                            {b.branch && <span> · <strong>Branch:</strong> {b.branch}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="invoice-calc-box">
                    <div className="invoice-calc-row">
                      <span>{hasTax ? "Subtotal (Taxable Amount)" : "Subtotal"}</span>
                      <strong>{money(invoice.subtotal, organization.currency)}</strong>
                    </div>
                    {hasTax ? (
                      <div className="invoice-calc-row">
                        <span>VAT / Tax</span>
                        <strong>{money(invoice.tax, organization.currency)}</strong>
                      </div>
                    ) : (
                      <div className="invoice-calc-row" style={{ color: "var(--text-muted)" }}>
                        <span>VAT / Tax</span>
                        <span>Non-Taxable / Exempt (0%)</span>
                      </div>
                    )}
                    {Number(invoice.discount) > 0 && (
                      <div className="invoice-calc-row">
                        <span>Discount</span>
                        <strong>- {money(invoice.discount, organization.currency)}</strong>
                      </div>
                    )}
                    <div className="invoice-calc-row grand-total">
                      <span>Total Due</span>
                      <strong>{money(invoice.total, organization.currency)}</strong>
                    </div>
                    <div className="invoice-calc-row">
                      <span>Paid to Date</span>
                      <span>{money(invoice.paidAmount, organization.currency)}</span>
                    </div>
                    <div className="invoice-calc-row balance-due">
                      <span>Balance Due</span>
                      <span>{money(balance, organization.currency)}</span>
                    </div>
                  </div>
                </div>
              </>
            );
          })()}

          <div className="invoice-signature-section">
            <div className="signature-box">
              Customer Confirmation
            </div>
            <div className="signature-box">
              Authorized Signature & Stamp
            </div>
          </div>
        </div>

        {/* Action panels hidden during printing */}
        <div className="dashboard-grid no-print">
          <div className="panel">
            <div className="panel-head">
              <h3>Record Payment</h3>
              <span>{money(balance, organization.currency)} balance due</span>
            </div>
            <form action={recordInvoicePaymentAction}>
              <FormPendingFeedback processingMessage="Recording invoice payment..." successMessage="Invoice payment recorded successfully" />
              <input type="hidden" name="orgId" value={orgId} />
              <input type="hidden" name="invoiceId" value={invoice.id} />
              <div className="form-grid">
                <label className="field">
                  Payment Amount
                  <input name="amount" type="number" min="0.01" max={balance || undefined} step="0.01" defaultValue={balance > 0 ? balance : undefined} required />
                </label>
                <div className="field">
                  <NepaliDatePicker name="paidAt" label="Payment Date (BS / AD)" />
                </div>
                <label className="field">
                  Payment Method
                  <input name="method" placeholder="Bank Transfer / Cash / Check" />
                </label>
                <label className="field">
                  Reference #
                  <input name="reference" placeholder="Check or Transaction ID" />
                </label>
                <label className="field full">
                  Payment Notes
                  <input name="notes" placeholder="Optional notes" />
                </label>
              </div>
              <div className="form-actions">
                <button className="success-btn" disabled={balance <= 0}>
                  {balance <= 0 ? "Fully Settled" : "Save Payment"}
                </button>
              </div>
            </form>
          </div>

          <div className="panel">
            <div className="panel-head">
              <h3>Payment & Status History</h3>
            </div>
            <form action={updateStatusAction} style={{ display: "flex", gap: 6, marginBottom: 14 }}>
              <FormPendingFeedback processingMessage="Updating status..." successMessage="Status updated successfully" />
              <input type="hidden" name="orgId" value={orgId} />
              <input type="hidden" name="resource" value="invoice" />
              <input type="hidden" name="id" value={invoice.id} />
              <select name="status" defaultValue={invoice.status} style={{ minHeight: 32 }}>
                <option>DRAFT</option>
                <option>SENT</option>
                <option>PARTIAL</option>
                <option>PAID</option>
                <option>OVERDUE</option>
                <option>CANCELLED</option>
              </select>
              <button className="secondary-btn" style={{ minHeight: 32 }}>Update Status</button>
            </form>
            {invoice.payments.length ? (
              invoice.payments.map((p) => (
                <div className="report-line" key={p.id}>
                  <div>
                    <strong>{p.method || "Payment"}</strong>
                    <div className="table-sub">
                      {shortDate(p.paidAt)} · Ref: {p.reference || "None"}
                    </div>
                  </div>
                  <strong className="amount-pos">{money(p.amount, organization.currency)}</strong>
                </div>
              ))
            ) : (
              <div className="empty-state">No payment receipts logged yet.</div>
            )}
          </div>
        </div>
      </main>
    );
  }

  if (module === "quotes") {
    const quote = await db.quote.findFirst({
      where: { id: recordId, organizationId: orgId },
      include: { contact: true, items: { include: { product: true } }, convertedInvoice: true },
    });
    if (!quote) notFound();

  return (
    <main className="page-wrap">
      <div className="page-header no-print">
        <div>
          <Link href={`/${orgId}/quotes`} className="topbar-kicker">
            <ArrowLeft size={12} style={{ verticalAlign: "middle", marginRight: 4 }} />
            Back to Quotes
          </Link>
          <h1 style={{ marginTop: 6 }}>{quote.quoteNumber}</h1>
          <p>Commercial price quotation with automatic conversion to invoice.</p>
        </div>
        <div className="page-actions">
          {quote.convertedInvoice ? (
            <Link className="success-btn" href={`/${orgId}/invoices/${quote.convertedInvoice.id}`}>
              <CheckCircle2 size={13} style={{ marginRight: 4 }} /> Open Converted Invoice
            </Link>
          ) : (
            <form action={convertQuoteToInvoiceAction}>
              <FormPendingFeedback processingMessage="Converting quote to invoice..." successMessage="Quote converted successfully" />
              <input type="hidden" name="orgId" value={orgId} />
              <input type="hidden" name="quoteId" value={quote.id} />
              <button className="primary-btn">
                <FileText size={13} style={{ marginRight: 4 }} /> Convert to Invoice
              </button>
            </form>
          )}
          {!quote.convertedInvoice && (
            <Link className="secondary-btn" href={`/${orgId}/quotes/${quote.id}/edit`}>
              <Edit3 size={13} style={{ marginRight: 4 }} /> Edit Quote
            </Link>
          )}
          <PrintButton label="Print Quote / PDF" defaultOrientation="portrait" />
        </div>
      </div>

      <div className="invoice-print-container">
        <div className="invoice-brand-row">
          <div className="invoice-company-details">
            <div className="brand-mark" style={{ marginBottom: 10 }}>
              <span className="brand-symbol">K</span>
              <div>
                <span>KASHTRIX</span>
                <div className="brand-sub">LEDGER</div>
              </div>
            </div>
            <h2>{organization.name}</h2>
            <p>
              {organization.address && <>{organization.address}<br /></>}
              {organization.email && <span>{organization.email} </span>}
              {organization.phone && <span>· {organization.phone}</span>}
            </p>
          </div>
          <div className="invoice-meta-col">
            <div style={{ marginBottom: 6 }}><Badge value={quote.status} /></div>
            <div className="invoice-doc-type">PRICE QUOTATION</div>
            <div className="table-sub" style={{ fontSize: 11.5, marginTop: 4 }}>
              <strong>Quote #:</strong> {quote.quoteNumber}<br />
              <strong>Issued:</strong> {shortDate(quote.issueDate)}<br />
              <strong>Valid Until:</strong> {shortDate(quote.validUntil)}
            </div>
          </div>
        </div>

        <div className="invoice-party-grid">
          <div className="invoice-party-box">
            <div className="topbar-kicker" style={{ marginBottom: 4 }}>Prepared For:</div>
            <h4>{quote.contact?.companyName || quote.contact?.name || "Prospective Client"}</h4>
            <p>
              {quote.contact?.companyName && quote.contact?.name && <>{quote.contact.name}<br /></>}
              {quote.contact?.address && <>{quote.contact.address}<br /></>}
              {quote.contact?.email && <>{quote.contact.email} </>}
              {quote.contact?.phone && <>{quote.contact.phone}</>}
            </p>
          </div>
          <div className="invoice-party-box">
            <div className="topbar-kicker" style={{ marginBottom: 4 }}>Quotation Details</div>
            <p>
              <strong>Currency:</strong> {organization.currency}<br />
              <strong>Total Proposed:</strong> {money(quote.total, organization.currency)}<br />
              <strong>Validity:</strong> Until {shortDate(quote.validUntil)}
            </p>
          </div>
        </div>

        {(() => {
          const hasTax = Number(quote.tax) > 0 || quote.items.some((i) => Number(i.taxRate) > 0);
          return (
            <>
              <DataTable paginate={false} className="invoice-items-table">
                <thead>
                  <tr>
                    <th style={{ width: "5%" }}>#</th>
                    <th style={{ width: hasTax ? "38%" : "50%" }}>Description</th>
                    <th style={{ width: "10%", textAlign: "center" }}>Qty</th>
                    <th style={{ width: "15%", textAlign: "right" }}>Rate</th>
                    {hasTax && <th style={{ width: "15%", textAlign: "right" }}>Tax</th>}
                    <th style={{ width: "17%", textAlign: "right" }}>Amount (Excl. Tax)</th>
                  </tr>
                </thead>
                <tbody>
                  {quote.items.map((i, idx) => {
                    const lineSub = Number(i.quantity) * Number(i.unitPrice);
                    const itemTaxRate = Number(i.taxRate) || 0;
                    const lineTax = (lineSub * itemTaxRate) / 100;

                    return (
                      <tr key={i.id}>
                        <td>{idx + 1}</td>
                        <td>
                          <div className="table-title">{i.description}</div>
                          {i.product?.sku && <div className="table-sub">SKU: {i.product.sku}</div>}
                        </td>
                        <td style={{ textAlign: "center" }}>{Number(i.quantity)}</td>
                        <td style={{ textAlign: "right" }}>{money(i.unitPrice, organization.currency)}</td>
                        {hasTax && (
                          <td style={{ textAlign: "right", fontSize: 11.5 }}>
                            {itemTaxRate > 0 ? (
                              <>
                                <span>{itemTaxRate}%</span>
                                <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
                                  +{money(lineTax, organization.currency)}
                                </div>
                              </>
                            ) : (
                              <span style={{ color: "var(--text-muted)", fontSize: 11 }}>0% (Exempt)</span>
                            )}
                          </td>
                        )}
                        <td style={{ textAlign: "right" }}>
                          <strong>{money(lineSub, organization.currency)}</strong>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </DataTable>

              <div className="invoice-calculation-wrap">
                <div className="invoice-notes-terms">
                  {quote.terms && (
                    <div>
                      <strong>Terms & Conditions:</strong>
                      <div>{quote.terms}</div>
                    </div>
                  )}
                </div>
                <div className="invoice-calc-box">
                  <div className="invoice-calc-row">
                    <span>{hasTax ? "Subtotal (Taxable Amount)" : "Subtotal"}</span>
                    <strong>{money(quote.subtotal, organization.currency)}</strong>
                  </div>
                  {hasTax ? (
                    <div className="invoice-calc-row">
                      <span>VAT / Tax</span>
                      <strong>{money(quote.tax, organization.currency)}</strong>
                    </div>
                  ) : (
                    <div className="invoice-calc-row" style={{ color: "var(--text-muted)" }}>
                      <span>VAT / Tax</span>
                      <span>Non-Taxable / Exempt (0%)</span>
                    </div>
                  )}
                  {Number(quote.discount) > 0 && (
                    <div className="invoice-calc-row">
                      <span>Discount</span>
                      <strong>- {money(quote.discount, organization.currency)}</strong>
                    </div>
                  )}
                  <div className="invoice-calc-row grand-total">
                    <span>Total Quoted</span>
                    <strong>{money(quote.total, organization.currency)}</strong>
                  </div>
                </div>
              </div>
            </>
          );
        })()}

        <div className="invoice-signature-section">
          <div className="signature-box">
            Client Acceptance Signature
          </div>
          <div className="signature-box">
            Authorized Representative
          </div>
        </div>
      </div>

      <div className="panel no-print" style={{ marginTop: 14 }}>
        <div className="panel-head">
          <h3>Quotation Stage & Status</h3>
        </div>
        <form action={updateStatusAction} style={{ display: "flex", gap: 6, maxWidth: 380 }}>
          <FormPendingFeedback processingMessage="Updating status..." successMessage="Status updated successfully" />
          <input type="hidden" name="orgId" value={orgId} />
          <input type="hidden" name="resource" value="quote" />
          <input type="hidden" name="id" value={quote.id} />
          <select name="status" defaultValue={quote.status} style={{ minHeight: 32 }}>
            <option>DRAFT</option>
            <option>SENT</option>
            <option>ACCEPTED</option>
            <option>REJECTED</option>
            <option>CANCELLED</option>
          </select>
          <button className="secondary-btn" style={{ minHeight: 32 }}>Update Status</button>
        </form>
      </div>
    </main>
  );
  }

  if (module === "sales") {
    const so = await db.salesOrder.findFirst({
      where: { id: recordId, organizationId: orgId },
      include: {
        contact: true,
        items: { include: { product: true } },
      },
    });
    if (!so) notFound();

    const total = Number(so.total);
    const subtotal = Number(so.subtotal);
    const tax = Number(so.tax);
    const discount = Number(so.discount);

    return (
      <main className="page-wrap">
        <div className="page-header no-print">
          <div>
            <Link href={`/${orgId}/sales`} className="topbar-kicker">
              <ArrowLeft size={12} style={{ verticalAlign: "middle", marginRight: 4 }} />
              Back to Sales Orders
            </Link>
            <h1 style={{ marginTop: 6 }}>Sales Order #{so.orderNumber}</h1>
            <p>Commercial customer sales order voucher, dispatch line items, and fulfillment record.</p>
          </div>
          <div className="page-actions">
            <PrintButton label="Print Sales Invoice / PDF" />
          </div>
        </div>

        {/* Printable Sales Order Invoice Voucher */}
        <div className="invoice-print-container">
          <div className="invoice-brand-row">
            <div className="invoice-company-details">
              <div className="brand-mark" style={{ marginBottom: 10 }}>
                <span className="brand-symbol">K</span>
                <div>
                  <span>KASHTRIX</span>
                  <div className="brand-sub">SALES &amp; COMMERCIAL LEDGER</div>
                </div>
              </div>
              <h2>{organization.name}</h2>
              <p>
                {organization.address && <>{organization.address}<br /></>}
                {organization.email && <span>{organization.email} </span>}
                {organization.phone && <span>· {organization.phone}</span>}
                {organization.taxNumber && <><br /><strong>Tax / PAN ID:</strong> {organization.taxNumber}</>}
              </p>
            </div>
            <div className="invoice-meta-col">
              <div style={{ marginBottom: 6 }}><Badge value={so.status} /></div>
              <div className="invoice-doc-type">SALES ORDER INVOICE</div>
              <div className="table-sub" style={{ fontSize: 11.5, marginTop: 4 }}>
                <strong>SO #:</strong> {so.orderNumber}<br />
                <strong>Order Date:</strong> {formatDualDate(so.orderDate)}<br />
                <strong>Fulfillment Status:</strong> {so.status}
              </div>
            </div>
          </div>

          <div className="invoice-party-grid">
            <div className="invoice-party-box">
              <div className="topbar-kicker" style={{ marginBottom: 4 }}>Bill To / Customer Details:</div>
              {so.contact ? (
                <>
                  <strong style={{ fontSize: 15, display: "block", marginBottom: 2 }}>
                    <Link href={`/${orgId}/crm/${so.contact.id}`} className="table-clickable-title">
                      {so.contact.companyName || so.contact.name}
                    </Link>
                  </strong>
                  {so.contact.companyName && so.contact.name && (
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Attn: {so.contact.name}</div>
                  )}
                  {so.contact.taxNumber && <div><strong>PAN / VAT:</strong> {so.contact.taxNumber}</div>}
                  {so.contact.address && <div><strong>Address:</strong> {so.contact.address}</div>}
                  {so.contact.phone && <div><strong>Phone:</strong> {so.contact.phone}</div>}
                  {so.contact.email && <div><strong>Email:</strong> {so.contact.email}</div>}
                </>
              ) : (
                <div style={{ color: "var(--text-muted)" }}>Walk-in / Direct Corporate Customer</div>
              )}
            </div>

            <div className="invoice-party-box">
              <div className="topbar-kicker" style={{ marginBottom: 4 }}>Sales Order Terms:</div>
              <div><strong>Fulfillment Mode:</strong> Standard Delivery / Commercial Dispatch</div>
              <div><strong>Currency:</strong> {organization.currency}</div>
              {so.notes && <div style={{ marginTop: 6 }}><strong>Remarks:</strong> {so.notes}</div>}
            </div>
          </div>

          {/* Itemized Lines */}
          <div className="table-card" style={{ marginBottom: 16 }}>
            <div className="table-scroll">
              <DataTable className="responsive-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Product / Description</th>
                    <th>SKU</th>
                    <th style={{ textAlign: "right" }}>Qty</th>
                    <th style={{ textAlign: "right" }}>Unit Price</th>
                    <th style={{ textAlign: "right" }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {so.items.map((item, idx) => (
                    <tr key={item.id}>
                      <td style={{ color: "var(--text-muted)", width: 36 }}>{idx + 1}</td>
                      <td data-label="Description">
                        <div className="table-title">{item.description}</div>
                        {item.product && <div className="table-sub">{item.product.name}</div>}
                      </td>
                      <td data-label="SKU">{item.product?.sku || "—"}</td>
                      <td data-label="Qty" style={{ textAlign: "right", fontFamily: "Consolas, monospace" }}>
                        {Number(item.quantity)}
                      </td>
                      <td data-label="Unit Price" style={{ textAlign: "right", fontFamily: "Consolas, monospace" }}>
                        {money(Number(item.unitPrice), organization.currency)}
                      </td>
                      <td data-label="Amount" style={{ textAlign: "right", fontWeight: 700, fontFamily: "Consolas, monospace" }}>
                        {money(Number(item.amount), organization.currency)}
                      </td>
                    </tr>
                  ))}
                  {!so.items.length && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center", padding: 24, color: "var(--text-muted)" }}>
                        No line items found for this sales order.
                      </td>
                    </tr>
                  )}
                </tbody>
              </DataTable>
            </div>
          </div>

          {/* Calculation Summary Box */}
          <div className="invoice-calculation-wrap">
            <div>
              {so.notes && (
                <div className="invoice-party-box" style={{ fontSize: 12 }}>
                  <strong>Order Notes:</strong>
                  <p style={{ margin: "4px 0 0" }}>{so.notes}</p>
                </div>
              )}
            </div>

            <div className="invoice-calc-box">
              <div className="invoice-calc-row">
                <span>Subtotal</span>
                <span>{money(subtotal, organization.currency)}</span>
              </div>
              {discount > 0 && (
                <div className="invoice-calc-row">
                  <span>Discount</span>
                  <span style={{ color: "var(--danger)" }}>- {money(discount, organization.currency)}</span>
                </div>
              )}
              {tax > 0 && (
                <div className="invoice-calc-row">
                  <span>Tax / VAT</span>
                  <span>{money(tax, organization.currency)}</span>
                </div>
              )}
              <div className="invoice-calc-row grand-total">
                <span>Order Total</span>
                <span>{money(total, organization.currency)}</span>
              </div>
            </div>
          </div>

          {/* Signature Block for Print */}
          <div className="invoice-signature-section">
            <div className="signature-box">
              <strong>Prepared / Dispatched By</strong>
              <div style={{ marginTop: 24, fontSize: 11, color: "var(--text-muted)" }}>Sales &amp; Fulfillment Officer</div>
            </div>
            <div className="signature-box">
              <strong>Customer Acknowledgment &amp; Receipt</strong>
              <div style={{ marginTop: 24, fontSize: 11, color: "var(--text-muted)" }}>Authorized Signatory / Seal</div>
            </div>
          </div>
        </div>

        {/* Status Update Form */}
        <div className="table-card no-print" style={{ padding: "14px 18px", marginTop: 20 }}>
          <form action={updateStatusAction} style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <FormPendingFeedback processingMessage="Updating status..." successMessage="Status updated successfully" />
            <span style={{ fontWeight: 600, fontSize: 13 }}>Update Sales Order Status:</span>
            <input type="hidden" name="orgId" value={orgId} />
            <input type="hidden" name="resource" value="sales" />
            <input type="hidden" name="id" value={so.id} />
            <select name="status" defaultValue={so.status} style={{ minHeight: 32 }}>
              <option>DRAFT</option>
              <option>CONFIRMED</option>
              <option>PROCESSING</option>
              <option>COMPLETED</option>
              <option>CANCELLED</option>
            </select>
            <button className="secondary-btn" style={{ minHeight: 32 }}>Update Status</button>
          </form>
        </div>
      </main>
    );
  }

  if (module === "purchase") {
    const po = await db.purchaseOrder.findFirst({
      where: { id: recordId, organizationId: orgId },
      include: {
        contact: true,
        items: { include: { product: true } },
        payments: { orderBy: { paidAt: "desc" } },
      },
    });
    if (!po) notFound();

    const total = Number(po.total);
    const paidAmount = Number(po.paidAmount);
    const duesBalance = Math.max(0, total - paidAmount);

    return (
      <main className="page-wrap">
        <div className="page-header no-print">
          <div>
            <Link href={`/${orgId}/purchase`} className="topbar-kicker">
              <ArrowLeft size={12} style={{ verticalAlign: "middle", marginRight: 4 }} />
              Back to Purchase Orders
            </Link>
            <h1 style={{ marginTop: 6 }}>Purchase Order #{po.orderNumber}</h1>
            <p>Procurement invoice, supplier terms, itemized line items, and dues balance.</p>
          </div>
          <div className="page-actions">
            <PrintButton label="Print Purchase Invoice / PDF" />
          </div>
        </div>

        {/* Printable Purchase Invoice Document */}
        <div className="invoice-print-container">
          <div className="invoice-brand-row">
            <div className="invoice-company-details">
              <div className="brand-mark" style={{ marginBottom: 10 }}>
                <span className="brand-symbol">K</span>
                <div>
                  <span>KASHTRIX</span>
                  <div className="brand-sub">PROCUREMENT LEDGER</div>
                </div>
              </div>
              <h2>{organization.name}</h2>
              <p>
                {organization.address && <>{organization.address}<br /></>}
                {organization.email && <span>{organization.email} </span>}
                {organization.phone && <span>· {organization.phone}</span>}
                {organization.taxNumber && <><br /><strong>Tax / PAN ID:</strong> {organization.taxNumber}</>}
              </p>
            </div>
            <div className="invoice-meta-col">
              <div style={{ marginBottom: 6 }}><Badge value={po.status} /></div>
              <div className="invoice-doc-type">PURCHASE ORDER INVOICE</div>
              <div className="table-sub" style={{ fontSize: 11.5, marginTop: 4 }}>
                <strong>PO #:</strong> {po.orderNumber}<br />
                <strong>Order Date:</strong> {formatDualDate(po.orderDate)}<br />
                <strong>Payment Status:</strong> {duesBalance <= 0 ? "FULLY PAID" : paidAmount > 0 ? "PARTIALLY PAID" : "UNPAID DUES"}
              </div>
            </div>
          </div>

          <div className="invoice-party-grid">
            <div className="invoice-party-box">
              <div className="topbar-kicker" style={{ marginBottom: 4 }}>Supplier / Vendor Details:</div>
              <h4>{po.contact?.companyName || po.contact?.name || "Official Vendor"}</h4>
              <p>
                {po.contact?.companyName && po.contact?.name && <>{po.contact.name}<br /></>}
                {po.contact?.address && <>{po.contact.address}<br /></>}
                {po.contact?.email && <>{po.contact.email} </>}
                {po.contact?.phone && <>{po.contact.phone}<br /></>}
                {po.contact?.taxNumber && <><strong>Vendor PAN / VAT:</strong> {po.contact.taxNumber}</>}
              </p>
            </div>
            <div className="invoice-party-box">
              <div className="topbar-kicker" style={{ marginBottom: 4 }}>Procurement &amp; Dues Summary</div>
              <p>
                <strong>Currency:</strong> {organization.currency}<br />
                <strong>Invoice Total:</strong> {money(total, organization.currency)}<br />
                <strong style={{ color: "var(--success)" }}>Paid Amount:</strong> {money(paidAmount, organization.currency)}<br />
                <strong style={{ color: duesBalance > 0 ? "var(--danger)" : "var(--success)", fontSize: "11pt" }}>
                  Outstanding Dues: {money(duesBalance, organization.currency)}
                </strong>
              </p>
            </div>
          </div>

          <DataTable paginate={false} className="invoice-items-table">
            <thead>
              <tr>
                <th style={{ width: "5%" }}>#</th>
                <th style={{ width: "45%" }}>Product / Item Details</th>
                <th style={{ width: "15%", textAlign: "center" }}>Quantity</th>
                <th style={{ width: "15%", textAlign: "right" }}>Unit Price</th>
                <th style={{ width: "20%", textAlign: "right" }}>Line Total</th>
              </tr>
            </thead>
            <tbody>
              {po.items.map((i, idx) => (
                <tr key={i.id}>
                  <td>{idx + 1}</td>
                  <td>
                    <div className="table-title">{i.description}</div>
                    {i.product?.sku && <div className="table-sub">SKU / Code: {i.product.sku}</div>}
                  </td>
                  <td style={{ textAlign: "center" }}>{Number(i.quantity)}</td>
                  <td style={{ textAlign: "right" }}>{money(i.unitPrice, organization.currency)}</td>
                  <td style={{ textAlign: "right" }}><strong>{money(i.amount, organization.currency)}</strong></td>
                </tr>
              ))}
              {!po.items.length && (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", color: "#64748b", padding: 12 }}>
                    General procurement expense voucher (Direct line)
                  </td>
                </tr>
              )}
            </tbody>
          </DataTable>

          <div className="invoice-calculation-wrap">
            <div className="invoice-notes-terms">
              {po.notes && (
                <div>
                  <strong>Order Notes &amp; References:</strong>
                  <div>{po.notes}</div>
                </div>
              )}
            </div>
            <div className="invoice-calc-box">
              <div className="invoice-calc-row">
                <span>Subtotal</span>
                <strong>{money(po.subtotal, organization.currency)}</strong>
              </div>
              <div className="invoice-calc-row">
                <span>Tax / VAT</span>
                <strong>{money(po.tax, organization.currency)}</strong>
              </div>
              {Number(po.discount) > 0 && (
                <div className="invoice-calc-row">
                  <span>Discount</span>
                  <strong>- {money(po.discount, organization.currency)}</strong>
                </div>
              )}
              <div className="invoice-calc-row grand-total">
                <span>Total Invoice Value</span>
                <strong>{money(po.total, organization.currency)}</strong>
              </div>
              <div className="invoice-calc-row">
                <span>Paid Towards Dues</span>
                <strong style={{ color: "var(--success)" }}>- {money(paidAmount, organization.currency)}</strong>
              </div>
              <div className="invoice-calc-row balance-due" style={{ background: duesBalance > 0 ? "#fef2f2" : "#f0fdf4" }}>
                <span>Remaining Dues Balance</span>
                <strong style={{ color: duesBalance > 0 ? "var(--danger)" : "var(--success)", fontSize: "11pt" }}>
                  {money(duesBalance, organization.currency)}
                </strong>
              </div>
            </div>
          </div>

          <div className="invoice-signature-section">
            <div className="signature-box">
              Vendor Authorized Signatory &amp; Stamp
            </div>
            <div className="signature-box">
              Received &amp; Verified by ({organization.name})
            </div>
          </div>
        </div>

        {/* Payment History & Settlement Action */}
        <div className="panel no-print" style={{ marginTop: 20 }}>
          <div className="panel-head">
            <h3>Payments Made Against This Purchase Order</h3>
          </div>
          {po.payments.length > 0 ? (
            <div className="table-scroll">
              <table className="data-table" style={{ width: "100%", fontSize: 12 }}>
                <thead>
                  <tr>
                    <th>Date (BS / AD)</th>
                    <th>Payment Method</th>
                    <th>Reference #</th>
                    <th>Notes</th>
                    <th style={{ textAlign: "right" }}>Amount Paid</th>
                  </tr>
                </thead>
                <tbody>
                  {po.payments.map((p) => (
                    <tr key={p.id}>
                      <td>{formatDualDate(p.paidAt)}</td>
                      <td><span className="badge cyan">{p.method || "Direct Bank"}</span></td>
                      <td style={{ fontFamily: "monospace" }}>{p.reference || "—"}</td>
                      <td>{p.notes || "—"}</td>
                      <td style={{ textAlign: "right", fontWeight: 700, color: "var(--success)" }}>
                        {money(p.amount, organization.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p style={{ color: "var(--text-muted)", fontSize: 13, padding: "8px 0" }}>
              No payments logged against this purchase order yet. Outstanding dues are currently {money(duesBalance, organization.currency)}.
            </p>
          )}

          {duesBalance > 0 && (
            <div style={{ marginTop: 16, borderTop: "1px solid var(--line)", paddingTop: 16 }}>
              <h4 style={{ margin: "0 0 10px 0", fontSize: 14 }}>Record Payment Toward Outstanding Dues</h4>
              <form action={recordPurchasePaymentAction} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, alignItems: "flex-end" }}>
                <FormPendingFeedback processingMessage="Recording purchase payment..." successMessage="Purchase payment recorded successfully" />
                <input type="hidden" name="orgId" value={orgId} />
                <input type="hidden" name="purchaseOrderId" value={po.id} />
                <label className="field">
                  Payment Amount ({organization.currency})
                  <input type="number" name="amount" defaultValue={duesBalance} max={duesBalance} min="1" step="0.01" required />
                </label>
                <div className="field">
                  <NepaliDatePicker name="paidAt" label="Payment Date (BS / AD)" required />
                </div>
                <label className="field">
                  Payment Method
                  <select name="method" defaultValue="Bank Transfer">
                    <option value="Bank Transfer">Bank Transfer (Siddhartha Bank)</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Cash">Cash / Petty Cash</option>
                    <option value="ConnectIPS / Fonepay">ConnectIPS / Fonepay</option>
                  </select>
                </label>
                <label className="field">
                  Cheque / Transaction Ref
                  <input name="reference" placeholder="CHQ-9812 / IPS Ref" />
                </label>
                <label className="field" style={{ gridColumn: "1 / -1" }}>
                  Notes / Voucher Memo
                  <input name="notes" placeholder="e.g. Office purchase dues installment payment" />
                </label>
                <div style={{ gridColumn: "1 / -1", marginTop: 4 }}>
                  <button className="success-btn" type="submit" style={{ padding: "8px 18px", minHeight: 36 }}>
                    Pay Dues &amp; Log Expense (Reflects in Monthly Report)
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </main>
    );
  }

  if (module === "crm" || module === "contacts") {
    const contact = await db.contact.findFirst({
      where: { id: recordId, organizationId: orgId },
      include: {
        purchaseOrders: {
          include: { items: true, payments: true },
          orderBy: { orderDate: "desc" },
        },
        invoices: {
          include: { items: true, payments: true },
          orderBy: { issueDate: "desc" },
        },
        quotes: { orderBy: { issueDate: "desc" } },
        salesOrders: { orderBy: { orderDate: "desc" } },
        incomes: {
          include: { bankAccount: true },
          orderBy: { receivedAt: "desc" },
        },
        bankTransactions: {
          include: { bankAccount: true },
          orderBy: { transactionDate: "desc" },
        },
      },
    });
    if (!contact) notFound();

    // Fetch any direct operational expenses booked under this vendor name / companyName
    const vendorExpenses = await db.expense.findMany({
      where: {
        organizationId: orgId,
        OR: [
          { vendor: contact.name },
          ...(contact.companyName ? [{ vendor: contact.companyName }] : []),
        ],
      },
      include: { category: true },
      orderBy: { occurredAt: "desc" },
    });

    const totalPurchases = contact.purchaseOrders.reduce((s, x) => s + Number(x.total), 0);
    const totalPaidToVendor = contact.purchaseOrders.reduce((s, x) => s + Number(x.paidAmount), 0);
    const vendorDues = Math.max(0, totalPurchases - totalPaidToVendor);

    const totalSales = contact.invoices.reduce((s, x) => s + Number(x.total), 0);
    const totalCollected = contact.invoices.reduce((s, x) => s + Number(x.paidAmount), 0);
    const customerReceivables = Math.max(0, totalSales - totalCollected);

    const totalIncomeReceived = contact.incomes.reduce((s, x) => s + Number(x.amount), 0);
    const totalDirectExpenses = vendorExpenses.reduce((s, x) => s + Number(x.amount), 0);

    // Build unified chronological statement entries
    type StatementRow = {
      id: string;
      date: Date;
      type: "PURCHASE" | "PO_PAYMENT" | "INVOICE" | "INV_PAYMENT" | "INCOME" | "DIRECT_EXPENSE" | "BANK_TX";
      typeLabel: string;
      reference: string;
      description: string;
      debit: number;  // increases dues/receivable
      credit: number; // payment/receipt settling balance
    };

    const statementRows: StatementRow[] = [
      ...contact.purchaseOrders.map((po) => ({
        id: `po-${po.id}`,
        date: po.orderDate,
        type: "PURCHASE" as const,
        typeLabel: "Procurement Bill",
        reference: po.orderNumber,
        description: `Purchase order (${po.items.length} line items)`,
        debit: Number(po.total),
        credit: 0,
      })),
      ...contact.purchaseOrders.flatMap((po) =>
        po.payments.map((p) => ({
          id: `popay-${p.id}`,
          date: p.paidAt,
          type: "PO_PAYMENT" as const,
          typeLabel: "Vendor Payment",
          reference: `Payment for ${po.orderNumber}`,
          description: `Disbursement via ${p.method || "Bank/Cash"}${p.reference ? ` (${p.reference})` : ""}`,
          debit: 0,
          credit: Number(p.amount),
        }))
      ),
      ...contact.invoices.map((inv) => ({
        id: `inv-${inv.id}`,
        date: inv.issueDate,
        type: "INVOICE" as const,
        typeLabel: "Sales Invoice",
        reference: inv.invoiceNumber,
        description: `Sales invoice (${inv.items.length} line items)`,
        debit: Number(inv.total),
        credit: 0,
      })),
      ...contact.invoices.flatMap((inv) =>
        inv.payments.map((p) => ({
          id: `invpay-${p.id}`,
          date: p.paidAt,
          type: "INV_PAYMENT" as const,
          typeLabel: "Sales Collection",
          reference: `Payment for ${inv.invoiceNumber}`,
          description: `Client settlement via ${p.method || "Bank/Cash"}${p.reference ? ` (${p.reference})` : ""}`,
          debit: 0,
          credit: Number(p.amount),
        }))
      ),
      ...contact.incomes.map((inc) => ({
        id: `inc-${inc.id}`,
        date: inc.receivedAt,
        type: "INCOME" as const,
        typeLabel: "Income / Inflow",
        reference: inc.source || "Direct Receipt",
        description: `${inc.title}${inc.bankAccount ? ` [Bank: ${inc.bankAccount.bankName} - ${inc.bankAccount.accountName}]` : inc.paymentMethod === "CASH" ? " [Cash in Hand]" : ""}`,
        debit: 0,
        credit: Number(inc.amount),
      })),
      ...vendorExpenses.map((exp) => ({
        id: `exp-${exp.id}`,
        date: exp.occurredAt,
        type: "DIRECT_EXPENSE" as const,
        typeLabel: "Direct Expense",
        reference: exp.category?.name || "Expense",
        description: `${exp.title}${exp.notes ? ` (${exp.notes})` : ""}`,
        debit: Number(exp.amount),
        credit: 0,
      })),
      ...contact.bankTransactions.map((tx) => ({
        id: `btx-${tx.id}`,
        date: tx.transactionDate,
        type: "BANK_TX" as const,
        typeLabel: tx.type === "DEPOSIT" ? "Bank Deposit" : "Bank Withdrawal",
        reference: `${tx.bankAccount.bankName} (${tx.reference || "N/A"})`,
        description: tx.description || `${tx.type} transaction`,
        debit: tx.type === "WITHDRAWAL" ? Number(tx.amount) : 0,
        credit: tx.type === "DEPOSIT" ? Number(tx.amount) : 0,
      })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Calculate chronological running balance (ascending then reversed)
    let running = 0;
    const sortedAsc = [...statementRows].reverse();
    const rowsWithBalance = sortedAsc.map((r) => {
      running += r.debit - r.credit;
      return { ...r, balance: running };
    }).reverse();

    return (
      <main className="page-wrap">
        <div className="page-header no-print">
          <div>
            <Link href={`/${orgId}/crm`} className="topbar-kicker">
              <ArrowLeft size={12} style={{ verticalAlign: "middle", marginRight: 4 }} />
              Back to CRM Directory
            </Link>
            <h1 style={{ marginTop: 6 }}>{contact.companyName || contact.name}</h1>
            <p>Complete enterprise vendor &amp; customer statement, payment receipts, orders, and ledger history.</p>
          </div>
          <div className="page-actions" style={{ flexWrap: "wrap", gap: 8 }}>
            <PrintButton label="Print Statement / Profile" />
            <Link
              href={`/${orgId}/income/new?type=record-income&contactId=${contact.id}`}
              className="success-btn"
              style={{ fontSize: 13 }}
            >
              + Record Payment Received / Income
            </Link>
            {organization.kind === "COMPANY" && (
              <Link href={`/${orgId}/purchase/new?type=new-purchase-order`} className="primary-btn" style={{ fontSize: 13 }}>
                + New Purchase Order
              </Link>
            )}
          </div>
        </div>

        {/* Company Profile Header Card */}
        <div className="table-card" style={{ padding: "20px 24px", marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <Badge value={contact.type} />
                {contact.taxNumber && (
                  <span className="badge cyan" style={{ fontSize: 11 }}>
                    PAN / VAT: <strong>{contact.taxNumber}</strong>
                  </span>
                )}
              </div>
              <h2 style={{ margin: 0, fontSize: 20 }}>{contact.companyName || contact.name}</h2>
              {contact.companyName && contact.name && contact.companyName.trim().toLowerCase() !== contact.name.trim().toLowerCase() && (
                <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>
                  Contact Representative: <strong>{contact.name}</strong>
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: 16, textAlign: "right", flexWrap: "wrap" }}>
              {(contact.type === "VENDOR" || contact.type === "BOTH") && (
                <div>
                  <div style={{ fontSize: 10, textTransform: "uppercase", color: "var(--text-muted)" }}>Vendor Dues (Payable)</div>
                  <strong style={{ fontSize: 18, color: vendorDues > 0 ? "var(--danger)" : "var(--success)" }}>
                    {money(vendorDues, organization.currency)}
                  </strong>
                </div>
              )}
              {(contact.type === "CUSTOMER" || contact.type === "BOTH") && (
                <div>
                  <div style={{ fontSize: 10, textTransform: "uppercase", color: "var(--text-muted)" }}>Receivables (Due from Client)</div>
                  <strong style={{ fontSize: 18, color: customerReceivables > 0 ? "var(--brand)" : "var(--success)" }}>
                    {money(customerReceivables, organization.currency)}
                  </strong>
                </div>
              )}
              <div>
                <div style={{ fontSize: 10, textTransform: "uppercase", color: "var(--text-muted)" }}>Total Payments Received</div>
                <strong style={{ fontSize: 18, color: "var(--success)" }}>
                  {money(totalIncomeReceived, organization.currency)}
                </strong>
              </div>
              {totalDirectExpenses > 0 && (
                <div>
                  <div style={{ fontSize: 10, textTransform: "uppercase", color: "var(--text-muted)" }}>Direct Operational Bills</div>
                  <strong style={{ fontSize: 18, color: "var(--text-muted)" }}>
                    {money(totalDirectExpenses, organization.currency)}
                  </strong>
                </div>
              )}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginTop: 16, borderTop: "1px solid var(--line)", paddingTop: 14, fontSize: 12.5 }}>
            <div>
              <span style={{ color: "var(--text-muted)" }}>Email Address:</span>
              <div style={{ fontWeight: 600 }}>{contact.email || "—"}</div>
            </div>
            <div>
              <span style={{ color: "var(--text-muted)" }}>Phone / Mobile:</span>
              <div style={{ fontWeight: 600 }}>{contact.phone || "—"}</div>
            </div>
            <div>
              <span style={{ color: "var(--text-muted)" }}>Registered Office Address:</span>
              <div style={{ fontWeight: 600 }}>{contact.address || "—"}</div>
            </div>
            <div>
              <span style={{ color: "var(--text-muted)" }}>Profile Notes:</span>
              <div style={{ fontWeight: 600 }}>{contact.notes || "—"}</div>
            </div>
          </div>
        </div>

        {/* PAYMENTS RECEIVED & INCOMES LOG FROM THIS CONTACT */}
        <div className="table-card" style={{ marginBottom: 20 }}>
          <div className="table-toolbar">
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <h3>Payments Received &amp; Incomes ({contact.incomes.length})</h3>
              <span className="badge green">Total: {money(totalIncomeReceived, organization.currency)}</span>
            </div>
            <Link
              href={`/${orgId}/income/new?type=record-income&contactId=${contact.id}`}
              className="primary-btn"
              style={{ fontSize: 12, padding: "5px 10px" }}
            >
              + Record Payment
            </Link>
          </div>
          <div className="table-scroll">
            <DataTable className="responsive-table">
              <thead>
                <tr>
                  <th>Date (BS / AD)</th>
                  <th>Receipt / Inflow Title</th>
                  <th>Payment Channel / Account</th>
                  <th>Source / Ref</th>
                  <th style={{ textAlign: "right" }}>Amount Received</th>
                </tr>
              </thead>
              <tbody>
                {contact.incomes.map((inc) => (
                  <tr key={inc.id}>
                    <td data-label="Date">
                      <div>{formatDualDate(inc.receivedAt)}</div>
                    </td>
                    <td data-label="Title" className="table-title">
                      <strong>{inc.title}</strong>
                      {inc.notes && <div className="table-sub">{inc.notes}</div>}
                    </td>
                    <td data-label="Channel">
                      {resolveIncomeChannel(inc) === "BANK" ? (
                        <span className="badge purple" style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 9px", fontSize: 11, fontWeight: 700 }}>
                          <Landmark size={13} /> {inc.bankAccount ? `Bank: ${inc.bankAccount.bankName.toUpperCase()}` : (inc.source && inc.source.toLowerCase().includes("bank") ? inc.source.toUpperCase() : "BANK ACCOUNT")}
                        </span>
                      ) : resolveIncomeChannel(inc) === "CASH" ? (
                        <span className="badge green" style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 9px", fontSize: 11, fontWeight: 700 }}>
                          <Banknote size={13} /> CASH IN HAND
                        </span>
                      ) : (
                        <span className="badge cyan" style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 9px", fontSize: 11, fontWeight: 700 }}>
                          <RefreshCw size={13} /> {(inc.paymentMethod || "OTHER").toUpperCase()}
                        </span>
                      )}
                    </td>
                    <td data-label="Source">{inc.source || "—"}</td>
                    <td data-label="Amount" className="amount-pos" style={{ textAlign: "right", fontWeight: 700 }}>
                      + {money(inc.amount, organization.currency)}
                    </td>
                  </tr>
                ))}
                {!contact.incomes.length && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center", padding: "16px 12px", color: "var(--text-muted)" }}>
                      No direct income payments recorded from this contact yet.{" "}
                      <Link
                        href={`/${orgId}/income/new?type=record-income&contactId=${contact.id}`}
                        style={{ color: "var(--brand)", textDecoration: "underline", marginLeft: 4 }}
                      >
                        Record first payment
                      </Link>
                    </td>
                  </tr>
                )}
              </tbody>
            </DataTable>
          </div>
        </div>

        {/* ALL-IN-ONE COMPREHENSIVE STATEMENT & LEDGER */}
        <div className="table-card" style={{ marginBottom: 20 }}>
          <div className="table-toolbar">
            <div>
              <h3>All-in-One Comprehensive Account Statement</h3>
              <p style={{ margin: "2px 0 0 0", fontSize: 12, color: "var(--text-muted)" }}>
                Chronological transaction ledger combining purchases, payments, invoices, income receipts, and bank postings.
              </p>
            </div>
            <span className="badge cyan">{rowsWithBalance.length} ledger transactions</span>
          </div>
          <div className="table-scroll">
            <DataTable className="responsive-table">
              <thead>
                <tr>
                  <th>Date (BS / AD)</th>
                  <th>Transaction Type</th>
                  <th>Reference</th>
                  <th>Description</th>
                  <th style={{ textAlign: "right" }}>Debit (Dr)</th>
                  <th style={{ textAlign: "right" }}>Credit (Cr)</th>
                  <th style={{ textAlign: "right" }}>Net Balance</th>
                </tr>
              </thead>
              <tbody>
                {rowsWithBalance.map((row) => (
                  <tr key={row.id}>
                    <td data-label="Date">
                      <div>{formatDualDate(row.date)}</div>
                    </td>
                    <td data-label="Type">
                      <span
                        className={`badge ${
                          row.type === "PURCHASE" || row.type === "DIRECT_EXPENSE"
                            ? "amber"
                            : row.type === "PO_PAYMENT" || row.type === "INCOME" || row.type === "INV_PAYMENT"
                            ? "green"
                            : row.type === "INVOICE"
                            ? "cyan"
                            : "purple"
                        }`}
                        style={{ fontSize: 10 }}
                      >
                        {row.typeLabel}
                      </span>
                    </td>
                    <td data-label="Reference" style={{ fontWeight: 600 }}>{row.reference}</td>
                    <td data-label="Description" style={{ fontSize: 12 }}>{row.description}</td>
                    <td data-label="Debit" style={{ textAlign: "right", color: row.debit > 0 ? "var(--danger)" : "inherit" }}>
                      {row.debit > 0 ? money(row.debit, organization.currency) : "—"}
                    </td>
                    <td data-label="Credit" style={{ textAlign: "right", color: row.credit > 0 ? "var(--success)" : "inherit", fontWeight: row.credit > 0 ? 600 : 400 }}>
                      {row.credit > 0 ? money(row.credit, organization.currency) : "—"}
                    </td>
                    <td data-label="Balance" style={{ textAlign: "right", fontWeight: 700, color: row.balance > 0 ? "var(--danger)" : row.balance < 0 ? "var(--success)" : "inherit" }}>
                      {money(Math.abs(row.balance), organization.currency)} {row.balance > 0 ? "Dr" : row.balance < 0 ? "Cr" : ""}
                    </td>
                  </tr>
                ))}
                {!rowsWithBalance.length && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", padding: 18, color: "var(--text-muted)" }}>
                      No ledger transactions found for this party.
                    </td>
                  </tr>
                )}
              </tbody>
            </DataTable>
          </div>
        </div>

        {/* Vendor Procurement / Purchase Orders Table */}
        <div className="table-card" style={{ marginBottom: 20 }}>
          <div className="table-toolbar">
            <h3>Procurement Orders &amp; Bills ({contact.purchaseOrders.length})</h3>
            <span className="badge purple">Total: {money(totalPurchases, organization.currency)}</span>
          </div>
          <div className="table-scroll">
            <DataTable className="responsive-table">
              <thead>
                <tr>
                  <th>PO #</th>
                  <th>Order Date</th>
                  <th>Line Items</th>
                  <th style={{ textAlign: "right" }}>Total Amount</th>
                  <th style={{ textAlign: "right" }}>Paid</th>
                  <th style={{ textAlign: "right" }}>Remaining Dues</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {contact.purchaseOrders.map((po) => {
                  const poTotal = Number(po.total);
                  const poPaid = Number(po.paidAmount);
                  const poDue = Math.max(0, poTotal - poPaid);
                  return (
                    <tr key={po.id}>
                      <td data-label="PO #">
                        <Link href={`/${orgId}/purchase/${po.id}`} className="table-clickable-title">
                          {po.orderNumber}
                        </Link>
                      </td>
                      <td data-label="Date">{formatDualDate(po.orderDate)}</td>
                      <td data-label="Lines">{po.items.length} items</td>
                      <td data-label="Total" style={{ textAlign: "right", fontWeight: 700 }}>
                        {money(poTotal, organization.currency)}
                      </td>
                      <td data-label="Paid" style={{ textAlign: "right", color: "var(--success)" }}>
                        {money(poPaid, organization.currency)}
                      </td>
                      <td data-label="Dues" style={{ textAlign: "right", color: poDue > 0 ? "var(--danger)" : "var(--success)", fontWeight: 700 }}>
                        {money(poDue, organization.currency)}
                      </td>
                      <td data-label="Status"><Badge value={po.status} /></td>
                      <td data-label="Action">
                        <Link href={`/${orgId}/purchase/${po.id}`} className="secondary-btn" style={{ padding: "3px 8px", fontSize: 11 }}>
                          View Invoice
                        </Link>
                      </td>
                    </tr>
                  );
                })}
                {!contact.purchaseOrders.length && (
                  <tr>
                    <td colSpan={8} style={{ textAlign: "center", padding: 14, color: "var(--text-muted)" }}>
                      No purchase orders registered for this vendor yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </DataTable>
          </div>
        </div>

        {/* Customer Sales & Invoices Table */}
        {contact.invoices.length > 0 && (
          <div className="table-card">
            <div className="table-toolbar">
              <h3>Customer Sales Invoices ({contact.invoices.length})</h3>
              <span className="badge green">Total: {money(totalSales, organization.currency)}</span>
            </div>
            <div className="table-scroll">
              <DataTable className="responsive-table">
                <thead>
                  <tr>
                    <th>Invoice #</th>
                    <th>Issue Date</th>
                    <th style={{ textAlign: "right" }}>Total</th>
                    <th style={{ textAlign: "right" }}>Collected</th>
                    <th style={{ textAlign: "right" }}>Balance Due</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {contact.invoices.map((inv) => (
                    <tr key={inv.id}>
                      <td data-label="Invoice #">
                        <Link href={`/${orgId}/invoices/${inv.id}`} className="table-clickable-title">
                          {inv.invoiceNumber}
                        </Link>
                      </td>
                      <td data-label="Date">{formatDualDate(inv.issueDate)}</td>
                      <td data-label="Total" style={{ textAlign: "right", fontWeight: 700 }}>
                        {money(inv.total, organization.currency)}
                      </td>
                      <td data-label="Collected" style={{ textAlign: "right", color: "var(--success)" }}>
                        {money(inv.paidAmount, organization.currency)}
                      </td>
                      <td data-label="Balance" style={{ textAlign: "right", fontWeight: 700 }}>
                        {money(Number(inv.total) - Number(inv.paidAmount), organization.currency)}
                      </td>
                      <td data-label="Status"><Badge value={inv.status} /></td>
                      <td data-label="Action">
                        <Link href={`/${orgId}/invoices/${inv.id}`} className="secondary-btn" style={{ padding: "3px 8px", fontSize: 11 }}>
                          View Invoice
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            </div>
          </div>
        )}
      </main>
    );
  }

  if (module === "loans") {
    const loan = await db.loan.findFirst({
      where: { id: recordId, organizationId: orgId },
      include: {
        payments: { orderBy: { paymentDate: "desc" } },
      },
    });
    if (!loan) notFound();

    // Auto-calculate Accrued Interest
    const principal = Number(loan.principalAmount);
    const principalPaid = Number(loan.totalPrincipalPaid);
    const interestPaid = Number(loan.totalInterestPaid);
    const remainingPrincipal = Math.max(0, principal - principalPaid);

    let accruedTotalInterest = 0;
    let isProjectedTerm = false;
    let daysCount = 0;
    if (loan.hasInterest) {
      const r = Number(loan.interestRate);
      const startMs = new Date(loan.startDate).getTime();
      const nowMs = Date.now();
      const elapsed = Math.floor((nowMs - startMs) / (1000 * 60 * 60 * 24));

      if (elapsed > 0) {
        daysCount = elapsed;
      } else {
        // Projected term to due date or minimum cycle
        isProjectedTerm = true;
        if (loan.dueDate && new Date(loan.dueDate).getTime() > startMs) {
          daysCount = Math.max(1, Math.round((new Date(loan.dueDate).getTime() - startMs) / (1000 * 60 * 60 * 24)));
        } else {
          daysCount = loan.interestFrequency === "DAILY" ? 1 : loan.interestFrequency === "YEARLY" ? 365 : 30;
        }
      }

      if (loan.interestFrequency === "DAILY") {
        accruedTotalInterest = principal * (r / 100) * daysCount;
      } else if (loan.interestFrequency === "YEARLY") {
        accruedTotalInterest = principal * (r / 100) * (daysCount / 365.25);
      } else {
        // MONTHLY
        accruedTotalInterest = principal * (r / 100) * (daysCount / 30);
      }
    }
    const accruedUnpaidInterest = Math.max(0, accruedTotalInterest - interestPaid);
    const roundedUnpaidInterest = Math.round(accruedUnpaidInterest * 100) / 100;
    const totalOutstandingDue = remainingPrincipal + roundedUnpaidInterest;

    return (
      <main className="page-wrap">
        <div className="page-header no-print">
          <div>
            <Link href={`/${orgId}/loans`} className="topbar-kicker">
              <ArrowLeft size={12} style={{ verticalAlign: "middle", marginRight: 4 }} />
              Back to Loan Ledger
            </Link>
            <h1 style={{ marginTop: 6 }}>
              {loan.type === "TAKEN" ? "Loan Taken (Borrowing)" : "Loan Given (Lending)"} · {loan.partyName}
            </h1>
            <p>Official loan agreement voucher, dynamic interest accrual ledger, and settlement tracker.</p>
          </div>
          <div className="page-actions">
            <PrintButton label="Print Loan Statement / PDF" defaultOrientation="portrait" />
          </div>
        </div>

        {/* Printable Loan Certificate Document */}
        <div className="invoice-print-container">
          <div className="invoice-brand-row">
            <div className="invoice-company-details">
              <div className="brand-mark" style={{ marginBottom: 10 }}>
                <span className="brand-symbol">K</span>
                <div>
                  <span>KASHTRIX</span>
                  <div className="brand-sub">FINANCIAL &amp; LOAN LEDGER</div>
                </div>
              </div>
              <h2>{organization.name}</h2>
              <p>
                {organization.address && <>{organization.address}<br /></>}
                {organization.email && <span>{organization.email} </span>}
                {organization.phone && <span>· {organization.phone}</span>}
              </p>
            </div>
            <div className="invoice-meta-col">
              <div style={{ marginBottom: 6 }}><Badge value={loan.status} /></div>
              <div className="invoice-doc-type">
                {loan.type === "TAKEN" ? "LOAN BORROWING AGREEMENT" : "LOAN LENDING CONTRACT"}
              </div>
              <div className="table-sub" style={{ fontSize: 11.5, marginTop: 4 }}>
                <strong>Loan ID:</strong> {loan.id.slice(-8).toUpperCase()}<br />
                <strong>Disbursement Date:</strong> {formatDualDate(loan.startDate)}<br />
                {loan.dueDate && <><strong>Target Due Date:</strong> {formatDualDate(loan.dueDate)}<br /></>}
                <strong>Status:</strong> {loan.status}
              </div>
            </div>
          </div>

          <div className="invoice-party-grid">
            <div className="invoice-party-box">
              <div className="topbar-kicker" style={{ marginBottom: 4 }}>
                {loan.type === "TAKEN" ? "Lender (Creditor):" : "Borrower (Debtor):"}
              </div>
              <h4>{loan.partyName}</h4>
              <p>
                <strong>Loan Nature:</strong> {loan.type === "TAKEN" ? "Borrowing / Liability" : "Lending / Asset"}<br />
                <strong>Interest Status:</strong> {loan.hasInterest ? `With Interest (${loan.interestRate}% ${loan.interestFrequency.toLowerCase()})` : "Without Interest (0%)"}<br />
                {loan.notes && <><strong>Terms:</strong> {loan.notes}</>}
              </p>
            </div>
            <div className="invoice-party-box">
              <div className="topbar-kicker" style={{ marginBottom: 4 }}>Outstanding Settlement Position</div>
              <p>
                <strong>Original Principal:</strong> {money(principal, organization.currency)}<br />
                <strong>Principal Repaid:</strong> {money(principalPaid, organization.currency)}<br />
                <strong>Remaining Principal:</strong> {money(remainingPrincipal, organization.currency)}<br />
                <strong>Auto-Accrued Interest:</strong> {money(roundedUnpaidInterest, organization.currency)} {isProjectedTerm ? `(Projected · ${daysCount}d)` : `(${daysCount}d)`}<br />
                <strong style={{ fontSize: "11pt", color: totalOutstandingDue > 0 ? "var(--danger)" : "var(--success)" }}>
                  Total Settlement Due: {money(totalOutstandingDue, organization.currency)}
                </strong>
              </p>
            </div>
          </div>

          <div className="invoice-calculation-wrap">
            <div className="invoice-notes-terms">
              <strong>Calculation Rule &amp; Frequency:</strong>
              <div style={{ fontSize: 12, marginTop: 4, lineHeight: 1.6 }}>
                {loan.hasInterest ? (
                  <>
                    Interest is accrued at <strong>{Number(loan.interestRate)}%</strong> on a <strong>{loan.interestFrequency.toLowerCase()}</strong> frequency basis from disbursement date ({formatDualDate(loan.startDate)}).
                    {isProjectedTerm ? ` Auto-projected for ${daysCount} days until due date / 1st term.` : ` Automatically recalculated for ${daysCount} days elapsed in real-time until full settlement.`}
                  </>
                ) : (
                  <>This loan is interest-free (0% interest). Only the principal amount of {money(principal, organization.currency)} is repayable.</>
                )}
              </div>
            </div>
            <div className="invoice-calc-box">
              <div className="invoice-calc-row">
                <span>Principal Borrowed / Lent</span>
                <strong>{money(principal, organization.currency)}</strong>
              </div>
              <div className="invoice-calc-row">
                <span>Principal Repaid to Date</span>
                <strong style={{ color: "var(--success)" }}>- {money(principalPaid, organization.currency)}</strong>
              </div>
              <div className="invoice-calc-row">
                <span>Remaining Principal</span>
                <strong>{money(remainingPrincipal, organization.currency)}</strong>
              </div>
              <div className="invoice-calc-row">
                <span>Unpaid Accrued Interest</span>
                <strong>+ {money(roundedUnpaidInterest, organization.currency)}</strong>
              </div>
              <div className="invoice-calc-row grand-total">
                <span>Total Amount to Settle</span>
                <strong style={{ color: totalOutstandingDue > 0 ? "var(--danger)" : "var(--success)" }}>
                  {money(totalOutstandingDue, organization.currency)}
                </strong>
              </div>
            </div>
          </div>

          <div className="invoice-signature-section">
            <div className="signature-box">
              {loan.type === "TAKEN" ? "Lender Signature & Acknowledgment" : "Borrower Signature & Acknowledgment"}
            </div>
            <div className="signature-box">
              Authorized Organization Signature ({organization.name})
            </div>
          </div>
        </div>

        {/* Payments History Ledger & Settlement Form */}
        <div className="panel loan-statement-section" style={{ marginTop: 20 }}>
          <div className="panel-head">
            <div>
              <h3>Loan Account Statement</h3>
              <span>{loan.payments.length} repayment entr{loan.payments.length === 1 ? "y" : "ies"} · Loan {loan.id.slice(-8).toUpperCase()}</span>
            </div>
            <PrintButton label="Print Statement / PDF" defaultOrientation="portrait" />
          </div>
          {loan.payments.length > 0 ? (
            <div className="table-scroll">
              <table className="data-table" style={{ width: "100%", fontSize: 12 }}>
                <thead>
                  <tr>
                    <th>Payment Date (BS / AD)</th>
                    <th style={{ textAlign: "right" }}>Principal Paid</th>
                    <th style={{ textAlign: "right" }}>Interest Paid</th>
                    <th style={{ textAlign: "right" }}>Total Paid</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {loan.payments.map((p) => (
                    <tr key={p.id}>
                      <td>{formatDualDate(p.paymentDate)}</td>
                      <td style={{ textAlign: "right", fontWeight: 600 }}>{money(p.principalAmount, organization.currency)}</td>
                      <td style={{ textAlign: "right", color: "var(--brand)" }}>{money(p.interestAmount, organization.currency)}</td>
                      <td style={{ textAlign: "right", fontWeight: 700, color: "var(--success)" }}>{money(p.totalAmount, organization.currency)}</td>
                      <td>{p.notes || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p style={{ color: "var(--text-muted)", fontSize: 13, padding: "8px 0" }}>
              No settlement payments logged yet. Total outstanding balance is {money(totalOutstandingDue, organization.currency)}.
            </p>
          )}

          {totalOutstandingDue > 0 && (
            <LoanSettlementForm
              orgId={orgId}
              loanId={loan.id}
              loanType={loan.type}
              partyName={loan.partyName}
              currency={organization.currency}
              remainingPrincipal={remainingPrincipal}
              hasInterest={loan.hasInterest}
              interestRate={loan.interestRate ? Number(loan.interestRate) : null}
              interestFrequency={loan.interestFrequency}
              startDate={loan.startDate}
              dueDate={loan.dueDate}
              totalInterestPaid={interestPaid}
              action={settleLoanAction}
            />
          )}
        </div>
      </main>
    );
  }

  notFound();
}
