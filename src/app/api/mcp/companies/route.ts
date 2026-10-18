import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyMcpAuth } from "@/lib/mcp-auth";

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
  return handleCompanies(request);
}

export async function POST(request: Request) {
  return handleCompanies(request);
}

async function handleCompanies(request: Request) {
  const auth = await verifyMcpAuth(request);
  if (!auth.authenticated) {
    return NextResponse.json(
      { error: "Unauthorized", message: auth.error || "Authentication required" },
      { status: 401, headers: corsHeaders() }
    );
  }

  const { searchParams } = new URL(request.url);
  let targetParam =
    searchParams.get("workspace") ||
    searchParams.get("slug") ||
    searchParams.get("id") ||
    searchParams.get("company");

  if (!targetParam && request.method === "POST") {
    try {
      const body = await request.json();
      targetParam = body.workspace || body.slug || body.id || body.company;
    } catch {}
  }

  let orgWhere: any = {};
  if (targetParam) {
    const p = targetParam.trim().toLowerCase();
    if (p === "simulcast" || p === "office" || p === "company") {
      orgWhere = { OR: [{ slug: "simulcast-technologies" }, { kind: "COMPANY" }] };
    } else if (p === "house" || p === "household" || p === "home") {
      orgWhere = { OR: [{ slug: "my-house" }, { kind: "HOUSEHOLD" }] };
    } else {
      orgWhere = {
        OR: [{ slug: targetParam }, { id: targetParam }, { name: { contains: targetParam } }],
      };
    }
  }

  const orgs = await db.organization.findMany({
    where: orgWhere,
    include: {
      bankAccounts: {
        select: {
          id: true,
          bankName: true,
          accountName: true,
          accountNumber: true,
          accountType: true,
          currency: true,
          currentBalance: true,
          isActive: true,
        },
      },
      memberships: {
        select: {
          id: true,
          role: true,
          user: { select: { id: true, name: true, email: true } },
        },
      },
      _count: {
        select: {
          invoices: true,
          expenses: true,
          contacts: true,
          purchaseOrders: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const companies = orgs.map((o: any) => {
    const totalBankBalance = o.bankAccounts.reduce(
      (sum: number, a: any) => sum + (Number(a.currentBalance) || 0),
      0
    );
    return {
      id: o.id,
      name: o.name,
      slug: o.slug,
      kind: o.kind,
      currency: o.currency || "NPR",
      panVatNumber: o.panVatNumber || o.taxNumber || "601928374",
      taxNumber: o.taxNumber || o.panVatNumber || "601928374",
      address: o.address || "Kathmandu, Nepal",
      email: o.email || "accounts@simulcast.local",
      phone: o.phone || "+977-1-5544332",
      status: o.status || "APPROVED",
      fiscalYear: "2083/2084 BS (2026/2027 AD)",
      nepaliYear: "2083 BS",
      totalBankAccounts: o.bankAccounts.length,
      totalBankBalance,
      bankAccounts: o.bankAccounts.map((b: any) => ({
        id: b.id,
        bankName: b.bankName,
        accountName: b.accountName,
        accountNumber: b.accountNumber,
        accountType: b.accountType,
        balance: Number(b.currentBalance) || 0,
        currency: b.currency,
      })),
      membersCount: o.memberships.length,
      members: o.memberships.map((m: any) => ({
        name: m.user.name,
        email: m.user.email,
        role: m.role,
      })),
      stats: {
        totalInvoicesCount: o._count.invoices,
        totalExpensesCount: o._count.expenses,
        totalPurchaseOrdersCount: o._count.purchaseOrders,
        totalContactsCount: o._count.contacts,
      },
    };
  });

  return NextResponse.json(
    {
      success: true,
      count: companies.length,
      companies,
      // Organizations alias for backwards compatibility
      organizations: companies,
    },
    { headers: corsHeaders() }
  );
}
