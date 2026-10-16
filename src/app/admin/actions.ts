"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { redirect } from "next/navigation";

async function requireSuperAdmin() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const fullUser = await db.user.findUnique({ where: { id: user.id } });
  if (!fullUser || fullUser.role !== "SUPER_ADMIN") {
    redirect("/workspaces");
  }
  return fullUser;
}

export async function approveVendorAction(formData: FormData) {
  await requireSuperAdmin();
  const orgId = String(formData.get("orgId") || "");
  const userId = String(formData.get("userId") || "");

  if (orgId) {
    await db.organization.update({
      where: { id: orgId },
      data: { status: "APPROVED" },
    });
  }

  if (userId) {
    await db.user.update({
      where: { id: userId },
      data: { status: "APPROVED" },
    });
  }

  revalidatePath("/admin");
}

export async function rejectVendorAction(formData: FormData) {
  await requireSuperAdmin();
  const orgId = String(formData.get("orgId") || "");
  const userId = String(formData.get("userId") || "");

  if (orgId) {
    await db.organization.update({
      where: { id: orgId },
      data: { status: "REJECTED" },
    });
  }

  if (userId) {
    await db.user.update({
      where: { id: userId },
      data: { status: "REJECTED" },
    });
  }

  revalidatePath("/admin");
}

export async function suspendVendorAction(formData: FormData) {
  await requireSuperAdmin();
  const orgId = String(formData.get("orgId") || "");
  const userId = String(formData.get("userId") || "");

  if (orgId) {
    await db.organization.update({
      where: { id: orgId },
      data: { status: "SUSPENDED" },
    });
  }

  if (userId) {
    await db.user.update({
      where: { id: userId },
      data: { status: "SUSPENDED" },
    });
  }

  revalidatePath("/admin");
}

export async function updateVendorCredentialsAction(formData: FormData) {
  await requireSuperAdmin();
  const userId = String(formData.get("userId") || "");
  const orgId = String(formData.get("orgId") || "");
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const phone = String(formData.get("phone") || "").trim();
  const newPassword = String(formData.get("newPassword") || "");
  const panVatNumber = String(formData.get("panVatNumber") || "").trim();
  const orgName = String(formData.get("orgName") || "").trim();

  if (!userId) return;

  const userUpdateData: any = {};
  if (name) userUpdateData.name = name;
  if (email) userUpdateData.email = email;
  if (phone) userUpdateData.phone = phone;
  if (newPassword && newPassword.length >= 6) {
    userUpdateData.passwordHash = await bcrypt.hash(newPassword, 12);
  }

  await db.user.update({
    where: { id: userId },
    data: userUpdateData,
  });

  if (orgId) {
    const orgUpdateData: any = {};
    if (orgName) orgUpdateData.name = orgName;
    if (panVatNumber) {
      orgUpdateData.panVatNumber = panVatNumber;
      orgUpdateData.taxNumber = panVatNumber;
    }
    if (phone) orgUpdateData.phone = phone;
    if (email) orgUpdateData.email = email;

    await db.organization.update({
      where: { id: orgId },
      data: orgUpdateData,
    });
  }

  revalidatePath("/admin");
}
