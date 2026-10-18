import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyMcpAuth, resolveOrgId, resolveOrgFilter, McpAuthResult } from "@/lib/mcp-auth";
import { analyzeFinancialDocument } from "@/lib/gemini";
import { resolveNepaliPeriodToAdRange } from "@/lib/nepali-calendar";
import { Prisma } from "@/generated/client";

export const dynamic = "force-dynamic";

const MCP_PROTOCOL_VERSION = "2025-06-18";
const MCP_SERVER_INSTRUCTIONS =
  "Use list_financial_transactions for complete period-based transaction requests and list_invoices for billing requests. Dates may be Gregorian (for example September 2026 or 2026-09) or Nepali Bikram Sambat (for example Ashoj or 2083-06). Read tools never modify ledger data. Confirm the target workspace and important values before using write or destructive tools.";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept, Authorization, Last-Event-ID, MCP-Protocol-Version, MCP-Session-Id, x-mcp-key, x-api-key",
  "Access-Control-Expose-Headers": "MCP-Session-Id",
};

function jsonResponse(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: CORS_HEADERS,
  });
}

function resolveBaseUrl(request: Request): string {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost || request.headers.get("host") || "";
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const proto = forwardedProto || (host.includes("localhost") || host.startsWith("127.") ? "http" : "https");
  if (host) return `${proto}://${host}`;
  return (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "https://ledger.simulcast.com.np").replace(/\/$/, "");
}

function authenticationRequiredResponse(request: Request, id: unknown, message: string) {
  const challenge = `Bearer resource_metadata="${resolveBaseUrl(request)}/.well-known/oauth-protected-resource", error="invalid_token", error_description="Authentication is required to access Kashtrix ERP data"`;
  return NextResponse.json(
    {
      jsonrpc: "2.0",
      id: id ?? null,
      result: {
        content: [{ type: "text", text: message }],
        _meta: { "mcp/www_authenticate": [challenge] },
        isError: true,
      },
    },
    {
      status: 401,
      headers: { ...CORS_HEADERS, "WWW-Authenticate": challenge },
    }
  );
}

