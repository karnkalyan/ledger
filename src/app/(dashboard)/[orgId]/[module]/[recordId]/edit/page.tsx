import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Save, Landmark, Banknote, Calendar, Tag, User, Receipt } from "lucide-react";
import { db } from "@/lib/db";
import { requireOrganizationAccess } from "@/lib/session";
import { DocumentComposer } from "@/components/document-composer";
import {
  updateCommerceDocumentAction,
  updateExpenseAction,
  updateIncomeAction,
  updateBankTransactionAction,
} from "@/app/(dashboard)/actions";
import { NepaliDatePicker } from "@/components/nepali-date-picker";
import { money } from "@/lib/format";

export default async function EditDocumentPage({
  params,
}: {
  params: Promise<{ orgId: string; module: string; recordId: string }>;
}) {
  const { orgId, module, recordId } = await params;
  const { organization, membership } = await requireOrganizationAccess(orgId);
  if (membership.role === "VIEWER") redirect(`/${orgId}/${module}/${recordId}`);

  const allowedModules = ["quotes", "invoices", "expenses", "income", "banking"];
  if (!allowedModules.includes(module)) notFound();

  // 1. EDIT EXPENSE TRANSACTION
  if (module === "expenses") {
    const [expense, categories, contacts] = await Promise.all([
      db.expense.findFirst({ where: { id: recordId, organizationId: orgId } }),
      db.expenseCategory.findMany({ where: { organizationId: orgId }, orderBy: { name: "asc" } }),
      db.contact.findMany({ where: { organizationId: orgId }, orderBy: { name: "asc" } }),
    ]);
    if (!expense) notFound();

    async function handleUpdateExpense(formData: FormData) {
      "use server";
      await updateExpenseAction(formData);
      redirect(`/${orgId}/expenses`);
    }

    return (
      <main className="page-wrap entry-page">
        <div className="page-header">
          <div>
            <Link href={`/${orgId}/expenses`} className="topbar-kicker">
              <ArrowLeft size={12} style={{ verticalAlign: "middle", marginRight: 4 }} />
              Back to Expenses
            </Link>
            <h1 style={{ marginTop: 6 }}>Modify Expense Transaction</h1>
            <p>Admin / Authorized Ledger Edit: Adjust amounts, date, category, formula, or vendor details.</p>
          </div>
          <Link href={`/${orgId}/expenses`} className="secondary-btn">
            Cancel
          </Link>
        </div>

        <section className="entry-form-card">
          <form action={handleUpdateExpense}>
            <input type="hidden" name="orgId" value={orgId} />
            <input type="hidden" name="id" value={expense.id} />

            <div className="form-grid">
              <label className="field full">
                <span className="field-label">Expense Title / Description</span>
                <input name="title" defaultValue={expense.title} required placeholder="e.g. Office Electricity bill / Raw Material" />
              </label>

              <label className="field">
                <span className="field-label">Category</span>
                <select name="categoryId" defaultValue={expense.categoryId || ""}>
                  <option value="">-- Uncategorized --</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span className="field-label">Vendor / Supplier / Payee</span>
                <input
                  name="vendor"
                  defaultValue={expense.vendor || ""}
                  list="vendor-options"
                  placeholder="Company or party name"
                />
                <datalist id="vendor-options">
                  {contacts.map((c) => (
                    <option key={c.id} value={c.companyName || c.name} />
                  ))}
                </datalist>
              </label>

              <div className="field">
                <NepaliDatePicker
                  name="occurredAt"
                  defaultValue={expense.occurredAt}
                  label="Expense Date (BS / AD)"
                  required
                />
              </div>

              <label className="field">
                <span className="field-label">Expense Classification</span>
                <select name="type" defaultValue={expense.type}>
                  <option value="ONE_TIME">One-off Operational Expense</option>
                  <option value="DAILY">Daily Essential</option>
                  <option value="RECURRING">Fixed Recurring Commitment</option>
                </select>
              </label>

              <label className="field">
                <span className="field-label">Total Amount ({organization.currency})</span>
                <input
                  name="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  defaultValue={Number(expense.amount)}
                  required
                  style={{ fontWeight: 700, fontSize: 16 }}
                />
              </label>

              <label className="field">
                <span className="field-label">Quantity (Optional Formula)</span>
                <input
                  name="quantity"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={expense.quantity ? Number(expense.quantity) : ""}
                  placeholder="e.g. 10"
                />
              </label>

              <label className="field">
                <span className="field-label">Unit Rate (Optional Formula)</span>
                <input
                  name="unitRate"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={expense.unitRate ? Number(expense.unitRate) : ""}
                  placeholder="Rate per unit"
                />
              </label>

              <label className="field">
                <span className="field-label">Measurement Unit</span>
                <input
                  name="unit"
                  defaultValue={expense.unit || ""}
                  placeholder="pcs, kg, liters, units, hrs"
                />
              </label>

              <label className="field">
                <span className="field-label">Days / Multiplier Count</span>
                <input
                  name="daysCount"
                  type="number"
                  min="1"
                  defaultValue={expense.daysCount ? Number(expense.daysCount) : 1}
                />
              </label>

              <label className="field full">
                <span className="field-label">Notes &amp; Internal Audit Remarks</span>
                <textarea
                  name="notes"
                  defaultValue={expense.notes || ""}
                  rows={3}
                  placeholder="Bill reference, receipt number, audit reason for modification..."
                />
              </label>
            </div>

            <div className="form-actions" style={{ marginTop: 20 }}>
              <button type="submit" className="primary-btn">
                <Save size={14} style={{ verticalAlign: "middle", marginRight: 6 }} />
                Save &amp; Update Expense Transaction
              </button>
              <Link href={`/${orgId}/expenses`} className="secondary-btn">
                Cancel
              </Link>
            </div>
          </form>
        </section>
      </main>
    );
  }

  // 2. EDIT INCOME INFLOW TRANSACTION
  if (module === "income") {
    const [income, bankAccounts, contacts] = await Promise.all([
      db.income.findFirst({
        where: { id: recordId, organizationId: orgId },
        include: { bankAccount: true, contact: true },
      }),
      db.bankAccount.findMany({ where: { organizationId: orgId }, orderBy: { createdAt: "asc" } }),
      db.contact.findMany({ where: { organizationId: orgId }, orderBy: { name: "asc" } }),
    ]);
    if (!income) notFound();

    async function handleUpdateIncome(formData: FormData) {
      "use server";
      await updateIncomeAction(formData);
      redirect(`/${orgId}/income`);
    }

    return (
      <main className="page-wrap entry-page">
        <div className="page-header">
          <div>
            <Link href={`/${orgId}/income`} className="topbar-kicker">
              <ArrowLeft size={12} style={{ verticalAlign: "middle", marginRight: 4 }} />
              Back to Income Ledger
            </Link>
            <h1 style={{ marginTop: 6 }}>Modify Income Inflow</h1>
            <p>Admin / Authorized Ledger Edit: Update receipts, destination channel, payer, or bank reflection.</p>
          </div>
          <Link href={`/${orgId}/income`} className="secondary-btn">
            Cancel
          </Link>
        </div>

        <section className="entry-form-card">
          <form action={handleUpdateIncome}>
            <input type="hidden" name="orgId" value={orgId} />
            <input type="hidden" name="id" value={income.id} />

            <div className="form-grid">
              <label className="field full">
                <span className="field-label">Income Inflow Title</span>
                <input
                  name="title"
                  defaultValue={income.title}
                  required
                  placeholder="e.g. Client Payment for Order #1042 / Consulting Revenue"
                />
              </label>

              <label className="field">
                <span className="field-label">Received Amount ({organization.currency})</span>
                <input
                  name="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  defaultValue={Number(income.amount)}
                  required
                  style={{ fontWeight: 700, fontSize: 16 }}
                />
              </label>

              <div className="field">
                <NepaliDatePicker
                  name="receivedAt"
                  defaultValue={income.receivedAt}
                  label="Receipt Date (BS / AD)"
                  required
                />
              </div>

              <label className="field">
                <span className="field-label">Payment Channel / Reception Mode</span>
                <select name="paymentMethod" defaultValue={income.paymentMethod || "CASH"}>
                  <option value="CASH">💵 Cash in Hand (Physical Liquid Inflow)</option>
                  <option value="BANK">🏦 Bank Account (Auto-updates Account Balance)</option>
                  <option value="OTHER">🔄 Other Channel (Digital Wallet / Instrument)</option>
                </select>
              </label>

              <label className="field">
                <span className="field-label">Destination Bank Account (If Bank selected)</span>
                <select name="bankAccountId" defaultValue={income.bankAccountId || bankAccounts[0]?.id || ""}>
                  <option value="">-- No Bank Selected --</option>
                  {bankAccounts.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.bankName} (A/C: {b.accountNumber}) · Bal: {money(b.currentBalance, organization.currency)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span className="field-label">Customer / Vendor (CRM Profile)</span>
                <select name="contactId" defaultValue={income.contactId || ""}>
                  <option value="">-- Optional: Link to CRM Contact --</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.companyName || c.name} {c.taxNumber ? `(PAN: ${c.taxNumber})` : ""} · {c.type}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span className="field-label">Custom Source / Payer Name</span>
                <input
                  name="source"
                  defaultValue={income.source || ""}
                  placeholder="Payer name if not in CRM"
                />
              </label>

              <label className="field full">
                <span className="field-label">Receipt Notes / Voucher Remarks</span>
                <textarea
                  name="notes"
                  defaultValue={income.notes || ""}
                  rows={3}
                  placeholder="Bank voucher ref, cheque details, memo..."
                />
              </label>
            </div>

            <div className="form-actions" style={{ marginTop: 20 }}>
              <button type="submit" className="primary-btn">
                <Save size={14} style={{ verticalAlign: "middle", marginRight: 6 }} />
                Save &amp; Update Income Record
              </button>
              <Link href={`/${orgId}/income`} className="secondary-btn">
                Cancel
              </Link>
            </div>
          </form>
        </section>
      </main>
    );
  }

  // 3. EDIT BANK TRANSACTION
  if (module === "banking") {
    const [txRecord, bankAccounts, contacts] = await Promise.all([
      db.bankTransaction.findFirst({
        where: { id: recordId, organizationId: orgId },
        include: { bankAccount: true, contact: true },
      }),
      db.bankAccount.findMany({ where: { organizationId: orgId }, orderBy: { createdAt: "asc" } }),
      db.contact.findMany({ where: { organizationId: orgId }, orderBy: { name: "asc" } }),
    ]);
    if (!txRecord) notFound();

    async function handleUpdateBankTx(formData: FormData) {
      "use server";
      await updateBankTransactionAction(formData);
      redirect(`/${orgId}/banking`);
    }

    return (
      <main className="page-wrap entry-page">
        <div className="page-header">
          <div>
            <Link href={`/${orgId}/banking`} className="topbar-kicker">
              <ArrowLeft size={12} style={{ verticalAlign: "middle", marginRight: 4 }} />
              Back to Bank Transactions
            </Link>
            <h1 style={{ marginTop: 6 }}>Modify Bank Transaction</h1>
            <p>Admin / Authorized Ledger Edit: Update bank balance postings, flow type, particulars, or reference codes.</p>
          </div>
          <Link href={`/${orgId}/banking`} className="secondary-btn">
            Cancel
          </Link>
        </div>

        <section className="entry-form-card">
          <form action={handleUpdateBankTx}>
            <input type="hidden" name="orgId" value={orgId} />
            <input type="hidden" name="id" value={txRecord.id} />

            <div className="form-grid">
              <label className="field">
                <span className="field-label">Bank Account</span>
                <select name="bankAccountId" defaultValue={txRecord.bankAccountId} required>
                  {bankAccounts.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.bankName} (A/C: {b.accountNumber}) · Bal: {money(b.currentBalance, organization.currency)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span className="field-label">Transaction Flow Type</span>
                <select name="type" defaultValue={txRecord.type} required>
                  <option value="DEPOSIT">DEPOSIT (+ Inflow / Credit to Account)</option>
                  <option value="WITHDRAWAL">WITHDRAWAL (- Outflow / Debit from Account)</option>
                </select>
              </label>

              <label className="field">
                <span className="field-label">Transaction Amount ({organization.currency})</span>
                <input
                  name="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  defaultValue={Number(txRecord.amount)}
                  required
                  style={{ fontWeight: 700, fontSize: 16 }}
                />
              </label>

              <div className="field">
                <NepaliDatePicker
                  name="transactionDate"
                  defaultValue={txRecord.transactionDate}
                  label="Transaction Date (BS / AD)"
                  required
                />
              </div>

              <label className="field full">
                <span className="field-label">Description / Particulars</span>
                <input
                  name="description"
                  defaultValue={txRecord.description}
                  required
                  placeholder="Account remittance, vendor disbursement, client collection..."
                />
              </label>

              <label className="field">
                <span className="field-label">Category / Ledger Tag</span>
                <input
                  name="category"
                  defaultValue={txRecord.category || ""}
                  placeholder="e.g. Payment Received, Vendor Disbursement, Bank Charges, Director drawings"
                />
              </label>

              <label className="field">
                <span className="field-label">Reference / Transfer ID / Remittance Code</span>
                <input
                  name="reference"
                  defaultValue={txRecord.reference || ""}
                  placeholder="IBFT / Fonepay / Voucher Ref #"
                />
              </label>

              <label className="field">
                <span className="field-label">Cheque Number (If applicable)</span>
                <input
                  name="chequeNumber"
                  defaultValue={txRecord.chequeNumber || ""}
                  placeholder="Cheque #"
                />
              </label>

              <label className="field">
                <span className="field-label">Linked Customer / Vendor (CRM)</span>
                <select name="contactId" defaultValue={txRecord.contactId || ""}>
                  <option value="">-- Optional: Link to CRM Contact --</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.companyName || c.name} {c.taxNumber ? `(PAN: ${c.taxNumber})` : ""} · {c.type}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="form-actions" style={{ marginTop: 20 }}>
              <button type="submit" className="primary-btn">
                <Save size={14} style={{ verticalAlign: "middle", marginRight: 6 }} />
                Save &amp; Recalculate Bank Balance
              </button>
              <Link href={`/${orgId}/banking`} className="secondary-btn">
                Cancel
              </Link>
            </div>
          </form>
        </section>
      </main>
    );
  }

  // 4. QUOTES & INVOICES (Commerce)
  const [contacts, rawProducts] = await Promise.all([
    db.contact.findMany({
      where: { organizationId: orgId, type: { in: ["CUSTOMER", "BOTH"] } },
      orderBy: { name: "asc" },
    }),
    db.product.findMany({
      where: { organizationId: orgId, active: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const products = rawProducts.map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    salePrice: Number(p.salePrice),
    purchasePrice: Number(p.purchasePrice),
  }));

  if (module === "quotes") {
    const quote = await db.quote.findFirst({
      where: { id: recordId, organizationId: orgId },
      include: { contact: true, items: { include: { product: true } } },
    });
    if (!quote) notFound();

    const initialData = {
      id: quote.id,
      number: quote.quoteNumber,
      contactId: quote.contactId,
      issueDate: quote.issueDate,
      dueDate: quote.validUntil,
      discount: Number(quote.discount),
      terms: quote.terms,
      notes: quote.notes,
      lines: quote.items.map((i) => ({
        description: i.description,
        quantity: Number(i.quantity),
        unitPrice: Number(i.unitPrice),
        taxRate: Number(i.taxRate),
        productId: i.productId || undefined,
      })),
    };

    return (
      <main className="page-wrap">
        <div className="page-header">
          <div>
            <Link href={`/${orgId}/quotes/${quote.id}`} className="topbar-kicker">
              <ArrowLeft size={12} style={{ verticalAlign: "middle", marginRight: 4 }} />
              Back to {quote.quoteNumber}
            </Link>
            <h1 style={{ marginTop: 6 }}>Edit Quotation ({quote.quoteNumber})</h1>
            <p>Modify line items, pricing, tax rates, validity date, or customer details.</p>
          </div>
        </div>

        <div className="table-card" style={{ padding: 24 }}>
          <DocumentComposer
            orgId={orgId}
            kind="QUOTE"
            contacts={contacts}
            products={products}
            currency={organization.currency}
            defaultTaxRate={organization.defaultTaxPercent ? Number(organization.defaultTaxPercent) : 13}
            action={updateCommerceDocumentAction}
            initialData={initialData}
            isEdit
          />
        </div>
      </main>
    );
  }

  if (module === "invoices") {
    const invoice = await db.invoice.findFirst({
      where: { id: recordId, organizationId: orgId },
      include: { contact: true, items: { include: { product: true } } },
    });
    if (!invoice) notFound();

    const initialData = {
      id: invoice.id,
      number: invoice.invoiceNumber,
      contactId: invoice.contactId,
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      discount: Number(invoice.discount),
      terms: invoice.terms,
      notes: invoice.notes,
      lines: invoice.items.map((i) => ({
        description: i.description,
        quantity: Number(i.quantity),
        unitPrice: Number(i.unitPrice),
        taxRate: Number(i.taxRate),
        productId: i.productId || undefined,
      })),
    };

    return (
      <main className="page-wrap">
        <div className="page-header">
          <div>
            <Link href={`/${orgId}/invoices/${invoice.id}`} className="topbar-kicker">
              <ArrowLeft size={12} style={{ verticalAlign: "middle", marginRight: 4 }} />
              Back to {invoice.invoiceNumber}
            </Link>
            <h1 style={{ marginTop: 6 }}>Edit Invoice ({invoice.invoiceNumber})</h1>
            <p>Modify line items, quantities, customer details, and invoice terms.</p>
          </div>
        </div>

        <div className="table-card" style={{ padding: 24 }}>
          <DocumentComposer
            orgId={orgId}
            kind="INVOICE"
            contacts={contacts}
            products={products}
            currency={organization.currency}
            defaultTaxRate={organization.defaultTaxPercent ? Number(organization.defaultTaxPercent) : 13}
            action={updateCommerceDocumentAction}
            initialData={initialData}
            isEdit
          />
        </div>
      </main>
    );
  }

  notFound();
}
