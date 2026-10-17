import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyMcpAuth, resolveOrgFilter } from "@/lib/mcp-auth";

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
  return handleBalanceRequest(request);
}

export async function POST(request: Request) {
  return handleBalanceRequest(request);
}

async function handleBalanceRequest(request: Request) {
  const auth = await verifyMcpAuth(request);
  if (!auth.authenticated) {
    return NextResponse.json(
      { error: "Unauthorized", message: auth.error || "Authentication required" },
      { status: 401, headers: corsHeaders() }
    );
  }

  const { searchParams } = new URL(request.url);
  let targetOrgParam = searchParams.get("workspace") || searchParams.get("orgId");

  if (!targetOrgParam && request.method === "POST") {
    try {
      const body = await request.json();
      targetOrgParam = body.workspace || body.orgId;
    } catch {
      // Ignore JSON parse errors
    }
  }

  try {
    const orgFilter = await resolveOrgFilter(auth, targetOrgParam || undefined);

    const [bankAccounts, invoices, purchaseOrders, loans] = await Promise.all([
      db.bankAccount.findMany({
        where: { ...orgFilter },
        select: {
          id: true,
          bankName: true,
          accountName: true,
          accountNumber: true,
          accountType: true,
          branch: true,
          currency: true,
          currentBalance: true,
          organizationId: true,
          organization: { select: { id: true, name: true, kind: true, currency: true } },
        },
      }),
      db.invoice.findMany({
        where: { ...orgFilter },
        select: {
          id: true,
          invoiceNumber: true,
          total: true,
          paidAmount: true,
          status: true,
          organizationId: true,
          organization: { select: { id: true, name: true, kind: true } },
        },
      }),
      db.purchaseOrder.findMany({
        where: { ...orgFilter },
        select: {
          id: true,
          orderNumber: true,
          total: true,
          paidAmount: true,
          status: true,
          organizationId: true,
          organization: { select: { id: true, name: true, kind: true } },
        },
      }),
      db.loan.findMany({
        where: { ...orgFilter },
        select: {
          id: true,
          principalAmount: true,
          totalPrincipalPaid: true,
          type: true,
          status: true,
          organizationId: true,
          organization: { select: { id: true, name: true, kind: true } },
        },
      }),
    ]);

    let totalCashAndBank = 0;
    let totalReceivables = 0;
    let totalPayables = 0;
    let totalLoansGiven = 0;
    let totalLoansTaken = 0;

    const orgMap = new Map<string, {
      name: string;
      kind: string;
      bankBalance: number;
      receivables: number;
      payables: number;
      accounts: Array<{ bankName: string; accountNumber: string; balance: number }>;
    }>();

    for (const b of bankAccounts) {
      const bal = Number(b.currentBalance || 0);
      totalCashAndBank += bal;
      if (!orgMap.has(b.organizationId)) {
        orgMap.set(b.organizationId, {
          name: b.organization.name,
          kind: b.organization.kind,
          bankBalance: 0,
          receivables: 0,
          payables: 0,
          accounts: [],
        });
      }
      const o = orgMap.get(b.organizationId)!;
      o.bankBalance += bal;
      o.accounts.push({
        bankName: b.bankName,
        accountNumber: b.accountNumber,
        balance: bal,
      });
    }

    for (const inv of invoices) {
      const tot = Number(inv.total || 0);
      const paid = Number(inv.paidAmount || 0);
      if (inv.status !== "PAID" && inv.status !== "CANCELLED") {
        const due = Math.max(0, tot - paid);
        totalReceivables += due;
        if (orgMap.has(inv.organizationId)) {
          orgMap.get(inv.organizationId)!.receivables += due;
        }
      }
    }

    for (const po of purchaseOrders) {
      const tot = Number(po.total || 0);
      const paid = Number(po.paidAmount || 0);
      if (po.status !== "CANCELLED") {
        const due = Math.max(0, tot - paid);
        if (due > 0) {
          totalPayables += due;
          if (orgMap.has(po.organizationId)) {
            orgMap.get(po.organizationId)!.payables += due;
          }
        }
      }
    }

    for (const l of loans) {
      if (l.status === "ACTIVE") {
        const rem = Math.max(0, Number(l.principalAmount || 0) - Number(l.totalPrincipalPaid || 0));
        if (l.type === "GIVEN") {
          totalLoansGiven += rem;
        } else {
          totalLoansTaken += rem;
        }
      }
    }

    const netFinancialPosition = totalCashAndBank + totalReceivables + totalLoansGiven - totalPayables - totalLoansTaken;

    return NextResponse.json(
      {
        success: true,
        summary: {
          totalCashAndBankBalance: totalCashAndBank,
          totalCustomerReceivables: totalReceivables,
          totalVendorPayables: totalPayables,
          totalLoansGivenToOthers: totalLoansGiven,
          totalLoansTakenFromOthers: totalLoansTaken,
          netFinancialPosition,
          currency: "NPR",
        },
        workspaceBreakdown: Array.from(orgMap.entries()).map(([id, o]) => ({
          organizationId: id,
          name: o.name,
          kind: o.kind,
          totalBankBalance: o.bankBalance,
          totalReceivables: o.receivables,
          totalPayables: o.payables,
          accounts: o.accounts,
        })),
        bankAccounts: bankAccounts.map((b) => ({
          id: b.id,
          bankName: b.bankName,
          accountName: b.accountName,
          accountNumber: b.accountNumber,
          branch: b.branch,
          currentBalance: Number(b.currentBalance || 0),
          workspace: `${b.organization.name} (${b.organization.kind})`,
        })),
      },
      { headers: corsHeaders() }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: "Internal Server Error", message: error?.message || "Failed to retrieve balance" },
      { status: 500, headers: corsHeaders() }
    );
  }
}
