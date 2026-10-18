import { NextResponse } from "next/server";
import { createMcpToken, verifyMcpToken } from "@/lib/mcp-auth";

export const dynamic = "force-dynamic";

function oauthError(error: string, description: string, status = 400) {
  return NextResponse.json(
    { error, error_description: description },
    {
      status,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, x-mcp-key",
        "Cache-Control": "no-store",
      },
    }
  );
}

async function pkceS256(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return Buffer.from(digest).toString("base64url");
}

export async function POST(request: Request) {
  let grantType = "authorization_code";
  let code = "";
  let refreshTokenInput = "";
  let codeVerifier = "";
  let redirectUri = "";
  let clientId = "";
  let requestedResource = "";

  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("application/x-www-form-urlencoded")) {
    const formData = await request.formData();
    grantType = String(formData.get("grant_type") || "authorization_code");
    code = String(formData.get("code") || "");
    refreshTokenInput = String(formData.get("refresh_token") || "");
    codeVerifier = String(formData.get("code_verifier") || "");
    redirectUri = String(formData.get("redirect_uri") || "");
    clientId = String(formData.get("client_id") || "");
    requestedResource = String(formData.get("resource") || "");
  } else if (contentType.includes("application/json")) {
    const json = await request.json().catch(() => ({}));
    grantType = json.grant_type || "authorization_code";
    code = json.code || "";
    refreshTokenInput = json.refresh_token || "";
    codeVerifier = json.code_verifier || "";
    redirectUri = json.redirect_uri || "";
    clientId = json.client_id || "";
    requestedResource = json.resource || "";
  } else {
    return oauthError("invalid_request", "Use application/x-www-form-urlencoded or application/json.");
  }

  let userId = "";
  let name = "";
  let email = "";
  let role = "";
  let orgId = "";
  let orgSlug = "";
  let orgIds: string[] = [];
  let grantedScope = "mcp:read mcp:write offline_access";
  let resource = requestedResource;

  if (grantType === "refresh_token") {
    if (!refreshTokenInput) return oauthError("invalid_request", "refresh_token is required.");
    const payload = await verifyMcpToken(refreshTokenInput);
    if (!payload || payload.tokenUse !== "refresh_token") {
      return oauthError("invalid_grant", "The refresh token is invalid or expired.");
    }
    userId = String(payload.userId || payload.sub || "");
    name = String(payload.name || "");
    email = String(payload.email || "");
    role = String(payload.role || "OWNER");
    orgId = String(payload.orgId || "");
    orgSlug = String(payload.orgSlug || "");
    if (Array.isArray(payload.orgIds)) orgIds = payload.orgIds as string[];
    grantedScope = String(payload.scope || grantedScope);
    resource = String(payload.resource || requestedResource || "");
  } else if (grantType === "authorization_code") {
    if (!code) return oauthError("invalid_request", "authorization code is required.");
    const payload = await verifyMcpToken(code);
    if (!payload || payload.tokenUse !== "authorization_code") {
      return oauthError("invalid_grant", "The authorization code is invalid or expired.");
    }

    const expectedRedirectUri = String(payload.redirectUri || "");
    const expectedClientId = String(payload.clientId || "");
    const expectedResource = String(payload.resource || "");
    const codeChallenge = String(payload.codeChallenge || "");
    const codeChallengeMethod = String(payload.codeChallengeMethod || "S256");
    if (expectedRedirectUri && redirectUri !== expectedRedirectUri) {
      return oauthError("invalid_grant", "redirect_uri does not match the authorization request.");
    }
    if (expectedClientId && clientId !== expectedClientId) {
      return oauthError("invalid_grant", "client_id does not match the authorization request.");
    }
    if (expectedResource && requestedResource && requestedResource !== expectedResource) {
      return oauthError("invalid_target", "resource does not match the authorization request.");
    }
    if (codeChallenge) {
      if (!codeVerifier || codeChallengeMethod !== "S256" || (await pkceS256(codeVerifier)) !== codeChallenge) {
        return oauthError("invalid_grant", "PKCE code verification failed.");
      }
    }

    userId = String(payload.userId || payload.sub || "");
    name = String(payload.name || "");
    email = String(payload.email || "");
    role = String(payload.role || "OWNER");
    orgId = String(payload.orgId || "");
    orgSlug = String(payload.orgSlug || "");
    if (Array.isArray(payload.orgIds)) orgIds = payload.orgIds as string[];
    grantedScope = String(payload.scope || grantedScope);
    resource = expectedResource || requestedResource;
  } else {
    return oauthError("unsupported_grant_type", "Supported grant types are authorization_code and refresh_token.");
  }

  if (!userId) return oauthError("invalid_grant", "The authorization grant has no user identity.");

  // Short-lived access tokens and independently renewable refresh tokens keep
  // ChatGPT connected without treating a refresh credential as a bearer token.
  const accessToken = await createMcpToken({
    userId,
    name,
    email,
    role,
    orgId,
    orgIds,
    orgSlug,
    expiresIn: "1h",
    tokenUse: "access_token",
    scope: grantedScope,
    resource,
  });
  const refreshToken = await createMcpToken({
    userId,
    name,
    email,
    role,
    orgId,
    orgIds,
    orgSlug,
    expiresIn: "90d",
    tokenUse: "refresh_token",
    scope: grantedScope,
    resource,
  });

  return NextResponse.json(
    {
      access_token: accessToken,
      id_token: accessToken,
      token_type: "Bearer",
      expires_in: 3600,
      refresh_token: refreshToken,
      scope: grantedScope,
      token: accessToken,
      orgId,
      orgIds,
      orgSlug,
    },
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, x-mcp-key",
        "Cache-Control": "no-store",
      },
    }
  );
}

export async function GET() {
  return NextResponse.json(
    {
      token_endpoint: "/api/oauth/token",
      supported_grant_types: ["authorization_code", "refresh_token"],
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
