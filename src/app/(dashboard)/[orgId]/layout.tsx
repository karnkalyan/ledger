import { AppShell } from "@/components/app-shell";
import { requireOrganizationAccess } from "@/lib/session";
import { cookies } from "next/headers";
import { getCurrentNepaliFiscalYear, getAvailableFiscalYears } from "@/lib/fiscal-year";
import { ToastProvider } from "@/components/toast-provider";
import { db } from "@/lib/db";

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const { user, organization, membership } = await requireOrganizationAccess(orgId);
  const cookieStore = await cookies();
  const fyCookie = cookieStore.get("flowledger_fy")?.value || null;
  const customFyCookie = cookieStore.get("flowledger_custom_fy")?.value || "";
  const customYears = customFyCookie
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n) && n >= 2000);
  const currentFiscalYear = getCurrentNepaliFiscalYear();
  const availableYears = getAvailableFiscalYears(new Date(), customYears);

  const [pendingTasks, pendingReminders] = await Promise.all([
    db.task.findMany({
      where: { organizationId: orgId, status: { not: "DONE" } },
      take: 8,
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    }),
    db.reminder.findMany({
      where: { organizationId: orgId, status: "PENDING" },
      take: 8,
      orderBy: { dueAt: "asc" },
    }),
  ]);

  const mappedTasks = pendingTasks.map((t) => ({
    id: t.id,
    title: t.title,
    dueAt: t.dueAt,
    priority: t.priority,
    type: "task" as const,
  }));

  const mappedReminders = pendingReminders.map((r) => ({
    id: r.id,
    title: r.title,
    dueAt: r.dueAt,
    type: "reminder" as const,
  }));

  return (
    <>
      <ToastProvider />
      <AppShell
        org={{
          id: organization.id,
          name: organization.name,
          kind: organization.kind,
          logoUrl: organization.logoUrl,
          taxNumber: organization.taxNumber || organization.panVatNumber,
        }}
        user={user}
        memberRole={membership.role}
        fiscalInfo={{
          availableYears,
          currentFiscalYear,
          activeCode: fyCookie || currentFiscalYear.slug,
        }}
        pendingTasks={mappedTasks}
        pendingReminders={mappedReminders}
      >
        {children}
      </AppShell>
    </>
  );
}

