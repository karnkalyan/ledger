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
  const activeOnly = searchParams.get("active") === "true";

  try {
    const orgFilter = await resolveOrgFilter(auth, workspaceParam || undefined);
    const where: any = { ...orgFilter };
    if (activeOnly) where.isActive = true;

    const rentalHouses = await db.rentalHouse.findMany({
      where,
      include: { organization: { select: { id: true, name: true, slug: true } } },
      orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
    });

    const activeHouse = rentalHouses.find((h) => h.isActive) || null;

    return NextResponse.json(
      { success: true, count: rentalHouses.length, activeHouse, rentalHouses },
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
    const houseId = body.id || body.houseId;
    const makeActive = body.isActive !== false;

    let house;
    if (houseId) {
      house = await db.rentalHouse.update({
        where: { id: houseId },
        data: {
          title: body.title,
          ownerName: body.ownerName,
          ownerPhone: body.ownerPhone || null,
          address: body.address || null,
          monthlyRent: body.monthlyRent !== undefined ? Number(body.monthlyRent) : undefined,
          electricityRate: body.electricityRate !== undefined ? Number(body.electricityRate) : undefined,
          waterGarbageFee: body.waterGarbageFee !== undefined ? Number(body.waterGarbageFee) : undefined,
          isActive: makeActive,
          notes: body.notes || null,
        },
      });
    } else {
      const count = await db.rentalHouse.count({ where: { organizationId: targetOrgId } });
      house = await db.rentalHouse.create({
        data: {
          organizationId: targetOrgId,
          title: body.title || "Current Rental Residence",
          ownerName: body.ownerName || "House Landlord",
          ownerPhone: body.ownerPhone || null,
          address: body.address || null,
          monthlyRent: body.monthlyRent !== undefined ? Number(body.monthlyRent) : 16800,
          electricityRate: body.electricityRate !== undefined ? Number(body.electricityRate) : 15,
          waterGarbageFee: body.waterGarbageFee !== undefined ? Number(body.waterGarbageFee) : 300,
          isActive: makeActive || count === 0,
          notes: body.notes || null,
        },
      });
    }

    if (makeActive) {
      await db.rentalHouse.updateMany({
        where: { organizationId: targetOrgId, id: { not: house.id } },
        data: { isActive: false },
      });
    }

    return NextResponse.json(
      { success: true, message: `Rental house "${house.title}" saved.`, house },
      { status: 200, headers: corsHeaders() }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500, headers: corsHeaders() }
    );
  }
}
