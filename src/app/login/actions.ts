"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { createSession, clearSession } from "@/lib/session";

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");

  const user = await db.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    redirect("/login?error=invalid");
  }

  if (user.status === "PENDING") {
    redirect("/pending-approval");
  }

  if (user.status === "REJECTED" || user.status === "SUSPENDED") {
    redirect("/login?error=suspended");
  }

  await createSession(user.id);

  if (user.role === "SUPER_ADMIN") {
    redirect("/admin");
  }

  redirect("/workspaces");
}

export async function logoutAction() {
  await clearSession();
  redirect("/login");
}
