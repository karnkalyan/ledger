import { PrismaClient } from "../src/generated/client";

const db = new PrismaClient();

async function main() {
  const organizations = await db.organization.findMany({
    include: { rentalHouses: { orderBy: [{ isActive: "desc" }, { createdAt: "desc" }] } },
  });
  let imported = 0;

  for (const organization of organizations) {
    const house = organization.rentalHouses[0];
    if (!house) continue;
    const expenses = await db.expense.findMany({
      where: {
        organizationId: organization.id,
        isEstimated: false,
        OR: [
          { title: { contains: "rent" } },
          { title: { contains: "Rent" } },
          { title: { contains: "electricity" } },
          { title: { contains: "Electricity" } },
        ],
      },
      include: { bankTransactions: true, rentalPayment: true },
      orderBy: { occurredAt: "asc" },
    });

    for (const expense of expenses) {
      if (expense.rentalPayment) continue;
      const billingMonth = expense.occurredAt.toISOString().slice(0, 7);
      const isElectricity = expense.title.toLowerCase().includes("electricity");
      const amount = Number(expense.amount);
      await db.$transaction(async (tx) => {
        let bill = await tx.rentalBill.findUnique({
          where: { rentalHouseId_billingMonth: { rentalHouseId: house.id, billingMonth } },
        });
        if (!bill) {
          bill = await tx.rentalBill.create({
            data: {
              organizationId: organization.id,
              rentalHouseId: house.id,
              billingMonth,
              rentAmount: isElectricity ? 0 : amount,
              electricityAmount: isElectricity ? amount : 0,
              waterAmount: 0,
              otherAmount: 0,
              totalAmount: amount,
              notes: "Imported from an existing actual expense record.",
            },
          });
        } else {
          bill = await tx.rentalBill.update({
            where: { id: bill.id },
            data: {
              rentAmount: isElectricity ? undefined : { increment: amount },
              electricityAmount: isElectricity ? { increment: amount } : undefined,
              totalAmount: { increment: amount },
            },
          });
        }
        const bankTransaction = expense.bankTransactions[0];
        await tx.rentalPayment.create({
          data: {
            organizationId: organization.id,
            rentalBillId: bill.id,
            amount,
            paidAt: expense.occurredAt,
            paymentMethod: bankTransaction ? "BANK" : "OTHER",
            reference: bankTransaction?.reference || null,
            notes: "Backfilled from the existing expense ledger.",
            expenseId: expense.id,
          },
        });
      });
      imported += 1;
    }
  }
  console.log(`Imported ${imported} existing rent/electricity payments.`);
}

main().finally(() => db.$disconnect());
