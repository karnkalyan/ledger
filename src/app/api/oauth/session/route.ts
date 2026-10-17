import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user || user.status !== "APPROVED") {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const memberships = await db.membership.findMany({
    where: { userId: user.id },
    include: { organization: true },
  });

  return NextResponse.json({
    authenticated: true,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
    organizations: memberships.map((m) => ({
      id: m.organization.id,
      name: m.organization.name,
      slug: m.organization.slug,
      kind: m.organization.kind,
      role: m.role,
    })),
  });
}
