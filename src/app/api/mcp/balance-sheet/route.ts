import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyMcpAuth, resolveOrgFilter } from "@/lib/mcp-auth";
import { adToBs } from "@/lib/nepali-calendar";

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
  return handleBalanceSheet(request);
}

export async function POST(request: Request) {
  return handleBalanceSheet(request);
}

async function handleBalanceSheet(request: Request) {
  const auth = await verifyMcpAuth(request);
  if (!auth.authenticated) {
    return NextResponse.json(
      { error: "Unauthorized", message: auth.error || "Authentication required" },
      { status: 401, headers: corsHeaders() }
    );
  }

  const { searchParams } = new URL(request.url);
  let targetOrgParam = searchParams.get("company") || searchParams.get("workspace") || searchParams.get("orgId");
  let fiscalYearParam = searchParams.get("fiscalYear") || "2083/84";

  if (!targetOrgParam && request.method === "POST") {
    try {
      const body = await request.json();
      targetOrgParam = body.company || body.workspace || body.orgId;
      if (body.fiscalYear) fiscalYearParam = body.fiscalYear;
    } catch {}
  }

  try {
    const orgFilter = await resolveOrgFilter(auth, targetOrgParam || undefined);
    const today = adToBs(new Date());

    // Fetch all balance sheet financial components
    const [bankAccounts, invoices, purchaseOrders, loans, products, expenses, incomes, rentalHouses] =
      await Promise.all([
        db.bankAccount.findMany({
          where: { ...orgFilter },
          include: { organization: { select: { id: true, name: true, slug: true, kind: true } } },
        }),
        db.invoice.findMany({
          where: { ...orgFilter },
          include: { organization: { select: { id: true, name: true, slug: true, kind: true } } },
        }),
        db.purchaseOrder.findMany({
          where: { ...orgFilter },
          include: { organization: { select: { id: true, name: true, slug: true, kind: true } } },
        }),
        db.loan.findMany({
          where: { ...orgFilter },
          include: { organization: { select: { id: true, name: true, slug: true, kind: true } } },
        }),
        db.product.findMany({
          where: { ...orgFilter },
          select: { stockQty: true, purchasePrice: true, salePrice: true },
        }),
        db.expense.findMany({
          where: { ...orgFilter },
          select: { amount: true },
        }),
        db.income.findMany({
          where: { ...orgFilter },
          select: { amount: true },
        }),
        db.rentalHouse.findMany({
          where: { ...orgFilter },
          select: { monthlyRent: true, isActive: true },
        }),
      ]);

    // 1. Assets Calculation
    const liquidCashAndBank = bankAccounts.reduce(
      (sum, b) => sum + (Number(b.currentBalance) || 0),
      0
    );

    const accountsReceivable = invoices.reduce((sum, inv) => {
      if (inv.status !== "PAID" && inv.status !== "CANCELLED") {
        const due = Math.max(0, Number(inv.total || 0) - Number(inv.paidAmount || 0));
        return sum + due;
      }
      return sum;
    }, 0);

    const shortTermLoansGiven = loans.reduce((sum, l) => {
      if (l.status === "ACTIVE" && l.type === "GIVEN") {
        const rem = Math.max(0, Number(l.principalAmount || 0) - Number(l.totalPrincipalPaid || 0));
        return sum + rem;
      }
      return sum;
    }, 0);

    const inventoryStockValue = products.reduce((sum, p) => {
      const qty = Number(p.stockQty) || 0;
      const unitCost = Number(p.purchasePrice) || Number(p.salePrice) || 0;
      return sum + Math.max(0, qty * unitCost);
    }, 0);

    const totalCurrentAssets =
      liquidCashAndBank + accountsReceivable + shortTermLoansGiven + inventoryStockValue;

    // Fixed / Non-current Assets (rental advances & deposits)
    const fixedAndNonCurrentAssets = rentalHouses.reduce((sum, rh) => {
      return sum + (rh.isActive ? Number(rh.monthlyRent || 0) * 2 : 0); // 2-month security advance equivalent
    }, 0);

    const totalAssets = totalCurrentAssets + fixedAndNonCurrentAssets;

    // 2. Liabilities Calculation
    const accountsPayable = purchaseOrders.reduce((sum, po) => {
      if (po.status !== "CANCELLED") {
        const due = Math.max(0, Number(po.total || 0) - Number(po.paidAmount || 0));
        return sum + due;
      }
      return sum;
    }, 0);

    const shortTermLoansTaken = loans.reduce((sum, l) => {
      if (l.status === "ACTIVE" && l.type === "TAKEN") {
        const rem = Math.max(0, Number(l.principalAmount || 0) - Number(l.totalPrincipalPaid || 0));
        return sum + rem;
      }
      return sum;
    }, 0);

    const totalCurrentLiabilities = accountsPayable + shortTermLoansTaken;
    const longTermLiabilities = 0;
    const totalLiabilities = totalCurrentLiabilities + longTermLiabilities;

    // 3. Equity Calculation
    const totalAllTimeIncomes = incomes.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
    const totalAllTimeExpenses = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const retainedEarnings = totalAllTimeIncomes - totalAllTimeExpenses;
    
    // Balancing Equity figure (Capital = Total Assets - Total Liabilities - Retained Earnings)
    const totalEquity = totalAssets - totalLiabilities;
    const capital = totalEquity - retainedEarnings;
    const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;

    // Company profile metadata
    const primaryCompany = bankAccounts[0]?.organization?.name || "Kashtrix ERP Multi-Entity";

    return NextResponse.json(
      {
        success: true,
        company: primaryCompany,
        fiscalYear: fiscalYearParam,
        bikramSambatPeriod: `${today.year}/${today.year + 1} BS`,
        periodEnglish: "17 July 2026 – 16 July 2027 (approximately)",
        asOfDateBS: today.formatted,
        asOfDateAD: new Date().toISOString().split("T")[0],
        currency: "NPR",

        // Structured Balance Sheet Table for ChatGPT
        balanceSheet: {
          assets: {
            currentAssets: {
              liquidCashAndBankBalances: Math.round(liquidCashAndBank * 100) / 100,
              accountsReceivable: Math.round(accountsReceivable * 100) / 100,
              loansAndAdvancesGiven: Math.round(shortTermLoansGiven * 100) / 100,
              inventoryStockValuation: Math.round(inventoryStockValue * 100) / 100,
              totalCurrentAssets: Math.round(totalCurrentAssets * 100) / 100,
            },
            fixedAssets: {
              propertyAndEquipment: 0,
              securityDepositsAndLeases: Math.round(fixedAndNonCurrentAssets * 100) / 100,
              totalFixedAssets: Math.round(fixedAndNonCurrentAssets * 100) / 100,
            },
            totalAssets: Math.round(totalAssets * 100) / 100,
          },
          liabilities: {
            currentLiabilities: {
              accountsPayableVendorBills: Math.round(accountsPayable * 100) / 100,
              shortTermLoansTaken: Math.round(shortTermLoansTaken * 100) / 100,
              totalCurrentLiabilities: Math.round(totalCurrentLiabilities * 100) / 100,
            },
            longTermLiabilities: {
              termLoans: Math.round(longTermLiabilities * 100) / 100,
              totalLongTermLiabilities: Math.round(longTermLiabilities * 100) / 100,
            },
            totalLiabilities: Math.round(totalLiabilities * 100) / 100,
          },
          equity: {
            capital: Math.round(capital * 100) / 100,
            retainedEarnings: Math.round(retainedEarnings * 100) / 100,
            totalEquity: Math.round(totalEquity * 100) / 100,
          },
          totalLiabilitiesAndEquity: Math.round(totalLiabilitiesAndEquity * 100) / 100,
          isBalanced: Math.abs(totalAssets - totalLiabilitiesAndEquity) < 0.01,
        },

        // Summary table format ready for markdown rendering
        tabularSummary: [
          { particulars: "Total Current Assets (Cash, Bank, A/R, Inventory)", amountNPR: Math.round(totalCurrentAssets * 100) / 100 },
          { particulars: "Total Fixed Assets & Lease Advances", amountNPR: Math.round(fixedAndNonCurrentAssets * 100) / 100 },
          { particulars: "TOTAL ASSETS", amountNPR: Math.round(totalAssets * 100) / 100 },
          { particulars: "Total Current Liabilities (Vendor Bills, Loans Taken)", amountNPR: Math.round(totalCurrentLiabilities * 100) / 100 },
          { particulars: "TOTAL LIABILITIES", amountNPR: Math.round(totalLiabilities * 100) / 100 },
          { particulars: "Capital & Retained Earnings", amountNPR: Math.round(totalEquity * 100) / 100 },
          { particulars: "TOTAL EQUITY", amountNPR: Math.round(totalEquity * 100) / 100 },
          { particulars: "TOTAL LIABILITIES + EQUITY", amountNPR: Math.round(totalLiabilitiesAndEquity * 100) / 100 },
        ],

        // Bank Accounts details
        bankAccounts: bankAccounts.map((b) => ({
          bankName: b.bankName,
          accountNumber: b.accountNumber,
          accountName: b.accountName,
          balance: Number(b.currentBalance) || 0,
          company: b.organization.name,
        })),
      },
      { headers: corsHeaders() }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: "Internal Server Error", message: error?.message || "Failed to calculate balance sheet" },
      { status: 500, headers: corsHeaders() }
    );
  }
}
