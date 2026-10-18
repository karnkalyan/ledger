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
  const typeParam = searchParams.get("type");
  const statusParam = searchParams.get("status");

  try {
    const orgFilter = await resolveOrgFilter(auth, workspaceParam || undefined);
    const where: any = { ...orgFilter };
    if (typeParam && typeParam !== "ALL") where.type = typeParam;
    if (statusParam && statusParam !== "ALL") where.status = statusParam;

    const loans = await db.loan.findMany({
      where,
      include: {
        payments: { orderBy: { paymentDate: "desc" } },
        organization: { select: { id: true, name: true, slug: true, kind: true } },
      },
      orderBy: { startDate: "desc" },
    });

    const summary = {
      totalLoans: loans.length,
      totalPrincipalBorrowed: loans
        .filter((l) => l.type === "TAKEN")
        .reduce((sum, l) => sum + Number(l.principalAmount), 0),
      totalPrincipalLent: loans
        .filter((l) => l.type === "GIVEN")
        .reduce((sum, l) => sum + Number(l.principalAmount), 0),
      totalRepaid: loans.reduce((sum, l) => sum + Number(l.totalPrincipalPaid), 0),
    };

    return NextResponse.json(
      { success: true, summary, loans },
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

  const action = body.action || "create";

  try {
    if (action === "settle" || body.loanId) {
      const targetOrgId = await resolveOrgId(auth, body.workspace || body.orgId);
      const loan = await db.loan.findFirst({
        where: { id: body.loanId, organizationId: targetOrgId },
      });

      if (!loan) {
        return NextResponse.json(
          { error: `Loan ${body.loanId} not found in authorized workspace` },
          { status: 404, headers: corsHeaders() }
        );
      }

      const principalAmount = Number(body.principalAmount) || 0;
      const interestAmount = Number(body.interestAmount) || 0;
      const totalAmount = principalAmount + interestAmount;
      const paymentDate = body.paymentDate ? new Date(body.paymentDate) : new Date();

      const payment = await db.$transaction(async (tx) => {
        const p = await tx.loanPayment.create({
          data: {
            loanId: loan.id,
            paymentDate,
            principalAmount,
            interestAmount,
            totalAmount,
            notes: body.notes || null,
          },
        });

        const newPrincipalPaid = Number(loan.totalPrincipalPaid) + principalAmount;
        const newInterestPaid = Number(loan.totalInterestPaid) + interestAmount;
        const isFullySettled = newPrincipalPaid >= Number(loan.principalAmount);

        await tx.loan.update({
          where: { id: loan.id },
          data: {
            totalPrincipalPaid: newPrincipalPaid,
            totalInterestPaid: newInterestPaid,
            status: isFullySettled ? "SETTLED" : "ACTIVE",
            settledAt: isFullySettled ? paymentDate : loan.settledAt,
          },
        });

        if (loan.type === "TAKEN") {
          await tx.expense.create({
            data: {
              organizationId: targetOrgId,
              title: `Loan Repayment to ${loan.partyName}`,
              vendor: loan.partyName,
              type: "ONE_TIME",
              amount: totalAmount,
              occurredAt: paymentDate,
              notes: `Settlement for Loan #${loan.id.slice(-6)}. Notes: ${body.notes || ""}`.trim(),
            },
          });
        } else {
          await tx.income.create({
            data: {
              organizationId: targetOrgId,
              title: `Loan Collection from ${loan.partyName}`,
              source: loan.partyName,
              amount: totalAmount,
              receivedAt: paymentDate,
              notes: `Collection for Loan #${loan.id.slice(-6)}. Notes: ${body.notes || ""}`.trim(),
            },
          });
        }

        return p;
      });

      return NextResponse.json(
        { success: true, message: "Loan repayment successfully recorded", payment },
        { status: 200, headers: corsHeaders() }
      );
    }

    // Default: Create Loan
    const targetOrgId = await resolveOrgId(auth, body.workspace || body.orgId);
    const loan = await db.loan.create({
      data: {
        organizationId: targetOrgId,
        partyName: body.partyName,
        type: body.type || "TAKEN",
        principalAmount: Number(body.principalAmount),
        startDate: body.startDate ? new Date(body.startDate) : new Date(),
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        hasInterest: Boolean(body.hasInterest),
        interestRate: Number(body.interestRate) || 0,
        interestFrequency: body.interestFrequency || "MONTHLY",
        notes: body.notes || null,
      },
    });

    return NextResponse.json(
      { success: true, message: `Loan created with ID: ${loan.id}`, loan },
      { status: 201, headers: corsHeaders() }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500, headers: corsHeaders() }
    );
  }
}
