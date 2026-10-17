import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyMcpAuth, resolveOrgId } from "@/lib/mcp-auth";
import { analyzeFinancialDocument } from "@/lib/gemini";
import { Prisma } from "@/generated/client";

export const dynamic = "force-dynamic";

const MCP_PROTOCOL_VERSION = "2024-11-05";

// Tool Definitions Compliant with MCP 2024-11-05 & OpenAI Apps SDK
const TOOLS = [
  // 1. ORGANIZATIONS
  {
    name: "list_organizations",
    description: "List all organizations/workspaces the authenticated user belongs to.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_organization_details",
    description: "Get full profile, settings, currency, fiscal year, and balance overview of the active organization.",
    inputSchema: {
      type: "object",
      properties: {
        orgId: { type: "string", description: "Optional organization ID to inspect" },
      },
    },
  },

  // 2. BANK ACCOUNTS
  {
    name: "list_bank_accounts",
    description: "List registered bank accounts with current balances, account numbers, and branches.",
    inputSchema: {
      type: "object",
      properties: {
        orgId: { type: "string", description: "Optional organization ID override" },
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
    description: "Create a new bank account in the organization ledger.",
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
    description: "List bank statement transactions with filtration by account, type (DEPOSIT/WITHDRAWAL), or search narration.",
    inputSchema: {
      type: "object",
      properties: {
        bankAccountId: { type: "string", description: "Optional bank account filter" },
        type: { type: "string", enum: ["DEPOSIT", "WITHDRAWAL"] },
        query: { type: "string", description: "Search query in narration or reference" },
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
    description: "List organization expenses with category, vendor, and date range filters.",
    inputSchema: {
      type: "object",
      properties: {
        categoryId: { type: "string" },
        vendor: { type: "string" },
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
    description: "Record a new expense.",
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
    description: "List expense categories and their monthly budgets.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "create_expense_category",
    description: "Create a new expense category.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        budgetMonthly: { type: "number" },
      },
      required: ["name"],
    },
  },

  // 5. INCOMES
  {
    name: "list_incomes",
    description: "List income records in the organization.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "integer", default: 50 },
      },
    },
  },
  {
    name: "create_income",
    description: "Record a new income entry.",
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
    description: "List customer invoices with statuses, due dates, and paid amounts.",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["DRAFT", "SENT", "PARTIAL", "PAID", "OVERDUE", "CANCELLED"] },
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
    description: "List vendor purchase orders and bills.",
    inputSchema: {
      type: "object",
      properties: {
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
    description: "List CRM contacts filtered by type: CUSTOMER, VENDOR, or BOTH.",
    inputSchema: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["CUSTOMER", "VENDOR", "BOTH"] },
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

export async function POST(request: Request) {
  const auth = await verifyMcpAuth(request);
  if (!auth.authenticated) {
    return NextResponse.json(
      { jsonrpc: "2.0", id: null, error: { code: -32000, message: auth.error || "Unauthorized" } },
      { status: 401 }
    );
  }

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } },
      { status: 400 }
    );
  }

  const { jsonrpc = "2.0", id = 1, method, params = {} } = body;

  switch (method) {
    case "initialize": {
      const clientVersion = params?.protocolVersion;
      return NextResponse.json({
        jsonrpc,
        id,
        result: {
          protocolVersion: clientVersion || MCP_PROTOCOL_VERSION,
          capabilities: {
            tools: { listChanged: false },
            resources: { subscribe: false, listChanged: false },
          },
          serverInfo: {
            name: "kashtrix-mcp-server",
            version: "1.0.0",
            description: "Kashtrix ERP Model Context Protocol Server with OAuth",
          },
        },
      });
    }

    case "notifications/initialized":
      return new NextResponse(null, { status: 204 });

    case "ping":
      return NextResponse.json({ jsonrpc, id, result: {} });

    case "tools/list":
      return NextResponse.json({
        jsonrpc,
        id,
        result: { tools: TOOLS },
      });

    case "tools/call": {
      const toolName = params?.name;
      const args = params?.arguments || {};
      const orgId = await resolveOrgId(auth, args.orgId);

      try {
        // ==========================================
        // 1. ORGANIZATIONS
        // ==========================================
        if (toolName === "list_organizations") {
          const memberships = await db.membership.findMany({
            where: auth.isMaster ? {} : { userId: auth.userId },
            include: { organization: true },
          });
          const orgs = memberships.map((m) => ({
            id: m.organization.id,
            name: m.organization.name,
            slug: m.organization.slug,
            kind: m.organization.kind,
            currency: m.organization.currency,
            role: m.role,
          }));
          return NextResponse.json({
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: JSON.stringify(orgs, null, 2) }] },
          });
        }

        if (toolName === "get_organization_details") {
          const org = await db.organization.findUnique({
            where: { id: orgId },
            include: {
              bankAccounts: { select: { id: true, bankName: true, accountNumber: true, currentBalance: true } },
              _count: { select: { invoices: true, expenses: true, contacts: true, bankTransactions: true } },
            },
          });
          return NextResponse.json({
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: JSON.stringify(org, null, 2) }] },
          });
        }

        // ==========================================
        // 2. BANK ACCOUNTS
        // ==========================================
        if (toolName === "list_bank_accounts") {
          const accounts = await db.bankAccount.findMany({
            where: { organizationId: orgId },
            include: { _count: { select: { transactions: true } } },
            orderBy: { createdAt: "asc" },
          });
          return NextResponse.json({
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: JSON.stringify(accounts, null, 2) }] },
          });
        }

        if (toolName === "get_bank_account") {
          const account = await db.bankAccount.findFirst({
            where: { id: args.id, organizationId: orgId },
            include: {
              transactions: { take: 25, orderBy: { transactionDate: "desc" } },
            },
          });
          return NextResponse.json({
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: JSON.stringify(account, null, 2) }] },
          });
        }

        if (toolName === "create_bank_account") {
          const newAccount = await db.bankAccount.create({
            data: {
              organizationId: orgId,
              bankName: args.bankName,
              accountName: args.accountName,
              accountNumber: args.accountNumber,
              accountType: args.accountType || "CURRENT",
              branch: args.branch || null,
              currency: args.currency || "NPR",
              openingBalance: new Prisma.Decimal(args.openingBalance || 0),
              currentBalance: new Prisma.Decimal(args.openingBalance || 0),
            },
          });
          return NextResponse.json({
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: `Bank Account created successfully:\n${JSON.stringify(newAccount, null, 2)}` }] },
          });
        }

        if (toolName === "update_bank_account") {
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
          return NextResponse.json({
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: `Bank Account updated:\n${JSON.stringify(updated, null, 2)}` }] },
          });
        }

        if (toolName === "delete_bank_account") {
          await db.bankAccount.delete({ where: { id: args.id } });
          return NextResponse.json({
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: `Bank Account ${args.id} permanently deleted.` }] },
          });
        }

        // ==========================================
        // 3. BANK TRANSACTIONS
        // ==========================================
        if (toolName === "list_bank_transactions") {
          const where: any = { organizationId: orgId };
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
            include: { bankAccount: { select: { bankName: true, accountNumber: true } } },
            take: args.limit || 50,
            orderBy: { transactionDate: "desc" },
          });
          return NextResponse.json({
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: JSON.stringify(txs, null, 2) }] },
          });
        }

        if (toolName === "create_bank_transaction") {
          const txAmount = Math.abs(Number(args.amount));
          const txType = args.type === "DEPOSIT" ? "DEPOSIT" : "WITHDRAWAL";
          const txDate = args.transactionDate ? new Date(args.transactionDate) : new Date();

          const tx = await db.bankTransaction.create({
            data: {
              organizationId: orgId,
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
            const bank = await db.bankAccount.findUnique({
              where: { id: args.bankAccountId },
              select: { currentBalance: true },
            });
            if (bank) {
              const delta = txType === "DEPOSIT" ? txAmount : -txAmount;
              const newBal = Number(bank.currentBalance) + delta;
              await db.bankAccount.update({
                where: { id: args.bankAccountId },
                data: { currentBalance: new Prisma.Decimal(newBal) },
              });
            }
          }

          return NextResponse.json({
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: `Bank Transaction recorded successfully (ID: ${tx.id}).` }] },
          });
        }

        if (toolName === "update_bank_transaction") {
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
          return NextResponse.json({
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: `Bank Transaction updated:\n${JSON.stringify(updated, null, 2)}` }] },
          });
        }

        if (toolName === "delete_bank_transaction") {
          await db.bankTransaction.delete({ where: { id: args.id } });
          return NextResponse.json({
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: `Bank Transaction ${args.id} deleted.` }] },
          });
        }

        // ==========================================
        // 4. EXPENSES
        // ==========================================
        if (toolName === "list_expenses") {
          const where: any = { organizationId: orgId, isEstimated: false };
          if (args.categoryId) where.categoryId = args.categoryId;
          if (args.vendor) where.vendor = { contains: args.vendor };

          const expenses = await db.expense.findMany({
            where,
            include: { category: true },
            take: args.limit || 50,
            orderBy: { occurredAt: "desc" },
          });
          return NextResponse.json({
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: JSON.stringify(expenses, null, 2) }] },
          });
        }

        if (toolName === "get_expense") {
          const expense = await db.expense.findFirst({
            where: { id: args.id, organizationId: orgId },
            include: { category: true },
          });
          return NextResponse.json({
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: JSON.stringify(expense, null, 2) }] },
          });
        }

        if (toolName === "create_expense") {
          let categoryId = args.categoryId;
          if (!categoryId && args.categoryName) {
            const cat = await db.expenseCategory.upsert({
              where: { organizationId_name: { organizationId: orgId, name: args.categoryName.trim() } },
              update: {},
              create: { organizationId: orgId, name: args.categoryName.trim() },
            });
            categoryId = cat.id;
          }

          const occurredAt = args.occurredAt ? new Date(args.occurredAt) : new Date();
          const expense = await db.expense.create({
            data: {
              organizationId: orgId,
              categoryId: categoryId || null,
              title: args.title,
              vendor: args.vendor || null,
              amount: new Prisma.Decimal(Math.abs(Number(args.amount))),
              occurredAt,
              isEstimated: false,
              notes: args.notes || null,
            },
          });
          return NextResponse.json({
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: `Expense "${expense.title}" created (ID: ${expense.id}).` }] },
          });
        }

        if (toolName === "update_expense") {
          const data: any = {};
          if (args.title) data.title = args.title;
          if (args.amount) data.amount = new Prisma.Decimal(Math.abs(Number(args.amount)));
          if (args.vendor) data.vendor = args.vendor;
          if (args.notes) data.notes = args.notes;

          const updated = await db.expense.update({ where: { id: args.id }, data });
          return NextResponse.json({
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: `Expense updated:\n${JSON.stringify(updated, null, 2)}` }] },
          });
        }

        if (toolName === "delete_expense") {
          await db.expense.delete({ where: { id: args.id } });
          return NextResponse.json({
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: `Expense ${args.id} deleted.` }] },
          });
        }

        if (toolName === "list_expense_categories") {
          const cats = await db.expenseCategory.findMany({
            where: { organizationId: orgId },
          });
          return NextResponse.json({
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: JSON.stringify(cats, null, 2) }] },
          });
        }

        if (toolName === "create_expense_category") {
          const cat = await db.expenseCategory.create({
            data: {
              organizationId: orgId,
              name: args.name,
              budgetMonthly: args.budgetMonthly ? new Prisma.Decimal(args.budgetMonthly) : null,
            },
          });
          return NextResponse.json({
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: `Expense Category created (ID: ${cat.id}).` }] },
          });
        }

        // ==========================================
        // 5. INCOMES
        // ==========================================
        if (toolName === "list_incomes") {
          const incomes = await db.income.findMany({
            where: { organizationId: orgId },
            include: { bankAccount: true },
            take: args.limit || 50,
            orderBy: { receivedAt: "desc" },
          });
          return NextResponse.json({
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: JSON.stringify(incomes, null, 2) }] },
          });
        }

        if (toolName === "create_income") {
          const inc = await db.income.create({
            data: {
              organizationId: orgId,
              title: args.title,
              source: args.source || "Direct Revenue",
              amount: new Prisma.Decimal(Math.abs(Number(args.amount))),
              paymentMethod: args.paymentMethod || "BANK",
              bankAccountId: args.bankAccountId || null,
              receivedAt: args.receivedAt ? new Date(args.receivedAt) : new Date(),
              notes: args.notes || null,
            },
          });
          return NextResponse.json({
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: `Income entry created (ID: ${inc.id}).` }] },
          });
        }

        if (toolName === "update_income") {
          const data: any = {};
          if (args.title) data.title = args.title;
          if (args.amount) data.amount = new Prisma.Decimal(Math.abs(Number(args.amount)));
          if (args.source) data.source = args.source;

          const updated = await db.income.update({ where: { id: args.id }, data });
          return NextResponse.json({
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: `Income updated:\n${JSON.stringify(updated, null, 2)}` }] },
          });
        }

        if (toolName === "delete_income") {
          await db.income.delete({ where: { id: args.id } });
          return NextResponse.json({
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: `Income ${args.id} deleted.` }] },
          });
        }

        // ==========================================
        // 6. INVOICES
        // ==========================================
        if (toolName === "list_invoices") {
          const where: any = { organizationId: orgId };
          if (args.status) where.status = args.status;

          const invoices = await db.invoice.findMany({
            where,
            include: { contact: true, items: true },
            take: args.limit || 50,
            orderBy: { issueDate: "desc" },
          });
          return NextResponse.json({
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: JSON.stringify(invoices, null, 2) }] },
          });
        }

        if (toolName === "get_invoice") {
          const invoice = await db.invoice.findFirst({
            where: {
              organizationId: orgId,
              OR: [{ id: args.id }, { invoiceNumber: args.id }],
            },
            include: { contact: true, items: true, payments: true },
          });
          return NextResponse.json({
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: JSON.stringify(invoice, null, 2) }] },
          });
        }

        if (toolName === "create_invoice") {
          let contactId = args.contactId;
          if (!contactId && args.customerName) {
            const contact = await db.contact.upsert({
              where: { id: "new-contact" },
              update: {},
              create: {
                organizationId: orgId,
                name: args.customerName,
                type: "CUSTOMER",
              },
            }).catch(async () => {
              return await db.contact.create({
                data: { organizationId: orgId, name: args.customerName, type: "CUSTOMER" },
              });
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
              organizationId: orgId,
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
            include: { items: true },
          });

          return NextResponse.json({
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: `Invoice #${invoice.invoiceNumber} created successfully (Total: ${invoice.total}).` }] },
          });
        }

        if (toolName === "update_invoice") {
          const data: any = {};
          if (args.status) data.status = args.status;
          if (args.notes) data.notes = args.notes;

          const updated = await db.invoice.update({ where: { id: args.id }, data });
          return NextResponse.json({
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: `Invoice updated:\n${JSON.stringify(updated, null, 2)}` }] },
          });
        }

        if (toolName === "delete_invoice") {
          await db.invoice.delete({ where: { id: args.id } });
          return NextResponse.json({
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: `Invoice ${args.id} deleted.` }] },
          });
        }

        if (toolName === "record_invoice_payment") {
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

          // Update paidAmount on invoice
          const inv = await db.invoice.findUnique({
            where: { id: args.invoiceId },
            select: { total: true, paidAmount: true },
          });
          if (inv) {
            const newPaid = Number(inv.paidAmount) + Number(args.amount);
            const newStatus = newPaid >= Number(inv.total) ? "PAID" : "PARTIAL";
            await db.invoice.update({
              where: { id: args.invoiceId },
              data: {
                paidAmount: new Prisma.Decimal(newPaid),
                status: newStatus,
              },
            });
          }

          return NextResponse.json({
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: `Payment of ${args.amount} recorded for Invoice ${args.invoiceId}.` }] },
          });
        }

        // ==========================================
        // 7. PURCHASES
        // ==========================================
        if (toolName === "list_purchases") {
          const pos = await db.purchaseOrder.findMany({
            where: { organizationId: orgId },
            include: { contact: true, items: true },
            take: args.limit || 50,
            orderBy: { orderDate: "desc" },
          });
          return NextResponse.json({
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: JSON.stringify(pos, null, 2) }] },
          });
        }

        if (toolName === "create_purchase") {
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
              organizationId: orgId,
              orderNumber: poNumber,
              status: "DRAFT",
              orderDate: args.orderDate ? new Date(args.orderDate) : new Date(),
              subtotal: new Prisma.Decimal(total),
              total: new Prisma.Decimal(total),
              items: { create: itemsData },
            },
          });

          return NextResponse.json({
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: `Purchase Order #${po.orderNumber} created (Total: ${po.total}).` }] },
          });
        }

        // ==========================================
        // 8. CONTACTS (CRM)
        // ==========================================
        if (toolName === "list_contacts") {
          const where: any = { organizationId: orgId };
          if (args.type) where.type = args.type;

          const contacts = await db.contact.findMany({ where, orderBy: { name: "asc" } });
          return NextResponse.json({
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: JSON.stringify(contacts, null, 2) }] },
          });
        }

        if (toolName === "create_contact") {
          const contact = await db.contact.create({
            data: {
              organizationId: orgId,
              name: args.name,
              type: args.type || "CUSTOMER",
              email: args.email || null,
              phone: args.phone || null,
              address: args.address || null,
              taxNumber: args.taxNumber || null,
            },
          });
          return NextResponse.json({
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: `Contact "${contact.name}" created (ID: ${contact.id}).` }] },
          });
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

          return NextResponse.json({
            jsonrpc,
            id,
            result: { content: [{ type: "text", text: JSON.stringify(extracted, null, 2) }] },
          });
        }

        return NextResponse.json({
          jsonrpc,
          id,
          error: { code: -32601, message: `Tool not found: ${toolName}` },
        });
      } catch (err: any) {
        console.error(`[MCP Tool Error / ${toolName}]:`, err);
        return NextResponse.json({
          jsonrpc,
          id,
          error: { code: -32000, message: err?.message || `Execution error in ${toolName}` },
        });
      }
    }

    default:
      return NextResponse.json({
        jsonrpc,
        id,
        error: { code: -32601, message: `Method not implemented: ${method}` },
      });
  }
}

export async function GET(request: Request) {
  const auth = await verifyMcpAuth(request);
  return NextResponse.json({
    status: "ok",
    service: "Kashtrix ERP MCP Server",
    version: "1.0.0",
    protocolVersion: MCP_PROTOCOL_VERSION,
    authenticated: auth.authenticated,
    user: auth.name,
    orgId: auth.orgId,
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
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, x-mcp-key, x-api-key",
    },
  });
}
