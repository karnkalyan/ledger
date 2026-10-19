import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";

const COOKIE_NAME = "expense_suite_session";
const secret = () => {
  const value = process.env.AUTH_SECRET;
  if (!value && process.env.NODE_ENV === "production") throw new Error("AUTH_SECRET is required in production");
  return new TextEncoder().encode(value || "dev-only-change-me");
};

export async function createSession(userId: string) {
  const token = await new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("14d")
    .sign(secret());

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
}

export async function clearSession() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function getSessionUser() {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (typeof payload.userId !== "string") return null;
    return db.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, name: true, email: true, role: true, status: true },
    });
  } catch {
    return null;
  }
}

export async function requireUser() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status === "PENDING") redirect("/pending-approval");
  if (user.status === "REJECTED" || user.status === "SUSPENDED") {
    redirect("/login?error=suspended");
  }
  return user;
}

export async function requireOrganizationAccess(organizationId: string) {
  const user = await requireUser();

  // Super admins have universal view access
  if (user.role === "SUPER_ADMIN") {
    const organization = await db.organization.findUnique({
      where: { id: organizationId },
    });
    if (!organization) redirect("/workspaces");
    const membership = await db.membership.findFirst({
      where: { organizationId },
    }) || {
      id: "admin-view",
      userId: user.id,
      organizationId,
      role: "OWNER" as any,
      organization,
      createdAt: new Date(),
    };
    return { user, membership, organization };
  }

  const membership = await db.membership.findUnique({
    where: { userId_organizationId: { userId: user.id, organizationId } },
    include: { organization: true },
  });

  if (!membership) redirect("/workspaces");

  if (membership.organization.status === "PENDING") {
    redirect("/pending-approval");
  }

  return { user, membership, organization: membership.organization };
}

export {
  type MemberRoleType,
  ROLE_ALLOWED_MODULES,
  canAccessModule,
} from "./permissions";





