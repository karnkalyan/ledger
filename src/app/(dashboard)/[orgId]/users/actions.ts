"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { requireOrganizationAccess } from "@/lib/session";
import { MemberRole } from "@/generated/client";

const s = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

async function requireAdminOrOwner(orgId: string) {
  const { user, membership, organization } = await requireOrganizationAccess(orgId);
  const isSuperAdmin = user.role === "SUPER_ADMIN";
  const isPrivileged = membership.role === "OWNER" || membership.role === "ADMIN" || isSuperAdmin;
  if (!isPrivileged) {
    throw new Error("Only organization owners and admins can manage users and workspace permissions.");
  }
  return { user, membership, organization, isSuperAdmin };
}

export async function addWorkspaceMemberAction(formData: FormData) {
  const orgId = s(formData, "orgId");
  const { user, organization, isSuperAdmin } = await requireAdminOrOwner(orgId);

  const mode = s(formData, "mode"); // "EXISTING" or "NEW"
  const roleInput = (s(formData, "role") || "VIEWER") as MemberRole;
  const allowedRoles = Object.values(MemberRole);
  const role = allowedRoles.includes(roleInput) ? roleInput : MemberRole.VIEWER;

  // Multi-tenant check: regular company admins can only assign organizations owned by their owner
  const permittedOrgs = await db.organization.findMany({
    where: isSuperAdmin ? {} : { ownerId: organization.ownerId },
    select: { id: true },
  });
  const permittedOrgIdSet = new Set(permittedOrgs.map((o) => o.id));

  const submittedOrgIds = formData.getAll("allowedOrgIds").map(String).filter(Boolean);
  const selectedOrgIds = submittedOrgIds.filter((id) => permittedOrgIdSet.has(id));
  if (!selectedOrgIds.includes(orgId)) {
    selectedOrgIds.push(orgId);
  }

  let targetUserId = "";

  if (mode === "EXISTING") {
    const existingUserId = s(formData, "existingUserId");
    if (!existingUserId) return;
    const existing = await db.user.findUnique({ where: { id: existingUserId } });
    if (!existing) return;
    if (existing.role === "SUPER_ADMIN") {
      throw new Error("Security Error: Super Administrator cannot be added via company workspace management.");
    }
    targetUserId = existing.id;
  } else {
    // Creating a brand new user
    const name = s(formData, "name");
    const email = s(formData, "email").toLowerCase();
    const phone = s(formData, "phone") || null;
    const password = s(formData, "password");

    if (!name || !email || !password || password.length < 6) {
      throw new Error("Full name, valid email, and minimum 6-character password are required.");
    }

    // Check if user already exists
    let existingUser = await db.user.findUnique({ where: { email } });
    if (existingUser) {
      if (existingUser.role === "SUPER_ADMIN") {
        throw new Error("Security Error: Cannot link Super Administrator account.");
      }
      targetUserId = existingUser.id;
    } else {
      const passwordHash = await bcrypt.hash(password, 12);
      const newUser = await db.user.create({
        data: {
          name,
          email,
          phone,
          passwordHash,
          role: "USER",
          status: "APPROVED",
        },
      });
      targetUserId = newUser.id;
    }
  }

  if (!targetUserId) return;

  // Grant access only to validated permitted workspaces
  for (const targetOrgId of selectedOrgIds) {
    await db.membership.upsert({
      where: {
        userId_organizationId: {
          userId: targetUserId,
          organizationId: targetOrgId,
        },
      },
      update: {
        role: targetOrgId === orgId ? role : undefined,
      },
      create: {
        userId: targetUserId,
        organizationId: targetOrgId,
        role: targetOrgId === orgId ? role : MemberRole.VIEWER,
      },
    });
  }

  revalidatePath(`/${orgId}/users`);
  revalidatePath("/admin");
  revalidatePath("/workspaces");
}

