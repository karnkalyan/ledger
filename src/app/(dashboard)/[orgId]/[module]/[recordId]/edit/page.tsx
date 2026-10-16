import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { requireOrganizationAccess } from "@/lib/session";
import { DocumentComposer } from "@/components/document-composer";
import { updateCommerceDocumentAction } from "@/app/(dashboard)/actions";

export default async function EditDocumentPage({
  params,
}: {
  params: Promise<{ orgId: string; module: string; recordId: string }>;
}) {
  const { orgId, module, recordId } = await params;
  const { organization, membership } = await requireOrganizationAccess(orgId);
  if (membership.role === "VIEWER") redirect(`/${orgId}/${module}/${recordId}`);
  if (!["quotes", "invoices"].includes(module)) notFound();

  const [contacts, rawProducts] = await Promise.all([
    db.contact.findMany({
      where: { organizationId: orgId, type: { in: ["CUSTOMER", "BOTH"] } },
      orderBy: { name: "asc" },
    }),
    db.product.findMany({
      where: { organizationId: orgId, active: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const products = rawProducts.map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    salePrice: Number(p.salePrice),
    purchasePrice: Number(p.purchasePrice),
  }));

  if (module === "quotes") {
    const quote = await db.quote.findFirst({
      where: { id: recordId, organizationId: orgId },
      include: { contact: true, items: { include: { product: true } } },
    });
    if (!quote) notFound();

    const initialData = {
      id: quote.id,
      number: quote.quoteNumber,
      contactId: quote.contactId,
      issueDate: quote.issueDate,
      dueDate: quote.validUntil,
      discount: Number(quote.discount),
      terms: quote.terms,
      notes: quote.notes,
      lines: quote.items.map((i) => ({
        description: i.description,
        quantity: Number(i.quantity),
        unitPrice: Number(i.unitPrice),
        taxRate: Number(i.taxRate),
        productId: i.productId || undefined,
      })),
    };

    return (
      <main className="page-wrap">
        <div className="page-header">
          <div>
            <Link href={`/${orgId}/quotes/${quote.id}`} className="topbar-kicker">
              <ArrowLeft size={12} style={{ verticalAlign: "middle", marginRight: 4 }} />
              Back to {quote.quoteNumber}
            </Link>
            <h1 style={{ marginTop: 6 }}>Edit Quotation ({quote.quoteNumber})</h1>
            <p>Modify line items, pricing, tax rates, validity date, or customer details.</p>
          </div>
        </div>

        <div className="table-card" style={{ padding: 24 }}>
          <DocumentComposer
            orgId={orgId}
            kind="QUOTE"
            contacts={contacts}
            products={products}
            currency={organization.currency}
            defaultTaxRate={organization.defaultTaxPercent ? Number(organization.defaultTaxPercent) : 13}
            action={updateCommerceDocumentAction}
            initialData={initialData}
            isEdit
          />
        </div>
      </main>
    );
  }

  if (module === "invoices") {
    const invoice = await db.invoice.findFirst({
      where: { id: recordId, organizationId: orgId },
      include: { contact: true, items: { include: { product: true } } },
    });
    if (!invoice) notFound();

    const initialData = {
      id: invoice.id,
      number: invoice.invoiceNumber,
      contactId: invoice.contactId,
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      discount: Number(invoice.discount),
      terms: invoice.terms,
      notes: invoice.notes,
      lines: invoice.items.map((i) => ({
        description: i.description,
        quantity: Number(i.quantity),
        unitPrice: Number(i.unitPrice),
        taxRate: Number(i.taxRate),
        productId: i.productId || undefined,
      })),
    };

    return (
      <main className="page-wrap">
        <div className="page-header">
          <div>
            <Link href={`/${orgId}/invoices/${invoice.id}`} className="topbar-kicker">
              <ArrowLeft size={12} style={{ verticalAlign: "middle", marginRight: 4 }} />
              Back to {invoice.invoiceNumber}
            </Link>
            <h1 style={{ marginTop: 6 }}>Edit Invoice ({invoice.invoiceNumber})</h1>
            <p>Modify line items, quantities, customer details, and invoice terms.</p>
          </div>
        </div>

        <div className="table-card" style={{ padding: 24 }}>
          <DocumentComposer
            orgId={orgId}
            kind="INVOICE"
            contacts={contacts}
            products={products}
            currency={organization.currency}
            defaultTaxRate={organization.defaultTaxPercent ? Number(organization.defaultTaxPercent) : 13}
            action={updateCommerceDocumentAction}
            initialData={initialData}
            isEdit
          />
        </div>
      </main>
    );
  }

  notFound();
}
