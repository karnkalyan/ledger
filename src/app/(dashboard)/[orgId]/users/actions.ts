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
  return { user, membership, organization };
}

export async function addWorkspaceMemberAction(formData: FormData) {
  const orgId = s(formData, "orgId");
  await requireAdminOrOwner(orgId);

  const mode = s(formData, "mode"); // "EXISTING" or "NEW"
  const roleInput = (s(formData, "role") || "VIEWER") as MemberRole;
  const allowedRoles = Object.values(MemberRole);
  const role = allowedRoles.includes(roleInput) ? roleInput : MemberRole.VIEWER;

  // Selected workspaces that this user should be granted access to
  const selectedOrgIds = formData.getAll("allowedOrgIds").map(String).filter(Boolean);
  if (!selectedOrgIds.includes(orgId)) {
    selectedOrgIds.push(orgId);
  }

  let targetUserId = "";

  if (mode === "EXISTING") {
    const existingUserId = s(formData, "existingUserId");
    if (!existingUserId) return;
    const existing = await db.user.findUnique({ where: { id: existingUserId } });
    if (!existing) return;
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
    let user = await db.user.findUnique({ where: { email } });
    if (user) {
      targetUserId = user.id;
    } else {
      const passwordHash = await bcrypt.hash(password, 12);
      user = await db.user.create({
        data: {
          name,
          email,
          phone,
          passwordHash,
          role: "USER",
          status: "APPROVED",
        },
      });
      targetUserId = user.id;
    }
  }

  if (!targetUserId) return;

  // Grant access to selected workspaces
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
  const { organization } = await requireAdminOrOwner(orgId);

  const membershipId = s(formData, "membershipId");
  const newRole = s(formData, "role") as MemberRole;
  if (!membershipId || !newRole) return;

  const membership = await db.membership.findUnique({
    where: { id: membershipId },
  });
  if (!membership || membership.organizationId !== orgId) return;

  // Prevent changing organization owner's role
  if (membership.userId === organization.ownerId && newRole !== "OWNER") {
    throw new Error("Cannot change the primary owner's role.");
  }

  await db.membership.update({
    where: { id: membershipId },
    data: { role: newRole },
  });

  revalidatePath(`/${orgId}/users`);
}

export async function removeWorkspaceMemberAction(formData: FormData) {
  const orgId = s(formData, "orgId");
  const { organization } = await requireAdminOrOwner(orgId);

  const membershipId = s(formData, "membershipId");
  if (!membershipId) return;

  const membership = await db.membership.findUnique({
    where: { id: membershipId },
  });
  if (!membership || membership.organizationId !== orgId) return;

  // Prevent removing workspace owner
  if (membership.userId === organization.ownerId) {
    throw new Error("Cannot remove workspace primary owner.");
  }

  await db.membership.delete({
    where: { id: membershipId },
  });

  revalidatePath(`/${orgId}/users`);
  revalidatePath("/workspaces");
}

export async function updateUserWorkspacesAction(formData: FormData) {
  const orgId = s(formData, "orgId");
  await requireAdminOrOwner(orgId);

  const userId = s(formData, "userId");
  if (!userId) return;

  const targetOrgIds = formData.getAll("allowedOrgIds").map(String).filter(Boolean);

  // Get current user memberships
  const currentMemberships = await db.membership.findMany({
    where: { userId },
  });
  const currentOrgIds = new Set(currentMemberships.map((m) => m.organizationId));
  const newOrgIds = new Set(targetOrgIds);

  // Add missing memberships
  for (const id of newOrgIds) {
    if (!currentOrgIds.has(id)) {
      await db.membership.create({
        data: {
          userId,
          organizationId: id,
          role: MemberRole.VIEWER,
        },
      });
    }
  }

  // Remove revoked memberships (except for organizations they own)
  for (const m of currentMemberships) {
    if (!newOrgIds.has(m.organizationId)) {
      const owned = await db.organization.findFirst({
        where: { id: m.organizationId, ownerId: userId },
      });
      if (!owned) {
        await db.membership.delete({ where: { id: m.id } });
      }
    }
  }

  revalidatePath(`/${orgId}/users`);
  revalidatePath("/admin");
  revalidatePath("/workspaces");
}
