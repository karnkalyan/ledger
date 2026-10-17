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
