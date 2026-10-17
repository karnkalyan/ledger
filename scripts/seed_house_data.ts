import { PrismaClient } from "../src/generated/client";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();

async function importHouseTransactions() {
  console.log("=== Importing House Bank Transactions into Database ===");

  const house = await prisma.organization.findFirst({
    where: { slug: "my-house" },
  });

  if (!house) {
    throw new Error("Organization 'my-house' not found!");
  }

  console.log(`Target Organization: ${house.name} (${house.id})`);

  const filePath = path.join(process.cwd(), "scripts", "extracted_house_data.json");
  if (!fs.existsSync(filePath)) {
    throw new Error(`Data file ${filePath} not found!`);
  }

  const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));

  for (const [accountNumber, txs] of Object.entries(data) as [string, any[]][]) {
    const account = await prisma.bankAccount.findFirst({
      where: {
        organizationId: house.id,
        accountNumber,
      },
    });

    if (!account) {
      console.log(`Warning: Bank account ${accountNumber} not found in My House. Skipping.`);
      continue;
    }

    console.log(`\nImporting ${txs.length} transactions for ${account.bankName} (${accountNumber})...`);

    // Clean existing transactions for this account to avoid duplicates
    await prisma.bankTransaction.deleteMany({
      where: { bankAccountId: account.id },
    });

    let imported = 0;
    // Insert in batches of 100
    const BATCH_SIZE = 100;
    for (let i = 0; i < txs.length; i += BATCH_SIZE) {
      const chunk = txs.slice(i, i + BATCH_SIZE);
      const createData = chunk.map((t) => ({
        organizationId: house.id,
        bankAccountId: account.id,
        transactionDate: new Date(`${t.date}T12:00:00Z`),
        type: t.type,
        amount: t.amount,
        balance: t.balance != null ? Number(t.balance) : null,
        description: t.description || "Bank Transaction",
        reference: t.reference || null,
        category: t.type === "DEPOSIT" ? "Household Inflow" : "Household Expenditure",
      }));

      await prisma.bankTransaction.createMany({
        data: createData,
      });
      imported += chunk.length;
    }

    // Set ending balance based on latest transaction balance if available
    const lastWithBal = [...txs].reverse().find((t) => t.balance != null);
    const endingBal = lastWithBal ? Number(lastWithBal.balance) : (accountNumber === "55509175153" ? 36843.35 : (accountNumber === "02905120254304" ? 3800.58 : 0));

    await prisma.bankAccount.update({
      where: { id: account.id },
      data: { currentBalance: endingBal },
    });

    console.log(`✓ Imported ${imported} transactions for ${account.bankName} (${accountNumber}). Ending Balance: ${endingBal}`);
  }

  console.log("\n=== HOUSE BANK TRANSACTIONS IMPORT COMPLETED SUCCESSFULLY ===");
}

importHouseTransactions()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("Import failed:", e);
    process.exit(1);
  });
