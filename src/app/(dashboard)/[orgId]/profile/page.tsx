import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, User, ShieldCheck } from "lucide-react";
import { requireOrganizationAccess } from "@/lib/session";
import { db } from "@/lib/db";
import { UserProfileForm } from "@/components/user-profile-form";

export const metadata = {
  title: "My User Profile & Security Settings | Kashtrix ERP",
  description: "Update account details, name, email, password, and profile avatar.",
};

export default async function UserProfilePage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const { organization, user } = await requireOrganizationAccess(orgId);

  // Fetch complete user record with avatarUrl and memberships
  const fullUser = await db.user.findUnique({
    where: { id: user.id },
    include: {
      memberships: {
        include: { organization: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!fullUser) notFound();

  return (
    <main className="page-wrap">
      <div className="page-header no-print">
        <div>
          <Link href={`/${orgId}`} className="topbar-kicker">
            <ArrowLeft size={12} style={{ verticalAlign: "middle", marginRight: 4 }} />
            Back to Dashboard
          </Link>
          <h1 style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 10 }}>
            <span>Account Profile &amp; Security</span>
          </h1>
          <p>
            Manage your personal profile, credentials, password, and security preferences for Kashtrix ERP.
          </p>
        </div>
      </div>

      <UserProfileForm
        user={{
          id: fullUser.id,
          name: fullUser.name,
          email: fullUser.email,
          phone: fullUser.phone,
          avatarUrl: (fullUser as any).avatarUrl,
          role: fullUser.role,
          status: fullUser.status,
        }}
        orgId={orgId}
        orgName={organization.name}
        memberships={fullUser.memberships.map((m) => ({
          role: m.role,
          organization: {
            id: m.organization.id,
            name: m.organization.name,
            kind: m.organization.kind,
          },
        }))}
      />
    </main>
  );
}