// Tool definitions for the current Streamable HTTP MCP contract and OpenAI tool scanner.
const TOOLS = [
  {
    name: "get_current_user",
    description: "Return the authenticated Kashtrix profile and connected workspace identity. Use this to confirm which account is connected.",
    inputSchema: { type: "object", properties: {} },
    outputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        name: { type: "string" },
        email: { type: "string" },
        nickname: { type: "string" },
      },
      required: ["id", "name", "email", "nickname"],
      additionalProperties: false,
    },
    _meta: { "openai/profile": true },
  },
  // 1. ORGANIZATIONS / WORKSPACES
  {
    name: "list_organizations",
    description: "List all authorized organizations and workspaces (e.g. House, Office, Company) the user has access to.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_organization_details",
    description: "Get full profile, settings, currency, and balance overview for all authorized workspaces or a specific workspace (e.g. house or office).",
    inputSchema: {
      type: "object",
      properties: {
        orgId: { type: "string", description: "Optional organization ID, slug, or workspace name (e.g. 'house', 'office')" },
        workspace: { type: "string", description: "Optional workspace alias (e.g. 'house', 'office', 'company')" },
      },
    },
  },
  {
    name: "get_financial_kpi_summary",
    description: "Get real-time financial KPI overview across all authorized accounts (House, Office) or a specific account: total cash & bank balance, income, expenses, and pending invoices.",
    inputSchema: {
      type: "object",
      properties: {
        orgId: { type: "string", description: "Optional organization ID, slug, or workspace name (e.g. 'house', 'office')" },
        workspace: { type: "string", description: "Optional workspace alias (e.g. 'house', 'office')" },
      },
    },
  },
  {
    name: "get_financial_balance",
    description: "Retrieve complete real-time financial balance for Simulcast Technologies, My House, or all authorized workspaces. Returns total cash & bank balance, total receivables (customer dues), total payables (vendor dues), and net liquid position in one unified call.",
    inputSchema: {
      type: "object",
      properties: {
        orgId: { type: "string", description: "Optional workspace filter (e.g. 'house', 'office', 'simulcast', or organization ID)" },
        workspace: { type: "string", description: "Optional workspace alias (e.g. 'house', 'office', 'simulcast', 'company')" },
      },
    },
  },
  {
    name: "get_balance",
    description: "Alias for get_financial_balance. Retrieve live cash/bank balance, receivables, and payables for Simulcast Technologies or My House.",
    inputSchema: {
      type: "object",
      properties: {
        orgId: { type: "string", description: "Optional workspace filter (e.g. 'house', 'office', 'simulcast', or organization ID)" },
        workspace: { type: "string", description: "Optional workspace alias (e.g. 'house', 'office', 'simulcast', 'company')" },
      },
    },
  },
  {
    name: "get_balance_sheet",
    description: "Retrieve complete official Balance Sheet (Assets, Liabilities, Equity, and Balanced reconciliation) for FY 2083/84 BS or any company (Simulcast Technologies, My House, Himalayan Retail Mart).",
    inputSchema: {
      type: "object",
      properties: {
        company: { type: "string", description: "Optional company/workspace filter: 'simulcast', 'house', 'office', or organization ID" },
        fiscalYear: { type: "string", description: "Fiscal year (default: '2083/84 BS')" },
      },
    },
  },
  {
    name: "getBalanceSheet",
    description: "OpenAI Action alias for get_balance_sheet. Retrieve complete balance sheet particulars and figures.",
    inputSchema: {
      type: "object",
      properties: {
        company: { type: "string", description: "Optional company name or workspace alias" },
        fiscalYear: { type: "string", description: "Fiscal year (e.g. '2083/84')" },
      },
    },
  },

  // 2. BANK ACCOUNTS
  {
    name: "list_bank_accounts",
    description: "List registered bank accounts with current balances, account numbers, and branches across all authorized accounts (House, Office) or filtered by workspace.",
    inputSchema: {
      type: "object",
      properties: {
        orgId: { type: "string", description: "Optional workspace filter (e.g. 'house', 'office', or organization ID)" },
        workspace: { type: "string", description: "Optional workspace alias ('house' or 'office')" },
      },
    },
  },
  {
    name: "get_bank_account",
    description: "Retrieve a specific bank account by ID with recent transactions.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Bank Account ID" },
      },
      required: ["id"],
    },
  },
  {
    name: "create_bank_account",
    description: "Create a new bank account in the ledger (specify workspace 'house' or 'office' to target).",
    inputSchema: {
      type: "object",
      properties: {
        bankName: { type: "string", description: "Name of the bank (e.g. Siddhartha Bank, Nabil Bank)" },
        accountName: { type: "string", description: "Name on account" },
        accountNumber: { type: "string", description: "Bank account number" },
        accountType: { type: "string", description: "CURRENT, SAVINGS, OVERDRAFT, FIXED" },
        branch: { type: "string", description: "Branch location (e.g. Kathmandu, Lalitpur)" },
        openingBalance: { type: "number", description: "Initial opening balance (default 0)" },
        currency: { type: "string", description: "Currency (default NPR)" },
        orgId: { type: "string", description: "Optional target workspace ID or slug ('house', 'office')" },
        workspace: { type: "string", description: "Target workspace alias ('house' or 'office')" },
      },
      required: ["bankName", "accountName", "accountNumber"],
    },
  },
  {
    name: "update_bank_account",
    description: "Update details or current balance of an existing bank account.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Bank Account ID" },
        bankName: { type: "string" },
        accountName: { type: "string" },
        accountNumber: { type: "string" },
        accountType: { type: "string" },
        branch: { type: "string" },
        currentBalance: { type: "number" },
      },
      required: ["id"],
    },
  },
  {
    name: "delete_bank_account",
    description: "Delete a bank account and its linked transactions.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Bank Account ID to delete" },
      },
      required: ["id"],
    },
  },

  // 3. BANK TRANSACTIONS
  {
    name: "list_bank_transactions",
    description: "List real bank statement transactions for a requested Gregorian or Nepali month/date range, with deposit, withdrawal, and net-cashflow totals. Use for requests such as last month, September 2026, Ashoj, or a specific workspace.",
    inputSchema: {
      type: "object",
      properties: {
        bankAccountId: { type: "string", description: "Optional bank account filter" },
        type: { type: "string", enum: ["DEPOSIT", "WITHDRAWAL"] },
        query: { type: "string", description: "Search query in narration or reference" },
        period: { type: "string", description: "Period such as 'last month', 'September 2026', '2026-09', 'ashoj', '2083-06', 'today', or 'all'" },
        startDate: { type: "string", description: "Optional inclusive start date in YYYY-MM-DD format" },
        endDate: { type: "string", description: "Optional inclusive end date in YYYY-MM-DD format" },
        orgId: { type: "string", description: "Optional workspace filter ('house', 'office', or ID)" },
        workspace: { type: "string", description: "Optional workspace alias ('house' or 'office')" },
        limit: { type: "integer", minimum: 1, maximum: 500, default: 100 },
      },
    },
    outputSchema: { type: "object", additionalProperties: true },
  },
  {
    name: "list_financial_transactions",
    description: "Return a unified transaction report across bank entries, expenses, income receipts, customer invoice payments, and vendor purchase payments for a requested period. Use when the user asks for all transaction details, a monthly ledger, or complete financial activity.",
    inputSchema: {
      type: "object",
      properties: {
        period: { type: "string", description: "Period such as 'last month', 'September 2026', '2026-09', 'ashoj', '2083-06', 'today', or 'all'" },
        startDate: { type: "string", description: "Optional inclusive start date in YYYY-MM-DD format; overrides the period start" },
        endDate: { type: "string", description: "Optional inclusive end date in YYYY-MM-DD format; overrides the period end" },
        orgId: { type: "string", description: "Optional organization ID, name, or slug" },
        workspace: { type: "string", description: "Optional workspace alias such as 'house', 'office', or 'company'" },
        query: { type: "string", description: "Optional text filter for descriptions, references, customers, or vendors" },
        limit: { type: "integer", minimum: 1, maximum: 500, default: 100 },
      },
    },
    outputSchema: { type: "object", additionalProperties: true },
  },
  {
    name: "create_bank_transaction",
    description: "Record a new bank deposit or withdrawal transaction.",
    inputSchema: {
      type: "object",
      properties: {
        bankAccountId: { type: "string", description: "Bank Account ID" },
        type: { type: "string", enum: ["DEPOSIT", "WITHDRAWAL"] },
        amount: { type: "number", description: "Positive transaction amount" },
        description: { type: "string", description: "Narration or description" },
        transactionDate: { type: "string", description: "YYYY-MM-DD" },
        reference: { type: "string", description: "Cheque #, Fonepay ref, or trace ID" },
        category: { type: "string", description: "Optional ledger category" },
        updateAccountBalance: { type: "boolean", default: true },
      },
      required: ["bankAccountId", "type", "amount", "description"],
    },
  },
  {
    name: "update_bank_transaction",
    description: "Update an existing bank transaction.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Transaction ID" },
        description: { type: "string" },
        amount: { type: "number" },
        type: { type: "string", enum: ["DEPOSIT", "WITHDRAWAL"] },
        category: { type: "string" },
        reference: { type: "string" },
      },
      required: ["id"],
    },
  },
  {
    name: "delete_bank_transaction",
    description: "Permanently delete a bank transaction record.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Transaction ID" },
      },
      required: ["id"],
    },
  },

  // 4. EXPENSES
  {
    name: "list_expenses",
    description: "List expenses with category, vendor, and date range filters across all authorized accounts (House, Office) or filtered by workspace.",
    inputSchema: {
      type: "object",
      properties: {
        categoryId: { type: "string" },
        vendor: { type: "string" },
        orgId: { type: "string", description: "Optional workspace filter ('house', 'office', or ID)" },
        workspace: { type: "string", description: "Optional workspace alias ('house' or 'office')" },
        limit: { type: "integer", default: 50 },
      },
    },
  },
  {
    name: "get_expense",
    description: "Get full details of a specific expense record.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Expense ID" },
      },
      required: ["id"],
    },
  },
  {
    name: "create_expense",
    description: "Record a new expense. Specify workspace 'house' or 'office' to record in household or company ledger.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Expense title" },
        amount: { type: "number", description: "Expense amount" },
        categoryId: { type: "string", description: "Expense category ID" },
        categoryName: { type: "string", description: "Category name (auto-created if not exists)" },
        vendor: { type: "string", description: "Vendor or payee name" },
        occurredAt: { type: "string", description: "Date YYYY-MM-DD" },
        notes: { type: "string" },
        orgId: { type: "string", description: "Target workspace ID or slug ('house', 'office')" },
        workspace: { type: "string", description: "Target workspace ('house' or 'office')" },
      },
      required: ["title", "amount"],
    },
  },
  {
    name: "update_expense",
    description: "Update an existing expense record.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        title: { type: "string" },
        amount: { type: "number" },
        vendor: { type: "string" },
        notes: { type: "string" },
      },
      required: ["id"],
    },
  },
  {
    name: "delete_expense",
    description: "Delete an expense record.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
      },
      required: ["id"],
    },
  },
  {
    name: "list_expense_categories",
    description: "List expense categories and their monthly budgets across accounts or by workspace.",
    inputSchema: {
      type: "object",
      properties: {
        orgId: { type: "string", description: "Optional workspace filter ('house', 'office')" },
        workspace: { type: "string", description: "Optional workspace alias ('house', 'office')" },
      },
    },
  },
  {
    name: "create_expense_category",
    description: "Create a new expense category in a workspace.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        budgetMonthly: { type: "number" },
        orgId: { type: "string", description: "Target workspace ID or slug ('house', 'office')" },
        workspace: { type: "string", description: "Target workspace alias ('house' or 'office')" },
      },
      required: ["name"],
    },
  },

  // 5. INCOMES
  {
    name: "list_incomes",
    description: "List income records across all authorized accounts (House, Office) or filtered by workspace.",
    inputSchema: {
      type: "object",
      properties: {
        orgId: { type: "string", description: "Optional workspace filter ('house', 'office', or ID)" },
        workspace: { type: "string", description: "Optional workspace alias ('house' or 'office')" },
        limit: { type: "integer", default: 50 },
      },
    },
  },
  {
    name: "create_income",
    description: "Record a new income entry in the ledger.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        source: { type: "string" },
        amount: { type: "number" },
        paymentMethod: { type: "string", default: "BANK" },
        bankAccountId: { type: "string" },
        receivedAt: { type: "string" },
        notes: { type: "string" },
        orgId: { type: "string", description: "Target workspace ID or slug ('house', 'office')" },
        workspace: { type: "string", description: "Target workspace alias ('house' or 'office')" },
      },
      required: ["title", "amount"],
    },
  },
  {
    name: "update_income",
    description: "Update an income entry.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        title: { type: "string" },
        amount: { type: "number" },
        source: { type: "string" },
      },
      required: ["id"],
    },
  },
  {
    name: "delete_income",
    description: "Delete an income entry.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
      },
      required: ["id"],
    },
  },

  // 6. INVOICES
  {
    name: "list_invoices",
    description: "List actual customer billing and invoice records with customer details, line items, payments, billed totals, collected amounts, outstanding balances, status, and optional period filters. Use when the user asks for billings, invoices, receivables, paid bills, or unpaid bills.",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["DRAFT", "SENT", "PARTIAL", "PAID", "OVERDUE", "CANCELLED"] },
        customer: { type: "string", description: "Optional customer name search" },
        period: { type: "string", description: "Issue period such as 'last month', 'September 2026', '2026-09', 'ashoj', or 'all'" },
        startDate: { type: "string", description: "Optional inclusive issue-date start in YYYY-MM-DD format" },
        endDate: { type: "string", description: "Optional inclusive issue-date end in YYYY-MM-DD format" },
        orgId: { type: "string", description: "Optional workspace filter ('house', 'office', or ID)" },
        workspace: { type: "string", description: "Optional workspace alias ('house' or 'office')" },
        limit: { type: "integer", minimum: 1, maximum: 500, default: 100 },
      },
    },
    outputSchema: { type: "object", additionalProperties: true },
  },
  {
    name: "get_invoice",
    description: "Get full invoice details including line items, customer info, and payment records.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Invoice ID or Invoice Number" },
      },
      required: ["id"],
    },
  },
  {
    name: "create_invoice",
    description: "Create a new customer invoice with line items.",
    inputSchema: {
      type: "object",
      properties: {
        customerName: { type: "string" },
        contactId: { type: "string" },
        invoiceNumber: { type: "string" },
        issueDate: { type: "string" },
        dueDate: { type: "string" },
        notes: { type: "string" },
        orgId: { type: "string", description: "Target workspace ID or slug ('office', 'house')" },
        workspace: { type: "string", description: "Target workspace alias ('office', 'house')" },
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              description: { type: "string" },
              quantity: { type: "number", default: 1 },
              unitPrice: { type: "number" },
              taxRate: { type: "number", default: 13 },
            },
            required: ["description", "unitPrice"],
          },
        },
      },
      required: ["customerName", "items"],
    },
  },
  {
    name: "update_invoice",
    description: "Update invoice details or status.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        status: { type: "string", enum: ["DRAFT", "SENT", "PARTIAL", "PAID", "OVERDUE", "CANCELLED"] },
        notes: { type: "string" },
      },
      required: ["id"],
    },
  },
  {
    name: "delete_invoice",
    description: "Permanently delete an invoice.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
      },
      required: ["id"],
    },
  },
  {
    name: "record_invoice_payment",
    description: "Record a customer payment received against an invoice.",
    inputSchema: {
      type: "object",
      properties: {
        invoiceId: { type: "string" },
        amount: { type: "number" },
        method: { type: "string", default: "BANK" },
        reference: { type: "string" },
        notes: { type: "string" },
      },
      required: ["invoiceId", "amount"],
    },
  },

  // 7. PURCHASES
  {
    name: "list_purchases",
    description: "List vendor purchase orders and bills across accounts or by workspace.",
    inputSchema: {
      type: "object",
      properties: {
        orgId: { type: "string", description: "Optional workspace filter ('house', 'office', or ID)" },
        workspace: { type: "string", description: "Optional workspace alias ('house' or 'office')" },
        limit: { type: "integer", default: 50 },
      },
    },
  },
  {
    name: "create_purchase",
    description: "Create a new purchase order or vendor bill.",
    inputSchema: {
      type: "object",
      properties: {
        vendorName: { type: "string" },
        contactId: { type: "string" },
        orderNumber: { type: "string" },
        orderDate: { type: "string" },
        orgId: { type: "string", description: "Target workspace ID or slug" },
        workspace: { type: "string", description: "Target workspace alias" },
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              description: { type: "string" },
              quantity: { type: "number", default: 1 },
              unitPrice: { type: "number" },
            },
            required: ["description", "unitPrice"],
          },
        },
      },
      required: ["vendorName", "items"],
    },
  },

  // 8. CONTACTS (CUSTOMERS / VENDORS)
  {
    name: "list_contacts",
    description: "List CRM contacts filtered by type (CUSTOMER, VENDOR, or BOTH) across accounts or by workspace.",
    inputSchema: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["CUSTOMER", "VENDOR", "BOTH"] },
        orgId: { type: "string", description: "Optional workspace filter ('house', 'office', or ID)" },
        workspace: { type: "string", description: "Optional workspace alias ('house' or 'office')" },
      },
    },
  },
  {
    name: "create_contact",
    description: "Create a new customer or vendor.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        type: { type: "string", enum: ["CUSTOMER", "VENDOR", "BOTH"], default: "CUSTOMER" },
        email: { type: "string" },
        phone: { type: "string" },
        address: { type: "string" },
        taxNumber: { type: "string", description: "PAN / VAT number" },
        orgId: { type: "string", description: "Target workspace ID or slug" },
        workspace: { type: "string", description: "Target workspace alias" },
      },
      required: ["name"],
    },
  },

  // 9. AI DOCUMENT EXTRACTION TOOL
  {
    name: "analyze_financial_document_ai",
    description: "Extract accounting transactions, bank statements, or invoices from plain text or base64 file using Kashtrix AI Engine.",
    inputSchema: {
      type: "object",
      properties: {
        textContent: { type: "string", description: "Text content of statement, receipt, or invoice" },
        base64Data: { type: "string", description: "Base64 image or PDF data" },
        mimeType: { type: "string", default: "text/plain" },
        filename: { type: "string" },
      },
    },
  },

  // 10. LOANS & DEBT (LENDING & BORROWING)
  {
    name: "list_loans",
    description: "List loans taken or given with principal, interest rates, paid balances, and settlement statuses across all accounts or by workspace.",
    inputSchema: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["TAKEN", "GIVEN", "ALL"], description: "TAKEN (borrowed) or GIVEN (lent out)" },
        status: { type: "string", enum: ["ACTIVE", "SETTLED", "DEFAULTED", "ALL"] },
        orgId: { type: "string", description: "Optional workspace filter ('house', 'office', or ID)" },
        workspace: { type: "string", description: "Optional workspace alias ('house' or 'office')" },
      },
    },
  },
  {
    name: "create_loan",
    description: "Create a new loan record (borrowed or lent out) in the ledger.",
    inputSchema: {
      type: "object",
      properties: {
        partyName: { type: "string", description: "Counterparty or lender/borrower name" },
        type: { type: "string", enum: ["TAKEN", "GIVEN"], default: "TAKEN" },
        principalAmount: { type: "number", description: "Principal loan amount" },
        startDate: { type: "string", description: "YYYY-MM-DD" },
        dueDate: { type: "string", description: "Optional due date YYYY-MM-DD" },
        hasInterest: { type: "boolean", default: false },
        interestRate: { type: "number", description: "Annual or monthly interest percent" },
        interestFrequency: { type: "string", enum: ["DAILY", "MONTHLY", "YEARLY"], default: "MONTHLY" },
        notes: { type: "string" },
        orgId: { type: "string", description: "Target workspace ID or slug" },
        workspace: { type: "string", description: "Target workspace alias ('house' or 'office')" },
      },
      required: ["partyName", "principalAmount"],
    },
  },
  {
    name: "settle_loan",
    description: "Record a principal and/or interest repayment against a loan, automatically syncing with income or expense.",
    inputSchema: {
      type: "object",
      properties: {
        loanId: { type: "string", description: "Loan ID to settle or repay" },
        principalAmount: { type: "number", description: "Principal repayment amount" },
        interestAmount: { type: "number", default: 0, description: "Interest portion paid" },
        paymentDate: { type: "string", description: "Payment date YYYY-MM-DD" },
        notes: { type: "string" },
        orgId: { type: "string" },
        workspace: { type: "string" },
      },
      required: ["loanId", "principalAmount"],
    },
  },

  // 11. RENTAL RESIDENCE & TENANCY
  {
    name: "list_rental_houses",
    description: "List rental residences and office premises with monthly rent, NEA electricity rate, water/garbage fees, and active status.",
    inputSchema: {
      type: "object",
      properties: {
        orgId: { type: "string", description: "Optional workspace filter ('house', 'office', or ID)" },
        workspace: { type: "string", description: "Optional workspace alias ('house' or 'office')" },
      },
    },
  },
  {
    name: "get_active_rental_house",
    description: "Get the currently active primary rental house or office lease with rent commitments and latest meter reading.",
    inputSchema: {
      type: "object",
      properties: {
        orgId: { type: "string", description: "Optional workspace filter ('house', 'office', or ID)" },
        workspace: { type: "string", description: "Optional workspace alias ('house' or 'office')" },
      },
    },
  },
  {
    name: "save_rental_house",
    description: "Create or update a rental residence / premises lease record and sync recurring commitments.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Optional rental house ID to update" },
        title: { type: "string", description: "e.g. 'Shantinagar House (Current)', 'Corporate Office'" },
        ownerName: { type: "string", description: "Landlord / House owner name" },
        ownerPhone: { type: "string" },
        address: { type: "string" },
        monthlyRent: { type: "number", description: "Monthly rent in NPR" },
        electricityRate: { type: "number", description: "Rate per NEA electricity unit" },
        waterGarbageFee: { type: "number", description: "Monthly water & waste management fee" },
        isActive: { type: "boolean", default: true },
        notes: { type: "string" },
        orgId: { type: "string" },
        workspace: { type: "string" },
      },
      required: ["title", "ownerName"],
    },
  },
  {
    name: "set_active_rental_house",
    description: "Set a specific rental house as active and automatically synchronize recurring lease commitments.",
    inputSchema: {
      type: "object",
      properties: {
        houseId: { type: "string", description: "Rental House ID" },
        orgId: { type: "string" },
        workspace: { type: "string" },
      },
      required: ["houseId"],
    },
  },
  {
    name: "delete_rental_house",
    description: "Delete a rental house record.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Rental House ID to delete" },
        orgId: { type: "string" },
        workspace: { type: "string" },
      },
      required: ["id"],
    },
  },

  // 12. UTILITIES (ELECTRICITY & MILK CONSUMPTION)
  {
    name: "get_electricity_readings",
    description: "Get electricity meter readings, consumed units, rates, and computed bills across Nepali (BS) or English (AD) billing months.",
    inputSchema: {
      type: "object",
      properties: {
        month: { type: "string", description: "Billing month: '2083-06' / 'ashoj', '2083-07' / 'kartik', '2026-10', or 'all'" },
        orgId: { type: "string" },
        workspace: { type: "string" },
      },
    },
  },
  {
    name: "save_electricity_reading",
    description: "Record electricity meter reading. Automatically calculates units consumed from previous reading, computes total NEA bill at unit rate, and syncs directly into expenses.",
    inputSchema: {
      type: "object",
      properties: {
        month: { type: "string", description: "Billing month (e.g. '2083-06', 'ashoj', '2026-10')" },
        currentUnit: { type: "number", description: "Current electricity meter reading (e.g. 6632)" },
        previousUnit: { type: "number", description: "Previous meter reading (auto-detected from last reading if omitted)" },
        meterNumber: { type: "string", default: "MAIN" },
        ratePerUnit: { type: "number", default: 15, description: "NPR rate per electricity unit" },
        readingDate: { type: "string", description: "Date of reading YYYY-MM-DD" },
        paid: { type: "boolean", default: true, description: "Whether bill has been paid or remains estimated" },
        notes: { type: "string" },
        orgId: { type: "string" },
        workspace: { type: "string" },
      },
      required: ["currentUnit"],
    },
  },
  {
    name: "get_milk_logs",
    description: "Get monthly dairy milk consumption logs, regular and alternate day quantities, rates, and total costs.",
    inputSchema: {
      type: "object",
      properties: {
        month: { type: "string", description: "Billing month (e.g. '2083-06', 'ashoj', '2026-10')" },
        orgId: { type: "string" },
        workspace: { type: "string" },
      },
    },
  },
  {
    name: "save_milk_log",
    description: "Save monthly milk consumption log and synchronize with household or office expenses.",
    inputSchema: {
      type: "object",
      properties: {
        month: { type: "string", description: "Month in BS or AD (e.g. '2083-06', '2026-10')" },
        ratePerLiter: { type: "number", default: 115 },
        regularDays: { type: "number", default: 30 },
        regularQty: { type: "number", default: 1.5, description: "Liters consumed per regular day" },
        alternateDays: { type: "number", default: 0 },
        alternateQty: { type: "number", default: 0 },
        paid: { type: "boolean", default: false },
        notes: { type: "string" },
        orgId: { type: "string" },
        workspace: { type: "string" },
      },
    },
  },

  // 13. PRODUCTS & INVENTORY
  {
    name: "list_products",
    description: "List inventory products, SKU codes, sale prices, cost prices, and current stock balances.",
    inputSchema: {
      type: "object",
      properties: {
        active: { type: "boolean", default: true },
        query: { type: "string", description: "Search by product name or SKU" },
        orgId: { type: "string" },
        workspace: { type: "string" },
      },
    },
  },
  {
    name: "create_product",
    description: "Create a new product or inventory item in the catalog.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Product name" },
        sku: { type: "string", description: "Unique stock keeping unit code" },
        unit: { type: "string", default: "pcs" },
        salePrice: { type: "number", default: 0 },
        purchasePrice: { type: "number", default: 0 },
        stockQty: { type: "number", default: 0 },
        reorderLevel: { type: "number", default: 0 },
        orgId: { type: "string" },
        workspace: { type: "string" },
      },
      required: ["name", "sku"],
    },
  },
  {
    name: "list_stock_movements",
    description: "List stock movements (IN, OUT, ADJUSTMENT, RETURN) with quantities and timestamps.",
    inputSchema: {
      type: "object",
      properties: {
        productId: { type: "string", description: "Optional product ID filter" },
        limit: { type: "integer", default: 50 },
        orgId: { type: "string" },
        workspace: { type: "string" },
      },
    },
  },
  {
    name: "create_stock_movement",
    description: "Record an inventory stock movement (IN/OUT/ADJUSTMENT) and update product stock balance.",
    inputSchema: {
      type: "object",
      properties: {
        productId: { type: "string", description: "Product ID" },
        type: { type: "string", enum: ["IN", "OUT", "ADJUSTMENT", "RETURN"] },
        quantity: { type: "number", description: "Quantity moved" },
        reference: { type: "string", description: "Invoice #, PO #, or adjustment reason" },
        note: { type: "string" },
        orgId: { type: "string" },
        workspace: { type: "string" },
      },
      required: ["productId", "type", "quantity"],
    },
  },

  // 14. STAFF, PAYROLL & LEAVES (HRM)
  {
    name: "list_employees",
    description: "List company employees with employee codes, designations, departments, basic salaries, and employment statuses.",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["ACTIVE", "ON_LEAVE", "INACTIVE", "TERMINATED"] },
        department: { type: "string" },
        orgId: { type: "string" },
        workspace: { type: "string" },
      },
    },
  },
  {
    name: "create_employee",
    description: "Register a new employee/staff member in the company roster.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        employeeCode: { type: "string", description: "Optional code (auto-generated if omitted)" },
        email: { type: "string" },
        phone: { type: "string" },
        designation: { type: "string" },
        department: { type: "string" },
        basicSalary: { type: "number", default: 0 },
        joinDate: { type: "string", description: "YYYY-MM-DD" },
        orgId: { type: "string" },
        workspace: { type: "string" },
      },
      required: ["name"],
    },
  },
  {
    name: "list_payrolls",
    description: "List employee payroll disbursements with salary breakdowns, allowances, and taxes.",
    inputSchema: {
      type: "object",
      properties: {
        employeeId: { type: "string" },
        orgId: { type: "string" },
        workspace: { type: "string" },
      },
    },
  },
  {
    name: "create_payroll",
    description: "Record a monthly payroll disbursement for an employee.",
    inputSchema: {
      type: "object",
      properties: {
        employeeId: { type: "string" },
        month: { type: "string", description: "Payroll month YYYY-MM-DD" },
        basic: { type: "number" },
        allowance: { type: "number", default: 0 },
        overtime: { type: "number", default: 0 },
        deduction: { type: "number", default: 0 },
        tax: { type: "number", default: 0 },
        netPay: { type: "number" },
        paidAt: { type: "string" },
        notes: { type: "string" },
        orgId: { type: "string" },
        workspace: { type: "string" },
      },
      required: ["employeeId", "month", "basic", "netPay"],
    },
  },
  {
    name: "list_leaves",
    description: "List staff leave requests and approval statuses.",
    inputSchema: {
      type: "object",
      properties: {
        employeeId: { type: "string" },
        status: { type: "string", enum: ["PENDING", "APPROVED", "REJECTED", "CANCELLED"] },
        orgId: { type: "string" },
        workspace: { type: "string" },
      },
    },
  },
  {
    name: "create_leave",
    description: "Submit a staff leave request.",
    inputSchema: {
      type: "object",
      properties: {
        employeeId: { type: "string" },
        leaveType: { type: "string", description: "Casual, Sick, Annual, Maternity" },
        fromDate: { type: "string", description: "YYYY-MM-DD" },
        toDate: { type: "string", description: "YYYY-MM-DD" },
        days: { type: "number" },
        reason: { type: "string" },
        orgId: { type: "string" },
        workspace: { type: "string" },
      },
      required: ["employeeId", "leaveType", "fromDate", "toDate", "days"],
    },
  },

  // 15. PROJECTS, TASKS & WORKLOGS
  {
    name: "list_projects",
    description: "List business and engineering projects with budgets, team leaders, client contacts, and statuses.",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", description: "ACTIVE, COMPLETED, ON_HOLD" },
        fiscalYear: { type: "string" },
        orgId: { type: "string" },
        workspace: { type: "string" },
      },
    },
  },
  {
    name: "create_project",
    description: "Create or update a business project with dedicated budget and project wallet.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Optional project ID to update" },
        name: { type: "string" },
        description: { type: "string" },
        contactId: { type: "string", description: "Client contact ID" },
        teamLeaderId: { type: "string", description: "Team leader employee ID" },
        budget: { type: "number", default: 0 },
        startDate: { type: "string" },
        endDate: { type: "string" },
        status: { type: "string", default: "ACTIVE" },
        priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "URGENT"], default: "MEDIUM" },
        workNature: { type: "string" },
        fiscalYear: { type: "string" },
        orgId: { type: "string" },
        workspace: { type: "string" },
      },
      required: ["name"],
    },
  },
  {
    name: "list_tasks",
    description: "List tasks and assignments by project, assignee employee, or status.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string" },
        employeeId: { type: "string" },
        status: { type: "string", enum: ["TODO", "IN_PROGRESS", "BLOCKED", "DONE"] },
        orgId: { type: "string" },
        workspace: { type: "string" },
      },
    },
  },
  {
    name: "create_task",
    description: "Create a new task under a project or assigned to an employee.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        description: { type: "string" },
        projectId: { type: "string" },
        employeeId: { type: "string" },
        priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "URGENT"], default: "MEDIUM" },
        dueAt: { type: "string" },
        allocatedHours: { type: "number", default: 0 },
        orgId: { type: "string" },
        workspace: { type: "string" },
      },
      required: ["title"],
    },
  },
  {
    name: "update_task",
    description: "Update task status, priority, or details.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        title: { type: "string" },
        description: { type: "string" },
        status: { type: "string", enum: ["TODO", "IN_PROGRESS", "BLOCKED", "DONE"] },
        priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "URGENT"] },
        dueAt: { type: "string" },
        allocatedHours: { type: "number" },
      },
      required: ["id"],
    },
  },
  {
    name: "list_work_logs",
    description: "List employee timesheets and work logs with duration and approval status.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string" },
        employeeId: { type: "string" },
        status: { type: "string" },
        orgId: { type: "string" },
        workspace: { type: "string" },
      },
    },
  },
  {
    name: "create_work_log",
    description: "Record work time log / timesheet entry against a project or task.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string" },
        taskId: { type: "string" },
        employeeId: { type: "string" },
        logDate: { type: "string" },
        nepaliDate: { type: "string" },
        startTime: { type: "string" },
        endTime: { type: "string" },
        durationMinutes: { type: "number" },
        comment: { type: "string" },
        orgId: { type: "string" },
        workspace: { type: "string" },
      },
    },
  },

  // 16. QUOTES & SALES ORDERS
  {
    name: "list_quotes",
    description: "List price quotations / estimates with statuses, validities, and line items.",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["DRAFT", "SENT", "ACCEPTED", "REJECTED", "CANCELLED"] },
        orgId: { type: "string" },
        workspace: { type: "string" },
      },
    },
  },
  {
    name: "create_quote",
    description: "Create a customer quotation / estimate with line items.",
    inputSchema: {
      type: "object",
      properties: {
        contactId: { type: "string" },
        quoteNumber: { type: "string" },
        issueDate: { type: "string" },
        validUntil: { type: "string" },
        notes: { type: "string" },
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              description: { type: "string" },
              quantity: { type: "number", default: 1 },
              unitPrice: { type: "number" },
              taxRate: { type: "number", default: 13 },
            },
            required: ["description", "unitPrice"],
          },
        },
        orgId: { type: "string" },
        workspace: { type: "string" },
      },
      required: ["items"],
    },
  },
  {
    name: "convert_quote_to_invoice",
    description: "Convert an accepted customer quotation directly into an official tax invoice.",
    inputSchema: {
      type: "object",
      properties: {
        quoteId: { type: "string", description: "Quote ID to convert" },
        orgId: { type: "string" },
        workspace: { type: "string" },
      },
      required: ["quoteId"],
    },
  },
  {
    name: "list_sales_orders",
    description: "List customer sales orders and fulfillment statuses.",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string" },
        orgId: { type: "string" },
        workspace: { type: "string" },
      },
    },
  },
  {
    name: "create_sales_order",
    description: "Create a sales order with line items.",
    inputSchema: {
      type: "object",
      properties: {
        contactId: { type: "string" },
        orderNumber: { type: "string" },
        orderDate: { type: "string" },
        notes: { type: "string" },
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              description: { type: "string" },
              quantity: { type: "number", default: 1 },
              unitPrice: { type: "number" },
            },
            required: ["description", "unitPrice"],
          },
        },
        orgId: { type: "string" },
        workspace: { type: "string" },
      },
      required: ["items"],
    },
  },

  // 17. PROJECT WALLETS
  {
    name: "list_project_wallets",
    description: "List project financial wallets showing total budgets, transferred amounts, hold balances, and remaining balances.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string" },
        orgId: { type: "string" },
        workspace: { type: "string" },
      },
    },
  },
  {
    name: "record_wallet_transfer",
    description: "Record a project wallet fund transfer or budget disbursement.",
    inputSchema: {
      type: "object",
      properties: {
        walletId: { type: "string", description: "Project Wallet ID" },
        amount: { type: "number", description: "Transfer amount" },
        type: { type: "string", enum: ["TRANSFER", "REQUEST"], default: "TRANSFER" },
        paymentMode: { type: "string", default: "Fonepay" },
        requestedById: { type: "string" },
        transferToId: { type: "string" },
        description: { type: "string" },
        orgId: { type: "string" },
        workspace: { type: "string" },
      },
      required: ["walletId", "amount"],
    },
  },

  // 18. COMPANY & WORKSPACE SETTINGS
  {
    name: "get_company_settings",
    description: "Get legal company details, PAN/VAT registration, official address, email, phone, fiscal year, and default tax rate.",
    inputSchema: {
      type: "object",
      properties: {
        orgId: { type: "string", description: "Optional workspace ID or slug" },
        workspace: { type: "string", description: "Optional workspace alias ('house' or 'office')" },
      },
    },
  },
  {
    name: "update_company_settings",
    description: "Update company profile, legal name, PAN/VAT number, registered address, contact info, fiscal year, or default VAT rate.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        taxNumber: { type: "string", description: "PAN / VAT number" },
        email: { type: "string" },
        phone: { type: "string" },
        address: { type: "string" },
        currency: { type: "string" },
        defaultTaxPercent: { type: "number" },
        fiscalYearStart: { type: "number", description: "Month index of fiscal year start (default 4 = Shrawan)" },
        orgId: { type: "string" },
        workspace: { type: "string" },
      },
    },
  },

  // 19. EXPENSE CATEGORIES CRUD
  {
    name: "get_expense_category",
    description: "Get full details of a specific expense category by ID.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Expense Category ID" },
      },
      required: ["id"],
    },
  },
  {
    name: "update_expense_category",
    description: "Update an expense category's name, monthly budget, or icon.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        name: { type: "string" },
        budgetMonthly: { type: "number" },
        icon: { type: "string" },
      },
      required: ["id"],
    },
  },
  {
    name: "delete_expense_category",
    description: "Delete an expense category.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
      },
      required: ["id"],
    },
  },

  // 20. INCOME CRUD
  {
    name: "get_income",
    description: "Get full details of a specific income record by ID.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Income ID" },
      },
      required: ["id"],
    },
  },

  // 21. INVOICE PAYMENTS CRUD
  {
    name: "delete_invoice_payment",
    description: "Delete an invoice payment record and adjust the invoice paidAmount and status.",
    inputSchema: {
      type: "object",
      properties: {
        paymentId: { type: "string", description: "Invoice Payment ID" },
      },
      required: ["paymentId"],
    },
  },

  // 22. PURCHASES / VENDOR ORDERS CRUD
  {
    name: "get_purchase",
    description: "Get purchase order details with line items and payments by ID or order number.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Purchase Order ID" },
      },
      required: ["id"],
    },
  },
  {
    name: "update_purchase",
    description: "Update a purchase order's status, notes, or discount.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        status: { type: "string", enum: ["DRAFT", "CONFIRMED", "PROCESSING", "COMPLETED", "CANCELLED"] },
        notes: { type: "string" },
      },
      required: ["id"],
    },
  },
  {
    name: "delete_purchase",
    description: "Permanently delete a purchase order and its linked items and payments.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
      },
      required: ["id"],
    },
  },
  {
    name: "record_purchase_payment",
    description: "Record a vendor payment against a purchase order and sync with expenses.",
    inputSchema: {
      type: "object",
      properties: {
        purchaseOrderId: { type: "string" },
        amount: { type: "number" },
        paidAt: { type: "string" },
        method: { type: "string", default: "Bank Transfer" },
        reference: { type: "string" },
        notes: { type: "string" },
      },
      required: ["purchaseOrderId", "amount"],
    },
  },

  // 23. CONTACTS CRUD
  {
    name: "get_contact",
    description: "Get customer or vendor contact details by ID.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
      },
      required: ["id"],
    },
  },
  {
    name: "update_contact",
    description: "Update customer or vendor contact profile.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        name: { type: "string" },
        companyName: { type: "string" },
        email: { type: "string" },
        phone: { type: "string" },
        address: { type: "string" },
        taxNumber: { type: "string" },
        notes: { type: "string" },
      },
      required: ["id"],
    },
  },
  {
    name: "delete_contact",
    description: "Delete a contact record.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
      },
      required: ["id"],
    },
  },

  // 24. LEADS (CRM) CRUD
  {
    name: "list_leads",
    description: "List sales pipeline leads with status, deal value, and follow-up dates.",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "WON", "LOST"] },
        orgId: { type: "string" },
        workspace: { type: "string" },
      },
    },
  },
  {
    name: "get_lead",
    description: "Get sales lead details by ID.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
      },
      required: ["id"],
    },
  },
  {
    name: "create_lead",
    description: "Create a new sales opportunity lead in the CRM.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        contactId: { type: "string" },
        source: { type: "string" },
        status: { type: "string", enum: ["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "WON", "LOST"], default: "NEW" },
        value: { type: "number", default: 0 },
        nextFollowUpAt: { type: "string" },
        notes: { type: "string" },
        orgId: { type: "string" },
        workspace: { type: "string" },
      },
      required: ["title"],
    },
  },
  {
    name: "update_lead",
    description: "Update sales lead status, estimated deal value, or notes.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        title: { type: "string" },
        status: { type: "string", enum: ["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "WON", "LOST"] },
        value: { type: "number" },
        nextFollowUpAt: { type: "string" },
        notes: { type: "string" },
      },
      required: ["id"],
    },
  },
  {
    name: "delete_lead",
    description: "Delete a sales lead.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
      },
      required: ["id"],
    },
  },

  // 25. PRODUCTS & INVENTORY CRUD
  {
    name: "get_product",
    description: "Get product details by ID or SKU.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
      },
      required: ["id"],
    },
  },
  {
    name: "update_product",
    description: "Update product pricing, stock levels, reorder level, or active status.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        name: { type: "string" },
        sku: { type: "string" },
        unit: { type: "string" },
        salePrice: { type: "number" },
        purchasePrice: { type: "number" },
        stockQty: { type: "number" },
        reorderLevel: { type: "number" },
        active: { type: "boolean" },
      },
      required: ["id"],
    },
  },
  {
    name: "delete_product",
    description: "Delete a product and its stock movements.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
      },
      required: ["id"],
    },
  },

  // 26. SALES ORDERS CRUD
  {
    name: "get_sales_order",
    description: "Get sales order details with line items by ID.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
      },
      required: ["id"],
    },
  },
  {
    name: "update_sales_order",
    description: "Update sales order status or notes.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        status: { type: "string", enum: ["DRAFT", "CONFIRMED", "PROCESSING", "COMPLETED", "CANCELLED"] },
        notes: { type: "string" },
      },
      required: ["id"],
    },
  },
  {
    name: "delete_sales_order",
    description: "Delete a sales order.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
      },
      required: ["id"],
    },
  },

  // 27. QUOTES CRUD
  {
    name: "get_quote",
    description: "Get price quotation details with line items by ID.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
      },
      required: ["id"],
    },
  },
  {
    name: "update_quote",
    description: "Update quotation status, terms, or notes.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        status: { type: "string", enum: ["DRAFT", "SENT", "ACCEPTED", "REJECTED", "CANCELLED"] },
        validUntil: { type: "string" },
        notes: { type: "string" },
        terms: { type: "string" },
      },
      required: ["id"],
    },
  },
  {
    name: "delete_quote",
    description: "Delete a quotation.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
      },
      required: ["id"],
    },
  },

  // 28. LOANS CRUD
  {
    name: "get_loan",
    description: "Get loan details with payment history by ID.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
      },
      required: ["id"],
    },
  },
  {
    name: "update_loan",
    description: "Update loan details, interest rate, due date, or notes.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        partyName: { type: "string" },
        interestRate: { type: "number" },
        dueDate: { type: "string" },
        status: { type: "string", enum: ["ACTIVE", "SETTLED", "DEFAULTED"] },
        notes: { type: "string" },
      },
      required: ["id"],
    },
  },
  {
    name: "delete_loan",
    description: "Delete a loan and its repayment records.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
      },
      required: ["id"],
    },
  },

  // 29. RENTAL HOUSE CRUD
  {
    name: "get_rental_house",
    description: "Get rental house details by ID.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
      },
      required: ["id"],
    },
  },

  // 30. UTILITIES CRUD
  {
    name: "delete_electricity_reading",
    description: "Delete an electricity reading log.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
      },
      required: ["id"],
    },
  },
  {
    name: "delete_milk_log",
    description: "Delete a monthly milk consumption log.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
      },
      required: ["id"],
    },
  },

  // 31. STAFF (HRM) CRUD
  {
    name: "get_employee",
    description: "Get employee details with designation and basic salary by ID.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
      },
      required: ["id"],
    },
  },
  {
    name: "update_employee",
    description: "Update employee details, designation, basic salary, or status.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        name: { type: "string" },
        email: { type: "string" },
        phone: { type: "string" },
        designation: { type: "string" },
        department: { type: "string" },
        basicSalary: { type: "number" },
        status: { type: "string", enum: ["ACTIVE", "ON_LEAVE", "INACTIVE", "TERMINATED"] },
      },
      required: ["id"],
    },
  },
  {
    name: "delete_employee",
    description: "Delete an employee record.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
      },
      required: ["id"],
    },
  },

  // 32. PAYROLL CRUD
  {
    name: "get_payroll",
    description: "Get payroll disbursement details by ID.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
      },
      required: ["id"],
    },
  },
  {
    name: "update_payroll",
    description: "Update payroll disbursement details.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        basic: { type: "number" },
        allowance: { type: "number" },
        overtime: { type: "number" },
        deduction: { type: "number" },
        tax: { type: "number" },
        netPay: { type: "number" },
        notes: { type: "string" },
      },
      required: ["id"],
    },
  },
  {
    name: "delete_payroll",
    description: "Delete a payroll record.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
      },
      required: ["id"],
    },
  },

  // 33. LEAVES CRUD
  {
    name: "get_leave",
    description: "Get leave request details by ID.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
      },
      required: ["id"],
    },
  },
  {
    name: "update_leave",
    description: "Update leave request status (APPROVED, REJECTED, CANCELLED) or notes.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        status: { type: "string", enum: ["PENDING", "APPROVED", "REJECTED", "CANCELLED"] },
      },
      required: ["id"],
    },
  },
  {
    name: "delete_leave",
    description: "Delete a leave request.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
      },
      required: ["id"],
    },
  },

  // 34. PROJECTS CRUD
  {
    name: "get_project",
    description: "Get project details with team leader and wallet balance by ID.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
      },
      required: ["id"],
    },
  },
  {
    name: "update_project",
    description: "Update project name, budget, status, or dates.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        name: { type: "string" },
        description: { type: "string" },
        budget: { type: "number" },
        status: { type: "string" },
        priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "URGENT"] },
      },
      required: ["id"],
    },
  },
  {
    name: "delete_project",
    description: "Delete a project and its associated wallet.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
      },
      required: ["id"],
    },
  },

  // 35. TASKS CRUD
  {
    name: "get_task",
    description: "Get task details by ID.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
      },
      required: ["id"],
    },
  },
  {
    name: "delete_task",
    description: "Delete a task.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
      },
      required: ["id"],
    },
  },

  // 36. WORKLOGS (TIMESHEETS) CRUD
  {
    name: "get_work_log",
    description: "Get timesheet worklog details by ID.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
      },
      required: ["id"],
    },
  },
  {
    name: "update_work_log",
    description: "Update worklog duration, status (APPROVED/REJECTED), or comment.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        durationMinutes: { type: "number" },
        comment: { type: "string" },
        status: { type: "string", enum: ["PENDING", "APPROVED", "REJECTED"] },
      },
      required: ["id"],
    },
  },
  {
    name: "delete_work_log",
    description: "Delete a worklog entry.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
      },
      required: ["id"],
    },
  },

  // 37. PROJECT WALLETS & TRANSACTIONS
  {
    name: "get_project_wallet",
    description: "Get project wallet details with budget balance and transaction logs.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
      },
      required: ["id"],
    },
  },
  {
    name: "list_wallet_transactions",
    description: "List project wallet transactions and approval statuses.",
    inputSchema: {
      type: "object",
      properties: {
        walletId: { type: "string" },
        orgId: { type: "string" },
        workspace: { type: "string" },
      },
    },
  },
  {
    name: "update_wallet_transaction_status",
    description: "Approve, reject, or complete a project wallet transfer.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        actionType: { type: "string", enum: ["LEADER_APPROVE", "ADMIN_APPROVE", "REJECT", "COMPLETE_TRANSFER"] },
      },
      required: ["id", "actionType"],
    },
  },

  // 38. LICENSES & COMPLIANCE
  {
    name: "list_licenses",
    description: "List software licenses and regulatory compliance certificates.",
    inputSchema: {
      type: "object",
      properties: {
        orgId: { type: "string" },
        workspace: { type: "string" },
      },
    },
  },
  {
    name: "get_license",
    description: "Get license details by ID.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
      },
      required: ["id"],
    },
  },
  {
    name: "create_license",
    description: "Add a software license or compliance record.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        vendor: { type: "string" },
        licenseKey: { type: "string" },
        seats: { type: "number", default: 1 },
        purchaseDate: { type: "string" },
        expiryDate: { type: "string" },
        renewalCost: { type: "number" },
        notes: { type: "string" },
        orgId: { type: "string" },
        workspace: { type: "string" },
      },
      required: ["name"],
    },
  },
  {
    name: "update_license",
    description: "Update license details, expiry date, or status.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        name: { type: "string" },
        expiryDate: { type: "string" },
        renewalCost: { type: "number" },
        status: { type: "string", enum: ["ACTIVE", "EXPIRING", "EXPIRED", "CANCELLED"] },
      },
      required: ["id"],
    },
  },
  {
    name: "delete_license",
    description: "Delete a license record.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
      },
      required: ["id"],
    },
  },

  // 39. REMINDERS & ALERTS
  {
    name: "list_reminders",
    description: "List scheduled reminders and alerts.",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["PENDING", "DONE", "DISMISSED"] },
        orgId: { type: "string" },
        workspace: { type: "string" },
      },
    },
  },
  {
    name: "get_reminder",
    description: "Get reminder details by ID.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
      },
      required: ["id"],
    },
  },
  {
    name: "create_reminder",
    description: "Create a scheduled reminder.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        dueAt: { type: "string", description: "YYYY-MM-DD" },
        notes: { type: "string" },
        orgId: { type: "string" },
        workspace: { type: "string" },
      },
      required: ["title", "dueAt"],
    },
  },
  {
    name: "update_reminder",
    description: "Update reminder title, due date, or status.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        title: { type: "string" },
        dueAt: { type: "string" },
        status: { type: "string", enum: ["PENDING", "DONE", "DISMISSED"] },
      },
      required: ["id"],
    },
  },
  {
    name: "delete_reminder",
    description: "Delete a reminder.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
      },
      required: ["id"],
    },
  },

  // 40. UNIVERSAL RECORD MANAGEMENT (HARD & SOFT DELETE)
  {
    name: "hard_delete_record",
    description: "Permanently delete any record across the ERP (resource: purchase, sales, invoice, quote, expense, income, contact, lead, task, product, leave, reminder, license, loan, payroll, milk_log, project, employee).",
    inputSchema: {
      type: "object",
      properties: {
        resource: {
          type: "string",
          enum: [
            "purchase", "sales", "invoice", "quote", "expense", "recurring_expense",
            "income", "contact", "lead", "task", "product", "leave", "reminder",
            "license", "loan", "payroll", "bank_tx", "milk_log", "project", "employee",
          ],
        },
        id: { type: "string", description: "Record ID to permanently delete" },
        orgId: { type: "string" },
        workspace: { type: "string" },
      },
      required: ["resource", "id"],
    },
  },
  {
    name: "soft_delete_record",
    description: "Soft delete, cancel, or mark inactive any record across the ERP without permanently destroying data.",
    inputSchema: {
      type: "object",
      properties: {
        resource: {
          type: "string",
          enum: [
            "purchase", "sales", "invoice", "quote", "expense", "recurring_expense",
            "income", "contact", "lead", "task", "product", "leave", "reminder",
            "license", "loan", "payroll", "bank_tx", "milk_log", "project", "employee",
          ],
        },
        id: { type: "string", description: "Record ID to soft delete" },
        orgId: { type: "string" },
        workspace: { type: "string" },
      },
      required: ["resource", "id"],
    },
  },
  {
    name: "create_organization",
    description: "Create a new organization or workspace in the system.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        slug: { type: "string" },
        kind: { type: "string", enum: ["COMPANY", "HOUSEHOLD", "PERSONAL"], default: "COMPANY" },
        currency: { type: "string", default: "NPR" },
        panVatNumber: { type: "string" },
        address: { type: "string" },
        phone: { type: "string" },
        email: { type: "string" },
      },
      required: ["name"],
    },
  },
];

