# FlowLedger — Office ERP + Personal Expense Tracker

A modern multi-workspace finance and operations admin panel built with **Next.js App Router, TypeScript, Prisma ORM and MySQL**.

## What is included

- One login with a strict **Office / Personal workspace switch**.
- Multiple companies, houses and personal workspaces under one user.
- Company dashboard: sales, purchase, stock, CRM, leads, invoices, quotations, income, expenses, staff, payroll, leave/HRM, tasks, licenses, reminders and reports.
- Personal / household dashboard: income, expenses, recurring household costs, tasks, reminders and monthly reports. Company-only modules are hidden.
- Invoice and quote line-item composer with product lookup, tax, discount and totals.
- Printable invoice / quote detail pages.
- Invoice payment history, paid amount, outstanding balance and status management.
- Quote → invoice conversion.
- Recurring expense formulas such as **1.5 litres × rate × days in month**.
- Monthly recurring estimates vs actual expense ledger.
- Office/home rent, electricity, internet, grocery, milk and custom expense categories.
- Scheduled daily cron endpoint to materialize monthly estimates and create due reminders / license renewal reminders.
- Stock movement ledger and low-stock monitoring.
- Payroll formula: basic + allowance + overtime − deduction − tax.
- License/subscription renewal records.
- Deep purple + cyan + pink responsive admin UI.

## Quick start

1. Create a MySQL database named `expense_suite`.
2. Copy environment file:

```bash
cp .env.example .env
```

3. Update `DATABASE_URL`, `AUTH_SECRET` and `CRON_SECRET` in `.env`.
4. Install dependencies:

```bash
npm install
```

5. Generate Prisma client and create database tables:

```bash
npm run db:generate
npm run db:push
```

6. Seed the demo company and household:

```bash
npm run db:seed
```

7. Run the app:

```bash
npm run dev
```

### Running with Docker Compose (Production VPS / Self-hosted)

This deployment uses the native MySQL already running on your VPS host (without spinning up an unnecessary MySQL container):

```bash
# 1. Clone repository on VPS
git clone https://github.com/karnkalyan/ledger.git
cd ledger

# 2. Configure environment variables (or rely on defaults in docker-compose.yml)
cp .env.example .env

# 3. Build and launch container
docker compose up -d --build
```

The container automatically:
- Connects to your host's MySQL at `host.docker.internal:3306`
- Synchronizes database tables with `prisma db push`
- Runs the master seed (`prisma/seed.ts`) to populate company, contacts, and historical ledger records
- Launches the Next.js app on port `3080`

### Demo login

- Email: `admin@simulcast.local`
- Password: `Admin@123`

Change/remove demo credentials before production use.

## Recurring expense example

For daily milk:

- Recurrence: `DAILY`
- Quantity: `1.5`
- Unit: `ltr`
- Rate: e.g. `120`
- Billing days: `30` (optional; if blank the actual number of days in the month is used by the scheduler)

The monthly estimate becomes `1.5 × 120 × 30 = NPR 5,400`.

For office rent, use a fixed amount and `dayOfMonth = 1`. The cron endpoint can create a reminder before the due date.

## Cron / scheduler

`vercel.json` calls:

`GET /api/cron/recurring-expenses`

The endpoint:

- creates an idempotent monthly estimated expense for each active recurring rule,
- creates due reminders for recurring expenses with a payment day,
- marks licenses as expiring/expired,
- creates license renewal reminders.

When `CRON_SECRET` is configured, send it as `Authorization: Bearer <CRON_SECRET>` for non-Vercel/manual calls.

## Important production notes

This project is a strong full-stack starter, but before using it as a real accounting/ERP system you should add organization-specific tax rules, immutable audit logging, database backups, fine-grained RBAC enforcement per action, email/SMS notification providers, file/object storage for receipts and attachments, and accounting-period close/reconciliation rules required by your jurisdiction.
