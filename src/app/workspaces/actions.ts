"use server";

import { WorkspaceKind, MemberRole } from "@/generated/client";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { slugify } from "@/lib/workspaces";

export async function createWorkspaceAction(formData: FormData) {
  const user = await requireUser();
  const name = String(formData.get("name") || "").trim();
  const kind = String(formData.get("kind") || "HOUSEHOLD") as WorkspaceKind;
  if (!name || !Object.values(WorkspaceKind).includes(kind)) redirect("/workspaces?error=invalid");

  const base = slugify(name);
  let slug = base;
  let i = 2;
  while (await db.organization.findUnique({ where: { slug } })) slug = `${base}-${i++}`;

  const org = await db.organization.create({
    data: {
      name,
      slug,
      kind,
      ownerId: user.id,
      currency: String(formData.get("currency") || "NPR"),
      address: String(formData.get("address") || "") || null,
      memberships: { create: { userId: user.id, role: MemberRole.OWNER } },
      expenseCategories: {
        create: kind === "COMPANY"
          ? ["Office Rent", "Electricity", "Internet", "Grocery", "Milk & Tea", "Transport"].map((n) => ({ name: n }))
          : ["House Rent", "Milk", "Grocery", "Electricity", "Internet", "Transport"].map((n) => ({ name: n })),
      },
    },
  });
  redirect(`/${org.id}`);
}