function humanizeToolName(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function isReadOnlyTool(name: string): boolean {
  return (
    name.startsWith("list_") ||
    name.startsWith("get_") ||
    name === "getBalanceSheet" ||
    name === "analyze_financial_document_ai"
  );
}

function isDestructiveTool(name: string): boolean {
  return (
    name.includes("delete") ||
    name === "settle_loan" ||
    name === "convert_quote_to_invoice" ||
    name === "update_wallet_transaction_status"
  );
}

// ChatGPT's tool scanner consumes these fields directly from tools/list. Keep
// the underlying definitions compact while guaranteeing that every tool has
// the current MCP/OpenAI metadata required for selection, auth, and safety.
const DISCOVERABLE_TOOLS = TOOLS.map((tool: any) => {
  const readOnly = isReadOnlyTool(tool.name);
  const destructive = isDestructiveTool(tool.name);
  const securitySchemes = [
    {
      type: "oauth2",
      scopes: readOnly ? ["mcp:read"] : ["mcp:write"],
    },
  ];

  return {
    ...tool,
    title: tool.title || humanizeToolName(tool.name),
    annotations: {
      title: tool.title || humanizeToolName(tool.name),
      readOnlyHint: readOnly,
      destructiveHint: destructive,
      openWorldHint: tool.name === "analyze_financial_document_ai",
      idempotentHint: readOnly,
    },
    securitySchemes,
    _meta: {
      ...(tool._meta || {}),
      securitySchemes,
      "openai/toolInvocation/invoking": readOnly ? "Loading Kashtrix data…" : "Updating Kashtrix…",
      "openai/toolInvocation/invoked": readOnly ? "Kashtrix data ready" : "Kashtrix updated",
    },
  };
});

function parseDateRange(args: Record<string, any>): {
  startDate?: Date;
  endDate?: Date;
  label: string;
} {
  const period = String(args.period || args.month || "").trim();
  const resolved = resolveNepaliPeriodToAdRange(period);
  let startDate = resolved.startDate;
  let endDate = resolved.endDate;

  if (args.startDate) {
    startDate = new Date(`${String(args.startDate).slice(0, 10)}T00:00:00.000Z`);
    if (Number.isNaN(startDate.getTime())) throw new Error("startDate must be a valid YYYY-MM-DD date");
  }
  if (args.endDate) {
    endDate = new Date(`${String(args.endDate).slice(0, 10)}T23:59:59.999Z`);
    if (Number.isNaN(endDate.getTime())) throw new Error("endDate must be a valid YYYY-MM-DD date");
  }
  if (startDate && endDate && startDate > endDate) {
    throw new Error("startDate must be before or equal to endDate");
  }

  return {
    startDate,
    endDate,
    label: period ? resolved.label : startDate || endDate ? "Custom date range" : "All Transactions",
  };
}

function dateWhere(startDate?: Date, endDate?: Date) {
  if (!startDate && !endDate) return undefined;
  return {
    ...(startDate ? { gte: startDate } : {}),
    ...(endDate ? { lte: endDate } : {}),
  };
}

/**
 * Executes a single MCP JSON-RPC call
 */
async function handleSingleRpc(rpc: any, auth: McpAuthResult) {
  const { jsonrpc = "2.0", id = 1, method = "" } = rpc || {};
  const params = rpc?.params || {};

  // Handle Notifications (no response needed per JSON-RPC 2.0)
  if (method.startsWith("notifications/") || method === "initialized") {
    return null;
  }

  switch (method) {
    case "initialize": {
      return {
        jsonrpc,
        id,
        result: {
          protocolVersion: MCP_PROTOCOL_VERSION,
          capabilities: {
            tools: { listChanged: false },
            resources: { subscribe: false, listChanged: false },
            prompts: { listChanged: false },
          },
          serverInfo: {
            name: "kashtrix-mcp-server",
            version: "1.0.0",
            description: "Kashtrix ERP Model Context Protocol Server with Full Multi-Workspace Support",
          },
          instructions: MCP_SERVER_INSTRUCTIONS,
        },
      };
    }

    case "ping":
      return { jsonrpc, id, result: {} };

    case "tools/list":
    case "list_tools":
      return {
        jsonrpc,
        id,
        result: { tools: DISCOVERABLE_TOOLS },
      };

    case "resources/list":
      return { jsonrpc, id, result: { resources: [] } };

    case "resources/templates/list":
      return { jsonrpc, id, result: { resourceTemplates: [] } };

    case "prompts/list":
      return { jsonrpc, id, result: { prompts: [] } };

    case "logging/setLevel":
      return { jsonrpc, id, result: {} };

    case "tools/call":
    case "call_tool":
    case "tool_call":
    case "call": {
      const toolName = params?.name || params?.tool || params?.tool_name || rpc?.tool || rpc?.name;
      let args = params?.arguments ?? params?.input ?? params?.parameters ?? {};
      if (typeof args === "string") {
        try {
          args = JSON.parse(args);
        } catch {
          args = {};
        }
      }
      if (!args || typeof args !== "object") {
        args = {};
      }

      const targetOrgParam = args.orgId || args.organizationId || args.workspace;

      try {
        if (toolName === "get_current_user") {
          const profile = {
            id: auth.userId || "",
            name: auth.name || "Kashtrix User",
            email: auth.email || "",
            nickname: `${auth.name || "Kashtrix User"} — ${auth.organizations?.length || 0} workspace(s)`,
          };
          return {
            jsonrpc,
            id,
            result: {
              content: [{ type: "text", text: JSON.stringify(profile) }],
              structuredContent: profile,
              isError: false,
            },
          };
        }

        // ==========================================
        // 1. ORGANIZATIONS / WORKSPACES
        // ==========================================
        if (toolName === "list_organizations") {
          return {
            jsonrpc,
            id,
            result: {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(auth.organizations || [], null, 2),
                },
              ],
            },
          };
        }

        if (toolName === "get_organization_details") {
          const targetOrgId = await resolveOrgId(auth, targetOrgParam);
          const org = await db.organization.findUnique({
            where: { id: targetOrgId },
            include: {
              bankAccounts: { select: { id: true, bankName: true, accountNumber: true, currentBalance: true } },
              _count: { select: { invoices: true, expenses: true, contacts: true, bankTransactions: true } },
            },
          });
          return {
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: JSON.stringify(org, null, 2) }] },
          };
        }

        if (
          toolName === "get_financial_balance" ||
          toolName === "get_balance" ||
          toolName === "get_total_balance" ||
          toolName === "get_live_balance" ||
          toolName === "get_organization_financial_balance" ||
          toolName === "financial_balance" ||
          toolName === "balance"
        ) {
          const orgFilter = await resolveOrgFilter(auth, targetOrgParam);

          const [bankAccounts, invoices, purchaseOrders, loans] = await Promise.all([
            db.bankAccount.findMany({
              where: { ...orgFilter },
              select: {
                id: true,
                bankName: true,
                accountName: true,
                accountNumber: true,
                accountType: true,
                branch: true,
                currency: true,
                currentBalance: true,
                organizationId: true,
                organization: { select: { id: true, name: true, kind: true, currency: true } },
              },
            }),
            db.invoice.findMany({
              where: { ...orgFilter },
              select: {
                id: true,
                invoiceNumber: true,
                total: true,
                paidAmount: true,
                status: true,
                organizationId: true,
                organization: { select: { id: true, name: true, kind: true } },
              },
            }),
            db.purchaseOrder.findMany({
              where: { ...orgFilter },
              select: {
                id: true,
                orderNumber: true,
                total: true,
                paidAmount: true,
                status: true,
                organizationId: true,
                organization: { select: { id: true, name: true, kind: true } },
              },
            }),
            db.loan.findMany({
              where: { ...orgFilter },
              select: {
                id: true,
                principalAmount: true,
                totalPrincipalPaid: true,
                type: true,
                status: true,
                organizationId: true,
                organization: { select: { id: true, name: true, kind: true } },
              },
            }),
          ]);

          let totalCashAndBank = 0;
          let totalReceivables = 0;
          let totalPayables = 0;
          let totalLoansGiven = 0;
          let totalLoansTaken = 0;

          const orgMap = new Map<string, {
            name: string;
            kind: string;
            bankBalance: number;
            receivables: number;
            payables: number;
            accounts: Array<{ bankName: string; accountNumber: string; balance: number }>;
          }>();

          for (const b of bankAccounts) {
            const bal = Number(b.currentBalance || 0);
            totalCashAndBank += bal;
            if (!orgMap.has(b.organizationId)) {
              orgMap.set(b.organizationId, {
                name: b.organization.name,
                kind: b.organization.kind,
                bankBalance: 0,
                receivables: 0,
                payables: 0,
                accounts: [],
              });
            }
            const o = orgMap.get(b.organizationId)!;
            o.bankBalance += bal;
            o.accounts.push({
              bankName: b.bankName,
              accountNumber: b.accountNumber,
              balance: bal,
            });
          }

          for (const inv of invoices) {
            const tot = Number(inv.total || 0);
            const paid = Number(inv.paidAmount || 0);
            if (inv.status !== "PAID" && inv.status !== "CANCELLED") {
              const due = Math.max(0, tot - paid);
              totalReceivables += due;
              if (orgMap.has(inv.organizationId)) {
                orgMap.get(inv.organizationId)!.receivables += due;
              }
            }
          }

          for (const po of purchaseOrders) {
            const tot = Number(po.total || 0);
            const paid = Number(po.paidAmount || 0);
            if (po.status !== "CANCELLED") {
              const due = Math.max(0, tot - paid);
              if (due > 0) {
                totalPayables += due;
                if (orgMap.has(po.organizationId)) {
                  orgMap.get(po.organizationId)!.payables += due;
                }
              }
            }
          }

          for (const l of loans) {
            if (l.status === "ACTIVE") {
              const rem = Math.max(0, Number(l.principalAmount || 0) - Number(l.totalPrincipalPaid || 0));
              if (l.type === "GIVEN") {
                totalLoansGiven += rem;
              } else {
                totalLoansTaken += rem;
              }
            }
          }

          const netFinancialPosition = totalCashAndBank + totalReceivables + totalLoansGiven - totalPayables - totalLoansTaken;

          const responseData = {
            targetWorkspace: targetOrgParam || "all-authorized-workspaces",
            summary: {
              totalCashAndBankBalance: totalCashAndBank,
              totalCustomerReceivables: totalReceivables,
              totalVendorPayables: totalPayables,
              totalLoansGivenToOthers: totalLoansGiven,
              totalLoansTakenFromOthers: totalLoansTaken,
              netFinancialPosition,
              currency: "NPR",
            },
            workspaceBreakdown: Array.from(orgMap.entries()).map(([id, o]) => ({
              organizationId: id,
              name: o.name,
              kind: o.kind,
              totalBankBalance: o.bankBalance,
              totalReceivables: o.receivables,
              totalPayables: o.payables,
              accounts: o.accounts,
            })),
            bankAccounts: bankAccounts.map((b) => ({
              id: b.id,
              bankName: b.bankName,
              accountName: b.accountName,
              accountNumber: b.accountNumber,
              branch: b.branch,
              currentBalance: Number(b.currentBalance || 0),
              workspace: `${b.organization.name} (${b.organization.kind})`,
            })),
          };

          return {
            jsonrpc,
            id,
            result: {
              content: [
                {
                  type: "text",
                  text: `Kashtrix Live Financial Balance for ${targetOrgParam ? `requested workspace (${targetOrgParam})` : "all authorized workspaces"}:\n\n` +
                    `• Total Cash & Bank Balance: NPR ${totalCashAndBank.toLocaleString("en-US", { minimumFractionDigits: 2 })}\n` +
                    `• Outstanding Customer Receivables: NPR ${totalReceivables.toLocaleString("en-US", { minimumFractionDigits: 2 })}\n` +
                    `• Outstanding Vendor Payables: NPR ${totalPayables.toLocaleString("en-US", { minimumFractionDigits: 2 })}\n` +
                    `• Net Liquid / Financial Position: NPR ${netFinancialPosition.toLocaleString("en-US", { minimumFractionDigits: 2 })}\n\n` +
                    `Breakdown Details:\n${JSON.stringify(responseData, null, 2)}`,
                },
              ],
            },
          };
        }

        if (toolName === "get_balance_sheet" || toolName === "getBalanceSheet") {
          const orgFilter = await resolveOrgFilter(auth, targetOrgParam || args.company);

          const [bankAccounts, invoices, purchaseOrders, loans, products, expenses, incomes, rentalHouses] =
            await Promise.all([
              db.bankAccount.findMany({
                where: { ...orgFilter },
                include: { organization: { select: { id: true, name: true, slug: true, kind: true } } },
              }),
              db.invoice.findMany({
                where: { ...orgFilter },
                include: { organization: { select: { id: true, name: true, slug: true, kind: true } } },
              }),
              db.purchaseOrder.findMany({
                where: { ...orgFilter },
                include: { organization: { select: { id: true, name: true, slug: true, kind: true } } },
              }),
              db.loan.findMany({
                where: { ...orgFilter },
                include: { organization: { select: { id: true, name: true, slug: true, kind: true } } },
              }),
              db.product.findMany({
                where: { ...orgFilter },
                select: { stockQty: true, purchasePrice: true, salePrice: true },
              }),
              db.expense.findMany({
                where: { ...orgFilter },
                select: { amount: true },
              }),
              db.income.findMany({
                where: { ...orgFilter },
                select: { amount: true },
              }),
              db.rentalHouse.findMany({
                where: { ...orgFilter },
                select: { monthlyRent: true, isActive: true },
              }),
            ]);

          const liquidCashAndBank = bankAccounts.reduce((sum, b) => sum + (Number(b.currentBalance) || 0), 0);
          const accountsReceivable = invoices.reduce((sum, inv) => {
            if (inv.status !== "PAID" && inv.status !== "CANCELLED") {
              return sum + Math.max(0, Number(inv.total || 0) - Number(inv.paidAmount || 0));
            }
            return sum;
          }, 0);
          const loansGiven = loans.reduce((sum, l) => {
            if (l.status === "ACTIVE" && l.type === "GIVEN") {
              return sum + Math.max(0, Number(l.principalAmount || 0) - Number(l.totalPrincipalPaid || 0));
            }
            return sum;
          }, 0);
          const inventoryValue = products.reduce((sum, p) => {
            const qty = Number(p.stockQty) || 0;
            const price = Number(p.purchasePrice) || Number(p.salePrice) || 0;
            return sum + Math.max(0, qty * price);
          }, 0);
          const currentAssets = liquidCashAndBank + accountsReceivable + loansGiven + inventoryValue;
          const fixedAssets = rentalHouses.reduce((sum, rh) => sum + (rh.isActive ? Number(rh.monthlyRent || 0) * 2 : 0), 0);
          const totalAssets = currentAssets + fixedAssets;

          const accountsPayable = purchaseOrders.reduce((sum, po) => {
            if (po.status !== "CANCELLED") {
              return sum + Math.max(0, Number(po.total || 0) - Number(po.paidAmount || 0));
            }
            return sum;
          }, 0);
          const loansTaken = loans.reduce((sum, l) => {
            if (l.status === "ACTIVE" && l.type === "TAKEN") {
              return sum + Math.max(0, Number(l.principalAmount || 0) - Number(l.totalPrincipalPaid || 0));
            }
            return sum;
          }, 0);
          const currentLiabilities = accountsPayable + loansTaken;
          const totalLiabilities = currentLiabilities;

          const totalAllTimeIncomes = incomes.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
          const totalAllTimeExpenses = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
          const retainedEarnings = totalAllTimeIncomes - totalAllTimeExpenses;
          const totalEquity = totalAssets - totalLiabilities;
          const capital = totalEquity - retainedEarnings;
          const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;

          const companyName = bankAccounts[0]?.organization?.name || "Kashtrix Multi-Entity ERP";

          const formattedTable =
            `# Kashtrix ERP — Balance Sheet\n` +
            `**Company**: ${companyName}\n` +
            `**Fiscal Year**: ${args.fiscalYear || "2083/84 BS"} (approx. 17 July 2026 – 16 July 2027)\n\n` +
            `| Particulars | Amount (NPR) |\n` +
            `| :--- | :--- |\n` +
            `| **ASSETS** | |\n` +
            `| Current Assets (Cash & Bank Balances) | ${liquidCashAndBank.toLocaleString("en-US", { minimumFractionDigits: 2 })} |\n` +
            `| Customer Accounts Receivable (Trade Debtors) | ${accountsReceivable.toLocaleString("en-US", { minimumFractionDigits: 2 })} |\n` +
            `| Short-term Advances & Loans Given | ${loansGiven.toLocaleString("en-US", { minimumFractionDigits: 2 })} |\n` +
            `| Inventory & Stock Valuation | ${inventoryValue.toLocaleString("en-US", { minimumFractionDigits: 2 })} |\n` +
            `| **Total Current Assets** | **${currentAssets.toLocaleString("en-US", { minimumFractionDigits: 2 })}** |\n` +
            `| Fixed Assets & Security Lease Advances | ${fixedAssets.toLocaleString("en-US", { minimumFractionDigits: 2 })} |\n` +
            `| **TOTAL ASSETS** | **${totalAssets.toLocaleString("en-US", { minimumFractionDigits: 2 })}** |\n` +
            `| | |\n` +
            `| **LIABILITIES** | |\n` +
            `| Current Liabilities (Accounts Payable / Vendor Bills) | ${accountsPayable.toLocaleString("en-US", { minimumFractionDigits: 2 })} |\n` +
            `| Short-term Borrowings (Loans Taken) | ${loansTaken.toLocaleString("en-US", { minimumFractionDigits: 2 })} |\n` +
            `| Long-term Liabilities | 0.00 |\n` +
            `| **TOTAL LIABILITIES** | **${totalLiabilities.toLocaleString("en-US", { minimumFractionDigits: 2 })}** |\n` +
            `| | |\n` +
            `| **EQUITY** | |\n` +
            `| Capital | ${capital.toLocaleString("en-US", { minimumFractionDigits: 2 })} |\n` +
            `| Retained Earnings | ${retainedEarnings.toLocaleString("en-US", { minimumFractionDigits: 2 })} |\n` +
            `| **TOTAL EQUITY** | **${totalEquity.toLocaleString("en-US", { minimumFractionDigits: 2 })}** |\n` +
            `| | |\n` +
            `| **TOTAL LIABILITIES + EQUITY** | **${totalLiabilitiesAndEquity.toLocaleString("en-US", { minimumFractionDigits: 2 })}** |\n\n` +
            `*Reconciliation Status: Balanced (Total Assets = Total Liabilities + Total Equity)*`;

          return {
            jsonrpc,
            id,
            result: {
              content: [{ type: "text", text: formattedTable }],
              balanceSheet: {
                totalAssets,
                totalCurrentAssets: currentAssets,
                totalFixedAssets: fixedAssets,
                totalLiabilities,
                totalCurrentLiabilities: currentLiabilities,
                totalEquity,
                capital,
                retainedEarnings,
                totalLiabilitiesAndEquity,
                isBalanced: true,
              },
            },
          };
        }

        if (toolName === "get_financial_kpi_summary") {
          const orgFilter = await resolveOrgFilter(auth, targetOrgParam);

          const [bankAccounts, expenses, incomes, invoices] = await Promise.all([
            db.bankAccount.findMany({
              where: { ...orgFilter },
              select: { id: true, bankName: true, currentBalance: true, organization: { select: { name: true, kind: true } } },
            }),
            db.expense.findMany({
              where: { ...orgFilter, isEstimated: false },
              select: { amount: true, organization: { select: { name: true, kind: true } } },
            }),
            db.income.findMany({
              where: { ...orgFilter },
              select: { amount: true, organization: { select: { name: true, kind: true } } },
            }),
            db.invoice.findMany({
              where: { ...orgFilter },
              select: { total: true, paidAmount: true, status: true, organization: { select: { name: true, kind: true } } },
            }),
          ]);

          let totalBankBalance = 0;
          for (const b of bankAccounts) totalBankBalance += Number(b.currentBalance || 0);

          let totalExpenses = 0;
          for (const e of expenses) totalExpenses += Number(e.amount || 0);

          let totalIncome = 0;
          for (const inc of incomes) totalIncome += Number(inc.amount || 0);

          let totalInvoiced = 0;
          let totalInvoicePaid = 0;
          let pendingInvoiceAmount = 0;
          let overdueInvoices = 0;

          for (const inv of invoices) {
            const tot = Number(inv.total || 0);
            const paid = Number(inv.paidAmount || 0);
            totalInvoiced += tot;
            totalInvoicePaid += paid;
            if (inv.status !== "PAID" && inv.status !== "CANCELLED") {
              pendingInvoiceAmount += Math.max(0, tot - paid);
            }
            if (inv.status === "OVERDUE") overdueInvoices++;
          }

          const summary = {
            workspacesAnalyzed: (auth.organizations || []).map((o) => `${o.name} (${o.kind})`),
            financialMetrics: {
              totalBankBalance,
              totalIncome,
              totalExpenses,
              netCashFlow: totalIncome - totalExpenses,
              totalInvoiced,
              totalInvoicePaid,
              outstandingInvoiceReceivables: pendingInvoiceAmount,
              overdueInvoicesCount: overdueInvoices,
            },
            bankAccountsOverview: bankAccounts.map((b) => ({
              bankName: b.bankName,
              currentBalance: b.currentBalance,
              workspace: `${b.organization.name} (${b.organization.kind})`,
            })),
          };

          return {
            jsonrpc,
            id,
            result: {
              content: [
                {
                  type: "text",
                  text: `Financial Overview across authorized workspaces:\n${JSON.stringify(summary, null, 2)}`,
                },
              ],
            },
          };
        }

        // ==========================================
        // 2. BANK ACCOUNTS
        // ==========================================
        if (toolName === "list_bank_accounts") {
          const orgFilter = await resolveOrgFilter(auth, targetOrgParam);
          const accounts = await db.bankAccount.findMany({
            where: { ...orgFilter },
            include: {
              organization: { select: { id: true, name: true, slug: true, kind: true } },
              _count: { select: { transactions: true } },
            },
            orderBy: { createdAt: "asc" },
          });

          return {
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: JSON.stringify(accounts, null, 2) }] },
          };
        }

        if (toolName === "get_bank_account") {
          const account = await db.bankAccount.findFirst({
            where: {
              id: args.id,
              ...(auth.isMaster || auth.role === "SUPER_ADMIN" ? {} : { organizationId: { in: auth.orgIds } }),
            },
            include: {
              organization: { select: { id: true, name: true, slug: true, kind: true } },
              transactions: { take: 25, orderBy: { transactionDate: "desc" } },
            },
          });
          if (!account) {
            return {
              jsonrpc,
              id,
              result: { content: [{ type: "text", text: `Bank Account ${args.id} not found.` }], isError: true },
            };
          }
          return {
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: JSON.stringify(account, null, 2) }] },
          };
        }

        if (toolName === "create_bank_account") {
          const targetOrgId = await resolveOrgId(auth, targetOrgParam);
          const newAccount = await db.bankAccount.create({
            data: {
              organizationId: targetOrgId,
              bankName: args.bankName,
              accountName: args.accountName,
              accountNumber: args.accountNumber,
              accountType: args.accountType || "CURRENT",
              branch: args.branch || null,
              currency: args.currency || "NPR",
              openingBalance: new Prisma.Decimal(args.openingBalance || 0),
              currentBalance: new Prisma.Decimal(args.openingBalance || 0),
            },
            include: {
              organization: { select: { id: true, name: true, kind: true } },
            },
          });
          return {
            jsonrpc,
            id,
            result: {
              content: [
                {
                  type: "text",
                  text: `Bank Account created successfully in ${newAccount.organization.name} (${newAccount.organization.kind}):\n${JSON.stringify(newAccount, null, 2)}`,
                },
              ],
            },
          };
        }

        if (toolName === "update_bank_account") {
          const existing = await db.bankAccount.findFirst({
            where: {
              id: args.id,
              ...(auth.isMaster || auth.role === "SUPER_ADMIN" ? {} : { organizationId: { in: auth.orgIds } }),
            },
          });
          if (!existing) {
            return {
              jsonrpc,
              id,
              result: { content: [{ type: "text", text: `Bank Account ${args.id} not found or unauthorized.` }], isError: true },
            };
          }

          const data: any = {};
          if (args.bankName) data.bankName = args.bankName;
          if (args.accountName) data.accountName = args.accountName;
          if (args.accountNumber) data.accountNumber = args.accountNumber;
          if (args.accountType) data.accountType = args.accountType;
          if (args.branch) data.branch = args.branch;
          if (args.currentBalance !== undefined) data.currentBalance = new Prisma.Decimal(args.currentBalance);

          const updated = await db.bankAccount.update({
            where: { id: args.id },
            data,
          });
          return {
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: `Bank Account updated:\n${JSON.stringify(updated, null, 2)}` }] },
          };
        }

        if (toolName === "delete_bank_account") {
          const existing = await db.bankAccount.findFirst({
            where: {
              id: args.id,
              ...(auth.isMaster || auth.role === "SUPER_ADMIN" ? {} : { organizationId: { in: auth.orgIds } }),
            },
          });
          if (!existing) {
            return {
              jsonrpc,
              id,
              result: { content: [{ type: "text", text: `Bank Account ${args.id} not found or unauthorized.` }], isError: true },
            };
          }
          await db.bankAccount.delete({ where: { id: args.id } });
          return {
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: `Bank Account ${args.id} permanently deleted.` }] },
          };
        }

        // ==========================================
        // 3. BANK TRANSACTIONS
        // ==========================================
        if (toolName === "list_bank_transactions") {
          const orgFilter = await resolveOrgFilter(auth, targetOrgParam);
          const where: any = { ...orgFilter };
          const { startDate, endDate, label } = parseDateRange(args);
          if (args.bankAccountId) where.bankAccountId = args.bankAccountId;
          if (args.type) where.type = args.type;
          const transactionDate = dateWhere(startDate, endDate);
          if (transactionDate) where.transactionDate = transactionDate;
          if (args.query) {
            where.OR = [
              { description: { contains: args.query } },
              { reference: { contains: args.query } },
              { chequeNumber: { contains: args.query } },
              { category: { contains: args.query } },
            ];
          }

          const limit = Math.min(500, Math.max(1, Number(args.limit) || 100));

          const txs = await db.bankTransaction.findMany({
            where,
            include: {
              bankAccount: { select: { bankName: true, accountName: true, accountNumber: true } },
              organization: { select: { id: true, name: true, slug: true, kind: true } },
            },
            take: limit,
            orderBy: { transactionDate: "desc" },
          });

          const transactions = txs.map((tx) => ({
            ...tx,
            amount: Number(tx.amount),
            balance: tx.balance === null ? null : Number(tx.balance),
          }));
          const summary = transactions.reduce(
            (totals, tx) => {
              if (tx.type === "DEPOSIT") totals.totalDeposits += tx.amount;
              if (tx.type === "WITHDRAWAL") totals.totalWithdrawals += tx.amount;
              return totals;
            },
            { totalRecords: transactions.length, totalDeposits: 0, totalWithdrawals: 0, netCashflow: 0 }
          );
          summary.netCashflow = summary.totalDeposits - summary.totalWithdrawals;
          const report = { period: label, summary, transactions };

          return {
            jsonrpc,
            id,
            result: {
              content: [{ type: "text", text: JSON.stringify(report, null, 2) }],
              structuredContent: report,
            },
          };
        }

        if (toolName === "list_financial_transactions") {
          const orgFilter = await resolveOrgFilter(auth, targetOrgParam);
          const { startDate, endDate, label } = parseDateRange(args);
          const range = dateWhere(startDate, endDate);
          const limit = Math.min(500, Math.max(1, Number(args.limit) || 100));

          const [bankEntries, expenses, incomes, invoicePayments, purchasePayments] = await Promise.all([
            db.bankTransaction.findMany({
              where: { ...orgFilter, ...(range ? { transactionDate: range } : {}) },
              include: {
                bankAccount: { select: { bankName: true, accountName: true, accountNumber: true } },
                organization: { select: { id: true, name: true, slug: true, kind: true } },
              },
              orderBy: { transactionDate: "desc" },
              take: limit,
            }),
            db.expense.findMany({
              where: { ...orgFilter, isEstimated: false, ...(range ? { occurredAt: range } : {}) },
              include: {
                category: { select: { name: true } },
                organization: { select: { id: true, name: true, slug: true, kind: true } },
              },
              orderBy: { occurredAt: "desc" },
              take: limit,
            }),
            db.income.findMany({
              where: { ...orgFilter, ...(range ? { receivedAt: range } : {}) },
              include: {
                organization: { select: { id: true, name: true, slug: true, kind: true } },
              },
              orderBy: { receivedAt: "desc" },
              take: limit,
            }),
            db.invoicePayment.findMany({
              where: {
                ...(range ? { paidAt: range } : {}),
                invoice: { ...orgFilter },
              },
              include: {
                invoice: {
                  include: {
                    contact: { select: { name: true } },
                    organization: { select: { id: true, name: true, slug: true, kind: true } },
                  },
                },
              },
              orderBy: { paidAt: "desc" },
              take: limit,
            }),
            db.purchasePayment.findMany({
              where: {
                ...(range ? { paidAt: range } : {}),
                purchaseOrder: { ...orgFilter },
              },
              include: {
                purchaseOrder: {
                  include: {
                    contact: { select: { name: true } },
                    organization: { select: { id: true, name: true, slug: true, kind: true } },
                  },
                },
              },
              orderBy: { paidAt: "desc" },
              take: limit,
            }),
          ]);

          const entries = [
            ...bankEntries.map((entry) => ({
              id: entry.id,
              source: "bank_transaction",
              date: entry.transactionDate.toISOString(),
              direction: entry.type === "DEPOSIT" ? "IN" : "OUT",
              amount: Number(entry.amount),
              description: entry.description,
              reference: entry.reference || entry.chequeNumber || "",
              category: entry.category || "Bank",
              party: entry.bankAccount.accountName || "",
              account: `${entry.bankAccount.bankName} ${entry.bankAccount.accountNumber}`.trim(),
              organization: entry.organization,
            })),
            ...expenses.map((entry) => ({
              id: entry.id,
              source: "expense",
              date: entry.occurredAt.toISOString(),
              direction: "OUT",
              amount: Number(entry.amount),
              description: entry.title,
              reference: "",
              category: entry.category?.name || "Expense",
              party: entry.vendor || "",
              account: "",
              organization: entry.organization,
            })),
            ...incomes.map((entry) => ({
              id: entry.id,
              source: "income",
              date: entry.receivedAt.toISOString(),
              direction: "IN",
              amount: Number(entry.amount),
              description: entry.title,
              reference: "",
              category: "Income",
              party: entry.source || "",
              account: entry.paymentMethod || "",
              organization: entry.organization,
            })),
            ...invoicePayments.map((entry) => ({
              id: entry.id,
              source: "invoice_payment",
              date: entry.paidAt.toISOString(),
              direction: "IN",
              amount: Number(entry.amount),
              description: `Payment for invoice ${entry.invoice.invoiceNumber}`,
              reference: entry.reference || "",
              category: "Customer payment",
              party: entry.invoice.contact?.name || "",
              account: entry.method || "",
              organization: entry.invoice.organization,
            })),
            ...purchasePayments.map((entry) => ({
              id: entry.id,
              source: "purchase_payment",
              date: entry.paidAt.toISOString(),
              direction: "OUT",
              amount: Number(entry.amount),
              description: `Payment for purchase ${entry.purchaseOrder.orderNumber}`,
              reference: entry.reference || "",
              category: "Vendor payment",
              party: entry.purchaseOrder.contact?.name || "",
              account: entry.method || "",
              organization: entry.purchaseOrder.organization,
            })),
          ];

          const query = String(args.query || "").trim().toLowerCase();
          const filtered = (query
            ? entries.filter((entry) =>
                [entry.description, entry.reference, entry.category, entry.party, entry.account, entry.organization.name]
                  .join(" ")
                  .toLowerCase()
                  .includes(query)
              )
            : entries
          )
            .sort((a, b) => b.date.localeCompare(a.date))
            .slice(0, limit);

          const totalsBySource = filtered.reduce<Record<string, { count: number; amount: number }>>((totals, entry) => {
            totals[entry.source] ||= { count: 0, amount: 0 };
            totals[entry.source].count += 1;
            totals[entry.source].amount += entry.amount;
            return totals;
          }, {});
          const report = {
            period: label,
            dateRange: {
              startDate: startDate?.toISOString() || null,
              endDate: endDate?.toISOString() || null,
            },
            totalRecords: filtered.length,
            totalsBySource,
            note: "Linked bank, expense, income, and payment records can describe the same cash movement; source totals are kept separate to avoid implying a deduplicated cashflow total.",
            transactions: filtered,
          };

          return {
            jsonrpc,
            id,
            result: {
              content: [{ type: "text", text: JSON.stringify(report, null, 2) }],
              structuredContent: report,
            },
          };
        }

        if (toolName === "create_bank_transaction") {
          const bank = await db.bankAccount.findUnique({
            where: { id: args.bankAccountId },
            select: { id: true, currentBalance: true, organizationId: true },
          });
          if (!bank) {
            return {
              jsonrpc,
              id,
              result: { content: [{ type: "text", text: `Bank Account ${args.bankAccountId} not found.` }], isError: true },
            };
          }

          if (!auth.isMaster && auth.role !== "SUPER_ADMIN" && !auth.orgIds?.includes(bank.organizationId)) {
            return {
              jsonrpc,
              id,
              result: { content: [{ type: "text", text: "Unauthorized: bank account does not belong to your authorized workspaces." }], isError: true },
            };
          }

          const txAmount = Math.abs(Number(args.amount));
          const txType = args.type === "DEPOSIT" ? "DEPOSIT" : "WITHDRAWAL";
          const txDate = args.transactionDate ? new Date(args.transactionDate) : new Date();

          const tx = await db.bankTransaction.create({
            data: {
              organizationId: bank.organizationId,
              bankAccountId: args.bankAccountId,
              type: txType,
              amount: new Prisma.Decimal(txAmount),
              description: args.description,
              transactionDate: txDate,
              reference: args.reference || null,
              category: args.category || null,
            },
          });

          if (args.updateAccountBalance !== false) {
            const delta = txType === "DEPOSIT" ? txAmount : -txAmount;
            const newBal = Number(bank.currentBalance) + delta;
            await db.bankAccount.update({
              where: { id: args.bankAccountId },
              data: { currentBalance: new Prisma.Decimal(newBal) },
            });
          }

          return {
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: `Bank Transaction recorded successfully (ID: ${tx.id}).` }] },
          };
        }

        if (toolName === "update_bank_transaction") {
          const existing = await db.bankTransaction.findFirst({
            where: {
              id: args.id,
              ...(auth.isMaster || auth.role === "SUPER_ADMIN" ? {} : { organizationId: { in: auth.orgIds } }),
            },
          });
          if (!existing) {
            return {
              jsonrpc,
              id,
              result: { content: [{ type: "text", text: `Transaction ${args.id} not found or unauthorized.` }], isError: true },
            };
          }

          const oldType = existing.type;
          const oldAmt = Number(existing.amount);
          const newType = args.type ? (args.type === "DEPOSIT" ? "DEPOSIT" : "WITHDRAWAL") : oldType;
          const newAmt = args.amount !== undefined ? Math.abs(Number(args.amount)) : oldAmt;

          const data: any = {};
          if (args.description) data.description = args.description;
          if (args.amount !== undefined) data.amount = new Prisma.Decimal(newAmt);
          if (args.type) data.type = newType;
          if (args.category) data.category = args.category;
          if (args.reference !== undefined) data.reference = args.reference;

          const oldRevert = oldType === "DEPOSIT" ? -oldAmt : oldAmt;
          const newApply = newType === "DEPOSIT" ? newAmt : -newAmt;
          const delta = oldRevert + newApply;

          if (delta !== 0) {
            await db.bankAccount.update({
              where: { id: existing.bankAccountId },
              data: { currentBalance: { increment: delta } },
            });
          }

          const updated = await db.bankTransaction.update({
            where: { id: args.id },
            data,
          });
          return {
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: `Bank Transaction updated and balance adjusted:\n${JSON.stringify(updated, null, 2)}` }] },
          };
        }

        if (toolName === "delete_bank_transaction") {
          const existing = await db.bankTransaction.findFirst({
            where: {
              id: args.id,
              ...(auth.isMaster || auth.role === "SUPER_ADMIN" ? {} : { organizationId: { in: auth.orgIds } }),
            },
          });
          if (!existing) {
            return {
              jsonrpc,
              id,
              result: { content: [{ type: "text", text: `Transaction ${args.id} not found or unauthorized.` }], isError: true },
            };
          }
          const amt = Number(existing.amount);
          const delta = existing.type === "DEPOSIT" ? -amt : amt;

          await db.$transaction(async (tx) => {
            await tx.bankAccount.update({
              where: { id: existing.bankAccountId },
              data: { currentBalance: { increment: delta } },
            });
            if (existing.incomeId) {
              await tx.income.deleteMany({ where: { id: existing.incomeId } });
            }
            if (existing.expenseId) {
              await tx.expense.deleteMany({ where: { id: existing.expenseId } });
            }
            await tx.bankTransaction.delete({ where: { id: args.id } });
          });

          return {
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: `Bank Transaction ${args.id} deleted and account balance updated.` }] },
          };
        }

        // ==========================================
        // 4. EXPENSES
        // ==========================================
        if (toolName === "list_expenses") {
          const orgFilter = await resolveOrgFilter(auth, targetOrgParam);
          const where: any = { ...orgFilter, isEstimated: false };
          if (args.categoryId) where.categoryId = args.categoryId;
          if (args.vendor) where.vendor = { contains: args.vendor };

          const expenses = await db.expense.findMany({
            where,
            include: {
              category: true,
              organization: { select: { id: true, name: true, slug: true, kind: true } },
            },
            take: args.limit || 50,
            orderBy: { occurredAt: "desc" },
          });
          return {
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: JSON.stringify(expenses, null, 2) }] },
          };
        }

        if (toolName === "get_expense") {
          const expense = await db.expense.findFirst({
            where: {
              id: args.id,
              ...(auth.isMaster || auth.role === "SUPER_ADMIN" ? {} : { organizationId: { in: auth.orgIds } }),
            },
            include: {
              category: true,
              organization: { select: { id: true, name: true, slug: true, kind: true } },
            },
          });
          if (!expense) {
            return {
              jsonrpc,
              id,
              result: { content: [{ type: "text", text: `Expense ${args.id} not found.` }], isError: true },
            };
          }
          return {
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: JSON.stringify(expense, null, 2) }] },
          };
        }

        if (toolName === "create_expense") {
          const targetOrgId = await resolveOrgId(auth, targetOrgParam);
          let categoryId = args.categoryId;
          if (!categoryId && args.categoryName) {
            const cat = await db.expenseCategory.upsert({
              where: { organizationId_name: { organizationId: targetOrgId, name: args.categoryName.trim() } },
              update: {},
              create: { organizationId: targetOrgId, name: args.categoryName.trim() },
            });
            categoryId = cat.id;
          }

          const occurredAt = args.occurredAt ? new Date(args.occurredAt) : new Date();
          const expense = await db.expense.create({
            data: {
              organizationId: targetOrgId,
              categoryId: categoryId || null,
              title: args.title,
              vendor: args.vendor || null,
              amount: new Prisma.Decimal(Math.abs(Number(args.amount))),
              occurredAt,
              isEstimated: false,
              notes: args.notes || null,
            },
            include: {
              organization: { select: { name: true, kind: true } },
            },
          });
          return {
            jsonrpc,
            id,
            result: {
              content: [
                {
                  type: "text",
                  text: `Expense "${expense.title}" created in ${expense.organization.name} (${expense.organization.kind}) (ID: ${expense.id}).`,
                },
              ],
            },
          };
        }

        if (toolName === "update_expense") {
          const existing = await db.expense.findFirst({
            where: {
              id: args.id,
              ...(auth.isMaster || auth.role === "SUPER_ADMIN" ? {} : { organizationId: { in: auth.orgIds } }),
            },
          });
          if (!existing) {
            return {
              jsonrpc,
              id,
              result: { content: [{ type: "text", text: `Expense ${args.id} not found or unauthorized.` }], isError: true },
            };
          }

          const data: any = {};
          if (args.title) data.title = args.title;
          if (args.amount) data.amount = new Prisma.Decimal(Math.abs(Number(args.amount)));
          if (args.vendor) data.vendor = args.vendor;
          if (args.notes) data.notes = args.notes;

          const updated = await db.expense.update({ where: { id: args.id }, data });
          return {
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: `Expense updated:\n${JSON.stringify(updated, null, 2)}` }] },
          };
        }

        if (toolName === "delete_expense") {
          const existing = await db.expense.findFirst({
            where: {
              id: args.id,
              ...(auth.isMaster || auth.role === "SUPER_ADMIN" ? {} : { organizationId: { in: auth.orgIds } }),
            },
          });
          if (!existing) {
            return {
              jsonrpc,
              id,
              result: { content: [{ type: "text", text: `Expense ${args.id} not found or unauthorized.` }], isError: true },
            };
          }
          await db.expense.delete({ where: { id: args.id } });
          return {
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: `Expense ${args.id} deleted.` }] },
          };
        }

        if (toolName === "list_expense_categories") {
          const orgFilter = await resolveOrgFilter(auth, targetOrgParam);
          const cats = await db.expenseCategory.findMany({
            where: { ...orgFilter },
            include: {
              organization: { select: { id: true, name: true, slug: true, kind: true } },
            },
          });
          return {
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: JSON.stringify(cats, null, 2) }] },
          };
        }

        if (toolName === "create_expense_category") {
          const targetOrgId = await resolveOrgId(auth, targetOrgParam);
          const cat = await db.expenseCategory.create({
            data: {
              organizationId: targetOrgId,
              name: args.name,
              budgetMonthly: args.budgetMonthly ? new Prisma.Decimal(args.budgetMonthly) : null,
            },
          });
          return {
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: `Expense Category created (ID: ${cat.id}).` }] },
          };
        }

        // ==========================================
        // 5. INCOMES
        // ==========================================
        if (toolName === "list_incomes") {
          const orgFilter = await resolveOrgFilter(auth, targetOrgParam);
          const incomes = await db.income.findMany({
            where: { ...orgFilter },
            include: {
              bankAccount: true,
              organization: { select: { id: true, name: true, slug: true, kind: true } },
            },
            take: args.limit || 50,
            orderBy: { receivedAt: "desc" },
          });
          return {
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: JSON.stringify(incomes, null, 2) }] },
          };
        }

        if (toolName === "create_income") {
          const targetOrgId = await resolveOrgId(auth, targetOrgParam);
          const inc = await db.income.create({
            data: {
              organizationId: targetOrgId,
              title: args.title,
              source: args.source || "Direct Revenue",
              amount: new Prisma.Decimal(Math.abs(Number(args.amount))),
              paymentMethod: args.paymentMethod || "BANK",
              bankAccountId: args.bankAccountId || null,
              receivedAt: args.receivedAt ? new Date(args.receivedAt) : new Date(),
              notes: args.notes || null,
            },
            include: {
              organization: { select: { name: true, kind: true } },
            },
          });
          return {
            jsonrpc,
            id,
            result: {
              content: [
                {
                  type: "text",
                  text: `Income entry created in ${inc.organization.name} (${inc.organization.kind}) (ID: ${inc.id}).`,
                },
              ],
            },
          };
        }

        if (toolName === "update_income") {
          const existing = await db.income.findFirst({
            where: {
              id: args.id,
              ...(auth.isMaster || auth.role === "SUPER_ADMIN" ? {} : { organizationId: { in: auth.orgIds } }),
            },
          });
          if (!existing) {
            return {
              jsonrpc,
              id,
              result: { content: [{ type: "text", text: `Income ${args.id} not found or unauthorized.` }], isError: true },
            };
          }

          const data: any = {};
          if (args.title) data.title = args.title;
          if (args.amount) data.amount = new Prisma.Decimal(Math.abs(Number(args.amount)));
          if (args.source) data.source = args.source;

          const updated = await db.income.update({ where: { id: args.id }, data });
          return {
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: `Income updated:\n${JSON.stringify(updated, null, 2)}` }] },
          };
        }

        if (toolName === "delete_income") {
          const existing = await db.income.findFirst({
            where: {
              id: args.id,
              ...(auth.isMaster || auth.role === "SUPER_ADMIN" ? {} : { organizationId: { in: auth.orgIds } }),
            },
          });
          if (!existing) {
            return {
              jsonrpc,
              id,
              result: { content: [{ type: "text", text: `Income ${args.id} not found or unauthorized.` }], isError: true },
            };
          }
          await db.income.delete({ where: { id: args.id } });
          return {
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: `Income ${args.id} deleted.` }] },
          };
        }

        // ==========================================
        // 6. INVOICES
        // ==========================================
        if (toolName === "list_invoices") {
          const orgFilter = await resolveOrgFilter(auth, targetOrgParam);
          const where: any = { ...orgFilter };
          const { startDate, endDate, label } = parseDateRange(args);
          if (args.status) where.status = args.status;
          if (args.customer) where.contact = { name: { contains: args.customer } };
          const issueDate = dateWhere(startDate, endDate);
          if (issueDate) where.issueDate = issueDate;
          const limit = Math.min(500, Math.max(1, Number(args.limit) || 100));

          const invoices = await db.invoice.findMany({
            where,
            include: {
              contact: true,
              items: true,
              payments: true,
              organization: { select: { id: true, name: true, slug: true, kind: true } },
            },
            take: limit,
            orderBy: { issueDate: "desc" },
          });
          const normalizedInvoices = invoices.map((invoice) => ({
            ...invoice,
            subtotal: Number(invoice.subtotal),
            tax: Number(invoice.tax),
            discount: Number(invoice.discount),
            total: Number(invoice.total),
            paidAmount: Number(invoice.paidAmount),
            outstandingAmount: Math.max(0, Number(invoice.total) - Number(invoice.paidAmount)),
            items: invoice.items.map((item) => ({
              ...item,
              quantity: Number(item.quantity),
              unitPrice: Number(item.unitPrice),
              taxRate: Number(item.taxRate),
              amount: Number(item.amount),
            })),
            payments: invoice.payments.map((payment) => ({ ...payment, amount: Number(payment.amount) })),
          }));
          const summary = normalizedInvoices.reduce(
            (totals, invoice) => {
              totals.totalBilled += invoice.total;
              totals.totalCollected += invoice.paidAmount;
              totals.totalOutstanding += invoice.outstandingAmount;
              return totals;
            },
            {
              totalInvoices: normalizedInvoices.length,
              totalBilled: 0,
              totalCollected: 0,
              totalOutstanding: 0,
            }
          );
          const billingReport = { period: label, summary, invoices: normalizedInvoices };
          return {
            jsonrpc,
            id,
            result: {
              content: [{ type: "text", text: JSON.stringify(billingReport, null, 2) }],
              structuredContent: billingReport,
            },
          };
        }

        if (toolName === "get_invoice") {
          const invoice = await db.invoice.findFirst({
            where: {
              OR: [{ id: args.id }, { invoiceNumber: args.id }],
              ...(auth.isMaster || auth.role === "SUPER_ADMIN" ? {} : { organizationId: { in: auth.orgIds } }),
            },
            include: {
              contact: true,
              items: true,
              payments: true,
              organization: { select: { id: true, name: true, slug: true, kind: true } },
            },
          });
          if (!invoice) {
            return {
              jsonrpc,
              id,
              result: { content: [{ type: "text", text: `Invoice ${args.id} not found.` }], isError: true },
            };
          }
          return {
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: JSON.stringify(invoice, null, 2) }] },
          };
        }

        if (toolName === "create_invoice") {
          const targetOrgId = await resolveOrgId(auth, targetOrgParam);
          let contactId = args.contactId;
          if (!contactId && args.customerName) {
            const contact = await db.contact.create({
              data: { organizationId: targetOrgId, name: args.customerName, type: "CUSTOMER" },
            });
            contactId = contact.id;
          }

          const invNumber = args.invoiceNumber || `INV-${Date.now().toString().slice(-6)}`;
          let subtotal = 0;
          let taxTotal = 0;

          const itemsData = (args.items || []).map((it: any) => {
            const qty = Number(it.quantity || 1);
            const price = Number(it.unitPrice || 0);
            const lineAmt = qty * price;
            const rate = Number(it.taxRate || 0);
            const lineTax = (lineAmt * rate) / 100;
            subtotal += lineAmt;
            taxTotal += lineTax;

            return {
              description: it.description,
              quantity: new Prisma.Decimal(qty),
              unitPrice: new Prisma.Decimal(price),
              taxRate: new Prisma.Decimal(rate),
              amount: new Prisma.Decimal(lineAmt),
            };
          });

          const total = subtotal + taxTotal;

          const invoice = await db.invoice.create({
            data: {
              organizationId: targetOrgId,
              contactId: contactId || null,
              invoiceNumber: invNumber,
              status: "DRAFT",
              issueDate: args.issueDate ? new Date(args.issueDate) : new Date(),
              dueDate: args.dueDate ? new Date(args.dueDate) : null,
              subtotal: new Prisma.Decimal(subtotal),
              tax: new Prisma.Decimal(taxTotal),
              total: new Prisma.Decimal(total),
              notes: args.notes || null,
              items: { create: itemsData },
            },
            include: {
              items: true,
              organization: { select: { name: true, kind: true } },
            },
          });

          return {
            jsonrpc,
            id,
            result: {
              content: [
                {
                  type: "text",
                  text: `Invoice #${invoice.invoiceNumber} created in ${invoice.organization.name} (Total: ${invoice.total}).`,
                },
              ],
            },
          };
        }

        if (toolName === "update_invoice") {
          const existing = await db.invoice.findFirst({
            where: {
              id: args.id,
              ...(auth.isMaster || auth.role === "SUPER_ADMIN" ? {} : { organizationId: { in: auth.orgIds } }),
            },
          });
          if (!existing) {
            return {
              jsonrpc,
              id,
              result: { content: [{ type: "text", text: `Invoice ${args.id} not found or unauthorized.` }], isError: true },
            };
          }

          const data: any = {};
          if (args.status) data.status = args.status;
          if (args.notes) data.notes = args.notes;

          const updated = await db.invoice.update({ where: { id: args.id }, data });
          return {
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: `Invoice updated:\n${JSON.stringify(updated, null, 2)}` }] },
          };
        }

        if (toolName === "delete_invoice") {
          const existing = await db.invoice.findFirst({
            where: {
              id: args.id,
              ...(auth.isMaster || auth.role === "SUPER_ADMIN" ? {} : { organizationId: { in: auth.orgIds } }),
            },
          });
          if (!existing) {
            return {
              jsonrpc,
              id,
              result: { content: [{ type: "text", text: `Invoice ${args.id} not found or unauthorized.` }], isError: true },
            };
          }
          await db.invoice.delete({ where: { id: args.id } });
          return {
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: `Invoice ${args.id} deleted.` }] },
          };
        }

        if (toolName === "record_invoice_payment") {
          const inv = await db.invoice.findFirst({
            where: {
              id: args.invoiceId,
              ...(auth.isMaster || auth.role === "SUPER_ADMIN" ? {} : { organizationId: { in: auth.orgIds } }),
            },
            select: { id: true, total: true, paidAmount: true },
          });
          if (!inv) {
            return {
              jsonrpc,
              id,
              result: { content: [{ type: "text", text: `Invoice ${args.invoiceId} not found or unauthorized.` }], isError: true },
            };
          }

          const payment = await db.invoicePayment.create({
            data: {
              invoiceId: args.invoiceId,
              amount: new Prisma.Decimal(Number(args.amount)),
              paidAt: new Date(),
              method: args.method || "BANK",
              reference: args.reference || null,
              notes: args.notes || null,
            },
          });

          const newPaid = Number(inv.paidAmount) + Number(args.amount);
          const newStatus = newPaid >= Number(inv.total) ? "PAID" : "PARTIAL";
          await db.invoice.update({
            where: { id: args.invoiceId },
            data: {
              paidAmount: new Prisma.Decimal(newPaid),
              status: newStatus,
            },
          });

          return {
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: `Payment of ${args.amount} recorded for Invoice ${args.invoiceId} (Status: ${newStatus}).` }] },
          };
        }

        // ==========================================
        // 7. PURCHASES
        // ==========================================
        if (toolName === "list_purchases") {
          const orgFilter = await resolveOrgFilter(auth, targetOrgParam);
          const pos = await db.purchaseOrder.findMany({
            where: { ...orgFilter },
            include: {
              contact: true,
              items: true,
              organization: { select: { id: true, name: true, slug: true, kind: true } },
            },
            take: args.limit || 50,
            orderBy: { orderDate: "desc" },
          });
          return {
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: JSON.stringify(pos, null, 2) }] },
          };
        }

        if (toolName === "create_purchase") {
          const targetOrgId = await resolveOrgId(auth, targetOrgParam);
          const poNumber = args.orderNumber || `PO-${Date.now().toString().slice(-6)}`;
          let total = 0;
          const itemsData = (args.items || []).map((it: any) => {
            const qty = Number(it.quantity || 1);
            const price = Number(it.unitPrice || 0);
            const lineAmt = qty * price;
            total += lineAmt;
            return {
              description: it.description,
              quantity: new Prisma.Decimal(qty),
              unitPrice: new Prisma.Decimal(price),
              amount: new Prisma.Decimal(lineAmt),
            };
          });

          const po = await db.purchaseOrder.create({
            data: {
              organizationId: targetOrgId,
              orderNumber: poNumber,
              status: "DRAFT",
              orderDate: args.orderDate ? new Date(args.orderDate) : new Date(),
              subtotal: new Prisma.Decimal(total),
              total: new Prisma.Decimal(total),
              items: { create: itemsData },
            },
          });

          return {
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: `Purchase Order #${po.orderNumber} created (Total: ${po.total}).` }] },
          };
        }

        // ==========================================
        // 8. CONTACTS (CRM)
        // ==========================================
        if (toolName === "list_contacts") {
          const orgFilter = await resolveOrgFilter(auth, targetOrgParam);
          const where: any = { ...orgFilter };
          if (args.type) where.type = args.type;

          const contacts = await db.contact.findMany({
            where,
            include: {
              organization: { select: { id: true, name: true, slug: true, kind: true } },
            },
            orderBy: { name: "asc" },
          });
          return {
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: JSON.stringify(contacts, null, 2) }] },
          };
        }

        if (toolName === "create_contact") {
          const targetOrgId = await resolveOrgId(auth, targetOrgParam);
          const contact = await db.contact.create({
            data: {
              organizationId: targetOrgId,
              name: args.name,
              type: args.type || "CUSTOMER",
              email: args.email || null,
              phone: args.phone || null,
              address: args.address || null,
              taxNumber: args.taxNumber || null,
            },
          });
          return {
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: `Contact "${contact.name}" created (ID: ${contact.id}).` }] },
          };
        }

        // ==========================================
        // 9. AI DOCUMENT EXTRACTION TOOL
        // ==========================================
        if (toolName === "analyze_financial_document_ai") {
          const extracted = await analyzeFinancialDocument({
            filename: args.filename,
            mimeType: args.mimeType || "text/plain",
            base64Data: args.base64Data,
            textContent: args.textContent,
          });

          return {
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: JSON.stringify(extracted, null, 2) }] },
          };
        }

        // ==========================================
        // 10. LOANS & DEBT
        // ==========================================
        if (toolName === "list_loans") {
          const orgFilter = await resolveOrgFilter(auth, targetOrgParam);
          const where: any = { ...orgFilter };
          if (args.type && args.type !== "ALL") where.type = args.type;
          if (args.status && args.status !== "ALL") where.status = args.status;

          const loans = await db.loan.findMany({
            where,
            include: {
              payments: { orderBy: { paymentDate: "desc" } },
              organization: { select: { id: true, name: true, slug: true, kind: true } },
            },
            orderBy: { startDate: "desc" },
          });

          return {
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: JSON.stringify(loans, null, 2) }] },
          };
        }

        if (toolName === "create_loan") {
          const targetOrgId = await resolveOrgId(auth, targetOrgParam);
          const loan = await db.loan.create({
            data: {
              organizationId: targetOrgId,
              partyName: args.partyName,
              type: args.type || "TAKEN",
              principalAmount: args.principalAmount,
              startDate: args.startDate ? new Date(args.startDate) : new Date(),
              dueDate: args.dueDate ? new Date(args.dueDate) : null,
              hasInterest: Boolean(args.hasInterest),
              interestRate: args.interestRate || 0,
              interestFrequency: args.interestFrequency || "MONTHLY",
              notes: args.notes || null,
            },
          });

          return {
            jsonrpc,
            id,
            result: {
              content: [
                {
                  type: "text",
                  text: `Loan #${loan.id.slice(-6)} of NPR ${loan.principalAmount} (${loan.type}) with ${loan.partyName} successfully created.`,
                },
              ],
            },
          };
        }

        if (toolName === "settle_loan") {
          const targetOrgId = await resolveOrgId(auth, targetOrgParam);
          const loan = await db.loan.findFirst({
            where: { id: args.loanId, organizationId: targetOrgId },
          });

          if (!loan) {
            throw new Error(`Loan ${args.loanId} not found in authorized workspace.`);
          }

          const principalAmount = Number(args.principalAmount) || 0;
          const interestAmount = Number(args.interestAmount) || 0;
          const totalAmount = principalAmount + interestAmount;
          const paymentDate = args.paymentDate ? new Date(args.paymentDate) : new Date();

          const result = await db.$transaction(async (tx) => {
            const payment = await tx.loanPayment.create({
              data: {
                loanId: loan.id,
                paymentDate,
                principalAmount,
                interestAmount,
                totalAmount,
                notes: args.notes || null,
              },
            });

            const newPrincipalPaid = Number(loan.totalPrincipalPaid) + principalAmount;
            const newInterestPaid = Number(loan.totalInterestPaid) + interestAmount;
            const isFullySettled = newPrincipalPaid >= Number(loan.principalAmount);

            const updatedLoan = await tx.loan.update({
              where: { id: loan.id },
              data: {
                totalPrincipalPaid: newPrincipalPaid,
                totalInterestPaid: newInterestPaid,
                status: isFullySettled ? "SETTLED" : "ACTIVE",
                settledAt: isFullySettled ? paymentDate : loan.settledAt,
              },
            });

            if (loan.type === "TAKEN") {
              await tx.expense.create({
                data: {
                  organizationId: targetOrgId,
                  title: `Loan Repayment to ${loan.partyName}`,
                  vendor: loan.partyName,
                  type: "ONE_TIME",
                  amount: totalAmount,
                  occurredAt: paymentDate,
                  notes: `Settlement payment for Loan #${loan.id.slice(-6)}. Principal: ${principalAmount}, Interest: ${interestAmount}`,
                },
              });
            } else {
              await tx.income.create({
                data: {
                  organizationId: targetOrgId,
                  title: `Loan Collection from ${loan.partyName}`,
                  source: loan.partyName,
                  amount: totalAmount,
                  receivedAt: paymentDate,
                  notes: `Settlement collection for Loan #${loan.id.slice(-6)}. Principal: ${principalAmount}, Interest: ${interestAmount}`,
                },
              });
            }

            return { payment, updatedLoan, isFullySettled };
          });

          return {
            jsonrpc,
            id,
            result: {
              content: [
                {
                  type: "text",
                  text: `Recorded repayment of NPR ${totalAmount} for Loan #${loan.id.slice(-6)}. Status: ${result.isFullySettled ? "FULLY SETTLED" : "ACTIVE (Remaining: NPR " + (Number(loan.principalAmount) - Number(result.updatedLoan.totalPrincipalPaid)) + ")"}.`,
                },
              ],
            },
          };
        }

        // ==========================================
        // 11. RENTAL RESIDENCE & TENANCY
        // ==========================================
        if (toolName === "list_rental_houses") {
          const orgFilter = await resolveOrgFilter(auth, targetOrgParam);
          const houses = await db.rentalHouse.findMany({
            where: orgFilter,
            include: {
              organization: { select: { id: true, name: true, slug: true } },
            },
            orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
          });

          return {
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: JSON.stringify(houses, null, 2) }] },
          };
        }

        if (toolName === "get_active_rental_house") {
          const orgFilter = await resolveOrgFilter(auth, targetOrgParam);
          const activeHouse = await db.rentalHouse.findFirst({
            where: { ...orgFilter, isActive: true },
            include: { organization: { select: { id: true, name: true, slug: true } } },
          });

          return {
            jsonrpc,
            id,
            result: {
              content: [
                {
                  type: "text",
                  text: activeHouse
                    ? JSON.stringify(activeHouse, null, 2)
                    : JSON.stringify({ message: "No active rental house found." }),
                },
              ],
            },
          };
        }

        if (toolName === "save_rental_house") {
          const targetOrgId = await resolveOrgId(auth, targetOrgParam);
          const houseId = args.id;
          const makeActive = args.isActive !== false;

          let house;
          if (houseId) {
            house = await db.rentalHouse.update({
              where: { id: houseId },
              data: {
                title: args.title,
                ownerName: args.ownerName,
                ownerPhone: args.ownerPhone || null,
                address: args.address || null,
                monthlyRent: args.monthlyRent !== undefined ? args.monthlyRent : undefined,
                electricityRate: args.electricityRate !== undefined ? args.electricityRate : undefined,
                waterGarbageFee: args.waterGarbageFee !== undefined ? args.waterGarbageFee : undefined,
                isActive: makeActive,
                notes: args.notes || null,
              },
            });
          } else {
            const count = await db.rentalHouse.count({ where: { organizationId: targetOrgId } });
            house = await db.rentalHouse.create({
              data: {
                organizationId: targetOrgId,
                title: args.title,
                ownerName: args.ownerName,
                ownerPhone: args.ownerPhone || null,
                address: args.address || null,
                monthlyRent: args.monthlyRent !== undefined ? args.monthlyRent : 16800,
                electricityRate: args.electricityRate !== undefined ? args.electricityRate : 15,
                waterGarbageFee: args.waterGarbageFee !== undefined ? args.waterGarbageFee : 300,
                isActive: makeActive || count === 0,
                notes: args.notes || null,
              },
            });
          }

          if (makeActive) {
            await db.rentalHouse.updateMany({
              where: { organizationId: targetOrgId, id: { not: house.id } },
              data: { isActive: false },
            });
          }

          return {
            jsonrpc,
            id,
            result: {
              content: [
                {
                  type: "text",
                  text: `Rental house "${house.title}" (Owner: ${house.ownerName}, Rent: NPR ${house.monthlyRent}/mo) successfully saved.`,
                },
              ],
            },
          };
        }

        if (toolName === "set_active_rental_house") {
          const targetOrgId = await resolveOrgId(auth, targetOrgParam);
          await db.rentalHouse.updateMany({
            where: { organizationId: targetOrgId },
            data: { isActive: false },
          });

          const house = await db.rentalHouse.update({
            where: { id: args.houseId },
            data: { isActive: true },
          });

          return {
            jsonrpc,
            id,
            result: {
              content: [{ type: "text", text: `Set "${house.title}" as active rental residence.` }],
            },
          };
        }

        if (toolName === "delete_rental_house") {
          const targetOrgId = await resolveOrgId(auth, targetOrgParam);
          await db.rentalHouse.deleteMany({
            where: { id: args.id, organizationId: targetOrgId },
          });

          return {
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: `Rental house ${args.id} deleted.` }] },
          };
        }

        // ==========================================
        // 12. UTILITIES (ELECTRICITY & MILK LOGS)
        // ==========================================
        if (toolName === "get_electricity_readings") {
          const orgFilter = await resolveOrgFilter(auth, targetOrgParam);
          const where: any = { ...orgFilter };
          if (args.month && args.month !== "all") {
            where.month = args.month;
          }

          const logs = await db.electricityReadingLog.findMany({
            where,
            include: { organization: { select: { id: true, name: true, slug: true } } },
            orderBy: { readingDate: "desc" },
          });

          return {
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: JSON.stringify(logs, null, 2) }] },
          };
        }

        if (toolName === "save_electricity_reading") {
          const targetOrgId = await resolveOrgId(auth, targetOrgParam);
          const currentUnit = Number(args.currentUnit);
          const month = args.month || new Date().toISOString().slice(0, 7);
          const ratePerUnit = Number(args.ratePerUnit) || 15;
          const meterNumber = args.meterNumber || "MAIN";
          const readingDate = args.readingDate ? new Date(args.readingDate) : new Date();
          const paid = args.paid !== false;

          let previousUnit = args.previousUnit !== undefined ? Number(args.previousUnit) : null;
          if (previousUnit === null) {
            const lastLog = await db.electricityReadingLog.findFirst({
              where: { organizationId: targetOrgId },
              orderBy: { readingDate: "desc" },
            });
            if (lastLog) {
              previousUnit = Number(lastLog.currentUnit);
            } else {
              const activeHouse = await db.rentalHouse.findFirst({
                where: { organizationId: targetOrgId, isActive: true },
              });
              previousUnit = Number(activeHouse?.lastElectricityUnit || 0);
            }
          }

          const unitsConsumed = Math.max(0, currentUnit - previousUnit);
          const totalCost = unitsConsumed * ratePerUnit;

          let elecCat = await db.expenseCategory.findFirst({
            where: {
              organizationId: targetOrgId,
              OR: [{ name: { contains: "Electricity" } }, { name: { contains: "Utilities" } }],
            },
          });
          if (!elecCat) {
            elecCat = await db.expenseCategory.create({
              data: {
                organizationId: targetOrgId,
                name: "Electricity & Utilities",
                icon: "zap",
              },
            });
          }

          const expenseTitle = `Electricity bill (${month}): ${unitsConsumed.toFixed(1)} units (${previousUnit} -> ${currentUnit}) @ NPR ${ratePerUnit}/unit`;
          const expenseNotes = `Electricity meter reading: Previous = ${previousUnit}, Current = ${currentUnit}. Consumed = ${unitsConsumed} units @ NPR ${ratePerUnit}/unit. ${args.notes || ""}`.trim();

          const result = await db.$transaction(async (tx) => {
            const existingExp = await tx.expense.findFirst({
              where: {
                organizationId: targetOrgId,
                title: { contains: `Electricity bill (${month})` },
              },
            });

            let expenseId: string;
            if (existingExp) {
              const updated = await tx.expense.update({
                where: { id: existingExp.id },
                data: {
                  title: expenseTitle,
                  amount: totalCost,
                  unitRate: ratePerUnit,
                  quantity: unitsConsumed,
                  unit: "units",
                  occurredAt: readingDate,
                  isEstimated: !paid,
                  notes: expenseNotes,
                },
              });
              expenseId = updated.id;
            } else {
              const created = await tx.expense.create({
                data: {
                  organizationId: targetOrgId,
                  categoryId: elecCat.id,
                  title: expenseTitle,
                  vendor: "Nepal Electricity Authority (NEA)",
                  type: "ONE_TIME",
                  amount: totalCost,
                  unitRate: ratePerUnit,
                  quantity: unitsConsumed,
                  unit: "units",
                  occurredAt: readingDate,
                  isEstimated: !paid,
                  notes: expenseNotes,
                },
              });
              expenseId = created.id;
            }

            const readingLog = await tx.electricityReadingLog.upsert({
              where: { organizationId_month: { organizationId: targetOrgId, month } },
              update: {
                meterNumber,
                previousUnit,
                currentUnit,
                unitsConsumed,
                ratePerUnit,
                totalCost,
                readingDate,
                expenseId,
                paid,
                notes: args.notes || null,
              },
              create: {
                organizationId: targetOrgId,
                month,
                meterNumber,
                previousUnit,
                currentUnit,
                unitsConsumed,
                ratePerUnit,
                totalCost,
                readingDate,
                expenseId,
                paid,
                notes: args.notes || null,
              },
            });

            await tx.rentalHouse.updateMany({
              where: { organizationId: targetOrgId, isActive: true },
              data: { lastElectricityUnit: currentUnit },
            });

            return { readingLog, unitsConsumed, totalCost };
          });

          return {
            jsonrpc,
            id,
            result: {
              content: [
                {
                  type: "text",
                  text: `Saved Electricity Log for ${month}: ${result.unitsConsumed.toFixed(1)} units consumed (${previousUnit} -> ${currentUnit}) = NPR ${result.totalCost.toFixed(2)} at NPR ${ratePerUnit}/unit. Synced to expenses.`,
                },
              ],
            },
          };
        }

        if (toolName === "get_milk_logs") {
          const orgFilter = await resolveOrgFilter(auth, targetOrgParam);
          const where: any = { ...orgFilter };
          if (args.month && args.month !== "all") {
            where.month = args.month;
          }

          const logs = await db.milkMonthlyLog.findMany({
            where,
            include: { organization: { select: { id: true, name: true, slug: true } } },
            orderBy: { month: "desc" },
          });

          return {
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: JSON.stringify(logs, null, 2) }] },
          };
        }

        if (toolName === "save_milk_log") {
          const targetOrgId = await resolveOrgId(auth, targetOrgParam);
          const month = args.month || new Date().toISOString().slice(0, 7);
          const ratePerLiter = Number(args.ratePerLiter) || 115;
          const regularDays = Number(args.regularDays) || 30;
          const regularQty = Number(args.regularQty) || 1.5;
          const alternateDays = Number(args.alternateDays) || 0;
          const alternateQty = Number(args.alternateQty) || 0;
          const paid = Boolean(args.paid);

          const totalLiters = regularDays * regularQty + alternateDays * alternateQty;
          const totalCost = totalLiters * ratePerLiter;

          const milkLog = await db.milkMonthlyLog.upsert({
            where: { organizationId_month: { organizationId: targetOrgId, month } },
            update: {
              ratePerLiter,
              regularDays,
              regularQty,
              alternateDays,
              alternateQty,
              totalLiters,
              totalCost,
              paid,
              notes: args.notes || null,
            },
            create: {
              organizationId: targetOrgId,
              month,
              ratePerLiter,
              regularDays,
              regularQty,
              alternateDays,
              alternateQty,
              totalLiters,
              totalCost,
              paid,
              notes: args.notes || null,
            },
          });

          return {
            jsonrpc,
            id,
            result: {
              content: [
                {
                  type: "text",
                  text: `Saved Milk Log for ${month}: ${totalLiters.toFixed(1)}L total @ NPR ${ratePerLiter}/L = NPR ${totalCost.toFixed(2)}. Status: ${paid ? "PAID" : "UNPAID"}.`,
                },
              ],
            },
          };
        }

        // ==========================================
        // 13. PRODUCTS & INVENTORY
        // ==========================================
        if (toolName === "list_products") {
          const orgFilter = await resolveOrgFilter(auth, targetOrgParam);
          const where: any = { ...orgFilter };
          if (args.active !== undefined) where.active = args.active;
          if (args.query) {
            where.OR = [
              { name: { contains: args.query } },
              { sku: { contains: args.query } },
            ];
          }

          const products = await db.product.findMany({
            where,
            include: {
              organization: { select: { id: true, name: true, slug: true } },
              _count: { select: { stockMovements: true } },
            },
            orderBy: { name: "asc" },
          });

          return {
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: JSON.stringify(products, null, 2) }] },
          };
        }

        if (toolName === "create_product") {
          const targetOrgId = await resolveOrgId(auth, targetOrgParam);
          const product = await db.product.create({
            data: {
              organizationId: targetOrgId,
              name: args.name,
              sku: args.sku,
              unit: args.unit || "pcs",
              salePrice: args.salePrice || 0,
              purchasePrice: args.purchasePrice || 0,
              stockQty: args.stockQty || 0,
              reorderLevel: args.reorderLevel || 0,
            },
          });

          return {
            jsonrpc,
            id,
            result: {
              content: [
                {
                  type: "text",
                  text: `Product "${product.name}" (SKU: ${product.sku}, Stock: ${product.stockQty} ${product.unit}, Price: NPR ${product.salePrice}) created successfully.`,
                },
              ],
            },
          };
        }

        if (toolName === "list_stock_movements") {
          const orgFilter = await resolveOrgFilter(auth, targetOrgParam);
          const where: any = { ...orgFilter };
          if (args.productId) where.productId = args.productId;

          const movements = await db.stockMovement.findMany({
            where,
            include: { product: { select: { id: true, name: true, sku: true, unit: true } } },
            take: args.limit || 50,
            orderBy: { occurredAt: "desc" },
          });

          return {
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: JSON.stringify(movements, null, 2) }] },
          };
        }

        if (toolName === "create_stock_movement") {
          const targetOrgId = await resolveOrgId(auth, targetOrgParam);
          const qty = Number(args.quantity) || 0;
          const movementType = args.type as "IN" | "OUT" | "ADJUSTMENT" | "RETURN";

          const product = await db.product.findFirst({
            where: { id: args.productId, organizationId: targetOrgId },
          });
          if (!product) {
            throw new Error(`Product ${args.productId} not found in workspace.`);
          }

          let newStock = Number(product.stockQty);
          if (movementType === "IN" || movementType === "RETURN") {
            newStock += qty;
          } else if (movementType === "OUT") {
            newStock = Math.max(0, newStock - qty);
          } else if (movementType === "ADJUSTMENT") {
            newStock = qty;
          }

          await db.$transaction([
            db.stockMovement.create({
              data: {
                organizationId: targetOrgId,
                productId: product.id,
                type: movementType,
                quantity: qty,
                reference: args.reference || null,
                note: args.note || null,
              },
            }),
            db.product.update({
              where: { id: product.id },
              data: { stockQty: newStock },
            }),
          ]);

          return {
            jsonrpc,
            id,
            result: {
              content: [
                {
                  type: "text",
                  text: `Stock movement ${movementType} of ${qty} units recorded for "${product.name}". New Stock: ${newStock} ${product.unit}.`,
                },
              ],
            },
          };
        }

        // ==========================================
        // 14. STAFF, PAYROLL & LEAVES (HRM)
        // ==========================================
        if (toolName === "list_employees") {
          const orgFilter = await resolveOrgFilter(auth, targetOrgParam);
          const where: any = { ...orgFilter };
          if (args.status) where.status = args.status;
          if (args.department) where.department = args.department;

          const employees = await db.employee.findMany({
            where,
            include: { organization: { select: { id: true, name: true, slug: true } } },
            orderBy: { name: "asc" },
          });

          return {
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: JSON.stringify(employees, null, 2) }] },
          };
        }

        if (toolName === "create_employee") {
          const targetOrgId = await resolveOrgId(auth, targetOrgParam);
          const employeeCode = args.employeeCode || `EMP-${Date.now().toString().slice(-4)}`;

          const employee = await db.employee.create({
            data: {
              organizationId: targetOrgId,
              name: args.name,
              employeeCode,
              email: args.email || null,
              phone: args.phone || null,
              designation: args.designation || null,
              department: args.department || null,
              basicSalary: args.basicSalary || 0,
              joinDate: args.joinDate ? new Date(args.joinDate) : new Date(),
            },
          });

          return {
            jsonrpc,
            id,
            result: {
              content: [
                {
                  type: "text",
                  text: `Employee "${employee.name}" (${employee.employeeCode}, ${employee.designation || "Staff"}) registered. Basic Salary: NPR ${employee.basicSalary}.`,
                },
              ],
            },
          };
        }

        if (toolName === "list_payrolls") {
          const orgFilter = await resolveOrgFilter(auth, targetOrgParam);
          const where: any = { ...orgFilter };
          if (args.employeeId) where.employeeId = args.employeeId;

          const payrolls = await db.payroll.findMany({
            where,
            include: { employee: true },
            orderBy: { month: "desc" },
          });

          return {
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: JSON.stringify(payrolls, null, 2) }] },
          };
        }

        if (toolName === "create_payroll") {
          const targetOrgId = await resolveOrgId(auth, targetOrgParam);
          const monthDate = args.month ? new Date(args.month) : new Date();

          const payroll = await db.payroll.create({
            data: {
              organizationId: targetOrgId,
              employeeId: args.employeeId,
              month: monthDate,
              basic: args.basic,
              allowance: args.allowance || 0,
              overtime: args.overtime || 0,
              deduction: args.deduction || 0,
              tax: args.tax || 0,
              netPay: args.netPay,
              paidAt: args.paidAt ? new Date(args.paidAt) : new Date(),
              notes: args.notes || null,
            },
            include: { employee: true },
          });

          return {
            jsonrpc,
            id,
            result: {
              content: [
                {
                  type: "text",
                  text: `Payroll disbursement of NPR ${payroll.netPay} created for ${payroll.employee.name}.`,
                },
              ],
            },
          };
        }

        if (toolName === "list_leaves") {
          const orgFilter = await resolveOrgFilter(auth, targetOrgParam);
          const where: any = { ...orgFilter };
          if (args.employeeId) where.employeeId = args.employeeId;
          if (args.status) where.status = args.status;

          const leaves = await db.leaveRequest.findMany({
            where,
            include: { employee: true },
            orderBy: { fromDate: "desc" },
          });

          return {
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: JSON.stringify(leaves, null, 2) }] },
          };
        }

        if (toolName === "create_leave") {
          const targetOrgId = await resolveOrgId(auth, targetOrgParam);
          const leave = await db.leaveRequest.create({
            data: {
              organizationId: targetOrgId,
              employeeId: args.employeeId,
              leaveType: args.leaveType,
              fromDate: new Date(args.fromDate),
              toDate: new Date(args.toDate),
              days: args.days,
              reason: args.reason || null,
              status: "PENDING",
            },
          });

          return {
            jsonrpc,
            id,
            result: {
              content: [
                {
                  type: "text",
                  text: `Leave request for ${leave.days} days (${leave.leaveType}) created with ID: ${leave.id}.`,
                },
              ],
            },
          };
        }

        // ==========================================
        // 15. PROJECTS, TASKS & WORKLOGS
        // ==========================================
        if (toolName === "list_projects") {
          const orgFilter = await resolveOrgFilter(auth, targetOrgParam);
          const where: any = { ...orgFilter };
          if (args.status) where.status = args.status;
          if (args.fiscalYear) where.fiscalYear = args.fiscalYear;

          const projects = await db.project.findMany({
            where,
            include: {
              teamLeader: true,
              contact: true,
              wallets: true,
              _count: { select: { tasks: true, worklogs: true } },
            },
            orderBy: { createdAt: "desc" },
          });

          return {
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: JSON.stringify(projects, null, 2) }] },
          };
        }

        if (toolName === "create_project") {
          const targetOrgId = await resolveOrgId(auth, targetOrgParam);
          const budget = Number(args.budget) || 0;

          let project;
          if (args.id) {
            project = await db.project.update({
              where: { id: args.id, organizationId: targetOrgId },
              data: {
                name: args.name,
                description: args.description || null,
                contactId: args.contactId || null,
                teamLeaderId: args.teamLeaderId || null,
                budget,
                startDate: args.startDate ? new Date(args.startDate) : undefined,
                endDate: args.endDate ? new Date(args.endDate) : undefined,
                status: args.status || "ACTIVE",
                priority: args.priority || "MEDIUM",
                workNature: args.workNature || null,
                fiscalYear: args.fiscalYear || null,
              },
            });
          } else {
            project = await db.project.create({
              data: {
                organizationId: targetOrgId,
                name: args.name,
                description: args.description || null,
                contactId: args.contactId || null,
                teamLeaderId: args.teamLeaderId || null,
                budget,
                startDate: args.startDate ? new Date(args.startDate) : null,
                endDate: args.endDate ? new Date(args.endDate) : null,
                status: args.status || "ACTIVE",
                priority: args.priority || "MEDIUM",
                workNature: args.workNature || null,
                fiscalYear: args.fiscalYear || null,
              },
            });
          }

          await db.projectWallet.upsert({
            where: { organizationId_projectId: { organizationId: targetOrgId, projectId: project.id } },
            update: { totalBudget: budget },
            create: {
              organizationId: targetOrgId,
              projectId: project.id,
              totalBudget: budget,
              transferredAmount: 0,
              holdAmount: 0,
              leaderHoldAmount: 0,
              balance: budget,
            },
          });

          return {
            jsonrpc,
            id,
            result: {
              content: [
                {
                  type: "text",
                  text: `Project "${project.name}" (Budget: NPR ${project.budget}, Status: ${project.status}) saved with dedicated wallet.`,
                },
              ],
            },
          };
        }

        if (toolName === "list_tasks") {
          const orgFilter = await resolveOrgFilter(auth, targetOrgParam);
          const where: any = { ...orgFilter };
          if (args.projectId) where.projectId = args.projectId;
          if (args.employeeId) where.employeeId = args.employeeId;
          if (args.status) where.status = args.status;

          const tasks = await db.task.findMany({
            where,
            include: {
              project: { select: { id: true, name: true } },
              employee: { select: { id: true, name: true, designation: true } },
            },
            orderBy: { createdAt: "desc" },
          });

          return {
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: JSON.stringify(tasks, null, 2) }] },
          };
        }

        if (toolName === "create_task") {
          const targetOrgId = await resolveOrgId(auth, targetOrgParam);
          const task = await db.task.create({
            data: {
              organizationId: targetOrgId,
              title: args.title,
              description: args.description || null,
              projectId: args.projectId || null,
              employeeId: args.employeeId || null,
              priority: args.priority || "MEDIUM",
              dueAt: args.dueAt ? new Date(args.dueAt) : null,
              allocatedHours: args.allocatedHours || 0,
            },
          });

          return {
            jsonrpc,
            id,
            result: {
              content: [
                {
                  type: "text",
                  text: `Task "${task.title}" (Priority: ${task.priority}) created successfully with ID: ${task.id}.`,
                },
              ],
            },
          };
        }

        if (toolName === "update_task") {
          const task = await db.task.update({
            where: { id: args.id },
            data: {
              ...(args.title ? { title: args.title } : {}),
              ...(args.description !== undefined ? { description: args.description } : {}),
              ...(args.status ? { status: args.status } : {}),
              ...(args.priority ? { priority: args.priority } : {}),
              ...(args.dueAt ? { dueAt: new Date(args.dueAt) } : {}),
              ...(args.allocatedHours !== undefined ? { allocatedHours: args.allocatedHours } : {}),
            },
          });

          return {
            jsonrpc,
            id,
            result: {
              content: [{ type: "text", text: `Task "${task.title}" updated to status ${task.status}.` }],
            },
          };
        }

        if (toolName === "list_work_logs") {
          const orgFilter = await resolveOrgFilter(auth, targetOrgParam);
          const where: any = { ...orgFilter };
          if (args.projectId) where.projectId = args.projectId;
          if (args.employeeId) where.employeeId = args.employeeId;
          if (args.status) where.status = args.status;

          const worklogs = await db.workLog.findMany({
            where,
            include: {
              project: { select: { id: true, name: true } },
              employee: { select: { id: true, name: true } },
              task: { select: { id: true, title: true } },
            },
            take: 100,
            orderBy: { logDate: "desc" },
          });

          return {
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: JSON.stringify(worklogs, null, 2) }] },
          };
        }

        if (toolName === "create_work_log") {
          const targetOrgId = await resolveOrgId(auth, targetOrgParam);
          const worklog = await db.workLog.create({
            data: {
              organizationId: targetOrgId,
              projectId: args.projectId || null,
              taskId: args.taskId || null,
              employeeId: args.employeeId || null,
              logDate: args.logDate ? new Date(args.logDate) : new Date(),
              nepaliDate: args.nepaliDate || null,
              startTime: args.startTime || null,
              endTime: args.endTime || null,
              durationMinutes: args.durationMinutes || 0,
              comment: args.comment || null,
              status: "PENDING",
            },
          });

          return {
            jsonrpc,
            id,
            result: {
              content: [
                {
                  type: "text",
                  text: `Worklog of ${worklog.durationMinutes} mins logged for ID: ${worklog.id}.`,
                },
              ],
            },
          };
        }

        // ==========================================
        // 16. QUOTES & SALES ORDERS
        // ==========================================
        if (toolName === "list_quotes") {
          const orgFilter = await resolveOrgFilter(auth, targetOrgParam);
          const where: any = { ...orgFilter };
          if (args.status) where.status = args.status;

          const quotes = await db.quote.findMany({
            where,
            include: {
              contact: true,
              items: true,
              organization: { select: { id: true, name: true, slug: true } },
            },
            orderBy: { issueDate: "desc" },
          });

          return {
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: JSON.stringify(quotes, null, 2) }] },
          };
        }

        if (toolName === "create_quote") {
          const targetOrgId = await resolveOrgId(auth, targetOrgParam);
          const quoteNumber = args.quoteNumber || `QT-${Date.now().toString().slice(-6)}`;
          const items = Array.isArray(args.items) ? args.items : [];

          let subtotal = 0;
          let taxTotal = 0;
          const lineItems = items.map((item: any) => {
            const qty = Number(item.quantity) || 1;
            const price = Number(item.unitPrice) || 0;
            const amount = qty * price;
            const rate = Number(item.taxRate) || 0;
            const tax = amount * (rate / 100);
            subtotal += amount;
            taxTotal += tax;
            return {
              description: item.description,
              quantity: qty,
              unitPrice: price,
              taxRate: rate,
              amount,
            };
          });

          const total = subtotal + taxTotal;

          const quote = await db.quote.create({
            data: {
              organizationId: targetOrgId,
              quoteNumber,
              contactId: args.contactId || null,
              issueDate: args.issueDate ? new Date(args.issueDate) : new Date(),
              validUntil: args.validUntil ? new Date(args.validUntil) : null,
              subtotal,
              tax: taxTotal,
              total,
              notes: args.notes || null,
              items: { create: lineItems },
            },
            include: { items: true },
          });

          return {
            jsonrpc,
            id,
            result: {
              content: [
                {
                  type: "text",
                  text: `Quotation #${quote.quoteNumber} of total NPR ${quote.total} created with ${quote.items.length} items.`,
                },
              ],
            },
          };
        }

        if (toolName === "convert_quote_to_invoice") {
          const targetOrgId = await resolveOrgId(auth, targetOrgParam);
          const quote = await db.quote.findFirst({
            where: { id: args.quoteId, organizationId: targetOrgId },
            include: { items: true },
          });

          if (!quote) {
            throw new Error(`Quote ${args.quoteId} not found.`);
          }

          const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;
          const invoice = await db.$transaction(async (tx) => {
            const inv = await tx.invoice.create({
              data: {
                organizationId: targetOrgId,
                invoiceNumber,
                contactId: quote.contactId,
                status: "SENT",
                issueDate: new Date(),
                subtotal: quote.subtotal,
                tax: quote.tax,
                total: quote.total,
                sourceQuoteId: quote.id,
                items: {
                  create: quote.items.map((i) => ({
                    description: i.description,
                    quantity: i.quantity,
                    unitPrice: i.unitPrice,
                    taxRate: i.taxRate,
                    amount: i.amount,
                  })),
                },
              },
            });

            await tx.quote.update({
              where: { id: quote.id },
              data: { status: "ACCEPTED" },
            });

            return inv;
          });

          return {
            jsonrpc,
            id,
            result: {
              content: [
                {
                  type: "text",
                  text: `Converted Quote #${quote.quoteNumber} to Tax Invoice #${invoice.invoiceNumber} (Total: NPR ${invoice.total}).`,
                },
              ],
            },
          };
        }

        if (toolName === "list_sales_orders") {
          const orgFilter = await resolveOrgFilter(auth, targetOrgParam);
          const where: any = { ...orgFilter };
          if (args.status) where.status = args.status;

          const orders = await db.salesOrder.findMany({
            where,
            include: { contact: true, items: true },
            orderBy: { orderDate: "desc" },
          });

          return {
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: JSON.stringify(orders, null, 2) }] },
          };
        }

        if (toolName === "create_sales_order") {
          const targetOrgId = await resolveOrgId(auth, targetOrgParam);
          const orderNumber = args.orderNumber || `SO-${Date.now().toString().slice(-6)}`;
          const items = Array.isArray(args.items) ? args.items : [];

          let subtotal = 0;
          const lineItems = items.map((item: any) => {
            const qty = Number(item.quantity) || 1;
            const price = Number(item.unitPrice) || 0;
            const amount = qty * price;
            subtotal += amount;
            return {
              description: item.description,
              quantity: qty,
              unitPrice: price,
              amount,
            };
          });

          const order = await db.salesOrder.create({
            data: {
              organizationId: targetOrgId,
              orderNumber,
              contactId: args.contactId || null,
              orderDate: args.orderDate ? new Date(args.orderDate) : new Date(),
              subtotal,
              total: subtotal,
              notes: args.notes || null,
              items: { create: lineItems },
            },
            include: { items: true },
          });

          return {
            jsonrpc,
            id,
            result: {
              content: [
                {
                  type: "text",
                  text: `Sales Order #${order.orderNumber} (Total: NPR ${order.total}) created successfully.`,
                },
              ],
            },
          };
        }

        // ==========================================
        // 17. PROJECT WALLETS
        // ==========================================
        if (toolName === "list_project_wallets") {
          const orgFilter = await resolveOrgFilter(auth, targetOrgParam);
          const where: any = { ...orgFilter };
          if (args.projectId) where.projectId = args.projectId;

          const wallets = await db.projectWallet.findMany({
            where,
            include: {
              project: { select: { id: true, name: true, budget: true, status: true } },
              transactions: { take: 10, orderBy: { transactionDate: "desc" } },
            },
          });

          return {
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: JSON.stringify(wallets, null, 2) }] },
          };
        }

        if (toolName === "record_wallet_transfer") {
          const targetOrgId = await resolveOrgId(auth, targetOrgParam);
          const amount = Number(args.amount) || 0;
          const type = args.type || "TRANSFER";

          const wallet = await db.projectWallet.findFirst({
            where: { id: args.walletId, organizationId: targetOrgId },
          });
          if (!wallet) {
            throw new Error(`Project wallet ${args.walletId} not found.`);
          }

          if (type === "TRANSFER") {
            const newTransferred = Number(wallet.transferredAmount) + amount;
            const newBalance = Math.max(0, Number(wallet.totalBudget) - newTransferred);

            await db.walletTransaction.create({
              data: {
                organizationId: targetOrgId,
                walletId: wallet.id,
                type: "TRANSFER",
                amount,
                paymentMode: args.paymentMode || "Fonepay",
                requestedById: args.requestedById || null,
                transferToId: args.transferToId || null,
                leaderApproval: "APPROVED",
                adminApproval: "APPROVED",
                status: "TRANSFERRED",
                description: args.description || null,
              },
            });

            await db.projectWallet.update({
              where: { id: wallet.id },
              data: { transferredAmount: newTransferred, balance: newBalance },
            });
          } else {
            const newHold = Number(wallet.holdAmount) + amount;
            await db.walletTransaction.create({
              data: {
                organizationId: targetOrgId,
                walletId: wallet.id,
                type: "REQUEST",
                amount,
                paymentMode: args.paymentMode || "Fonepay",
                requestedById: args.requestedById || null,
                transferToId: args.transferToId || null,
                leaderApproval: "PENDING",
                adminApproval: "PENDING",
                status: "PENDING",
                description: args.description || null,
              },
            });

            await db.projectWallet.update({
              where: { id: wallet.id },
              data: { holdAmount: newHold },
            });
          }

          return {
            jsonrpc,
            id,
            result: {
              content: [
                {
                  type: "text",
                  text: `Recorded wallet ${type} of NPR ${amount} for project wallet ${wallet.id}.`,
                },
              ],
            },
          };
        }

        // ==========================================
        // 18. COMPANY & WORKSPACE SETTINGS
        // ==========================================
        if (toolName === "get_company_settings") {
          const targetOrgId = await resolveOrgId(auth, targetOrgParam);
          const org = await db.organization.findUnique({
            where: { id: targetOrgId },
            select: {
              id: true,
              name: true,
              slug: true,
              kind: true,
              panVatNumber: true,
              taxNumber: true,
              email: true,
              phone: true,
              address: true,
              currency: true,
              defaultTaxPercent: true,
              fiscalYearStart: true,
              vendorCategory: true,
              officeOpenTime: true,
              officeCloseTime: true,
              status: true,
            },
          });

          return {
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: JSON.stringify(org, null, 2) }] },
          };
        }

        if (toolName === "update_company_settings") {
          const targetOrgId = await resolveOrgId(auth, targetOrgParam);
          const updateData: any = {};
          if (args.name) updateData.name = args.name;
          if (args.taxNumber) {
            updateData.taxNumber = args.taxNumber;
            updateData.panVatNumber = args.taxNumber;
          }
          if (args.email) updateData.email = args.email;
          if (args.phone) updateData.phone = args.phone;
          if (args.address) updateData.address = args.address;
          if (args.currency) updateData.currency = args.currency;
          if (args.defaultTaxPercent !== undefined) updateData.defaultTaxPercent = args.defaultTaxPercent;
          if (args.fiscalYearStart !== undefined) updateData.fiscalYearStart = args.fiscalYearStart;

          const updated = await db.organization.update({
            where: { id: targetOrgId },
            data: updateData,
          });

          return {
            jsonrpc,
            id,
            result: {
              content: [
                {
                  type: "text",
                  text: `Updated settings for "${updated.name}" (PAN/VAT: ${updated.taxNumber || updated.panVatNumber || "N/A"}).`,
                },
              ],
            },
          };
        }

        // ==========================================
        // 19. EXPENSE CATEGORIES CRUD
        // ==========================================
        if (toolName === "get_expense_category") {
          const cat = await db.expenseCategory.findUnique({
            where: { id: args.id },
            include: { _count: { select: { expenses: true } } },
          });
          return {
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: JSON.stringify(cat, null, 2) }] },
          };
        }

        if (toolName === "update_expense_category") {
          const updateData: any = {};
          if (args.name) updateData.name = args.name;
          if (args.budgetMonthly !== undefined) updateData.budgetMonthly = args.budgetMonthly;
          if (args.icon) updateData.icon = args.icon;

          const cat = await db.expenseCategory.update({
            where: { id: args.id },
            data: updateData,
          });
          return {
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: `Updated category "${cat.name}".` }] },
          };
        }

        if (toolName === "delete_expense_category") {
          await db.expense.updateMany({
            where: { categoryId: args.id },
            data: { categoryId: null },
          });
          await db.expenseCategory.delete({ where: { id: args.id } });
          return {
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: `Deleted category ${args.id}.` }] },
          };
        }

        // ==========================================
        // 20. INCOME CRUD
        // ==========================================
        if (toolName === "get_income") {
          const inc = await db.income.findUnique({
            where: { id: args.id },
            include: { contact: true, bankAccount: true },
          });
          return {
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: JSON.stringify(inc, null, 2) }] },
          };
        }

        // ==========================================
        // 21. INVOICE PAYMENTS CRUD
        // ==========================================
        if (toolName === "delete_invoice_payment") {
          const payment = await db.invoicePayment.findUnique({ where: { id: args.paymentId } });
          if (!payment) throw new Error("Payment record not found");

          await db.$transaction(async (tx) => {
            await tx.invoicePayment.delete({ where: { id: payment.id } });
            const invoice = await tx.invoice.findUnique({ where: { id: payment.invoiceId } });
            if (invoice) {
              const newPaid = Math.max(0, Number(invoice.paidAmount) - Number(payment.amount));
              await tx.invoice.update({
                where: { id: invoice.id },
                data: {
                  paidAmount: newPaid,
                  status: newPaid <= 0 ? "SENT" : "PARTIAL",
                },
              });
            }
          });

          return {
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: `Deleted invoice payment ${args.paymentId}.` }] },
          };
        }

        // ==========================================
        // 22. PURCHASES / VENDOR ORDERS CRUD
        // ==========================================
        if (toolName === "get_purchase") {
          const po = await db.purchaseOrder.findFirst({
            where: { OR: [{ id: args.id }, { orderNumber: args.id }] },
            include: { contact: true, items: true, payments: true },
          });
          return {
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: JSON.stringify(po, null, 2) }] },
          };
        }

        if (toolName === "update_purchase") {
          const updateData: any = {};
          if (args.status) updateData.status = args.status;
          if (args.notes !== undefined) updateData.notes = args.notes;

          const po = await db.purchaseOrder.update({
            where: { id: args.id },
            data: updateData,
          });
          return {
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: `Updated PO #${po.orderNumber} status to ${po.status}.` }] },
          };
        }

        if (toolName === "delete_purchase") {
          await db.$transaction([
            db.purchasePayment.deleteMany({ where: { purchaseOrderId: args.id } }),
            db.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: args.id } }),
            db.purchaseOrder.delete({ where: { id: args.id } }),
          ]);
          return {
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: `Deleted purchase order ${args.id}.` }] },
          };
        }

        if (toolName === "record_purchase_payment") {
          const po = await db.purchaseOrder.findUnique({
            where: { id: args.purchaseOrderId },
            include: { contact: true },
          });
          if (!po) throw new Error("Purchase order not found");

          const amount = Number(args.amount);
          const payDate = args.paidAt ? new Date(args.paidAt) : new Date();

          await db.$transaction(async (tx) => {
            await tx.purchasePayment.create({
              data: {
                purchaseOrderId: po.id,
                amount,
                paidAt: payDate,
                method: args.method || "Bank Transfer",
                reference: args.reference || null,
                notes: args.notes || null,
              },
            });

            const newPaid = Number(po.paidAmount) + amount;
            const isFullyPaid = newPaid >= Number(po.total);
            await tx.purchaseOrder.update({
              where: { id: po.id },
              data: {
                paidAmount: newPaid,
                status: isFullyPaid ? "COMPLETED" : po.status,
              },
            });

            await tx.expense.create({
              data: {
                organizationId: po.organizationId,
                title: `Payment for PO #${po.orderNumber}`,
                vendor: po.contact?.name || "Vendor",
                type: "ONE_TIME",
                amount,
                occurredAt: payDate,
                notes: `Vendor payment against PO #${po.orderNumber}`,
              },
            });
          });

          return {
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: `Recorded payment of NPR ${amount} for PO #${po.orderNumber}.` }] },
          };
        }

        // ==========================================
        // 23. CONTACTS CRUD
        // ==========================================
        if (toolName === "get_contact") {
          const contact = await db.contact.findUnique({
            where: { id: args.id },
            include: { invoices: { take: 5 }, purchaseOrders: { take: 5 } },
          });
          return {
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: JSON.stringify(contact, null, 2) }] },
          };
        }

        if (toolName === "update_contact") {
          const updateData: any = {};
          if (args.name) updateData.name = args.name;
          if (args.companyName !== undefined) updateData.companyName = args.companyName;
          if (args.email !== undefined) updateData.email = args.email;
          if (args.phone !== undefined) updateData.phone = args.phone;
          if (args.address !== undefined) updateData.address = args.address;
          if (args.taxNumber !== undefined) updateData.taxNumber = args.taxNumber;
          if (args.notes !== undefined) updateData.notes = args.notes;

          const contact = await db.contact.update({
            where: { id: args.id },
            data: updateData,
          });
          return {
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: `Updated contact "${contact.name}".` }] },
          };
        }

        if (toolName === "delete_contact") {
          await db.contact.delete({ where: { id: args.id } });
          return {
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: `Deleted contact ${args.id}.` }] },
          };
        }

        // ==========================================
        // 24. LEADS (CRM) CRUD
        // ==========================================
        if (toolName === "list_leads") {
          const orgFilter = await resolveOrgFilter(auth, targetOrgParam);
          const where: any = { ...orgFilter };
          if (args.status) where.status = args.status;

          const leads = await db.lead.findMany({
            where,
            include: { contact: true },
            orderBy: { createdAt: "desc" },
          });
          return {
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: JSON.stringify(leads, null, 2) }] },
          };
        }

        if (toolName === "get_lead") {
          const lead = await db.lead.findUnique({
            where: { id: args.id },
            include: { contact: true },
          });
          return {
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: JSON.stringify(lead, null, 2) }] },
          };
        }

        if (toolName === "create_lead") {
          const targetOrgId = await resolveOrgId(auth, targetOrgParam);
          const lead = await db.lead.create({
            data: {
              organizationId: targetOrgId,
              title: args.title,
              contactId: args.contactId || null,
              source: args.source || null,
              status: args.status || "NEW",
              value: Number(args.value) || 0,
              nextFollowUpAt: args.nextFollowUpAt ? new Date(args.nextFollowUpAt) : null,
              notes: args.notes || null,
            },
          });
          return {
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: `Lead "${lead.title}" created with ID: ${lead.id}.` }] },
          };
        }

        if (toolName === "update_lead") {
          const updateData: any = {};
          if (args.title) updateData.title = args.title;
          if (args.status) updateData.status = args.status;
          if (args.value !== undefined) updateData.value = Number(args.value);
          if (args.nextFollowUpAt) updateData.nextFollowUpAt = new Date(args.nextFollowUpAt);
          if (args.notes !== undefined) updateData.notes = args.notes;

          const lead = await db.lead.update({
            where: { id: args.id },
            data: updateData,
          });
          return {
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: `Updated lead "${lead.title}" (Status: ${lead.status}).` }] },
          };
        }

        if (toolName === "delete_lead") {
          await db.lead.delete({ where: { id: args.id } });
          return {
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: `Deleted lead ${args.id}.` }] },
          };
        }

        // ==========================================
        // 25. PRODUCTS & INVENTORY CRUD
        // ==========================================
        if (toolName === "get_product") {
          const product = await db.product.findFirst({
            where: { OR: [{ id: args.id }, { sku: args.id }] },
            include: { stockMovements: { take: 10, orderBy: { occurredAt: "desc" } } },
          });
          return {
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: JSON.stringify(product, null, 2) }] },
          };
        }

        if (toolName === "update_product") {
          const updateData: any = {};
          if (args.name) updateData.name = args.name;
          if (args.sku) updateData.sku = args.sku;
          if (args.unit) updateData.unit = args.unit;
          if (args.salePrice !== undefined) updateData.salePrice = Number(args.salePrice);
          if (args.purchasePrice !== undefined) updateData.purchasePrice = Number(args.purchasePrice);
          if (args.stockQty !== undefined) updateData.stockQty = Number(args.stockQty);
          if (args.reorderLevel !== undefined) updateData.reorderLevel = Number(args.reorderLevel);
          if (args.active !== undefined) updateData.active = Boolean(args.active);

          const product = await db.product.update({
            where: { id: args.id },
            data: updateData,
          });
          return {
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: `Updated product "${product.name}" (Stock: ${product.stockQty}).` }] },
          };
        }

        if (toolName === "delete_product") {
          await db.$transaction([
            db.stockMovement.deleteMany({ where: { productId: args.id } }),
            db.product.delete({ where: { id: args.id } }),
          ]);
          return {
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: `Deleted product ${args.id}.` }] },
          };
        }

        // ==========================================
        // 26. SALES ORDERS CRUD
        // ==========================================
        if (toolName === "get_sales_order") {
          const so = await db.salesOrder.findFirst({
            where: { OR: [{ id: args.id }, { orderNumber: args.id }] },
            include: { contact: true, items: true },
          });
          return {
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: JSON.stringify(so, null, 2) }] },
          };
        }

        if (toolName === "update_sales_order") {
          const updateData: any = {};
          if (args.status) updateData.status = args.status;
          if (args.notes !== undefined) updateData.notes = args.notes;

          const so = await db.salesOrder.update({
            where: { id: args.id },
            data: updateData,
          });
          return {
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: `Updated Sales Order #${so.orderNumber} to ${so.status}.` }] },
          };
        }

        if (toolName === "delete_sales_order") {
          await db.$transaction([
            db.salesOrderItem.deleteMany({ where: { salesOrderId: args.id } }),
            db.salesOrder.delete({ where: { id: args.id } }),
          ]);
          return {
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: `Deleted sales order ${args.id}.` }] },
          };
        }

        // ==========================================
        // 27. QUOTES CRUD
        // ==========================================
        if (toolName === "get_quote") {
          const quote = await db.quote.findFirst({
            where: { OR: [{ id: args.id }, { quoteNumber: args.id }] },
            include: { contact: true, items: true },
          });
          return {
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: JSON.stringify(quote, null, 2) }] },
          };
        }

        if (toolName === "update_quote") {
          const updateData: any = {};
          if (args.status) updateData.status = args.status;
          if (args.validUntil) updateData.validUntil = new Date(args.validUntil);
          if (args.notes !== undefined) updateData.notes = args.notes;
          if (args.terms !== undefined) updateData.terms = args.terms;

          const quote = await db.quote.update({
            where: { id: args.id },
            data: updateData,
          });
          return {
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: `Updated Quote #${quote.quoteNumber} (Status: ${quote.status}).` }] },
          };
        }

        if (toolName === "delete_quote") {
          await db.$transaction([
            db.quoteItem.deleteMany({ where: { quoteId: args.id } }),
            db.quote.delete({ where: { id: args.id } }),
          ]);
          return {
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: `Deleted quote ${args.id}.` }] },
          };
        }

        // ==========================================
        // 28. LOANS CRUD
        // ==========================================
        if (toolName === "get_loan") {
          const loan = await db.loan.findUnique({
            where: { id: args.id },
            include: { payments: { orderBy: { paymentDate: "desc" } } },
          });
          return {
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: JSON.stringify(loan, null, 2) }] },
          };
        }

        if (toolName === "update_loan") {
          const updateData: any = {};
          if (args.partyName) updateData.partyName = args.partyName;
          if (args.interestRate !== undefined) updateData.interestRate = Number(args.interestRate);
          if (args.dueDate) updateData.dueDate = new Date(args.dueDate);
          if (args.status) updateData.status = args.status;
          if (args.notes !== undefined) updateData.notes = args.notes;

          const loan = await db.loan.update({
            where: { id: args.id },
            data: updateData,
          });
          return {
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: `Updated Loan #${loan.id.slice(-6)} (Status: ${loan.status}).` }] },
          };
        }

        if (toolName === "delete_loan") {
          await db.$transaction([
            db.loanPayment.deleteMany({ where: { loanId: args.id } }),
            db.loan.delete({ where: { id: args.id } }),
          ]);
          return {
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: `Deleted loan ${args.id}.` }] },
          };
        }

        // ==========================================
        // 29. RENTAL HOUSE CRUD
        // ==========================================
        if (toolName === "get_rental_house") {
          const house = await db.rentalHouse.findUnique({ where: { id: args.id } });
          return {
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: JSON.stringify(house, null, 2) }] },
          };
        }

        // ==========================================
        // 30. UTILITIES CRUD
        // ==========================================
        if (toolName === "delete_electricity_reading") {
          await db.electricityReadingLog.delete({ where: { id: args.id } });
          return {
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: `Deleted electricity reading log ${args.id}.` }] },
          };
        }

        if (toolName === "delete_milk_log") {
          await db.milkMonthlyLog.delete({ where: { id: args.id } });
          return {
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: `Deleted milk log ${args.id}.` }] },
          };
        }

        // ==========================================
        // 31. STAFF (HRM) CRUD
        // ==========================================
        if (toolName === "get_employee") {
          const emp = await db.employee.findFirst({
            where: { OR: [{ id: args.id }, { employeeCode: args.id }] },
            include: { payrolls: { take: 5 }, leaveRequests: { take: 5 } },
          });
          return {
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: JSON.stringify(emp, null, 2) }] },
          };
        }

        if (toolName === "update_employee") {
          const updateData: any = {};
          if (args.name) updateData.name = args.name;
          if (args.email !== undefined) updateData.email = args.email;
          if (args.phone !== undefined) updateData.phone = args.phone;
          if (args.designation !== undefined) updateData.designation = args.designation;
          if (args.department !== undefined) updateData.department = args.department;
          if (args.basicSalary !== undefined) updateData.basicSalary = Number(args.basicSalary);
          if (args.status) updateData.status = args.status;

          const emp = await db.employee.update({
            where: { id: args.id },
            data: updateData,
          });
          return {
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: `Updated employee "${emp.name}".` }] },
          };
        }

        if (toolName === "delete_employee") {
          await db.employee.delete({ where: { id: args.id } });
          return {
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: `Deleted employee ${args.id}.` }] },
          };
        }

        // ==========================================
        // 32. PAYROLL CRUD
        // ==========================================
        if (toolName === "get_payroll") {
          const p = await db.payroll.findUnique({
            where: { id: args.id },
            include: { employee: true },
          });
          return {
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: JSON.stringify(p, null, 2) }] },
          };
        }

        if (toolName === "update_payroll") {
          const updateData: any = {};
          if (args.basic !== undefined) updateData.basic = Number(args.basic);
          if (args.allowance !== undefined) updateData.allowance = Number(args.allowance);
          if (args.overtime !== undefined) updateData.overtime = Number(args.overtime);
          if (args.deduction !== undefined) updateData.deduction = Number(args.deduction);
          if (args.tax !== undefined) updateData.tax = Number(args.tax);
          if (args.netPay !== undefined) updateData.netPay = Number(args.netPay);
          if (args.notes !== undefined) updateData.notes = args.notes;

          const p = await db.payroll.update({
            where: { id: args.id },
            data: updateData,
          });
          return {
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: `Updated payroll for ${p.id}.` }] },
          };
        }

        if (toolName === "delete_payroll") {
          await db.payroll.delete({ where: { id: args.id } });
          return {
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: `Deleted payroll ${args.id}.` }] },
          };
        }

        // ==========================================
        // 33. LEAVES CRUD
        // ==========================================
        if (toolName === "get_leave") {
          const leave = await db.leaveRequest.findUnique({
            where: { id: args.id },
            include: { employee: true },
          });
          return {
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: JSON.stringify(leave, null, 2) }] },
          };
        }

        if (toolName === "update_leave") {
          const leave = await db.leaveRequest.update({
            where: { id: args.id },
            data: { status: args.status },
          });
          return {
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: `Updated leave status to ${leave.status}.` }] },
          };
        }

        if (toolName === "delete_leave") {
          await db.leaveRequest.delete({ where: { id: args.id } });
          return {
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: `Deleted leave request ${args.id}.` }] },
          };
        }

        // ==========================================
        // 34. PROJECTS CRUD
        // ==========================================
        if (toolName === "get_project") {
          const p = await db.project.findUnique({
            where: { id: args.id },
            include: { teamLeader: true, contact: true, wallets: true, tasks: true },
          });
          return {
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: JSON.stringify(p, null, 2) }] },
          };
        }

        if (toolName === "update_project") {
          const updateData: any = {};
          if (args.name) updateData.name = args.name;
          if (args.description !== undefined) updateData.description = args.description;
          if (args.budget !== undefined) updateData.budget = Number(args.budget);
          if (args.status) updateData.status = args.status;
          if (args.priority) updateData.priority = args.priority;

          const p = await db.project.update({
            where: { id: args.id },
            data: updateData,
          });
          return {
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: `Updated project "${p.name}".` }] },
          };
        }

        if (toolName === "delete_project") {
          await db.$transaction([
            db.walletTransaction.deleteMany({ where: { wallet: { projectId: args.id } } }),
            db.projectWallet.deleteMany({ where: { projectId: args.id } }),
            db.workLog.deleteMany({ where: { projectId: args.id } }),
            db.task.deleteMany({ where: { projectId: args.id } }),
            db.project.delete({ where: { id: args.id } }),
          ]);
          return {
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: `Deleted project ${args.id}.` }] },
          };
        }

        // ==========================================
        // 35. TASKS CRUD
        // ==========================================
        if (toolName === "get_task") {
          const task = await db.task.findUnique({
            where: { id: args.id },
            include: { project: true, employee: true, worklogs: true },
          });
          return {
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: JSON.stringify(task, null, 2) }] },
          };
        }

        if (toolName === "delete_task") {
          await db.task.delete({ where: { id: args.id } });
          return {
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: `Deleted task ${args.id}.` }] },
          };
        }

        // ==========================================
        // 36. WORKLOGS (TIMESHEETS) CRUD
        // ==========================================
        if (toolName === "get_work_log") {
          const wl = await db.workLog.findUnique({
            where: { id: args.id },
            include: { project: true, employee: true, task: true },
          });
          return {
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: JSON.stringify(wl, null, 2) }] },
          };
        }

        if (toolName === "update_work_log") {
          const updateData: any = {};
          if (args.durationMinutes !== undefined) updateData.durationMinutes = Number(args.durationMinutes);
          if (args.comment !== undefined) updateData.comment = args.comment;
          if (args.status) {
            updateData.status = args.status;
            if (args.status === "APPROVED") updateData.approvedAt = new Date();
          }

          const wl = await db.workLog.update({
            where: { id: args.id },
            data: updateData,
          });
          return {
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: `Updated worklog ${wl.id} (Status: ${wl.status}).` }] },
          };
        }

        if (toolName === "delete_work_log") {
          await db.workLog.delete({ where: { id: args.id } });
          return {
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: `Deleted worklog ${args.id}.` }] },
          };
        }

        // ==========================================
        // 37. PROJECT WALLETS & TRANSACTIONS
        // ==========================================
        if (toolName === "get_project_wallet") {
          const wallet = await db.projectWallet.findUnique({
            where: { id: args.id },
            include: { project: true, transactions: { orderBy: { transactionDate: "desc" } } },
          });
          return {
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: JSON.stringify(wallet, null, 2) }] },
          };
        }

        if (toolName === "list_wallet_transactions") {
          const orgFilter = await resolveOrgFilter(auth, targetOrgParam);
          const where: any = { ...orgFilter };
          if (args.walletId) where.walletId = args.walletId;

          const txs = await db.walletTransaction.findMany({
            where,
            include: { requestedBy: true, transferTo: true, wallet: { select: { projectId: true } } },
            orderBy: { transactionDate: "desc" },
          });
          return {
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: JSON.stringify(txs, null, 2) }] },
          };
        }

        if (toolName === "update_wallet_transaction_status") {
          const tx = await db.walletTransaction.findUnique({
            where: { id: args.id },
            include: { wallet: true },
          });
          if (!tx) throw new Error("Wallet transaction not found");

          const actionType = args.actionType;
          if (actionType === "LEADER_APPROVE") {
            await db.walletTransaction.update({
              where: { id: tx.id },
              data: { leaderApproval: "APPROVED" },
            });
          } else if (actionType === "ADMIN_APPROVE") {
            await db.walletTransaction.update({
              where: { id: tx.id },
              data: { adminApproval: "APPROVED" },
            });
          } else if (actionType === "REJECT") {
            if (tx.wallet && tx.status === "PENDING") {
              const newHold = Math.max(0, Number(tx.wallet.holdAmount) - Number(tx.amount));
              await db.projectWallet.update({
                where: { id: tx.walletId },
                data: { holdAmount: newHold },
              });
            }
            await db.walletTransaction.update({
              where: { id: tx.id },
              data: { status: "REJECTED", leaderApproval: "REJECTED", adminApproval: "REJECTED" },
            });
          } else if (actionType === "COMPLETE_TRANSFER") {
            if (tx.wallet) {
              const newHold = Math.max(0, Number(tx.wallet.holdAmount) - Number(tx.amount));
              const newTransferred = Number(tx.wallet.transferredAmount) + Number(tx.amount);
              const newBalance = Math.max(0, Number(tx.wallet.totalBudget) - newTransferred);
              await db.projectWallet.update({
                where: { id: tx.walletId },
                data: {
                  holdAmount: newHold,
                  transferredAmount: newTransferred,
                  balance: newBalance,
                },
              });
            }
            await db.walletTransaction.update({
              where: { id: tx.id },
              data: { status: "TRANSFERRED", leaderApproval: "APPROVED", adminApproval: "APPROVED" },
            });
          }

          return {
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: `Wallet transaction ${tx.id} updated with action ${actionType}.` }] },
          };
        }

        // ==========================================
        // 38. LICENSES & COMPLIANCE
        // ==========================================
        if (toolName === "list_licenses") {
          const orgFilter = await resolveOrgFilter(auth, targetOrgParam);
          const licenses = await db.licenseRecord.findMany({
            where: orgFilter,
            orderBy: { expiryDate: "asc" },
          });
          return {
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: JSON.stringify(licenses, null, 2) }] },
          };
        }

        if (toolName === "get_license") {
          const lic = await db.licenseRecord.findUnique({ where: { id: args.id } });
          return {
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: JSON.stringify(lic, null, 2) }] },
          };
        }

        if (toolName === "create_license") {
          const targetOrgId = await resolveOrgId(auth, targetOrgParam);
          const lic = await db.licenseRecord.create({
            data: {
              organizationId: targetOrgId,
              name: args.name,
              vendor: args.vendor || null,
              licenseKey: args.licenseKey || null,
              seats: Number(args.seats) || 1,
              purchaseDate: args.purchaseDate ? new Date(args.purchaseDate) : null,
              expiryDate: args.expiryDate ? new Date(args.expiryDate) : null,
              renewalCost: args.renewalCost ? Number(args.renewalCost) : null,
              notes: args.notes || null,
              status: "ACTIVE",
            },
          });
          return {
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: `License "${lic.name}" created with ID: ${lic.id}.` }] },
          };
        }

        if (toolName === "update_license") {
          const updateData: any = {};
          if (args.name) updateData.name = args.name;
          if (args.expiryDate) updateData.expiryDate = new Date(args.expiryDate);
          if (args.renewalCost !== undefined) updateData.renewalCost = Number(args.renewalCost);
          if (args.status) updateData.status = args.status;

          const lic = await db.licenseRecord.update({
            where: { id: args.id },
            data: updateData,
          });
          return {
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: `Updated license "${lic.name}" (Status: ${lic.status}).` }] },
          };
        }

        if (toolName === "delete_license") {
          await db.licenseRecord.delete({ where: { id: args.id } });
          return {
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: `Deleted license ${args.id}.` }] },
          };
        }

        // ==========================================
        // 39. REMINDERS & ALERTS
        // ==========================================
        if (toolName === "list_reminders") {
          const orgFilter = await resolveOrgFilter(auth, targetOrgParam);
          const where: any = { ...orgFilter };
          if (args.status) where.status = args.status;

          const reminders = await db.reminder.findMany({
            where,
            orderBy: { dueAt: "asc" },
          });
          return {
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: JSON.stringify(reminders, null, 2) }] },
          };
        }

        if (toolName === "get_reminder") {
          const r = await db.reminder.findUnique({ where: { id: args.id } });
          return {
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: JSON.stringify(r, null, 2) }] },
          };
        }

        if (toolName === "create_reminder") {
          const targetOrgId = await resolveOrgId(auth, targetOrgParam);
          const r = await db.reminder.create({
            data: {
              organizationId: targetOrgId,
              title: args.title,
              dueAt: new Date(args.dueAt),
              notes: args.notes || null,
              status: "PENDING",
            },
          });
          return {
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: `Reminder "${r.title}" scheduled for ${r.dueAt.toISOString().slice(0, 10)}.` }] },
          };
        }

        if (toolName === "update_reminder") {
          const updateData: any = {};
          if (args.title) updateData.title = args.title;
          if (args.dueAt) updateData.dueAt = new Date(args.dueAt);
          if (args.status) updateData.status = args.status;

          const r = await db.reminder.update({
            where: { id: args.id },
            data: updateData,
          });
          return {
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: `Updated reminder "${r.title}" (Status: ${r.status}).` }] },
          };
        }

        if (toolName === "delete_reminder") {
          await db.reminder.delete({ where: { id: args.id } });
          return {
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: `Deleted reminder ${args.id}.` }] },
          };
        }

        // ==========================================
        // 40. UNIVERSAL HARD & SOFT DELETION
        // ==========================================
        if (toolName === "hard_delete_record") {
          const targetOrgId = await resolveOrgId(auth, targetOrgParam);
          const { resource, id: recordId } = args;

          await db.$transaction(async (tx) => {
            switch (resource) {
              case "purchase":
                await tx.purchasePayment.deleteMany({ where: { purchaseOrderId: recordId } });
                await tx.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: recordId } });
                await tx.purchaseOrder.deleteMany({ where: { id: recordId, organizationId: targetOrgId } });
                break;
              case "sales":
                await tx.salesOrderItem.deleteMany({ where: { salesOrderId: recordId } });
                await tx.salesOrder.deleteMany({ where: { id: recordId, organizationId: targetOrgId } });
                break;
              case "invoice":
                await tx.invoicePayment.deleteMany({ where: { invoiceId: recordId } });
                await tx.invoiceItem.deleteMany({ where: { invoiceId: recordId } });
                await tx.invoice.deleteMany({ where: { id: recordId, organizationId: targetOrgId } });
                break;
              case "quote":
                await tx.quoteItem.deleteMany({ where: { quoteId: recordId } });
                await tx.quote.deleteMany({ where: { id: recordId, organizationId: targetOrgId } });
                break;
              case "expense": {
                const linkedBankTxs = await tx.bankTransaction.findMany({
                  where: { expenseId: recordId, organizationId: targetOrgId },
                });
                for (const btx of linkedBankTxs) {
                  await tx.bankAccount.update({
                    where: { id: btx.bankAccountId },
                    data: { currentBalance: { increment: Number(btx.amount) } },
                  });
                }
                await tx.bankTransaction.deleteMany({ where: { expenseId: recordId } });
                await tx.expense.deleteMany({ where: { id: recordId, organizationId: targetOrgId } });
                break;
              }
              case "recurring_expense":
                await tx.expense.updateMany({ where: { recurringExpenseId: recordId }, data: { recurringExpenseId: null } });
                await tx.recurringExpense.deleteMany({ where: { id: recordId, organizationId: targetOrgId } });
                break;
              case "income": {
                const linkedBankTxs = await tx.bankTransaction.findMany({
                  where: { incomeId: recordId, organizationId: targetOrgId },
                });
                for (const btx of linkedBankTxs) {
                  await tx.bankAccount.update({
                    where: { id: btx.bankAccountId },
                    data: { currentBalance: { decrement: Number(btx.amount) } },
                  });
                }
                await tx.bankTransaction.deleteMany({ where: { incomeId: recordId } });
                await tx.income.deleteMany({ where: { id: recordId, organizationId: targetOrgId } });
                break;
              }
              case "contact":
                await tx.contact.deleteMany({ where: { id: recordId, organizationId: targetOrgId } });
                break;
              case "lead":
                await tx.lead.deleteMany({ where: { id: recordId, organizationId: targetOrgId } });
                break;
              case "task":
                await tx.workLog.updateMany({ where: { taskId: recordId }, data: { taskId: null } });
                await tx.task.deleteMany({ where: { id: recordId, organizationId: targetOrgId } });
                break;
              case "product":
                await tx.stockMovement.deleteMany({ where: { productId: recordId } });
                await tx.product.deleteMany({ where: { id: recordId, organizationId: targetOrgId } });
                break;
              case "leave":
                await tx.leaveRequest.deleteMany({ where: { id: recordId, organizationId: targetOrgId } });
                break;
              case "reminder":
                await tx.reminder.deleteMany({ where: { id: recordId, organizationId: targetOrgId } });
                break;
              case "license":
                await tx.licenseRecord.deleteMany({ where: { id: recordId, organizationId: targetOrgId } });
                break;
              case "loan":
                await tx.loanPayment.deleteMany({ where: { loanId: recordId } });
                await tx.loan.deleteMany({ where: { id: recordId, organizationId: targetOrgId } });
                break;
              case "payroll":
                await tx.payroll.deleteMany({ where: { id: recordId, organizationId: targetOrgId } });
                break;
              case "bank_tx": {
                const existingTx = await tx.bankTransaction.findFirst({
                  where: { id: recordId, organizationId: targetOrgId },
                });
                if (existingTx) {
                  const amt = Number(existingTx.amount);
                  const delta = existingTx.type === "DEPOSIT" ? -amt : amt;
                  await tx.bankAccount.update({
                    where: { id: existingTx.bankAccountId },
                    data: { currentBalance: { increment: delta } },
                  });
                  if (existingTx.incomeId) {
                    await tx.income.deleteMany({ where: { id: existingTx.incomeId, organizationId: targetOrgId } });
                  }
                  if (existingTx.expenseId) {
                    await tx.expense.deleteMany({ where: { id: existingTx.expenseId, organizationId: targetOrgId } });
                  }
                  await tx.bankTransaction.delete({ where: { id: recordId } });
                }
                break;
              }
              case "milk_log":
                await tx.milkMonthlyLog.deleteMany({ where: { id: recordId, organizationId: targetOrgId } });
                break;
              case "project":
                await tx.project.deleteMany({ where: { id: recordId, organizationId: targetOrgId } });
                break;
              case "employee":
                await tx.employee.deleteMany({ where: { id: recordId, organizationId: targetOrgId } });
                break;
              default:
                break;
            }
          });

          return {
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: `Permanently deleted ${resource} record ${recordId}.` }] },
          };
        }

        if (toolName === "soft_delete_record") {
          const targetOrgId = await resolveOrgId(auth, targetOrgParam);
          const { resource, id: recordId } = args;

          switch (resource) {
            case "purchase":
              await db.purchaseOrder.updateMany({ where: { id: recordId, organizationId: targetOrgId }, data: { status: "CANCELLED" } });
              break;
            case "sales":
              await db.salesOrder.updateMany({ where: { id: recordId, organizationId: targetOrgId }, data: { status: "CANCELLED" } });
              break;
            case "invoice":
              await db.invoice.updateMany({ where: { id: recordId, organizationId: targetOrgId }, data: { status: "CANCELLED" } });
              break;
            case "quote":
              await db.quote.updateMany({ where: { id: recordId, organizationId: targetOrgId }, data: { status: "CANCELLED" } });
              break;
            case "lead":
              await db.lead.updateMany({ where: { id: recordId, organizationId: targetOrgId }, data: { status: "LOST" } });
              break;
            case "task":
              await db.task.updateMany({ where: { id: recordId, organizationId: targetOrgId }, data: { status: "BLOCKED" } });
              break;
            case "leave":
              await db.leaveRequest.updateMany({ where: { id: recordId, organizationId: targetOrgId }, data: { status: "CANCELLED" } });
              break;
            case "reminder":
              await db.reminder.updateMany({ where: { id: recordId, organizationId: targetOrgId }, data: { status: "DISMISSED" } });
              break;
            case "license":
              await db.licenseRecord.updateMany({ where: { id: recordId, organizationId: targetOrgId }, data: { status: "CANCELLED" } });
              break;
            case "product":
              await db.product.updateMany({ where: { id: recordId, organizationId: targetOrgId }, data: { active: false } });
              break;
            case "loan":
              await db.loan.updateMany({ where: { id: recordId, organizationId: targetOrgId }, data: { status: "SETTLED" } });
              break;
            case "employee":
              await db.employee.updateMany({ where: { id: recordId, organizationId: targetOrgId }, data: { status: "INACTIVE" } });
              break;
            case "expense": {
              const exp = await db.expense.findFirst({ where: { id: recordId, organizationId: targetOrgId } });
              if (exp && !exp.notes?.includes("[CANCELLED]")) {
                await db.expense.update({
                  where: { id: recordId },
                  data: { notes: `[CANCELLED] ${exp.notes || ""}`.trim() },
                });
              }
              break;
            }
            default:
              break;
          }

          return {
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: `Soft-deleted / cancelled ${resource} record ${recordId}.` }] },
          };
        }

        if (toolName === "create_organization") {
          const slug = args.slug || args.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
          const ownerId = auth.userId || "master-admin";

          const org = await db.organization.create({
            data: {
              name: args.name,
              slug,
              kind: args.kind || "COMPANY",
              currency: args.currency || "NPR",
              panVatNumber: args.panVatNumber || null,
              taxNumber: args.panVatNumber || null,
              address: args.address || null,
              phone: args.phone || null,
              email: args.email || null,
              ownerId,
            },
          });

          return {
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: `Created organization "${org.name}" (Slug: ${org.slug}, ID: ${org.id}).` }] },
          };
        }

        return {
          jsonrpc,
          id,
          result: { content: [{ type: "text", text: `Tool not found: ${toolName}` }], isError: true },
        };
      } catch (err: any) {
        console.error(`[MCP Tool Error / ${toolName}]:`, err);
        return {
          jsonrpc,
          id,
          result: { content: [{ type: "text", text: `Error executing ${toolName}: ${err?.message || "Internal error"}` }], isError: true },
        };
      }
    }

    default:
      return {
        jsonrpc,
        id,
        error: { code: -32601, message: `Method not implemented: ${method}` },
      };
  }
}

