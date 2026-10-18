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
  const query = searchParams.get("query");
  const activeParam = searchParams.get("active");

  try {
    const orgFilter = await resolveOrgFilter(auth, workspaceParam || undefined);
    const where: any = { ...orgFilter };
    if (activeParam !== null && activeParam !== undefined) {
      where.active = activeParam !== "false";
    }
    if (query) {
      where.OR = [
        { name: { contains: query } },
        { sku: { contains: query } },
      ];
    }

    const products = await db.product.findMany({
      where,
      include: {
        organization: { select: { id: true, name: true, slug: true } },
        _count: { select: { stockMovements: true } },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(
      {
        success: true,
        count: products.length,
        totalStockUnits: products.reduce((sum, p) => sum + Number(p.stockQty), 0),
        products,
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

  const action = body.action || (body.movementType ? "movement" : "create");
  const targetOrgId = await resolveOrgId(auth, body.workspace || body.orgId);

  try {
    if (action === "movement" || body.movementType) {
      const qty = Number(body.quantity) || 0;
      const type = (body.type || body.movementType || "IN") as "IN" | "OUT" | "ADJUSTMENT" | "RETURN";

      const product = await db.product.findFirst({
        where: { id: body.productId, organizationId: targetOrgId },
      });
      if (!product) {
        return NextResponse.json(
          { error: `Product ${body.productId} not found` },
          { status: 404, headers: corsHeaders() }
        );
      }

      let newStock = Number(product.stockQty);
      if (type === "IN" || type === "RETURN") {
        newStock += qty;
      } else if (type === "OUT") {
        newStock = Math.max(0, newStock - qty);
      } else if (type === "ADJUSTMENT") {
        newStock = qty;
      }

      const [movement] = await db.$transaction([
        db.stockMovement.create({
          data: {
            organizationId: targetOrgId,
            productId: product.id,
            type,
            quantity: qty,
            reference: body.reference || null,
            note: body.note || null,
          },
        }),
        db.product.update({
          where: { id: product.id },
          data: { stockQty: newStock },
        }),
      ]);

      return NextResponse.json(
        {
          success: true,
          message: `Stock movement ${type} of ${qty} recorded. New balance: ${newStock} ${product.unit}.`,
          movement,
        },
        { status: 200, headers: corsHeaders() }
      );
    }

    // Create Product
    const product = await db.product.create({
      data: {
        organizationId: targetOrgId,
        name: body.name,
        sku: body.sku,
        unit: body.unit || "pcs",
        salePrice: Number(body.salePrice) || 0,
        purchasePrice: Number(body.purchasePrice) || 0,
        stockQty: Number(body.stockQty) || 0,
        reorderLevel: Number(body.reorderLevel) || 0,
      },
    });

    return NextResponse.json(
      { success: true, message: `Product "${product.name}" created.`, product },
      { status: 201, headers: corsHeaders() }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500, headers: corsHeaders() }
    );
  }
}
