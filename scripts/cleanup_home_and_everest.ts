import { PrismaClient } from "../src/generated/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== 1. CLEARING ALL DATA IN MY HOUSE (HOUSEHOLD) ===");
  const household = await prisma.organization.findUnique({ where: { slug: "my-house" } });
  if (household) {
    const hId = household.id;
    const delTx = await prisma.bankTransaction.deleteMany({ where: { organizationId: hId } });
    const delAcc = await prisma.bankAccount.deleteMany({ where: { organizationId: hId } });
    const delExp = await prisma.expense.deleteMany({ where: { organizationId: hId } });
    const delRec = await prisma.recurringExpense.deleteMany({ where: { organizationId: hId } });
    const delInc = await prisma.income.deleteMany({ where: { organizationId: hId } });
    const delTsk = await prisma.task.deleteMany({ where: { organizationId: hId } });
    const delRem = await prisma.reminder.deleteMany({ where: { organizationId: hId } });

    console.log(`Cleared My House: ${delExp.count} expenses, ${delRec.count} recurring rules, ${delInc.count} incomes, ${delTsk.count} tasks, ${delRem.count} reminders.`);
  } else {
    console.log("Household workspace 'my-house' not found.");
  }

  console.log("\n=== 2. REMOVING EVEREST BANK (AV BIONICS) FROM SIMULCAST ===");
  const company = await prisma.organization.findUnique({ where: { slug: "simulcast-technologies" } });
  if (company) {
    const cId = company.id;
    const ebAccounts = await prisma.bankAccount.findMany({
      where: {
        organizationId: cId,
        OR: [
          { bankName: { contains: "Everest" } },
          { accountNumber: "04400105200931" },
          { accountNumber: "04405501200137" },
        ],
      },
    });

    console.log(`Found ${ebAccounts.length} Everest Bank accounts to remove:`, ebAccounts.map(a => a.accountNumber));

    for (const acc of ebAccounts) {
      const txs = await prisma.bankTransaction.findMany({ where: { bankAccountId: acc.id } });
      const incIds = txs.map(t => t.incomeId).filter(Boolean) as string[];
      const expIds = txs.map(t => t.expenseId).filter(Boolean) as string[];

      await prisma.bankTransaction.deleteMany({ where: { bankAccountId: acc.id } });
      if (incIds.length) await prisma.income.deleteMany({ where: { id: { in: incIds } } });
      if (expIds.length) await prisma.expense.deleteMany({ where: { id: { in: expIds } } });
      await prisma.bankAccount.delete({ where: { id: acc.id } });
      console.log(`Deleted account ${acc.accountNumber} with ${txs.length} transactions and linked income/expenses.`);
    }

    // Clean any lingering items referencing Everest Bank in Simulcast
    const lingeringInc = await prisma.income.deleteMany({ where: { organizationId: cId, source: { contains: "Everest Bank" } } });
    const lingeringExp = await prisma.expense.deleteMany({ where: { organizationId: cId, OR: [{ vendor: { contains: "Everest Bank" } }, { title: { contains: "Everest Bank" } }] } });
    console.log(`Cleaned lingering items: ${lingeringInc.count} incomes, ${lingeringExp.count} expenses.`);
  }

  console.log("\n=== 3. VERIFYING REMAINING BANK ACCOUNTS ===");
  const remainingBanks = await prisma.bankAccount.findMany({
    include: {
      organization: { select: { name: true, slug: true } },
      _count: { select: { transactions: true } },
    },
  });
  console.log("Active Bank Accounts in DB:", remainingBanks.map(b => ({
    org: b.organization.name,
    bankName: b.bankName,
    accountNumber: b.accountNumber,
    currentBalance: Number(b.currentBalance),
    transactions: b._count.transactions,
  })));

  console.log("\n=== 4. VERIFYING MY HOUSE (HOUSEHOLD) COUNTS ===");
  const householdCheck = await prisma.organization.findUnique({
    where: { slug: "my-house" },
    include: {
      _count: {
        select: {
          expenses: true,
          recurringExpenses: true,
          incomes: true,
          bankAccounts: true,
          bankTransactions: true,
        },
      },
    },
  });
  console.log("My House Record Counts:", householdCheck?._count);
}

main()
  .catch((e) => {
    console.error("ERROR:", e);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