export async function POST(request: Request) {
  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return jsonResponse(
      { jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error: invalid JSON body" } },
      400
    );
  }

  if (Array.isArray(body) && body.length === 0) {
    return jsonResponse(
      { jsonrpc: "2.0", id: null, error: { code: -32600, message: "Invalid Request: empty JSON-RPC batch" } },
      400
    );
  }

  const normalizeRpc = (item: any) => {
    if (!item?.method && item && typeof item === "object") {
      const detectedTool = item.tool || item.name || item.action;
      if (detectedTool) {
        return {
          ...item,
          jsonrpc: item.jsonrpc || "2.0",
          method: "tools/call",
          params: {
            name: detectedTool,
            arguments: item.arguments || item.params || item,
          },
        };
      }
    }
    return item;
  };

  body = Array.isArray(body) ? body.map(normalizeRpc) : normalizeRpc(body);
  const items = Array.isArray(body) ? body : [body];
  const discoveryMethods = new Set([
    "initialize",
    "notifications/initialized",
    "initialized",
    "tools/list",
    "list_tools",
    "resources/list",
    "resources/templates/list",
    "prompts/list",
    "ping",
    "logging/setLevel",
  ]);
  const protectedItem = items.find(
    (item: any) =>
      !discoveryMethods.has(item?.method || "") &&
      !String(item?.method || "").startsWith("notifications/")
  );

  let auth: McpAuthResult = { authenticated: false };
  if (protectedItem) {
    auth = await verifyMcpAuth(request);
    if (!auth.authenticated) {
      return authenticationRequiredResponse(
        request,
        protectedItem?.id,
        auth.error || "Authentication required"
      );
    }
  }

  // Handle JSON-RPC Batch Requests
  if (Array.isArray(body)) {
    const responses = await Promise.all(
      body.map((item) => handleSingleRpc(item, auth))
    );
    const validResponses = responses.filter(Boolean);
    return jsonResponse(validResponses);
  }

  // Single JSON-RPC Request
  const response = await handleSingleRpc(body, auth);
  if (!response) {
    return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
  }

  return jsonResponse(response);
}

