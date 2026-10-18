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

  try {
    const orgFilter = await resolveOrgFilter(auth, workspaceParam || undefined);
    const where: any = { ...orgFilter };
    if (statusParam) where.status = statusParam;

    const projects = await db.project.findMany({
      where,
      include: {
        teamLeader: true,
        contact: true,
        wallets: true,
        tasks: { take: 10, orderBy: { createdAt: "desc" } },
        _count: { select: { tasks: true, worklogs: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(
      {
        success: true,
        count: projects.length,
        totalProjectBudgets: projects.reduce((sum, p) => sum + Number(p.budget), 0),
        projects,
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

  const action = body.action || (body.taskId ? "task" : "project");
  const targetOrgId = await resolveOrgId(auth, body.workspace || body.orgId);

  try {
    if (action === "task" || body.allocatedHours !== undefined) {
      const task = await db.task.create({
        data: {
          organizationId: targetOrgId,
          title: body.title,
          description: body.description || null,
          projectId: body.projectId || null,
          employeeId: body.employeeId || null,
          priority: body.priority || "MEDIUM",
          dueAt: body.dueAt ? new Date(body.dueAt) : null,
          allocatedHours: Number(body.allocatedHours) || 0,
        },
      });

      return NextResponse.json(
        { success: true, message: `Task "${task.title}" created.`, task },
        { status: 201, headers: corsHeaders() }
      );
    }

    // Create Project
    const budget = Number(body.budget) || 0;
    const project = await db.project.create({
      data: {
        organizationId: targetOrgId,
        name: body.name,
        description: body.description || null,
        contactId: body.contactId || null,
        teamLeaderId: body.teamLeaderId || null,
        budget,
        startDate: body.startDate ? new Date(body.startDate) : null,
        endDate: body.endDate ? new Date(body.endDate) : null,
        status: body.status || "ACTIVE",
        priority: body.priority || "MEDIUM",
        workNature: body.workNature || null,
        fiscalYear: body.fiscalYear || null,
      },
    });

    await db.projectWallet.upsert({
      where: { organizationId_projectId: { organizationId: targetOrgId, projectId: project.id } },
      update: { totalBudget: budget },
      create: {
        organizationId: targetOrgId,
        projectId: project.id,
        totalBudget: budget,
        transferredAmount: 0,
        holdAmount: 0,
        leaderHoldAmount: 0,
        balance: budget,
      },
    });

    return NextResponse.json(
      { success: true, message: `Project "${project.name}" created with wallet.`, project },
      { status: 201, headers: corsHeaders() }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500, headers: corsHeaders() }
    );
  }
}
