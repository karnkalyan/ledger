import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function resolveBaseUrl(request: Request): string {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost || request.headers.get("host") || "";
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const proto = forwardedProto || (host.includes("localhost") ? "http" : "https");

  if (host && !host.includes("localhost") && !host.startsWith("127.")) {
    return `${proto}://${host}`;
  }
  const envUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
  return (envUrl || "https://ledger.simulcast.com.np").replace(/\/$/, "");
}

export async function GET(request: Request) {
  const serverUrl = resolveBaseUrl(request);

  const openapiSpec = {
    openapi: "3.0.3",
    info: {
      title: "Kashtrix ERP MCP & Ledger API",
      version: "1.0.0",
      description:
        "Official OpenAI Actions & MCP API for Kashtrix ERP. Execute full CRUD operations on Bank Accounts, Transactions, Expenses, Invoices, Purchases, Contacts, and AI Document Extractions.",
      contact: {
        name: "Kashtrix Support",
        email: "support@simulcast.com.np",
      },
    },
    servers: [
      {
        url: serverUrl,
        description: "Kashtrix Production Server",
      },
    ],
    paths: {
      "/api/mcp": {
        post: {
          operationId: "executeMcpJsonRpc",
          summary: "Execute MCP JSON-RPC 2.0 command",
          description: "Main JSON-RPC endpoint supporting tools/list, tools/call, resources/list, and initialize.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    jsonrpc: { type: "string", default: "2.0" },
                    id: { type: "string", default: "1" },
                    method: { type: "string", description: "tools/call or tools/list" },
                    params: { type: "object", description: "Method parameters" },
                  },
                  required: ["method"],
                },
              },
            },
          },
          responses: {
            "200": {
              description: "JSON-RPC response",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      jsonrpc: { type: "string" },
                      id: { type: "string" },
                      result: { type: "object" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/api/mcp/companies": {
        get: {
          operationId: "getCompaniesDetails",
          summary: "Get all companies and workspace details",
          description:
            "Retrieve comprehensive details for all registered companies and workspaces (e.g. Simulcast Technologies Pvt Ltd, My House, Himalayan Retail Mart), including company ID, name, PAN/VAT number, address, contact email, phone, fiscal year (2083/2084 BS), active status, bank accounts, and current balances.",
          parameters: [
            {
              name: "company",
              in: "query",
              required: false,
              schema: { type: "string" },
              description: "Optional company name, slug, workspace ('simulcast', 'house', 'office'), or company ID",
            },
          ],
          responses: {
            "200": {
              description: "List of registered companies with full profiles and balances",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      count: { type: "integer" },
                      companies: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            id: { type: "string" },
                            name: { type: "string" },
                            slug: { type: "string" },
                            kind: { type: "string" },
                            panVatNumber: { type: "string" },
                            address: { type: "string" },
                            email: { type: "string" },
                            phone: { type: "string" },
                            fiscalYear: { type: "string" },
                            totalBankBalance: { type: "number" },
                            bankAccounts: { type: "array", items: { type: "object" } },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        post: {
          operationId: "postCompaniesDetails",
          summary: "Query companies and workspace details",
          description: "Query company and organization profile details via POST payload.",
          requestBody: {
            required: false,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    company: { type: "string", description: "Company name, slug, or workspace alias" },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Company details result",
              content: { "application/json": { schema: { type: "object" } } },
            },
          },
        },
      },
      "/api/mcp/transactions": {
        get: {
          operationId: "getCompanyTransactions",
          summary: "Get company bank transactions and ledger records",
          description:
            "Retrieve complete bank transactions, sales, payments, receipts, and ledger statements for any registered company. Supports Nepali Bikram Sambat periods (e.g. 'ashoj' / '2083-06', 'bhadra', 'shrawan'), English dates (e.g. '2026-10', 'today', 'all'), transaction types (DEPOSIT, WITHDRAWAL, ALL), and keyword searches.",
          parameters: [
            {
              name: "month",
              in: "query",
              required: false,
              schema: { type: "string" },
              description: "Billing month or period: 'ashoj' (or '2083-06'), 'bhadra', 'shrawan', '2026-10', 'today', 'all'",
            },
            {
              name: "company",
              in: "query",
              required: false,
              schema: { type: "string" },
              description: "Company or workspace filter: 'simulcast', 'house', 'office', or company name / slug",
            },
            {
              name: "type",
              in: "query",
              required: false,
              schema: { type: "string", enum: ["DEPOSIT", "WITHDRAWAL", "ALL"] },
              description: "Filter by transaction type: DEPOSIT, WITHDRAWAL, or ALL",
            },
            {
              name: "search",
              in: "query",
              required: false,
              schema: { type: "string" },
              description: "Search keyword in description, reference, or cheque number",
            },
            {
              name: "limit",
              in: "query",
              required: false,
              schema: { type: "integer", default: 100 },
              description: "Maximum number of transactions to return (up to 500)",
            },
          ],
          responses: {
            "200": {
              description: "List of transactions and cashflow summary",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      period: { type: "string" },
                      summary: {
                        type: "object",
                        properties: {
                          totalRecords: { type: "integer" },
                          totalDeposits: { type: "number" },
                          totalWithdrawals: { type: "number" },
                          netCashflow: { type: "number" },
                        },
                      },
                      transactions: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            id: { type: "string" },
                            date: { type: "string" },
                            type: { type: "string" },
                            amount: { type: "number" },
                            description: { type: "string" },
                            bankName: { type: "string" },
                            accountNumber: { type: "string" },
                            companyName: { type: "string" },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        post: {
          operationId: "postCompanyTransactions",
          summary: "Query company transactions with JSON parameters",
          description: "Query bank transactions for a specific company and period via POST body.",
          requestBody: {
            required: false,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    month: { type: "string", description: "e.g. 'ashoj', '2083-06', '2026-10', 'today'" },
                    company: { type: "string", description: "e.g. 'simulcast', 'house', 'office'" },
                    type: { type: "string", enum: ["DEPOSIT", "WITHDRAWAL", "ALL"] },
                    search: { type: "string" },
                    limit: { type: "integer" },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Transactions query result",
              content: { "application/json": { schema: { type: "object" } } },
            },
          },
        },
      },
      "/api/mcp/balance": {
        get: {
          operationId: "getFinancialBalance",
          summary: "Get live financial balance and receivables/payables",
          description: "Retrieve total bank balance, outstanding receivables, vendor payables, and net position for Simulcast Technologies, My House, or all accounts.",
          parameters: [
            {
              name: "workspace",
              in: "query",
              required: false,
              schema: { type: "string" },
              description: "Workspace alias (e.g. 'simulcast', 'house', 'office') or organization ID",
            },
          ],
          responses: {
            "200": {
              description: "Live financial balance overview",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      summary: { type: "object" },
                      workspaceBreakdown: { type: "array", items: { type: "object" } },
                      bankAccounts: { type: "array", items: { type: "object" } },
                    },
                  },
                },
              },
            },
          },
        },
        post: {
          operationId: "postFinancialBalance",
          summary: "Query live financial balance with JSON parameters",
          description: "Query bank balances, customer receivables, and vendor payables.",
          requestBody: {
            required: false,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    workspace: { type: "string", description: "e.g. 'simulcast', 'house', 'office'" },
                    orgId: { type: "string" },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Live financial balance overview",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      summary: { type: "object" },
                      workspaceBreakdown: { type: "array", items: { type: "object" } },
                      bankAccounts: { type: "array", items: { type: "object" } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    components: {
      securitySchemes: {
        OAuth2: {
          type: "oauth2",
          description: "Kashtrix ERP OAuth 2.0 Authentication",
          flows: {
            authorizationCode: {
              authorizationUrl: `${serverUrl}/api/oauth/authorize`,
              tokenUrl: `${serverUrl}/api/oauth/token`,
              scopes: {
                "mcp:all": "Full read & write access to organization ledger",
                "mcp:read": "Read-only access to organizations, balances and transactions",
                "mcp:write": "Write access to record journals, transactions and invoices",
                "admin": "Administrative access across all organizations",
              },
            },
          },
        },
        BearerAuth: {
          type: "http",
          scheme: "bearer",
          description: "Enter your Kashtrix JWT Access Token or Master Key",
        },
        ApiKeyAuth: {
          type: "apiKey",
          in: "header",
          name: "x-mcp-key",
          description: "Kashtrix MCP Key header",
        },
      },
    },
    security: [{ OAuth2: ["mcp:all", "mcp:read", "mcp:write", "admin"] }, { BearerAuth: [] }],
  };

  return NextResponse.json(openapiSpec, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, x-mcp-key",
    },
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, x-mcp-key",
    },
  });
}
