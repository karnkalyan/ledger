import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyMcpAuth, resolveOrgId, resolveOrgFilter, McpAuthResult } from "@/lib/mcp-auth";
import { analyzeFinancialDocument } from "@/lib/gemini";
import { Prisma } from "@/generated/client";

export const dynamic = "force-dynamic";

const MCP_PROTOCOL_VERSION = "2024-11-05";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-mcp-key, x-api-key",
};

function jsonResponse(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: CORS_HEADERS,
  });
}

// Tool Definitions Compliant with MCP 2024-11-05 & OpenAI Apps SDK
const TOOLS = [
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
    description: "List bank statement transactions with filtration by account, type (DEPOSIT/WITHDRAWAL), search query, or workspace.",
    inputSchema: {
      type: "object",
      properties: {
        bankAccountId: { type: "string", description: "Optional bank account filter" },
        type: { type: "string", enum: ["DEPOSIT", "WITHDRAWAL"] },
        query: { type: "string", description: "Search query in narration or reference" },
        orgId: { type: "string", description: "Optional workspace filter ('house', 'office', or ID)" },
        workspace: { type: "string", description: "Optional workspace alias ('house' or 'office')" },
        limit: { type: "integer", default: 50 },
      },
    },
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
    description: "List customer invoices with statuses, due dates, and paid amounts across accounts or by workspace.",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["DRAFT", "SENT", "PARTIAL", "PAID", "OVERDUE", "CANCELLED"] },
        orgId: { type: "string", description: "Optional workspace filter ('house', 'office', or ID)" },
        workspace: { type: "string", description: "Optional workspace alias ('house' or 'office')" },
        limit: { type: "integer", default: 50 },
      },
    },
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
];

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
      const clientVersion = params?.protocolVersion;
      return {
        jsonrpc,
        id,
        result: {
          protocolVersion: clientVersion || MCP_PROTOCOL_VERSION,
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
        result: { tools: TOOLS },
      };

    case "resources/list":
      return { jsonrpc, id, result: { resources: [] } };

    case "prompts/list":
      return { jsonrpc, id, result: { prompts: [] } };

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
          if (args.bankAccountId) where.bankAccountId = args.bankAccountId;
          if (args.type) where.type = args.type;
          if (args.query) {
            where.OR = [
              { description: { contains: args.query } },
              { reference: { contains: args.query } },
            ];
          }

          const txs = await db.bankTransaction.findMany({
            where,
            include: {
              bankAccount: { select: { bankName: true, accountNumber: true } },
              organization: { select: { id: true, name: true, slug: true, kind: true } },
            },
            take: args.limit || 50,
            orderBy: { transactionDate: "desc" },
          });

          return {
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: JSON.stringify(txs, null, 2) }] },
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

          const data: any = {};
          if (args.description) data.description = args.description;
          if (args.amount) data.amount = new Prisma.Decimal(Math.abs(Number(args.amount)));
          if (args.type) data.type = args.type;
          if (args.category) data.category = args.category;
          if (args.reference) data.reference = args.reference;

          const updated = await db.bankTransaction.update({
            where: { id: args.id },
            data,
          });
          return {
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: `Bank Transaction updated:\n${JSON.stringify(updated, null, 2)}` }] },
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
          await db.bankTransaction.delete({ where: { id: args.id } });
          return {
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: `Bank Transaction ${args.id} deleted.` }] },
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
          if (args.status) where.status = args.status;

          const invoices = await db.invoice.findMany({
            where,
            include: {
              contact: true,
              items: true,
              organization: { select: { id: true, name: true, slug: true, kind: true } },
            },
            take: args.limit || 50,
            orderBy: { issueDate: "desc" },
          });
          return {
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: JSON.stringify(invoices, null, 2) }] },
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
  const auth = await verifyMcpAuth(request);
  if (!auth.authenticated) {
    return jsonResponse(
      { jsonrpc: "2.0", id: null, error: { code: -32000, message: auth.error || "Unauthorized" } },
      401
    );
  }

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return jsonResponse(
      { jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error: invalid JSON body" } },
      400
    );
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
    status: "ok",
    service: "Kashtrix ERP MCP Server",
    version: "1.0.0",
    protocolVersion: MCP_PROTOCOL_VERSION,
    authenticated: auth.authenticated,
    user: auth.name,
    email: auth.email,
    role: auth.role,
    primaryOrgId: auth.orgId,
    authorizedOrganizations: auth.organizations || [],
    toolsCount: TOOLS.length,
    endpoints: {
      jsonRpc: "/api/mcp",
      sse: "/api/mcp/sse",
      oauthAuthorize: "/api/oauth/authorize",
      oauthToken: "/api/oauth/token",
      openapi: "/api/mcp/openapi.json",
    },
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}
