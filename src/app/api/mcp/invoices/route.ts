import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyMcpAuth, resolveOrgFilter, resolveOrgId } from "@/lib/mcp-auth";

export const dynamic = "force-dynamic";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-mcp-key",
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function GET(request: Request) {
  const auth = await verifyMcpAuth(request);
  if (!auth.authenticated) {
    return NextResponse.json(
      { error: "Unauthorized", message: auth.error || "Authentication required" },
      { status: 401, headers: corsHeaders() }
    );
  }

  const { searchParams } = new URL(request.url);
  const workspaceParam = searchParams.get("workspace") || searchParams.get("orgId");
  const statusParam = searchParams.get("status");
  const limit = Math.min(500, Math.max(1, parseInt(searchParams.get("limit") || "100", 10)));

  try {
    const orgFilter = await resolveOrgFilter(auth, workspaceParam || undefined);
    const where: any = { ...orgFilter };
    if (statusParam && statusParam !== "ALL") where.status = statusParam;

    const invoices = await db.invoice.findMany({
      where,
      include: {
        contact: true,
        items: true,
        payments: true,
        organization: { select: { id: true, name: true, slug: true, kind: true } },
      },
      take: limit,
      orderBy: { issueDate: "desc" },
    });

    const summary = {
      totalInvoices: invoices.length,
      totalBilled: invoices.reduce((sum, i) => sum + Number(i.total), 0),
      totalCollected: invoices.reduce((sum, i) => sum + Number(i.paidAmount), 0),
      totalOutstanding: invoices.reduce(
        (sum, i) => sum + Math.max(0, Number(i.total) - Number(i.paidAmount)),
        0
      ),
    };

    return NextResponse.json(
      { success: true, summary, invoices },
      { status: 200, headers: corsHeaders() }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500, headers: corsHeaders() }
    );
  }
}

export async function POST(request: Request) {
  const auth = await verifyMcpAuth(request);
  if (!auth.authenticated) {
    return NextResponse.json(
      { error: "Unauthorized", message: auth.error || "Authentication required" },
      { status: 401, headers: corsHeaders() }
    );
  }

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400, headers: corsHeaders() }
    );
  }

  const action = body.action || (body.paymentAmount ? "payment" : "create");
  const targetOrgId = await resolveOrgId(auth, body.workspace || body.orgId);

  try {
    if (action === "payment" || body.paymentAmount !== undefined) {
      const invoice = await db.invoice.findFirst({
        where: { id: body.invoiceId, organizationId: targetOrgId },
      });
      if (!invoice) {
        return NextResponse.json(
          { error: `Invoice ${body.invoiceId} not found` },
          { status: 404, headers: corsHeaders() }
        );
      }

      const pAmount = Number(body.paymentAmount || body.amount);
      const newPaid = Number(invoice.paidAmount) + pAmount;
      const isPaid = newPaid >= Number(invoice.total);

      const [payment] = await db.$transaction([
        db.invoicePayment.create({
          data: {
            invoiceId: invoice.id,
            amount: pAmount,
            paidAt: body.paidAt ? new Date(body.paidAt) : new Date(),
            method: body.method || "BANK",
            reference: body.reference || null,
            notes: body.notes || null,
          },
        }),
        db.invoice.update({
          where: { id: invoice.id },
          data: {
            paidAmount: newPaid,
            status: isPaid ? "PAID" : "PARTIAL",
          },
        }),
      ]);

      return NextResponse.json(
        {
          success: true,
          message: `Payment of NPR ${pAmount} recorded for Invoice #${invoice.invoiceNumber}. New Status: ${isPaid ? "PAID" : "PARTIAL"}.`,
          payment,
        },
        { status: 200, headers: corsHeaders() }
      );
    }

    // Create Invoice
    let contactId = body.contactId;
    if (!contactId && body.customerName) {
      let contact = await db.contact.findFirst({
        where: { organizationId: targetOrgId, name: body.customerName },
      });
      if (!contact) {
        contact = await db.contact.create({
          data: {
            organizationId: targetOrgId,
            name: body.customerName,
            type: "CUSTOMER",
          },
        });
      }
      contactId = contact.id;
    }

    const items = Array.isArray(body.items) ? body.items : [];
    let subtotal = 0;
    let taxTotal = 0;
    const lineItems = items.map((i: any) => {
      const qty = Number(i.quantity) || 1;
      const price = Number(i.unitPrice) || 0;
      const amount = qty * price;
      const rate = Number(i.taxRate) || 13;
      const tax = amount * (rate / 100);
      subtotal += amount;
      taxTotal += tax;
      return {
        description: i.description,
        quantity: qty,
        unitPrice: price,
        taxRate: rate,
        amount,
      };
    });

    const total = subtotal + taxTotal;
    const invoiceNumber = body.invoiceNumber || `INV-${Date.now().toString().slice(-6)}`;

    const invoice = await db.invoice.create({
      data: {
        organizationId: targetOrgId,
        invoiceNumber,
        contactId: contactId || null,
        status: "SENT",
        issueDate: body.issueDate ? new Date(body.issueDate) : new Date(),
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        subtotal,
        tax: taxTotal,
        total,
        notes: body.notes || null,
        items: { create: lineItems },
      },
      include: { items: true, contact: true },
    });

    return NextResponse.json(
      {
        success: true,
        message: `Invoice #${invoice.invoiceNumber} created (Total: NPR ${invoice.total}).`,
        invoice,
      },
      { status: 201, headers: corsHeaders() }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500, headers: corsHeaders() }
    );
  }
}
