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
  const categoryId = searchParams.get("categoryId");
  const vendor = searchParams.get("vendor");
  const limit = Math.min(500, Math.max(1, parseInt(searchParams.get("limit") || "100", 10)));

  try {
    const orgFilter = await resolveOrgFilter(auth, workspaceParam || undefined);
    const where: any = { ...orgFilter };
    if (categoryId) where.categoryId = categoryId;
    if (vendor) where.vendor = { contains: vendor };

    const expenses = await db.expense.findMany({
      where,
      include: {
        category: { select: { id: true, name: true } },
        organization: { select: { id: true, name: true, slug: true, kind: true } },
      },
      take: limit,
      orderBy: { occurredAt: "desc" },
    });

    const totalAmount = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

    return NextResponse.json(
      {
        success: true,
        count: expenses.length,
        totalAmount,
        expenses,
      },
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

  try {
    const targetOrgId = await resolveOrgId(auth, body.workspace || body.orgId);
    let categoryId = body.categoryId;
    if (!categoryId && body.categoryName) {
      let cat = await db.expenseCategory.findFirst({
        where: { organizationId: targetOrgId, name: body.categoryName },
      });
      if (!cat) {
        cat = await db.expenseCategory.create({
          data: { organizationId: targetOrgId, name: body.categoryName },
        });
      }
      categoryId = cat.id;
    }

    const expense = await db.expense.create({
      data: {
        organizationId: targetOrgId,
        title: body.title,
        amount: Number(body.amount),
        categoryId: categoryId || null,
        vendor: body.vendor || null,
        occurredAt: body.occurredAt ? new Date(body.occurredAt) : new Date(),
        notes: body.notes || null,
      },
      include: { category: true },
    });

    return NextResponse.json(
      { success: true, message: `Expense recorded: ${expense.title} (NPR ${expense.amount})`, expense },
      { status: 201, headers: corsHeaders() }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500, headers: corsHeaders() }
    );
  }
}
