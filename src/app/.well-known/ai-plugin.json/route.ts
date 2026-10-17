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

  const manifest = {
    schema_version: "v1",
    name_for_model: "kashtrix_erp",
    name_for_human: "Kashtrix ERP Ledger",
    description_for_model:
      "Kashtrix ERP financial assistant. Query live total bank balances, customer receivables, vendor payables, expenses, invoices, and bank statements across all authorized company and household workspaces.",
    description_for_human:
      "Manage company and household ledgers, bank transactions, expenses, invoices, and real-time financial balances.",
    auth: {
      type: "oauth",
      client_url: `${serverUrl}/api/oauth/authorize`,
      scope: "mcp:all",
      authorization_url: `${serverUrl}/api/oauth/token`,
      authorization_content_type: "application/x-www-form-urlencoded",
      verification_tokens: {},
    },
    api: {
      type: "openapi",
      url: `${serverUrl}/api/mcp/openapi.json`,
    },
    logo_url: `${serverUrl}/logo-mark.png`,
    contact_email: "support@simulcast.com.np",
    legal_info_url: `${serverUrl}`,
  };

  return NextResponse.json(manifest, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
