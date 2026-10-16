import { db } from "@/lib/db";

export async function getUserWorkspaces(userId: string) {
  return db.membership.findMany({
    where: { userId },
    include: { organization: true },
    orderBy: [{ organization: { kind: "asc" } }, { organization: { name: "asc" } }],
  });
}

export function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50) || `workspace-${Date.now()}`;
}