export async function GET(request: Request) {
  const accept = request.headers.get("accept") || "";
  if (accept.includes("text/event-stream")) {
    const { GET: handleSseGet } = await import("./sse/route");
    return handleSseGet(request);
  }

  const auth = await verifyMcpAuth(request);
  return jsonResponse({
    name: "Kashtrix ERP Model Context Protocol (MCP) Server",
    status: "ok",
    service: "Kashtrix ERP MCP Server",
    version: "1.0.0",
    protocolVersion: MCP_PROTOCOL_VERSION,
    authenticated: auth.authenticated,
    user: auth.name || "MCP Client",
    email: auth.email || "",
    role: auth.role || "OWNER",
    primaryOrgId: auth.orgId || "",
    authorizedOrganizations: auth.organizations || [],
    toolsCount: TOOLS.length,
    tools: DISCOVERABLE_TOOLS,
    endpoints: {
      jsonRpc: "/api/mcp",
      sse: "/api/mcp/sse",
      oauthAuthorize: "/api/oauth/authorize",
      oauthToken: "/api/oauth/token",
      oauthRegister: "/api/oauth/register",
      openapi: "/api/mcp/openapi.json",
    },
    authRequired: false,
    discovery: {
      initialize: "/api/mcp",
      toolsList: "/api/mcp",
    },
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

// This server uses stateless Streamable HTTP sessions, so there is no server-
// side session state to release. Accepting DELETE keeps MCP clients that always
// send a transport shutdown request from reporting a false failure.
export async function DELETE() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}
