import { requireOrganizationAccess } from "@/lib/session";
import { MobileMenuPageContent } from "@/components/mobile-menu-page";

export default async function MenuPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const { organization, membership, user } = await requireOrganizationAccess(orgId);

  return (
    <main className="page-wrap">
      <MobileMenuPageContent
        orgId={orgId}
        orgName={organization.name}
        kind={organization.kind}
        taxNumber={organization.taxNumber}
        currency={organization.currency}
        userRole={user.role}
      />
    </main>
  );
}
