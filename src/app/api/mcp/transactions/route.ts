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

  // 1. Resolve date window
  let startDate: Date | undefined;
  let endDate: Date | undefined;
  let humanPeriod = "All Historical Transactions";

  const mLower = monthParam.trim().toLowerCase();
  if (mLower.includes("ashoj") || mLower.includes("asoj") || mLower.includes("ashwin") || mLower === "2083-06" || mLower === "06") {
    // Ashoj 2083 BS = approx Sep 17, 2026 - Oct 17, 2026
    startDate = new Date("2026-09-15T00:00:00.000Z");
    endDate = new Date("2026-10-18T23:59:59.999Z");
    humanPeriod = "Ashoj 2083 BS (असोज २०८३ / Sep 17 – Oct 17, 2026)";
  } else if (mLower.includes("bhadra") || mLower.includes("bhadau") || mLower === "2083-05" || mLower === "05") {
    // Bhadra 2083 BS = approx Aug 17, 2026 - Sep 16, 2026
    startDate = new Date("2026-08-16T00:00:00.000Z");
    endDate = new Date("2026-09-17T23:59:59.999Z");
    humanPeriod = "Bhadra 2083 BS (भदौ २०८३ / Aug 17 – Sep 16, 2026)";
  } else if (mLower.includes("shrawan") || mLower.includes("saun") || mLower === "2083-04" || mLower === "04") {
    startDate = new Date("2026-07-16T00:00:00.000Z");
    endDate = new Date("2026-08-17T23:59:59.999Z");
    humanPeriod = "Shrawan 2083 BS (साउन २०८३ / Jul 17 – Aug 16, 2026)";
  } else if (mLower === "today") {
    const now = new Date();
    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    humanPeriod = `Today (${now.toISOString().slice(0, 10)})`;
  } else if (mLower === "this_month" || mLower === "this month" || mLower === "2026-10") {
    startDate = new Date("2026-10-01T00:00:00.000Z");
    endDate = new Date("2026-10-31T23:59:59.999Z");
    humanPeriod = "October 2026";
  } else if (mLower === "2026-09") {
    startDate = new Date("2026-09-01T00:00:00.000Z");
    endDate = new Date("2026-09-30T23:59:59.999Z");
    humanPeriod = "September 2026";
  } else if (monthParam && monthParam.length >= 7) {
    const ym = monthParam.slice(0, 7);
    startDate = new Date(`${ym}-01T00:00:00.000Z`);
    endDate = new Date(`${ym}-31T23:59:59.999Z`);
    humanPeriod = monthParam;
  }

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
