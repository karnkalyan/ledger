# Feature map

## Workspace model

- One user login can own or join multiple workspaces.
- Workspace types: `COMPANY`, `HOUSEHOLD`, `PERSONAL`.
- Every business and finance record carries `organizationId`.
- Office and personal navigation are different; office-only routes are blocked for non-company workspaces.
- Viewer memberships are read-only at the server-action layer.

## Company modules

| Module | Capabilities |
|---|---|
| Dashboard | Income, actual expense, net cash, invoice outstanding, low stock, 6-month cash flow, recurring estimate, reminders |
| Sales | Multi-line sales orders, customer link, taxes/discounts, lifecycle status, stock OUT on completion |
| Purchase | Multi-line purchase orders, vendor link, lifecycle status, stock IN on completion |
| Stock | Products/SKUs, prices, opening stock, movement ledger, reorder indicator |
| CRM | Customers, vendors, both-type contacts, tax IDs and contact details |
| Leads | Pipeline value, source, follow-up date and lead stages |
| Invoices | Line items, tax, discount, totals, status, print view, payments, outstanding balance |
| Quotes | Line items, validity, status, print view, idempotent quote-to-invoice conversion |
| Income | Receipt/income ledger |
| Expenses | One-time actuals, formula expenses, recurring rules, monthly estimates |
| Staff | Employee directory, department, role, salary, status |
| Payroll | Basic + allowance + overtime - deduction - tax, month and payment date |
| Leave / HRM | Leave date range, automatic day count, approval workflow |
| Tasks | Priority, assignee, due date and workflow status |
| Licenses | Key/reference, seats, expiry, renewal cost, expiry status |
| Reminders | Dated reminders with status and scheduler-generated references |
| Reports | Month selector, estimate vs actual, category totals, income detail, printable close summary |

## Personal / household modules

- Personal/household dashboard
- Income
- Home expenses
- Formula-based recurring costs (rent, milk, grocery, electricity, internet, etc.)
- Tasks
- Reminders
- Monthly reports

Company modules are not shown in personal/household mode.

## Recurring expense engine

A recurring rule can use either:

- a fixed monthly amount, or
- quantity × unit rate, with recurrence-aware monthly conversion.

For daily costs, the engine calculates:

`quantity × unit rate × billing days`

If billing days is not specified, it uses the actual number of days in the selected month.

Example: `1.5 L × NPR 120 × 30 = NPR 5,400`.

The scheduler and manual action are idempotent per recurring rule and month: they will not create the same monthly estimate twice.