export async function updateWorkspaceMemberRoleAction(formData: FormData) {
  const orgId = s(formData, "orgId");
  const { user, organization, isSuperAdmin } = await requireAdminOrOwner(orgId);

  const membershipId = s(formData, "membershipId");
  const newRole = s(formData, "role") as MemberRole;
  if (!membershipId || !newRole) return;

  const membership = await db.membership.findUnique({
    where: { id: membershipId },
    include: { user: true },
  });
  if (!membership || membership.organizationId !== orgId) return;

  // Protect Super Admin
  if (membership.user.role === "SUPER_ADMIN") {
    throw new Error("Security Error: Super Administrator role cannot be modified by workspace administrators.");
  }

  // Prevent changing organization owner's role
  if (membership.userId === organization.ownerId) {
    throw new Error("Security Error: Primary organization owner role cannot be changed.");
  }

  await db.membership.update({
    where: { id: membershipId },
    data: { role: newRole },
  });

  revalidatePath(`/${orgId}/users`);
}

export async function removeWorkspaceMemberAction(formData: FormData) {
  const orgId = s(formData, "orgId");
  const { user, organization, isSuperAdmin } = await requireAdminOrOwner(orgId);

  const membershipId = s(formData, "membershipId");
  if (!membershipId) return;

  const membership = await db.membership.findUnique({
    where: { id: membershipId },
    include: { user: true },
  });
  if (!membership || membership.organizationId !== orgId) return;

  // Protect Super Admin
  if (membership.user.role === "SUPER_ADMIN") {
    throw new Error("Security Error: Super Administrator cannot be removed by workspace administrators.");
  }

  // Prevent removing workspace owner
  if (membership.userId === organization.ownerId) {
    throw new Error("Security Error: Primary organization owner cannot be removed.");
  }

  await db.membership.delete({
    where: { id: membershipId },
  });

  revalidatePath(`/${orgId}/users`);
  revalidatePath("/workspaces");
}

export async function updateUserWorkspacesAction(formData: FormData) {
  const orgId = s(formData, "orgId");
  const { user, organization, isSuperAdmin } = await requireAdminOrOwner(orgId);

  const userId = s(formData, "userId");
  if (!userId) return;

  const targetUser = await db.user.findUnique({ where: { id: userId } });
  if (!targetUser) return;

  // Protect Super Admin
  if (targetUser.role === "SUPER_ADMIN") {
    throw new Error("Security Error: Super Administrator workspace access cannot be configured from a company workspace.");
  }

  // Strict multi-tenant isolation: only organizations owned by the same owner can be modified
  const accessibleOrgs = await db.organization.findMany({
    where: isSuperAdmin ? {} : { ownerId: organization.ownerId },
    select: { id: true },
  });
  const allowedOrgIdSet = new Set(accessibleOrgs.map((o) => o.id));

  // Filter incoming IDs: foreign tenant IDs are completely discarded
  const submittedOrgIds = formData.getAll("allowedOrgIds").map(String).filter(Boolean);
  const targetOrgIds = submittedOrgIds.filter((id) => allowedOrgIdSet.has(id));

  // Get current user memberships in this scope
  const currentMemberships = await db.membership.findMany({
    where: { userId },
  });
  const currentScopedMemberships = currentMemberships.filter((m) => allowedOrgIdSet.has(m.organizationId));
  const currentScopedOrgIds = new Set(currentScopedMemberships.map((m) => m.organizationId));
  const newOrgIds = new Set(targetOrgIds);

  // Add missing memberships within permitted scope
  for (const id of newOrgIds) {
    if (!currentScopedOrgIds.has(id)) {
      await db.membership.create({
        data: {
          userId,
          organizationId: id,
          role: MemberRole.VIEWER,
        },
      });
    }
  }

  // Remove revoked memberships within permitted scope (never remove foreign memberships or owned orgs)
  for (const m of currentScopedMemberships) {
    if (!newOrgIds.has(m.organizationId)) {
      const isOwner = m.organizationId === organization.id && userId === organization.ownerId;
      if (!isOwner) {
        await db.membership.delete({ where: { id: m.id } });
      }
    }
  }

  revalidatePath(`/${orgId}/users`);
  revalidatePath("/admin");
  revalidatePath("/workspaces");
}
