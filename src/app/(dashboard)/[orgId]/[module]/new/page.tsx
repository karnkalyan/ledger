import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireOrganizationAccess } from "@/lib/session";
import { monthKey } from "@/lib/format";
import { ExpenseForm } from "@/components/expense-form";
import { IncomeForm } from "@/components/income-form";
import { DocumentComposer } from "@/components/document-composer";
import { NepaliDatePicker } from "@/components/nepali-date-picker";
import { saveIncomeAction, saveContactAction, saveLeadAction, saveStockMovementAction, saveProductAction, saveEmployeeAction, savePayrollAction, saveLeaveAction, saveTaskAction, saveLicenseAction, saveReminderAction, saveExpenseAction, saveRecurringExpenseAction, saveCommerceDocumentAction, saveBankAccountAction, saveBankTransactionAction, saveLoanAction } from "./actions";
const entries = [
  { module: "loans", type: "new-loan", title: "Record Loan (Taken / Given)", subtitle: "Configure borrower or lender, principal, daily/monthly/yearly interest rate, and due date." },
  { module: "expenses", type: "recurring-rule", title: "Add Recurring Commitment", subtitle: "Configure recurring expenses like office rent, internet, milk, utilities." },
  { module: "expenses", type: "new-expense", title: "Record Actual Expense", subtitle: "Record a paid expense or calculate it from quantity × rate × days." },
  { module: "income", type: "record-income", title: "Record Income / Receipt", subtitle: "Save a received amount with its source and date." },
  { module: "banking", type: "new-account", title: "Add Bank Account", subtitle: "Register bank branch and account number for corporate or household ledger." },
  { module: "banking", type: "record-deposit", title: "Record Bank Deposit", subtitle: "Record funds deposited into bank account; automatically reflects in Income." },
  { module: "banking", type: "record-withdrawal", title: "Record Bank Withdrawal", subtitle: "Record funds withdrawn or paid from bank account; automatically reflects in Expenses." },
  { module: "crm", type: "add-contact", title: "Create Contact Record", subtitle: "Create a customer, vendor or partner profile." },
  { module: "leads", type: "add-lead", title: "New Sales Opportunity", subtitle: "Record deal value and follow-up target." },
  { module: "stock", type: "movement", title: "Record Stock Movement", subtitle: "Inward, outward, return, or stock adjustment." },
  { module: "stock", type: "new-product", title: "Add Product Item", subtitle: "Create product SKU with buying and selling prices." },
  { module: "staff", type: "add-employee", title: "New Team Member", subtitle: "Create employee profile for payroll and HR." },
  { module: "payroll", type: "new-payroll", title: "Generate Monthly Payslip", subtitle: "Record salary disbursement for staff member." },
  { module: "leaves", type: "request-leave", title: "Submit Leave Request", subtitle: "Record planned absence or medical leave." },
  { module: "tasks", type: "add-task", title: "Create Action Item", subtitle: "Define task details and due date." },
  { module: "licenses", type: "add-license", title: "Store License Record", subtitle: "Save license key, renewal date, and vendor costs." },
  { module: "reminders", type: "add-reminder", title: "Create Reminder", subtitle: "Schedule an alert for upcoming commitments." },
  { module: "invoices", type: "new-invoice", title: "Create Commercial Invoice", subtitle: "Itemized lines, automatic tax, customer balance." },
  { module: "quotes", type: "new-quotation", title: "Create Quotation", subtitle: "Build a line-item quote with tax, discount and validity date." },
  { module: "sales", type: "new-sales-order", title: "Create Sales Order", subtitle: "Add customer and product line items." },
  { module: "purchase", type: "new-purchase-order", title: "Create Purchase Order", subtitle: "Add vendor and procurement items." }
];
const officeOnly = new Set(["sales","purchase","stock","crm","leads","staff","payroll","leaves","invoices","quotes","licenses"]);
export default async function NewEntryPage({params, searchParams}: {
 params: Promise<{orgId: string; module: string}>;
 searchParams: Promise<{type?: string; defaultType?: string}>;
}) {
 const {orgId, module} = await params;
 if (["projects", "wallets", "worklogs"].includes(module)) {
   redirect(`/${orgId}/${module}`);
 }
 const {type, defaultType} = await searchParams;
 const entry = entries.find(e => e.module === module && (!type || e.type === type));
 if (!entry) notFound();
 const {organization, membership} = await requireOrganizationAccess(orgId);
 if (membership.role === "VIEWER" || (organization.kind !== "COMPANY" && officeOnly.has(module))) redirect("/" + orgId);
 const now = new Date();
 const commerce = ["invoices","quotes","sales","purchase"].includes(module);
 const [categories, contacts, rawProducts, staff, bankAccounts] = await Promise.all([
  module === "expenses" ? db.expenseCategory.findMany({where:{organizationId:orgId},orderBy:{name:"asc"}}) : Promise.resolve([]),
  commerce || module === "leads" || module === "income" || module === "banking" ? db.contact.findMany({where:{organizationId:orgId, ...(commerce ? {type:{in:module === "purchase" ? ["VENDOR","BOTH"] : ["CUSTOMER","BOTH"]}} : {})},orderBy:{name:"asc"}}) : Promise.resolve([]),
  commerce || module === "stock" ? db.product.findMany({where:{organizationId:orgId, ...(commerce ? {active:true} : {})},orderBy:{name:"asc"}}) : Promise.resolve([]),
  ["payroll","leaves","tasks"].includes(module) ? db.employee.findMany({where:{organizationId:orgId, ...(module === "payroll" ? {status:"ACTIVE"} : {})},orderBy:{name:"asc"}}) : Promise.resolve([]),
  module === "banking" || module === "income" ? db.bankAccount.findMany({where:{organizationId:orgId},orderBy:{bankName:"asc"}}) : Promise.resolve([]),
 ]);
 const products = rawProducts.map(p => ({id:p.id,name:p.name,sku:p.sku,salePrice:Number(p.salePrice),purchasePrice:Number(p.purchasePrice)}));
 let form: React.ReactNode;
 switch(entry.type) {
 case "recurring-rule": form = (<>
            <ExpenseForm action={saveRecurringExpenseAction} orgId={orgId} categories={categories.map((c) => ({ id: c.id, name: c.name }))} recurring />
          </>); break;
 case "new-expense": form = (<>
            <ExpenseForm action={saveExpenseAction} orgId={orgId} categories={categories.map((c) => ({ id: c.id, name: c.name }))} />
          </>); break;
  case "record-income": form = (
    <IncomeForm
      orgId={orgId}
      currency={organization.currency}
      contacts={contacts}
      bankAccounts={bankAccounts.map((b) => ({
        id: b.id,
        bankName: b.bankName,
        accountNumber: b.accountNumber,
        accountType: b.accountType,
        currentBalance: Number(b.currentBalance),
      }))}
      action={saveIncomeAction}
    />
  ); break;
  case "new-account": form = (<>
            <form action={saveBankAccountAction}>
              <input type="hidden" name="orgId" value={orgId} />
              <div className="form-grid">
                <label className="field full">
                  Bank Name
                  <input name="bankName" required placeholder="Siddhartha Bank Ltd / Everest Bank / Nabil Bank" />
                </label>
                <label className="field">
                  Account Name
                  <input name="accountName" placeholder="Account Name / Business Name" defaultValue={organization.name} />
                </label>
                <label className="field">
                  Account Number
                  <input name="accountNumber" required placeholder="02017249683" />
                </label>
                <label className="field">
                  Account Type
                  <select name="accountType">
                    <option value="CURRENT">Current Account (CANR)</option>
                    <option value="SAVINGS">Savings Account</option>
                    <option value="OVERDRAFT">Overdraft Facility (OD)</option>
                    <option value="FIXED">Fixed Deposit</option>
                  </select>
                </label>
                <label className="field">
                  Branch Name
                  <input name="branch" placeholder="Kathmandu / New Road / Biratnagar" />
                </label>
                <label className="field">
                  Currency
                  <input name="currency" defaultValue={organization.currency || "NPR"} />
                </label>
                <label className="field">
                  Opening Balance
                  <input name="openingBalance" type="number" step="0.01" defaultValue="0" />
                </label>
                <label className="field full">
                  Notes / Remarks
                  <textarea name="notes" placeholder="Optional notes about this bank account" />
                </label>
              </div>
              <div className="form-actions">
                <button className="primary-btn" type="submit">
                  Save Bank Account
                </button>
              </div>
            </form>
          </>); break;
  case "record-deposit":
  case "record-withdrawal": form = (<>
            <form action={saveBankTransactionAction}>
              <input type="hidden" name="orgId" value={orgId} />
              <input type="hidden" name="type" value={entry.type === "record-deposit" ? "DEPOSIT" : "WITHDRAWAL"} />
              <div className="form-grid">
                <label className="field full">
                  Bank Account
                  <select name="bankAccountId" required>
                    {bankAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.bankName} — A/C {a.accountNumber} ({a.accountType})
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  {entry.type === "record-deposit" ? "Customer / Client / Vendor (CRM)" : "Vendor / Supplier / Payee (CRM)"}
                  <select name="contactId">
                    <option value="">-- Optional: Link to CRM Profile --</option>
                    {contacts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.companyName || c.name} {c.taxNumber ? `(PAN: ${c.taxNumber})` : ""} · {c.type}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  {entry.type === "record-deposit" ? "Payer / Source Name (Custom)" : "Beneficiary / Payee Name (Custom)"}
                  <input name="partyName" placeholder="Client, Vendor, or Custom entity name" />
                </label>

                {/* DIRECTOR ACCOUNT CATEGORIZATION */}
                <div className="field full" style={{ background: "var(--soft)", padding: "12px 14px", borderRadius: 8, border: "1px solid var(--line)" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontWeight: 600 }}>
                    <input
                      type="checkbox"
                      name="isDirectorAccount"
                      id="isDirectorAccountCheckbox"
                      style={{ width: 16, height: 16, accentColor: "var(--brand)" }}
                    />
                    <span>Categorize under Director Current Account ({entry.type === "record-deposit" ? "Capital Inflow / Loan" : "Personal Drawings"})</span>
                  </label>
                  <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <label className="field" style={{ margin: 0 }}>
                      <span className="field-label" style={{ fontSize: 11 }}>Director Name</span>
                      <input
                        name="directorName"
                        defaultValue="Director"
                        placeholder="Director Name"
                      />
                    </label>
                    <label className="field" style={{ margin: 0 }}>
                      <span className="field-label" style={{ fontSize: 11 }}>Director Transaction Type</span>
                      <select name="directorTxType">
                        {entry.type === "record-deposit" ? (
                          <>
                            <option value="CAPITAL">Director Capital Inflow</option>
                            <option value="LOAN">Director Loan to Company</option>
                            <option value="DRAWINGS_REPAYMENT">Director Drawings Repayment</option>
                          </>
                        ) : (
                          <>
                            <option value="DRAWINGS">Director Personal Drawings</option>
                            <option value="REIMBURSEMENT">Loan Repayment / Reimbursement to Director</option>
                            <option value="EXPENSE_ADVANCE">Director Advance</option>
                          </>
                        )}
                      </select>
                    </label>
                  </div>
                </div>

                <label className="field full">
                  Description / Particulars
                  <input name="description" required placeholder={entry.type === "record-deposit" ? "Client payment / Cash deposit / Account remittance" : "Vendor payment / Office rent / Transfer"} />
                </label>
                <label className="field">
                  Amount ({organization.currency})
                  <input name="amount" type="number" min="0" step="0.01" required placeholder="0.00" />
                </label>
                <div className="field">
                  <NepaliDatePicker name="transactionDate" label="Transaction Date (BS / AD)" required />
                </div>
                <label className="field">
                  Reference / Transfer ID / Remittance Code
                  <input name="reference" placeholder="Ref code / IBFT / Transfer ID" />
                </label>
                <label className="field">
                  Cheque Number (if applicable)
                  <input name="chequeNumber" placeholder="Cheque number" />
                </label>
              </div>
              <div className="form-actions">
                <button className={entry.type === "record-deposit" ? "success-btn" : "primary-btn"} type="submit">
                  {entry.type === "record-deposit" ? "Save Bank Deposit (+ Income & Customer/Vendor Reflection)" : "Save Bank Withdrawal (+ Expense)"}
                </button>
              </div>
            </form>
          </>); break;
 case "add-contact": form = (<>
            <form action={saveContactAction}>
              <input type="hidden" name="orgId" value={orgId} />
              <div className="form-grid">
                <label className="field">
                  Contact Type
                  <select name="type" defaultValue={defaultType || "CUSTOMER"}>
                    <option value="CUSTOMER">CUSTOMER (Client)</option>
                    <option value="VENDOR">VENDOR (Supplier)</option>
                    <option value="BOTH">BOTH (Dual Role)</option>
                  </select>
                </label>
                <label className="field">
                  Full Name / Contact Person
                  <input name="name" required />
                </label>
                <label className="field">
                  Company Name
                  <input name="companyName" />
                </label>
                <label className="field">
                  Tax / PAN / VAT #
                  <input name="taxNumber" />
                </label>
                <label className="field">
                  Email
                  <input name="email" type="email" />
                </label>
                <label className="field">
                  Phone
                  <input name="phone" />
                </label>
                <label className="field full">
                  Address
                  <input name="address" />
                </label>
                <label className="field full">
                  Notes
                  <textarea name="notes" />
                </label>
              </div>
              <div className="form-actions">
                <button className="primary-btn" type="submit">Save Contact</button>
              </div>
            </form>
          </>); break;
 case "add-lead": form = (<>
            <form action={saveLeadAction}>
              <input type="hidden" name="orgId" value={orgId} />
              <div className="form-grid">
                <label className="field full">Opportunity Title<input name="title" required placeholder="e.g. Broadcast Setup Contract" /></label>
                <label className="field">Contact<select name="contactId"><option value="">No linked contact</option>{contacts.map((c) => (<option value={c.id} key={c.id}>{c.companyName || c.name}</option>))}</select></label>
                <label className="field">Source<input name="source" placeholder="Referral / Direct" /></label>
                <label className="field">Estimated Value<input name="value" type="number" min="0" step="0.01" /></label>
                <label className="field">Stage<select name="status"><option>NEW</option><option>CONTACTED</option><option>QUALIFIED</option><option>PROPOSAL</option><option>WON</option><option>LOST</option></select></label>
                <div className="field full">
                  <NepaliDatePicker name="nextFollowUpAt" label="Next Follow-Up Date (BS / AD)" />
                </div>
                <label className="field full">Notes<textarea name="notes" /></label>
              </div>
              <div className="form-actions"><button className="primary-btn">Save Opportunity</button></div>
            </form>
          </>); break;
 case "movement": form = (<>
            <form action={saveStockMovementAction}>
              <input type="hidden" name="orgId" value={orgId} />
              <div className="form-grid">
                <label className="field full">Item SKU<select name="productId" required><option value="">Select Item</option>{products.map((p) => (<option value={p.id} key={p.id}>{p.sku} · {p.name}</option>))}</select></label>
                <label className="field">Type<select name="type"><option>IN</option><option>OUT</option><option>RETURN</option><option>ADJUSTMENT</option></select></label>
                <label className="field">Quantity<input name="quantity" type="number" min="0" step="0.001" required /></label>
                <div className="field full">
                  <NepaliDatePicker name="occurredAt" label="Movement Date (BS / AD)" />
                </div>
                <label className="field">Reference<input name="reference" placeholder="PO / Invoice #" /></label>
                <label className="field full">Note<input name="note" /></label>
              </div>
              <div className="form-actions"><button className="primary-btn">Save Movement</button></div>
            </form>
          </>); break;
 case "new-product": form = (<>
            <form action={saveProductAction}>
              <input type="hidden" name="orgId" value={orgId} />
              <div className="form-grid">
                <label className="field">SKU<input name="sku" required placeholder="PRD-001" /></label>
                <label className="field">Item Name<input name="name" required /></label>
                <label className="field">Unit<input name="unit" defaultValue="pcs" /></label>
                <label className="field">Opening Stock<input name="openingStock" type="number" step="0.001" /></label>
                <label className="field">Purchase Price<input name="purchasePrice" type="number" step="0.01" /></label>
                <label className="field">Selling Price<input name="salePrice" type="number" step="0.01" /></label>
                <label className="field">Reorder Threshold<input name="reorderLevel" type="number" step="0.001" /></label>
              </div>
              <div className="form-actions"><button className="primary-btn">Save Product</button></div>
            </form>
          </>); break;
 case "add-employee": form = (<>
            <form action={saveEmployeeAction}>
              <input type="hidden" name="orgId" value={orgId} />
              <div className="form-grid">
                <label className="field">Employee Code<input name="employeeCode" required placeholder="EMP-001" /></label>
                <label className="field">Full Name<input name="name" required /></label>
                <label className="field">Email<input name="email" type="email" /></label>
                <label className="field">Phone<input name="phone" /></label>
                <label className="field">Designation<input name="designation" /></label>
                <label className="field">Department<input name="department" /></label>
                <div className="field full">
                  <NepaliDatePicker name="joinDate" label="Join Date (BS / AD)" />
                </div>
                <label className="field full">Basic Monthly Salary (NPR)<input name="basicSalary" type="number" min="0" step="0.01" /></label>
              </div>
              <div className="form-actions"><button className="primary-btn">Save Member</button></div>
            </form>
          </>); break;
 case "new-payroll": form = (<>
            <form action={savePayrollAction}>
              <input type="hidden" name="orgId" value={orgId} />
              <div className="form-grid">
                <label className="field full">Employee<select name="employeeId" required><option value="">Select Employee</option>{staff.map((e) => (<option value={e.id} key={e.id}>{e.employeeCode} · {e.name}</option>))}</select></label>
                <label className="field">Month<input name="month" type="text" placeholder="YYYY-MM" pattern="[0-9]{4}-(0[1-9]|1[0-2])" defaultValue={monthKey(now)} required /></label>
                <label className="field">Basic Salary<input name="basic" type="number" min="0" step="0.01" required /></label>
                <label className="field">Allowance<input name="allowance" type="number" min="0" step="0.01" defaultValue="0" /></label>
                <label className="field">Overtime<input name="overtime" type="number" min="0" step="0.01" defaultValue="0" /></label>
                <label className="field">Deduction<input name="deduction" type="number" min="0" step="0.01" defaultValue="0" /></label>
                <label className="field">Tax<input name="tax" type="number" min="0" step="0.01" defaultValue="0" /></label>
                <div className="field full">
                  <NepaliDatePicker name="paidAt" label="Disbursement Date (BS / AD)" />
                </div>
                <label className="field full">Notes<input name="notes" /></label>
              </div>
              <div className="form-actions"><button className="primary-btn">Create Payslip</button></div>
            </form>
          </>); break;
 case "request-leave": form = (<>
            <form action={saveLeaveAction}>
              <input type="hidden" name="orgId" value={orgId} />
              <div className="form-grid">
                <label className="field full">Employee<select name="employeeId" required><option value="">Select Employee</option>{staff.map((e) => (<option value={e.id} key={e.id}>{e.name}</option>))}</select></label>
                <label className="field full">Leave Type<input name="leaveType" defaultValue="Annual" /></label>
                <div className="field">
                  <NepaliDatePicker name="fromDate" label="From Date (BS / AD)" required />
                </div>
                <div className="field">
                  <NepaliDatePicker name="toDate" label="To Date (BS / AD)" required />
                </div>
                <label className="field full">Reason<textarea name="reason" /></label>
              </div>
              <div className="form-actions"><button className="primary-btn">Submit Request</button></div>
            </form>
          </>); break;
 case "add-task": form = (<>
            <form action={saveTaskAction}>
              <input type="hidden" name="orgId" value={orgId} />
              <div className="form-grid">
                <label className="field full">Task Title<input name="title" required placeholder="Prepare quarterly tax statement" /></label>
                <label className="field">Priority<select name="priority"><option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>URGENT</option></select></label>
                <label className="field">Status<select name="status"><option>TODO</option><option>IN_PROGRESS</option><option>BLOCKED</option><option>DONE</option></select></label>
                <div className="field full">
                  <NepaliDatePicker name="dueAt" label="Due Date (BS / AD)" />
                </div>
                {staff.length > 0 && (<label className="field full">Assignee<select name="employeeId"><option value="">Unassigned</option>{staff.map((e) => (<option value={e.id} key={e.id}>{e.name}</option>))}</select></label>)}
                <label className="field full">Description<textarea name="description" /></label>
              </div>
              <div className="form-actions"><button className="primary-btn">Save Task</button></div>
            </form>
          </>); break;
 case "add-license": form = (<>
            <form action={saveLicenseAction}>
              <input type="hidden" name="orgId" value={orgId} />
              <div className="form-grid">
                <label className="field full">License / Subscription Name<input name="name" required placeholder="e.g. Adobe Creative Cloud Enterprise" /></label>
                <label className="field">Vendor<input name="vendor" /></label>
                <label className="field">Seats / Users<input name="seats" type="number" min="1" defaultValue="1" /></label>
                <label className="field full">License Key / Account ID<input name="licenseKey" /></label>
                <div className="field">
                  <NepaliDatePicker name="purchaseDate" label="Purchase Date (BS / AD)" />
                </div>
                <div className="field">
                  <NepaliDatePicker name="expiryDate" label="Expiry Date (BS / AD)" />
                </div>
                <label className="field full">Renewal Cost<input name="renewalCost" type="number" step="0.01" min="0" /></label>
                <label className="field full">Notes<textarea name="notes" /></label>
              </div>
              <div className="form-actions"><button className="primary-btn">Save License</button></div>
            </form>
          </>); break;
 case "add-reminder": form = (<>
            <form action={saveReminderAction}>
              <input type="hidden" name="orgId" value={orgId} />
              <div className="form-grid">
                <label className="field full">Reminder Title<input name="title" required placeholder="Pay commercial building rent" /></label>
                <div className="field full">
                  <NepaliDatePicker name="dueAt" label="Due Date (BS / AD)" required />
                </div>
                <label className="field full">Notes<textarea name="notes" /></label>
              </div>
              <div className="form-actions"><button className="primary-btn">Save Reminder</button></div>
            </form>
          </>); break;
 case "new-invoice": form = (<>
            <DocumentComposer action={saveCommerceDocumentAction} currency={organization.currency} defaultTaxRate={organization.defaultTaxPercent ? Number(organization.defaultTaxPercent) : 13} kind="INVOICE" orgId={orgId} contacts={contacts} products={products} />
          </>); break;
 case "new-quotation": form = (<>
            <DocumentComposer action={saveCommerceDocumentAction} currency={organization.currency} defaultTaxRate={organization.defaultTaxPercent ? Number(organization.defaultTaxPercent) : 13} kind="QUOTE" orgId={orgId} contacts={contacts} products={products} />
          </>); break;
 case "new-sales-order": form = (<>
            <DocumentComposer action={saveCommerceDocumentAction} currency={organization.currency} defaultTaxRate={organization.defaultTaxPercent ? Number(organization.defaultTaxPercent) : 13} kind="SALES_ORDER" orgId={orgId} contacts={contacts} products={products} />
          </>); break;
 case "new-purchase-order": form = (<>
            <DocumentComposer action={saveCommerceDocumentAction} currency={organization.currency} defaultTaxRate={organization.defaultTaxPercent ? Number(organization.defaultTaxPercent) : 13} kind="PURCHASE_ORDER" orgId={orgId} contacts={contacts} products={products} />
          </>); break;
 case "new-loan": form = (
    <form action={saveLoanAction}>
      <input type="hidden" name="orgId" value={orgId} />
      <div className="form-grid">
        <label className="field full">
          Party / Borrower / Lender Name
          <input name="partyName" required placeholder="Full Name or Institution (e.g. Kalyan Karn, Friend, Nabil Bank)" />
        </label>
        <label className="field">
          Loan Flow Type
          <select name="type" defaultValue="TAKEN">
            <option value="TAKEN">Loan Taken (Liability / Borrowed Money)</option>
            <option value="GIVEN">Loan Given (Asset / Lent to Others)</option>
          </select>
        </label>
        <label className="field">
          Principal Amount ({organization.currency})
          <input name="principalAmount" type="number" step="0.01" min="1" required placeholder="50000" />
        </label>
        <div className="field">
          <NepaliDatePicker name="startDate" label="Disbursement / Start Date (BS / AD)" required />
        </div>
        <div className="field">
          <NepaliDatePicker name="dueDate" label="Target Due Date (BS / AD)" />
        </div>
        <label className="field" style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", marginTop: 24 }}>
          <input type="checkbox" name="hasInterest" value="true" style={{ width: 18, height: 18 }} />
          <span style={{ fontWeight: 600 }}>Apply Interest on Loan</span>
        </label>
        <label className="field">
          Interest Rate (%)
          <input name="interestRate" type="number" step="0.01" min="0" placeholder="e.g. 1.5 for monthly or 12 for yearly" />
        </label>
        <label className="field">
          Interest Calculation Frequency
          <select name="interestFrequency" defaultValue="MONTHLY">
            <option value="DAILY">Daily Rate (Calculated per Day elapsed)</option>
            <option value="MONTHLY">Monthly Rate (Calculated per 30 Days)</option>
            <option value="YEARLY">Yearly Rate (Calculated per 365 Days)</option>
          </select>
        </label>
        <label className="field full">
          Notes / Collateral / Terms
          <textarea name="notes" placeholder="Terms of agreement, loan purpose, or collateral reference..." />
        </label>
      </div>
      <div className="form-actions">
        <button className="primary-btn" type="submit">Save Loan Record</button>
      </div>
    </form>
  ); break;
 default: notFound();
 }
 return <main className="page-wrap entry-page">
  <div className="page-header"><div><Link href={"/" + orgId + "/" + module} className="topbar-kicker">? Back to {module}</Link><h1>{entry.title}</h1><p>{entry.subtitle}</p></div><Link href={"/" + orgId + "/" + module} className="secondary-btn">Cancel</Link></div>
  <section className="entry-form-card" aria-label={entry.title}>{form}</section>
 </main>;
}
