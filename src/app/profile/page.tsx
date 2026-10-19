import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";

export default async function GenericProfileRedirect() {
  const user = await requireUser();
  const membership = await db.membership.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });

  if (membership) {
    redirect(`/${membership.organizationId}/profile`);
  }
  redirect("/workspaces");
}
