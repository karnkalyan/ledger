import { SignJWT, jwtVerify } from "jose";
import { db } from "@/lib/db";

const MCP_SECRET_STR =
  process.env.MCP_JWT_SECRET ||
  process.env.AUTH_SECRET ||
  "leader_mcp_jwt_secret_secure_key_2026_x92817491823";
const MCP_SECRET = new TextEncoder().encode(MCP_SECRET_STR);

export interface McpTokenPayload {
  userId: string;
  orgId: string;
  orgSlug?: string;
  name: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

/**
 * Creates an encrypted JWT access token for ChatGPT / MCP clients
 */
export async function createMcpToken(payload: {
  userId: string;
  orgId: string;
  orgSlug?: string;
  name: string;
  email: string;
  role?: string;
  expiresIn?: string;
}): Promise<string> {
  const token = await new SignJWT({
    userId: payload.userId,
    orgId: payload.orgId,
    orgSlug: payload.orgSlug || "",
    name: payload.name,
    email: payload.email,
    role: payload.role || "OWNER",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.userId)
    .setIssuedAt()
    .setExpirationTime(payload.expiresIn || "30d")
    .sign(MCP_SECRET);

  return token;
}

/**
 * Verifies an incoming MCP API request by checking:
 * 1. Bearer JWT token against secret
 * 2. Master MCP Key
 * 3. x-mcp-key or x-api-key header
 */
export async function verifyMcpAuth(req: Request): Promise<{
  authenticated: boolean;
  userId?: string;
  orgId?: string;
  orgSlug?: string;
  role?: string;
  name?: string;
  email?: string;
  isMaster?: boolean;
  error?: string;
}> {
  const authHeader = req.headers.get("authorization") || "";
  const customKey = req.headers.get("x-mcp-key") || req.headers.get("x-api-key");
  const masterKey = process.env.MCP_API_KEY || "leader_master_mcp_api_key_2026_sec";

  let token = "";
  if (authHeader.startsWith("Bearer ")) {
    token = authHeader.slice(7).trim();
  } else if (customKey) {
    token = customKey.trim();
  }

  if (!token) {
    return {
      authenticated: false,
      error: "Missing authorization token. Provide 'Authorization: Bearer <token>' or 'x-mcp-key'.",
    };
  }

  // 1. Direct match with Master Key
  if (token === masterKey) {
    // Get the first organization as fallback for master admin
    const defaultOrg = await db.organization.findFirst({
      select: { id: true, slug: true, name: true },
    });
    return {
      authenticated: true,
      userId: "master-admin",
      orgId: defaultOrg?.id || "",
      orgSlug: defaultOrg?.slug || "",
      role: "SUPER_ADMIN",
      name: "Master Administrator",
      email: "admin@leader.simulcast.com.np",
      isMaster: true,
    };
  }

  // 2. JWT Verification
  try {
    const { payload } = await jwtVerify(token, MCP_SECRET, { algorithms: ["HS256"] });
    const userId = String(payload.userId || payload.sub || "");
    let orgId = String(payload.orgId || "");
    const role = String(payload.role || "OWNER");
    const name = String(payload.name || "MCP User");
    const email = String(payload.email || "");
    const orgSlug = String(payload.orgSlug || "");

    // If orgId wasn't in the token, fetch user's first organization
    if (!orgId && userId) {
      const membership = await db.membership.findFirst({
        where: { userId },
        include: { organization: true },
      });
      if (membership) {
        orgId = membership.organizationId;
      }
    }

    return {
      authenticated: true,
      userId,
      orgId,
      orgSlug,
      role,
      name,
      email,
    };
  } catch {
    // JWT verification failed
  }

  return { authenticated: false, error: "Invalid or expired MCP authentication token." };
}

/**
 * Resolves the target organization ID for a tool execution
 */
export async function resolveOrgId(
  auth: { orgId?: string; isMaster?: boolean; role?: string },
  requestedOrgId?: string
): Promise<string> {
  if (requestedOrgId && (auth.isMaster || auth.role === "SUPER_ADMIN")) {
    return requestedOrgId;
  }
  if (auth.orgId) return auth.orgId;
  if (requestedOrgId) return requestedOrgId;

  // Fallback to first org in DB
  const first = await db.organization.findFirst({ select: { id: true } });
  return first?.id || "";
}
