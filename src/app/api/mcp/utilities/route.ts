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
  const month = searchParams.get("month");
  const type = searchParams.get("type"); // "electricity", "milk", or "all"

  try {
    const orgFilter = await resolveOrgFilter(auth, workspaceParam || undefined);
    const whereElectricity: any = { ...orgFilter };
    const whereMilk: any = { ...orgFilter };

    if (month && month !== "all") {
      whereElectricity.month = month;
      whereMilk.month = month;
    }

    const [electricityLogs, milkLogs] = await Promise.all([
      type === "milk"
        ? Promise.resolve([])
        : db.electricityReadingLog.findMany({
            where: whereElectricity,
            include: { organization: { select: { id: true, name: true, slug: true } } },
            orderBy: { readingDate: "desc" },
          }),
      type === "electricity"
        ? Promise.resolve([])
        : db.milkMonthlyLog.findMany({
            where: whereMilk,
            include: { organization: { select: { id: true, name: true, slug: true } } },
            orderBy: { month: "desc" },
          }),
    ]);

    return NextResponse.json(
      {
        success: true,
        summary: {
          totalElectricityLogs: electricityLogs.length,
          totalMilkLogs: milkLogs.length,
          totalElectricityExpense: electricityLogs.reduce((s, l) => s + Number(l.totalCost), 0),
          totalMilkExpense: milkLogs.reduce((s, l) => s + Number(l.totalCost), 0),
        },
        electricityLogs,
        milkLogs,
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

  const kind = body.kind || (body.currentUnit !== undefined ? "electricity" : "milk");
  const targetOrgId = await resolveOrgId(auth, body.workspace || body.orgId);

  try {
    if (kind === "electricity") {
      const currentUnit = Number(body.currentUnit);
      const month = body.month || new Date().toISOString().slice(0, 7);
      const ratePerUnit = Number(body.ratePerUnit) || 15;
      const meterNumber = body.meterNumber || "MAIN";
      const readingDate = body.readingDate ? new Date(body.readingDate) : new Date();
      const paid = body.paid !== false;

      let previousUnit = body.previousUnit !== undefined ? Number(body.previousUnit) : null;
      if (previousUnit === null) {
        const lastLog = await db.electricityReadingLog.findFirst({
          where: { organizationId: targetOrgId },
          orderBy: { readingDate: "desc" },
        });
        if (lastLog) {
          previousUnit = Number(lastLog.currentUnit);
        } else {
          const activeHouse = await db.rentalHouse.findFirst({
            where: { organizationId: targetOrgId, isActive: true },
          });
          previousUnit = Number(activeHouse?.lastElectricityUnit || 0);
        }
      }

      const unitsConsumed = Math.max(0, currentUnit - previousUnit);
      const totalCost = unitsConsumed * ratePerUnit;

      let elecCat = await db.expenseCategory.findFirst({
        where: {
          organizationId: targetOrgId,
          OR: [{ name: { contains: "Electricity" } }, { name: { contains: "Utilities" } }],
        },
      });
      if (!elecCat) {
        elecCat = await db.expenseCategory.create({
          data: {
            organizationId: targetOrgId,
            name: "Electricity & Utilities",
            icon: "zap",
          },
        });
      }

      const expenseTitle = `Electricity bill (${month}): ${unitsConsumed.toFixed(1)} units (${previousUnit} -> ${currentUnit}) @ NPR ${ratePerUnit}/unit`;

      const result = await db.$transaction(async (tx) => {
        const existingExp = await tx.expense.findFirst({
          where: {
            organizationId: targetOrgId,
            title: { contains: `Electricity bill (${month})` },
          },
        });

        let expenseId: string;
        if (existingExp) {
          const updated = await tx.expense.update({
            where: { id: existingExp.id },
            data: {
              title: expenseTitle,
              amount: totalCost,
              unitRate: ratePerUnit,
              quantity: unitsConsumed,
              unit: "units",
              occurredAt: readingDate,
              isEstimated: !paid,
            },
          });
          expenseId = updated.id;
        } else {
          const created = await tx.expense.create({
            data: {
              organizationId: targetOrgId,
              categoryId: elecCat.id,
              title: expenseTitle,
              vendor: "Nepal Electricity Authority (NEA)",
              type: "ONE_TIME",
              amount: totalCost,
              unitRate: ratePerUnit,
              quantity: unitsConsumed,
              unit: "units",
              occurredAt: readingDate,
              isEstimated: !paid,
            },
          });
          expenseId = created.id;
        }

        const readingLog = await tx.electricityReadingLog.upsert({
          where: { organizationId_month: { organizationId: targetOrgId, month } },
          update: {
            meterNumber,
            previousUnit,
            currentUnit,
            unitsConsumed,
            ratePerUnit,
            totalCost,
            readingDate,
            expenseId,
            paid,
            notes: body.notes || null,
          },
          create: {
            organizationId: targetOrgId,
            month,
            meterNumber,
            previousUnit,
            currentUnit,
            unitsConsumed,
            ratePerUnit,
            totalCost,
            readingDate,
            expenseId,
            paid,
            notes: body.notes || null,
          },
        });

        await tx.rentalHouse.updateMany({
          where: { organizationId: targetOrgId, isActive: true },
          data: { lastElectricityUnit: currentUnit },
        });

        return { readingLog, unitsConsumed, totalCost };
      });

      return NextResponse.json(
        {
          success: true,
          message: `Electricity log recorded for ${month}: ${result.unitsConsumed.toFixed(1)} units consumed = NPR ${result.totalCost.toFixed(2)}.`,
          readingLog: result.readingLog,
        },
        { status: 200, headers: corsHeaders() }
      );
    } else {
      // Milk Log
      const month = body.month || new Date().toISOString().slice(0, 7);
      const ratePerLiter = Number(body.ratePerLiter) || 115;
      const regularDays = Number(body.regularDays) || 30;
      const regularQty = Number(body.regularQty) || 1.5;
      const alternateDays = Number(body.alternateDays) || 0;
      const alternateQty = Number(body.alternateQty) || 0;
      const paid = Boolean(body.paid);

      const totalLiters = regularDays * regularQty + alternateDays * alternateQty;
      const totalCost = totalLiters * ratePerLiter;

      const milkLog = await db.milkMonthlyLog.upsert({
        where: { organizationId_month: { organizationId: targetOrgId, month } },
        update: {
          ratePerLiter,
          regularDays,
          regularQty,
          alternateDays,
          alternateQty,
          totalLiters,
          totalCost,
          paid,
          notes: body.notes || null,
        },
        create: {
          organizationId: targetOrgId,
          month,
          ratePerLiter,
          regularDays,
          regularQty,
          alternateDays,
          alternateQty,
          totalLiters,
          totalCost,
          paid,
          notes: body.notes || null,
        },
      });

      return NextResponse.json(
        {
          success: true,
          message: `Milk log recorded for ${month}: ${totalLiters.toFixed(1)}L = NPR ${totalCost.toFixed(2)}.`,
          milkLog,
        },
        { status: 200, headers: corsHeaders() }
      );
    }
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500, headers: corsHeaders() }
    );
  }
}
