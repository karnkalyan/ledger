import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user || user.status !== "APPROVED") {
    return NextResponse.json({ authenticated: false }, { status: 401 });
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

  return NextResponse.json({
    authenticated: true,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
    organizations,
  });
}
