import Link from "next/link";
import { ArrowLeft, Users, ShieldCheck, UserPlus } from "lucide-react";
import { db } from "@/lib/db";
import { requireOrganizationAccess } from "@/lib/session";
import { WorkspaceUsersClient } from "@/components/workspace-users-client";

export default async function WorkspaceUsersPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const { organization, membership, user } = await requireOrganizationAccess(orgId);

  // Fetch all members of this workspace
  const rawMembers = await db.membership.findMany({
    where: { organizationId: orgId },
    include: {
      user: {
        include: {
          memberships: {
            include: { organization: true },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  // Multi-tenant security scoping: regular company admins can only see workspaces
  // owned by their organization owner. Cross-tenant organizations (other vendors) are never leaked.
  const isActorSuperAdmin = user.role === "SUPER_ADMIN";
  const allWorkspaces = await db.organization.findMany({
    where: isActorSuperAdmin
      ? {}
      : { ownerId: organization.ownerId },
    select: { id: true, name: true, kind: true },
    orderBy: { name: "asc" },
  });

  // Candidate users: exclude SUPER_ADMIN accounts and users from completely separate vendor organizations
  const memberUserIds = new Set(rawMembers.map((m) => m.userId));
  const candidateUsers = await db.user.findMany({
    where: {
      id: { notIn: Array.from(memberUserIds) },
      role: { not: "SUPER_ADMIN" },
      ...(isActorSuperAdmin
        ? {}
        : {
            memberships: {
              some: {
                organization: {
                  ownerId: organization.ownerId,
                },
              },
            },
          }),
    },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });

  const formattedMembers = rawMembers.map((m) => ({
    id: m.id,
    userId: m.userId,
    role: m.role,
    createdAt: m.createdAt,
    user: {
      id: m.user.id,
      name: m.user.name,
      email: m.user.email,
      phone: m.user.phone,
      role: m.user.role,
      status: m.user.status,
    },
    isSuperAdmin: m.user.role === "SUPER_ADMIN",
    isOwner: m.userId === organization.ownerId,
    userWorkspaces: m.user.memberships
      .filter((mem) => isActorSuperAdmin || mem.organization.ownerId === organization.ownerId)
      .map((mem) => ({
        id: mem.organization.id,
        name: mem.organization.name,
        kind: mem.organization.kind,
        role: mem.role,
      })),
  }));


  return (
    <main className="page-wrap">
      <div className="page-header no-print">
        <div>
          <Link href={`/${orgId}`} className="topbar-kicker">
            <ArrowLeft size={12} style={{ verticalAlign: "middle", marginRight: 4 }} />
            Back to Dashboard
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}>
            <h1 style={{ margin: 0 }}>User Management &amp; Access Control</h1>
            <span className="badge purple" style={{ fontSize: 12 }}>
              {organization.name}
            </span>
          </div>
          <p style={{ margin: "4px 0 0 0" }}>
            Assign company team members, configure workspace roles (Admin, Accountant, CRM / Sales, HR, Viewer), and manage accessible workspaces.
          </p>
        </div>
      </div>

      <WorkspaceUsersClient
        orgId={orgId}
        currentOrgName={organization.name}
        ownerId={organization.ownerId}
        members={formattedMembers}
        candidateUsers={candidateUsers}
        allWorkspaces={allWorkspaces}
        isActorSuperAdmin={isActorSuperAdmin}
      />
    </main>
  );
}
