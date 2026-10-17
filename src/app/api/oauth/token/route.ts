import { NextResponse } from "next/server";
import { createMcpToken, verifyMcpToken } from "@/lib/mcp-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let grantType = "authorization_code";
  let code = "";
  let refreshTokenInput = "";

  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("application/x-www-form-urlencoded")) {
    const formData = await request.formData();
    grantType = String(formData.get("grant_type") || "authorization_code");
    code = String(formData.get("code") || "");
    refreshTokenInput = String(formData.get("refresh_token") || "");
  } else if (contentType.includes("application/json")) {
    const json = await request.json().catch(() => ({}));
    grantType = json.grant_type || "authorization_code";
    code = json.code || "";
    refreshTokenInput = json.refresh_token || "";
  }

  let userId = "chatgpt-client";
  let name = "ChatGPT Assistant";
  let email = "chatgpt@openai.com";
  let role = "OWNER";
  let orgId = "";
  let orgSlug = "";
  let orgIds: string[] = [];
  let organizations: any[] = [];

  if (grantType === "refresh_token" && refreshTokenInput) {
    try {
      const payload = await verifyMcpToken(refreshTokenInput);
      if (payload) {
        userId = String(payload.userId || payload.sub || userId);
        name = String(payload.name || name);
        email = String(payload.email || email);
        role = String(payload.role || role);
        orgId = String(payload.orgId || orgId);
        orgSlug = String(payload.orgSlug || orgSlug);
        if (Array.isArray(payload.orgIds)) orgIds = payload.orgIds as string[];
      }
    } catch {}
  } else if (code) {
    try {
      const decoded = JSON.parse(Buffer.from(code, "base64url").toString("utf-8"));
      if (decoded.userId) userId = String(decoded.userId);
      if (decoded.name) name = String(decoded.name);
      if (decoded.email) email = String(decoded.email);
      if (decoded.role) role = String(decoded.role);
      if (decoded.orgId) orgId = String(decoded.orgId);
      if (decoded.orgSlug) orgSlug = String(decoded.orgSlug);
      if (Array.isArray(decoded.orgIds)) orgIds = decoded.orgIds;
      if (Array.isArray(decoded.organizations)) organizations = decoded.organizations;
    } catch {}
  }

  // Generate 30-day access token authorizing ALL user's organizations
  const accessToken = await createMcpToken({
    userId,
    name,
    email,
    role,
    orgId,
    orgIds,
    orgSlug,
    expiresIn: "30d",
  });

  return NextResponse.json(
    {
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: 2592000, // 30 days
      refresh_token: accessToken,
      scope: "mcp:all",
      token: accessToken,
      orgId,
      orgIds,
      organizations,
      orgSlug,
    },
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, x-mcp-key",
      },
    }
  );
}

export async function GET() {
  return NextResponse.json(
    {
      token_endpoint: "/api/oauth/token",
      supported_grant_types: ["authorization_code", "client_credentials"],
    },
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    }
  );
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
