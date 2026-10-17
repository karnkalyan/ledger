import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { verifyMcpAuth } from "@/lib/mcp-auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-mcp-key",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(request: Request) {
  // 1. Try Bearer token authorization (ChatGPT / MCP Client userinfo probe)
  const auth = await verifyMcpAuth(request);
  if (auth.authenticated && auth.userId) {
    return NextResponse.json(
      {
        sub: auth.userId,
        id: auth.userId,
        name: auth.name,
        email: auth.email,
        role: auth.role,
        authenticated: true,
        user: {
          id: auth.userId,
          name: auth.name,
          email: auth.email,
          role: auth.role,
        },
        organizations: auth.organizations || [],
      },
      { headers: CORS_HEADERS }
    );
  }

  // 2. Try browser session cookie
  const user = await getSessionUser();
  if (!user || user.status !== "APPROVED") {
    return NextResponse.json({ authenticated: false, error: "Unauthorized" }, { status: 401, headers: CORS_HEADERS });
  }

  let organizations: Array<{ id: string; name: string; slug: string; kind: string; role: string }> = [];

  if (user.role === "SUPER_ADMIN") {
    const all = await db.organization.findMany({
      select: { id: true, name: true, slug: true, kind: true },
      orderBy: { createdAt: "asc" },
    });
    organizations = all.map((o) => ({ ...o, role: "SUPER_ADMIN" }));
  } else {
    const [memberships, owned] = await Promise.all([
      db.membership.findMany({
        where: { userId: user.id },
        include: { organization: true },
      }),
      db.organization.findMany({
        where: { ownerId: user.id },
      }),
    ]);

    const orgMap = new Map<string, { id: string; name: string; slug: string; kind: string; role: string }>();

    for (const m of memberships) {
      orgMap.set(m.organization.id, {
        id: m.organization.id,
        name: m.organization.name,
        slug: m.organization.slug,
        kind: m.organization.kind,
        role: m.role,
      });
    }

    for (const o of owned) {
      if (!orgMap.has(o.id)) {
        orgMap.set(o.id, {
          id: o.id,
          name: o.name,
          slug: o.slug,
          kind: o.kind,
          role: "OWNER",
        });
      }
    }

    organizations = Array.from(orgMap.values());
  }

  return NextResponse.json(
    {
      sub: user.id,
      authenticated: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      organizations,
    },
    { headers: CORS_HEADERS }
  );
}
