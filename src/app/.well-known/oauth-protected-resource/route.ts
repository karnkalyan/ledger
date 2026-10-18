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

  const protectedResourceMetadata = {
    resource: `${serverUrl}/api/mcp`,
    authorization_servers: [serverUrl],
    scopes_supported: ["mcp:all", "mcp:read", "mcp:write", "admin", "openid", "profile", "email", "offline_access"],
    bearer_methods_supported: ["header"],
    resource_documentation: `${serverUrl}/api/mcp`,
  };

  return NextResponse.json(protectedResourceMetadata, {
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
