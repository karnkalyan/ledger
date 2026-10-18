import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyMcpAuth, resolveOrgFilter } from "@/lib/mcp-auth";
import { resolveNepaliPeriodToAdRange } from "@/lib/nepali-calendar";

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
  return handleTransactions(request);
}

export async function POST(request: Request) {
  return handleTransactions(request);
}

async function handleTransactions(request: Request) {
  const auth = await verifyMcpAuth(request);
  if (!auth.authenticated) {
    return NextResponse.json(
      { error: "Unauthorized", message: auth.error || "Authentication required" },
      { status: 401, headers: corsHeaders() }
    );
  }

  const { searchParams } = new URL(request.url);
  let monthParam = searchParams.get("month") || searchParams.get("period") || "";
  let workspaceParam = searchParams.get("company") || searchParams.get("workspace") || searchParams.get("orgId") || "";
  let typeParam = (searchParams.get("type") || "ALL").toUpperCase();
  let search = (searchParams.get("search") || searchParams.get("q") || "").trim();
  let limit = Math.min(parseInt(searchParams.get("limit") || "100", 10), 500);

  if (request.method === "POST") {
    try {
      const body = await request.json();
      monthParam = body.month || body.period || monthParam;
      workspaceParam = body.company || body.workspace || body.orgId || workspaceParam;
      typeParam = (body.type || typeParam).toUpperCase();
      search = body.search || body.q || search;
      if (body.limit) limit = Math.min(parseInt(body.limit, 10), 500);
    } catch {}
  }

  // 1. Dynamically resolve date window using Bikram Sambat Calendar Engine (zero hardcoded dates)
  const resolvedPeriod = resolveNepaliPeriodToAdRange(monthParam);
  const startDate = resolvedPeriod.startDate;
  const endDate = resolvedPeriod.endDate;
  const humanPeriod = resolvedPeriod.label;

  // 2. Resolve organization / workspace filter
  const orgFilter = await resolveOrgFilter(auth, workspaceParam || undefined);

  // 3. Build where clause for Bank Transactions
  const where: any = {
    bankAccount: {
      ...orgFilter,
    },
  };

  if (startDate && endDate) {
    where.transactionDate = {
      gte: startDate,
      lte: endDate,
    };
  }

  if (typeParam === "DEPOSIT" || typeParam === "WITHDRAWAL") {
    where.type = typeParam;
  }

  if (search) {
    where.OR = [
      { description: { contains: search } },
      { reference: { contains: search } },
      { chequeNumber: { contains: search } },
      { category: { contains: search } },
    ];
  }

  // 4. Fetch bank transactions
  const transactions = await db.bankTransaction.findMany({
    where,
    include: {
      bankAccount: {
        select: {
          id: true,
          bankName: true,
          accountName: true,
          accountNumber: true,
          accountType: true,
          organization: {
            select: {
              id: true,
              name: true,
              slug: true,
              kind: true,
            },
          },
        },
      },
    },
    orderBy: { transactionDate: "desc" },
    take: limit,
  });

  // Calculate totals
  let totalDeposits = 0;
  let totalWithdrawals = 0;

  const formattedTransactions = transactions.map((t) => {
    const amt = Number(t.amount) || 0;
    if (t.type === "DEPOSIT") {
      totalDeposits += amt;
    } else {
      totalWithdrawals += amt;
    }

    return {
      id: t.id,
      date: t.transactionDate.toISOString().slice(0, 10),
      rawTimestamp: t.transactionDate.toISOString(),
      type: t.type,
      amount: amt,
      balance: t.balance !== null ? Number(t.balance) : undefined,
      description: t.description,
      reference: t.reference || "",
      chequeNumber: t.chequeNumber || "",
      category: t.category || "General",
      bankName: t.bankAccount.bankName,
      accountName: t.bankAccount.accountName,
      accountNumber: t.bankAccount.accountNumber,
      companyId: t.bankAccount.organization.id,
      companyName: t.bankAccount.organization.name,
      companySlug: t.bankAccount.organization.slug,
      workspaceKind: t.bankAccount.organization.kind,
    };
  });

  const netCashflow = totalDeposits - totalWithdrawals;

  return NextResponse.json(
    {
      success: true,
      period: humanPeriod,
      filter: {
        month: monthParam || "ALL",
        company: workspaceParam || "ALL",
        type: typeParam,
      },
      summary: {
        totalRecords: formattedTransactions.length,
        totalDeposits,
        totalWithdrawals,
        netCashflow,
      },
      transactions: formattedTransactions,
    },
    { headers: corsHeaders() }
  );
}
