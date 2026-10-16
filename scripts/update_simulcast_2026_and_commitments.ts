import { PrismaClient, ExpenseType } from "../src/generated/client";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();

function getCategory(desc: string, txType: string): string {
  const d = desc.toLowerCase();
  if (
    d.includes("charge fee") ||
    d.includes("wtax.pd") ||
    d.includes("sms alert") ||
    d.includes("card charge") ||
    d.includes("int.pd")
  ) {
    return "Bank Service Charges & Tax";
  }

  const isDirector = d.includes("kalyan") || d.includes("director") || d.includes("kashvi");
  if (isDirector) {
    return txType === "DEPOSIT"
      ? "Director Current Account (Inflow)"
      : "Director Current Account (Drawings)";
  }

  if (d.includes("salary") || d.includes("payroll")) {
    return "Staff Salary & Payroll";
  }

  if (d.includes("cash withdrawal") || d.includes("atm")) {
    return "Cash Withdrawal / Petty Cash";
  }

  return txType === "DEPOSIT"
    ? "Client Revenue / Sales Inflow"
    : "Vendor / Operating Outflow";
}

async function main() {
  console.log("=== STEP 1: CLEANING UP RECURRING COMMITMENTS IN SIMULCAST ===");
  const company = await prisma.organization.findUnique({
    where: { slug: "simulcast-technologies" },
  });

  if (!company) {
    throw new Error("Simulcast workspace not found!");
  }
  const orgId = company.id;

  const recurring = await prisma.recurringExpense.findMany({
    where: { organizationId: orgId },
    orderBy: { createdAt: "asc" },
  });

  console.log(`Found ${recurring.length} recurring expenses.`);
  const seenTitles = new Set<string>();
  const toDeleteIds: string[] = [];

  for (const r of recurring) {
    const key = r.title.trim().toLowerCase();
    if (seenTitles.has(key)) {
      toDeleteIds.push(r.id);
    } else {
      seenTitles.add(key);
    }
  }

  if (toDeleteIds.length > 0) {
    const delRes = await prisma.recurringExpense.deleteMany({
      where: { id: { in: toDeleteIds } },
    });
    console.log(`Deleted ${delRes.count} duplicate recurring expenses.`);
  }

  const remainingRecurring = await prisma.recurringExpense.findMany({
    where: { organizationId: orgId },
  });
  console.log(
    `Remaining clean recurring expenses: ${remainingRecurring.length}`,
    remainingRecurring.map((r) => ({
      title: r.title,
      vendor: r.vendor,
      amount: r.fixedAmount ? Number(r.fixedAmount) : (Number(r.quantity || 0) * Number(r.unitRate || 0) * Number(r.billingDays || 0)),
    }))
  );

  console.log("\n=== STEP 2: REMOVING OLD/INCORRECT BANK TRANSACTIONS ===");
  const existingBank = await prisma.bankAccount.findFirst({
    where: { organizationId: orgId },
  });

  if (existingBank) {
    const oldTxs = await prisma.bankTransaction.findMany({
      where: { bankAccountId: existingBank.id },
      select: { id: true, incomeId: true, expenseId: true },
    });
    const incIds = oldTxs.map((t) => t.incomeId).filter(Boolean) as string[];
    const expIds = oldTxs.map((t) => t.expenseId).filter(Boolean) as string[];

    console.log(`Removing ${oldTxs.length} old bank transactions...`);
    await prisma.bankTransaction.deleteMany({
      where: { bankAccountId: existingBank.id },
    });

    if (incIds.length > 0) {
      await prisma.income.deleteMany({ where: { id: { in: incIds } } });
      console.log(`Deleted ${incIds.length} linked income records.`);
    }
    if (expIds.length > 0) {
      await prisma.expense.deleteMany({ where: { id: { in: expIds } } });
      console.log(`Deleted ${expIds.length} linked expense records.`);
    }
  }

  console.log("\n=== STEP 3: CREATING / UPDATING SIDDHARTHA BANK ACCOUNT ===");
  let bankAccount = await prisma.bankAccount.findFirst({
    where: { organizationId: orgId, accountNumber: "02017249683" },
  });

  if (!bankAccount) {
    bankAccount = await prisma.bankAccount.create({
      data: {
        organizationId: orgId,
        bankName: "Siddhartha Bank Ltd",
        accountName: "SIMULCAST TECHNOLOGIES PRIVATE LIMITED",
        accountNumber: "02017249683",
        accountType: "CANR (Current Account)",
        currency: "NPR",
        openingBalance: 5795.0,
        currentBalance: 27944.68,
        isActive: true,
        notes: "Corporate current account verified against all 2023-2026 statements",
      },
    });
  } else {
    bankAccount = await prisma.bankAccount.update({
      where: { id: bankAccount.id },
      data: {
        bankName: "Siddhartha Bank Ltd",
        accountName: "SIMULCAST TECHNOLOGIES PRIVATE LIMITED",
        accountNumber: "02017249683",
        accountType: "CANR (Current Account)",
        openingBalance: 5795.0,
        currentBalance: 27944.68,
        isActive: true,
      },
    });
  }
  console.log(`Bank Account active: ${bankAccount.bankName} (${bankAccount.accountNumber})`);

  console.log("\n=== STEP 4: IMPORTING CLEAN 379 TRANSACTIONS WITH DIRECTOR TAGGING ===");
  const dataFilePath = path.join(process.cwd(), "scripts", "extracted_company_data.json");
  const extracted = JSON.parse(fs.readFileSync(dataFilePath, "utf-8"));
  const txList = extracted.siddharthaBank.transactions;
  console.log(`Extracted list contains ${txList.length} transactions.`);

  let depositCount = 0;
  let withdrawCount = 0;
  let directorDepCount = 0;
  let directorWdCount = 0;
  let directorDepTotal = 0;
  let directorWdTotal = 0;

  for (const t of txList) {
    const txDate = new Date(`${t.date}T12:00:00Z`);
    const amount = Number(t.amount);
    const cat = getCategory(t.description, t.type);

    let incomeId: string | null = null;
    let expenseId: string | null = null;

    const isDirInflow = cat === "Director Current Account (Inflow)";
    const isDirDrawings = cat === "Director Current Account (Drawings)";

    if (t.type === "DEPOSIT") {
      depositCount++;
      if (isDirInflow) {
        directorDepCount++;
        directorDepTotal += amount;
      }

      const inc = await prisma.income.create({
        data: {
          organizationId: orgId,
          title: isDirInflow
            ? `Director Capital Inflow - ${t.description}`
            : t.description || "Bank Deposit Receipt",
          source: isDirInflow
            ? "Director Current Account (Kalyan Kumar Karn)"
            : "Siddhartha Bank Ltd (02017249683)",
          amount,
          receivedAt: txDate,
          notes: `Category: ${cat} | Ref: ${t.reference || "N/A"} | Source: ${t.source_pdf}`,
        },
      });
      incomeId = inc.id;
    } else {
      withdrawCount++;
      if (isDirDrawings) {
        directorWdCount++;
        directorWdTotal += amount;
      }

      const exp = await prisma.expense.create({
        data: {
          organizationId: orgId,
          title: isDirDrawings
            ? `Director Drawings / Advance - ${t.description}`
            : t.description || "Bank Withdrawal Outlay",
          vendor: isDirDrawings
            ? "Director Current Account (Kalyan Kumar Karn)"
            : "Siddhartha Bank Outlay",
          type: ExpenseType.ONE_TIME,
          amount,
          occurredAt: txDate,
          notes: `Category: ${cat} | Ref: ${t.reference || "N/A"} | Source: ${t.source_pdf}`,
        },
      });
      expenseId = exp.id;
    }

    await prisma.bankTransaction.create({
      data: {
        organizationId: orgId,
        bankAccountId: bankAccount.id,
        transactionDate: txDate,
        type: t.type,
        amount,
        balance: t.balance != null ? Number(t.balance) : null,
        description: t.description,
        reference: t.reference,
        category: cat,
        incomeId,
        expenseId,
      },
    });
  }

  // Update bank current balance to the exact closing balance
  await prisma.bankAccount.update({
    where: { id: bankAccount.id },
    data: { currentBalance: 27944.68 },
  });

  console.log("\n================ SUMMARY ================");
  console.log(`Total Bank Transactions Imported: ${txList.length}`);
  console.log(`  - Deposits: ${depositCount}`);
  console.log(`  - Withdrawals: ${withdrawCount}`);
  console.log(`Director Account (Kalyan Kumar Karn):`);
  console.log(`  - Injections: ${directorDepCount} transactions (Rs. ${directorDepTotal.toLocaleString()})`);
  console.log(`  - Drawings: ${directorWdCount} transactions (Rs. ${directorWdTotal.toLocaleString()})`);
  console.log(`  - Net Director Position: Rs. ${(directorDepTotal - directorWdTotal).toLocaleString()}`);
  console.log(`Bank Final Balance: Rs. 27,944.68`);
  console.log("=========================================\n");
}

main()
  .catch((e) => {
    console.error("MIGRATION ERROR:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
