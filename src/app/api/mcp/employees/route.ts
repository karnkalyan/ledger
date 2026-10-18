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
  const departmentParam = searchParams.get("department");

  try {
    const orgFilter = await resolveOrgFilter(auth, workspaceParam || undefined);
    const where: any = { ...orgFilter };
    if (statusParam) where.status = statusParam;
    if (departmentParam) where.department = departmentParam;

    const employees = await db.employee.findMany({
      where,
      include: {
        organization: { select: { id: true, name: true, slug: true } },
        _count: { select: { payrolls: true, leaveRequests: true, tasks: true } },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(
      {
        success: true,
        count: employees.length,
        totalMonthlyPayrollCommitment: employees
          .filter((e) => e.status === "ACTIVE")
          .reduce((sum, e) => sum + Number(e.basicSalary), 0),
        employees,
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

  const action = body.action || (body.basicSalary !== undefined && body.name ? "employee" : "payroll");
  const targetOrgId = await resolveOrgId(auth, body.workspace || body.orgId);

  try {
    if (action === "payroll" || body.netPay !== undefined) {
      const monthDate = body.month ? new Date(body.month) : new Date();
      const payroll = await db.payroll.create({
        data: {
          organizationId: targetOrgId,
          employeeId: body.employeeId,
          month: monthDate,
          basic: Number(body.basic),
          allowance: Number(body.allowance) || 0,
          overtime: Number(body.overtime) || 0,
          deduction: Number(body.deduction) || 0,
          tax: Number(body.tax) || 0,
          netPay: Number(body.netPay),
          paidAt: body.paidAt ? new Date(body.paidAt) : new Date(),
          notes: body.notes || null,
        },
        include: { employee: true },
      });

      return NextResponse.json(
        {
          success: true,
          message: `Payroll disbursement of NPR ${payroll.netPay} logged for ${payroll.employee.name}.`,
          payroll,
        },
        { status: 201, headers: corsHeaders() }
      );
    }

    // Create Employee
    const employeeCode = body.employeeCode || `EMP-${Date.now().toString().slice(-4)}`;
    const employee = await db.employee.create({
      data: {
        organizationId: targetOrgId,
        name: body.name,
        employeeCode,
        email: body.email || null,
        phone: body.phone || null,
        designation: body.designation || null,
        department: body.department || null,
        basicSalary: Number(body.basicSalary) || 0,
        joinDate: body.joinDate ? new Date(body.joinDate) : new Date(),
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: `Employee "${employee.name}" (${employee.employeeCode}) created.`,
        employee,
      },
      { status: 201, headers: corsHeaders() }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500, headers: corsHeaders() }
    );
  }
}
