import { PrismaClient } from "../src/generated/client";

const prisma = new PrismaClient();

async function main() {
  const recurring = await prisma.recurringExpense.findMany({
    include: { category: true }
  });
  console.log("RECURRING_COUNT:" + recurring.length);
  for (const r of recurring) {
    console.log(`REC:${r.title}|vendor=${r.vendor}|fixed=${r.fixedAmount}|qty=${r.quantity}|rate=${r.unitRate}|days=${r.billingDays}|recurrence=${r.recurrence}`);
  }

  const accounts = await prisma.bankAccount.findMany({
    include: { _count: { select: { transactions: true } } }
  });
  console.log("\nACCOUNTS:");
  for (const a of accounts) {
    console.log(`ACC:${a.bankName}|${a.accountNumber}|Balance=${a.currentBalance}|TxCount=${a._count.transactions}`);
  }

  const dirInflows = await prisma.bankTransaction.findMany({
    where: { category: "Director Current Account (Inflow)" }
  });
  const dirDrawings = await prisma.bankTransaction.findMany({
    where: { category: "Director Current Account (Drawings)" }
  });

  const sumInflows = dirInflows.reduce((s, x) => s + Number(x.amount), 0);
  const sumDrawings = dirDrawings.reduce((s, x) => s + Number(x.amount), 0);

  console.log(`\nDIRECTOR ACCOUNT STATS:`);
  console.log(`Inflows: ${dirInflows.length} tx, Total: Rs. ${sumInflows.toLocaleString()}`);
  console.log(`Drawings: ${dirDrawings.length} tx, Total: Rs. ${sumDrawings.toLocaleString()}`);
  console.log(`Net Director Position: Rs. ${(sumInflows - sumDrawings).toLocaleString()}`);

  const tx2026 = await prisma.bankTransaction.findMany({
    where: { transactionDate: { gte: new Date("2026-01-01T00:00:00Z") } },
    orderBy: { transactionDate: "asc" }
  });
  console.log(`\n2026 TRANSACTIONS COUNT: ${tx2026.length}`);
  console.log(`First 2026 tx: ${tx2026[0]?.transactionDate.toISOString().slice(0, 10)} | ${tx2026[0]?.description}`);
  console.log(`Last 2026 tx: ${tx2026[tx2026.length - 1]?.transactionDate.toISOString().slice(0, 10)} | ${tx2026[tx2026.length - 1]?.description} | Bal: ${tx2026[tx2026.length - 1]?.balance}`);
}

main().finally(() => prisma.$disconnect());
