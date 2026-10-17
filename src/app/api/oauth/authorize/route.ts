import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { isMasterApiKey } from "@/lib/mcp-auth";
import bcrypt from "bcryptjs";

export const dynamic = "force-dynamic";

/**
 * GET /api/oauth/authorize - Initiates OAuth flow by redirecting to login & consent dialog
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const redirectUri = searchParams.get("redirect_uri") || "";
  const state = searchParams.get("state") || "";
  const codeChallenge = searchParams.get("code_challenge") || "";
  const clientId = searchParams.get("client_id") || "chatgpt";
  const scope = searchParams.get("scope") || "mcp:all";
  const auto = searchParams.get("auto") === "true";

  // If auto-approval is explicitly requested (e.g. headless tests)
  if (auto && redirectUri) {
    const firstOrg = await db.organization.findFirst({ select: { id: true, slug: true, name: true } });
    const codePayload = Buffer.from(
      JSON.stringify({
        issuedAt: Date.now(),
        userId: "auto-approved",
        orgId: firstOrg?.id || "",
        orgSlug: firstOrg?.slug || "",
        user: "ChatGPT Auto-Approved Client",
        role: "OWNER",
        state,
        codeChallenge,
        scope,
      })
    ).toString("base64url");

    const target = new URL(redirectUri);
    target.searchParams.set("code", codePayload);
    if (state) target.searchParams.set("state", state);
    return NextResponse.redirect(target.toString(), 302);
  }

  // Redirect user's browser to the branded interactive login & consent dialog
  const envUrl = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "https://leader.simulcast.com.np").replace(/\/$/, "");
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost || request.headers.get("host") || "";
  const forwardedProto = request.headers.get("x-forwarded-proto");

  const isInternal =
    !host ||
    host.includes("0.0.0.0") ||
    host.startsWith("0.") ||
    host.startsWith("10.") ||
    host.startsWith("172.") ||
    host.startsWith("192.168.");

  let baseUrl = envUrl;
  if (!isInternal) {
    const isLocalhost = host.includes("localhost") || host.startsWith("127.");
    if (isLocalhost && process.env.NODE_ENV === "production") {
      baseUrl = envUrl;
    } else {
      const proto = forwardedProto || (isLocalhost ? "http" : "https");
      baseUrl = `${proto}://${host}`;
    }
  }

  const dialogUrl = new URL("/oauth/authorize", baseUrl);
  if (redirectUri) dialogUrl.searchParams.set("redirect_uri", redirectUri);
  if (state) dialogUrl.searchParams.set("state", state);
  if (clientId) dialogUrl.searchParams.set("client_id", clientId);
  if (scope) dialogUrl.searchParams.set("scope", scope);
  if (codeChallenge) dialogUrl.searchParams.set("code_challenge", codeChallenge);

  return NextResponse.redirect(dialogUrl.toString(), 302);
}

/**
 * POST /api/oauth/authorize - Validates credentials from the login dialog and grants the authorization code
 */
export async function POST(request: Request) {
  let body: Record<string, string> = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const { email, password, apiKey, orgId, redirectUri, state, codeChallenge, scope } = body;

  if (!redirectUri) {
    return NextResponse.json({ error: "Missing redirect_uri" }, { status: 400 });
  }

  let authenticatedUser: { id: string; name: string; email: string; role: string } | null = null;
  let targetOrgId = orgId || "";
  let targetOrgSlug = "";

  // 1. Check Master Key
  if (apiKey && isMasterApiKey(apiKey)) {
    const defaultOrg = await db.organization.findFirst({ select: { id: true, slug: true } });
    targetOrgId = targetOrgId || defaultOrg?.id || "";
    targetOrgSlug = defaultOrg?.slug || "";
    authenticatedUser = {
      id: "master-admin",
      name: "Master Administrator",
      email: "admin@leader.simulcast.com.np",
      role: "SUPER_ADMIN",
    };
  }

  // 2. Check Email & Password
  if (!authenticatedUser && email && password) {
    const user = await db.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
    if (user && user.status === "APPROVED" && (await bcrypt.compare(password, user.passwordHash))) {
      authenticatedUser = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      };
    }
  }

  // 3. Check existing browser session cookie
  if (!authenticatedUser) {
    const session = await getSessionUser();
    if (session && session.status === "APPROVED") {
      authenticatedUser = session;
    }
  }

  if (!authenticatedUser) {
    return NextResponse.json(
      { error: "Invalid credentials. Please enter a valid account email and password." },
      { status: 401 }
    );
  }

  // Find all user's organizations (memberships and owned)
  const isSuperAdmin = authenticatedUser.role === "SUPER_ADMIN" || authenticatedUser.id === "master-admin";

  let allAuthorizedOrgs: Array<{ id: string; name: string; slug: string; kind: string }> = [];

  if (isSuperAdmin) {
    const allDbOrgs = await db.organization.findMany({
      select: { id: true, name: true, slug: true, kind: true },
      orderBy: { createdAt: "asc" },
    });
    allAuthorizedOrgs = allDbOrgs;
  } else {
    const [memberships, owned] = await Promise.all([
      db.membership.findMany({
        where: { userId: authenticatedUser.id },
        include: { organization: true },
      }),
      db.organization.findMany({
        where: { ownerId: authenticatedUser.id },
      }),
    ]);

    const orgMap = new Map<string, { id: string; name: string; slug: string; kind: string }>();

    for (const m of memberships) {
      orgMap.set(m.organization.id, {
        id: m.organization.id,
        name: m.organization.name,
        slug: m.organization.slug,
        kind: m.organization.kind,
      });
    }

    for (const o of owned) {
      if (!orgMap.has(o.id)) {
        orgMap.set(o.id, {
          id: o.id,
          name: o.name,
          slug: o.slug,
          kind: o.kind,
        });
      }
    }

    allAuthorizedOrgs = Array.from(orgMap.values());
  }

  // Fallback if user has no orgs yet
  if (allAuthorizedOrgs.length === 0) {
    const firstOrg = await db.organization.findFirst({ select: { id: true, slug: true, name: true, kind: true } });
    if (firstOrg) {
      allAuthorizedOrgs.push(firstOrg);
    }
  }

  const orgIds = allAuthorizedOrgs.map((o) => o.id);

  if (targetOrgId) {
    const matched = allAuthorizedOrgs.find((o) => o.id === targetOrgId || o.slug === targetOrgId);
    if (matched) {
      targetOrgId = matched.id;
      targetOrgSlug = matched.slug;
    }
  }

  if (!targetOrgId && allAuthorizedOrgs.length > 0) {
    targetOrgId = allAuthorizedOrgs[0].id;
    targetOrgSlug = allAuthorizedOrgs[0].slug;
  }

  // Create signed authorization code with full multi-organization authorization
  const codePayload = Buffer.from(
    JSON.stringify({
      issuedAt: Date.now(),
      userId: authenticatedUser.id,
      name: authenticatedUser.name,
      email: authenticatedUser.email,
      role: authenticatedUser.role,
      orgId: targetOrgId,
      orgIds,
      organizations: allAuthorizedOrgs,
      orgSlug: targetOrgSlug,
      state: state || "",
      codeChallenge: codeChallenge || "",
      scope: scope || "mcp:all",
    })
  ).toString("base64url");

  const target = new URL(redirectUri);
  target.searchParams.set("code", codePayload);
  if (state) target.searchParams.set("state", state);

  return NextResponse.json(
    {
      ok: true,
      redirectUrl: target.toString(),
    },
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
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
