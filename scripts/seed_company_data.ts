import { PrismaClient, ContactType, WorkspaceKind, StockMovementType, OrderStatus, DocumentStatus, ExpenseType } from "../src/generated/client";
import { bsToAd } from "../src/lib/nepali-calendar";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();

function parseDate(dateStr: string | null | undefined): Date {
  if (!dateStr) return new Date();
  if (dateStr.startsWith("BS:")) {
    const parts = dateStr.replace("BS:", "").split("-");
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      const d = parseInt(parts[2], 10);
      try {
        return bsToAd(y, m, d);
      } catch {
        return new Date();
      }
    }
  }
  const clean = dateStr.slice(0, 10);
  const d = new Date(`${clean}T12:00:00Z`);
  return isNaN(d.getTime()) ? new Date() : d;
}

async function main() {
  console.log("Starting Company Data Truncate and Import...");

  // 1. Locate Simulcast company workspace
  const company = await prisma.organization.findUnique({
    where: { slug: "simulcast-technologies" },
  });

  if (!company) {
    throw new Error("Simulcast Technologies workspace not found!");
  }
  const orgId = company.id;
  console.log(`Target Organization: ${company.name} (${orgId})`);

  // Verify and ensure we NEVER touch household workspace
  const household = await prisma.organization.findUnique({
    where: { slug: "my-house" },
  });
  if (household) {
    console.log(`Protected Household Workspace: ${household.name} (${household.id}) - WILL NOT BE TOUCHED.`);
  }

  // 2. COMPLETE TRUNCATE of existing company data
  console.log("\n--- TRUNCATING EXISTING COMPANY DATA ---");
  await prisma.bankTransaction.deleteMany({ where: { organizationId: orgId } });
  await prisma.bankAccount.deleteMany({ where: { organizationId: orgId } });
  await prisma.invoicePayment.deleteMany({ where: { invoice: { organizationId: orgId } } });
  await prisma.invoiceItem.deleteMany({ where: { invoice: { organizationId: orgId } } });
  await prisma.invoice.deleteMany({ where: { organizationId: orgId } });
  await prisma.quoteItem.deleteMany({ where: { quote: { organizationId: orgId } } });
  await prisma.quote.deleteMany({ where: { organizationId: orgId } });
  await prisma.salesOrderItem.deleteMany({ where: { salesOrder: { organizationId: orgId } } });
  await prisma.salesOrder.deleteMany({ where: { organizationId: orgId } });
  await prisma.purchaseOrderItem.deleteMany({ where: { purchaseOrder: { organizationId: orgId } } });
  await prisma.purchaseOrder.deleteMany({ where: { organizationId: orgId } });
  await prisma.stockMovement.deleteMany({ where: { organizationId: orgId } });
  await prisma.product.deleteMany({ where: { organizationId: orgId } });
  await prisma.expense.deleteMany({ where: { organizationId: orgId } });
  await prisma.income.deleteMany({ where: { organizationId: orgId } });
  await prisma.lead.deleteMany({ where: { organizationId: orgId } });
  await prisma.contact.deleteMany({ where: { organizationId: orgId } });
  console.log("Truncate completed successfully.");

  // Load extracted data
  const dataFilePath = path.join(process.cwd(), "scripts", "extracted_company_data.json");
  if (!fs.existsSync(dataFilePath)) {
    throw new Error("scripts/extracted_company_data.json not found! Run scripts/extract_all_data.py first.");
  }
  const data = JSON.parse(fs.readFileSync(dataFilePath, "utf-8"));

  // 3. SEED CONTACTS (Clients & Vendors)
  console.log("\n--- IMPORTING CONTACTS ---");
  const contactMap = new Map<string, string>(); // name -> contactId

  for (const clientName of data.clients) {
    if (!clientName || clientName.trim().length < 2) continue;
    const name = clientName.trim();
    const contact = await prisma.contact.create({
      data: {
        organizationId: orgId,
        type: ContactType.CUSTOMER,
        name,
        companyName: name,
        notes: "Imported from Simulcast client records",
      },
    });
    contactMap.set(name.toLowerCase(), contact.id);
  }

  for (const vendorName of data.vendors) {
    if (!vendorName || vendorName.trim().length < 2) continue;
    const name = vendorName.trim();
    const existingId = contactMap.get(name.toLowerCase());
    if (existingId) {
      await prisma.contact.update({
        where: { id: existingId },
        data: { type: ContactType.BOTH },
      });
    } else {
      const contact = await prisma.contact.create({
        data: {
          organizationId: orgId,
          type: ContactType.VENDOR,
          name,
          companyName: name,
          notes: "Imported from Simulcast vendor procurement records",
        },
      });
      contactMap.set(name.toLowerCase(), contact.id);
    }
  }
  console.log(`Imported ${contactMap.size} unique client & vendor contacts.`);

  // 4. SEED PRODUCTS & OPENING STOCK
  console.log("\n--- IMPORTING PRODUCTS & STOCK ---");
  const productMap = new Map<string, string>(); // sku or name.toLowerCase() -> productId

  for (const p of data.products) {
    const product = await prisma.product.create({
      data: {
        organizationId: orgId,
        sku: p.sku,
        name: p.name,
        unit: p.unit || "pcs",
        salePrice: p.salePrice || 0,
        purchasePrice: p.purchasePrice || 0,
        stockQty: p.stockQty || 0,
        reorderLevel: p.reorderLevel || 2,
        active: true,
      },
    });
    productMap.set(p.sku.toLowerCase(), product.id);
    productMap.set(p.name.toLowerCase(), product.id);

    if (p.stockQty > 0) {
      await prisma.stockMovement.create({
        data: {
          organizationId: orgId,
          productId: product.id,
          type: StockMovementType.IN,
          quantity: p.stockQty,
          reference: "OPENING_STOCK",
          note: `Opening stock from SIMUL STOCK list (${p.category})`,
          occurredAt: new Date("2023-01-01T12:00:00Z"),
        },
      });
    }
  }
  console.log(`Imported ${data.products.length} products with stock movements.`);

  // 5. SEED BANK ACCOUNTS
  console.log("\n--- INITIALIZING BANK ACCOUNTS ---");
  const sBank = await prisma.bankAccount.create({
    data: {
      organizationId: orgId,
      bankName: "Siddhartha Bank Ltd",
      accountName: "Simulcast Technologies Pvt Ltd",
      accountNumber: "02017249683",
      accountType: "Current (CANR)",
      branch: "Kathmandu Branch",
      currency: "NPR",
      openingBalance: 5795.00,
      currentBalance: 5795.00,
      notes: "Official corporate bank account of Simulcast Technologies Pvt Ltd.",
    },
  });
  console.log("Initialized Siddhartha Bank account.");

  // 6. SEED SIDDHARTHA BANK TRANSACTIONS (Reflected in Income & Expenses)
  console.log("\n--- IMPORTING SIDDHARTHA BANK TRANSACTIONS (24 PDFs) ---");
  let sDepositCount = 0;
  let sWithdrawCount = 0;
  let sTotalDeposit = 0;
  let sTotalWithdraw = 0;
  let latestSBal = 5795.00;

  for (const tx of data.siddharthaBank.transactions) {
    const txDate = parseDate(tx.date);
    const amount = Number(tx.amount);
    if (amount <= 0) continue;

    let incomeId: string | null = null;
    let expenseId: string | null = null;

    if (tx.type === "DEPOSIT") {
      sDepositCount++;
      sTotalDeposit += amount;
      const inc = await prisma.income.create({
        data: {
          organizationId: orgId,
          title: tx.description || "Bank Deposit Receipt",
          source: "Siddhartha Bank Ltd (02017249683)",
          amount,
          receivedAt: txDate,
          notes: `Bank statement ref: ${tx.reference || "N/A"} | Source: ${tx.source_pdf}`,
        },
      });
      incomeId = inc.id;
    } else {
      sWithdrawCount++;
      sTotalWithdraw += amount;
      const exp = await prisma.expense.create({
        data: {
          organizationId: orgId,
          title: tx.description || "Bank Withdrawal Outlay",
          vendor: "Siddhartha Bank Outlay",
          type: ExpenseType.ONE_TIME,
          amount,
          occurredAt: txDate,
          notes: `Bank statement ref: ${tx.reference || "N/A"} | Source: ${tx.source_pdf}`,
        },
      });
      expenseId = exp.id;
    }

    if (tx.balance != null && Number(tx.balance) > 0) {
      latestSBal = Number(tx.balance);
    }

    await prisma.bankTransaction.create({
      data: {
        organizationId: orgId,
        bankAccountId: sBank.id,
        transactionDate: txDate,
        type: tx.type,
        amount,
        balance: tx.balance != null ? Number(tx.balance) : null,
        description: tx.description,
        reference: tx.reference,
        category: tx.type === "DEPOSIT" ? "Bank Deposit / Inflow" : "Bank Payout / Outflow",
        incomeId,
        expenseId,
      },
    });
  }

  // Update Siddhartha Bank ending balance
  await prisma.bankAccount.update({
    where: { id: sBank.id },
    data: { currentBalance: latestSBal },
  });
  console.log(`Siddhartha Bank: ${sDepositCount} Deposits (Rs. ${sTotalDeposit.toLocaleString()}), ${sWithdrawCount} Withdrawals (Rs. ${sTotalWithdraw.toLocaleString()}). Final Balance: Rs. ${latestSBal.toLocaleString()}`);

  // 7. SEED PURCHASES
  console.log("\n--- IMPORTING PURCHASES ---");
  // Group purchase items by invoiceNumber + vendor
  const purchaseGroups = new Map<string, typeof data.purchases>();
  for (const p of data.purchases) {
    const key = `${p.vendor}_${p.invoiceNumber}`;
    if (!purchaseGroups.has(key)) purchaseGroups.set(key, []);
    purchaseGroups.get(key)!.push(p);
  }

  let poCount = 0;
  for (const [key, items] of purchaseGroups.entries()) {
    const first = items[0];
    const contactId = contactMap.get(first.vendor.toLowerCase()) || null;
    const subtotal = items.reduce((s: number, i: any) => s + Number(i.total), 0);
    const tax = items.reduce((s: number, i: any) => s + Number(i.vat || 0), 0);
    const total = subtotal + tax;
    const orderDate = parseDate(first.date);

    const po = await prisma.purchaseOrder.create({
      data: {
        organizationId: orgId,
        orderNumber: `${first.invoiceNumber}-${poCount + 1}`,
        contactId,
        status: OrderStatus.COMPLETED,
        orderDate,
        subtotal,
        tax,
        total,
        notes: `Fiscal Year: ${first.fiscalYear}`,
        stockPostedAt: orderDate,
        items: {
          create: items.map((i: any) => ({
            productId: productMap.get(i.productName.toLowerCase()) || null,
            description: i.productName,
            quantity: Number(i.quantity) || 1,
            unitPrice: Number(i.unitPrice) || 0,
            amount: Number(i.total) || 0,
          })),
        },
      },
    });
    poCount++;
  }
  console.log(`Imported ${poCount} Purchase Orders with itemized line items.`);

  // 9. SEED SALES & INVOICES
  console.log("\n--- IMPORTING SALES ORDERS & INVOICES ---");
  const salesGroups = new Map<string, typeof data.sales>();
  for (const s of data.sales) {
    const key = `${s.client}_${s.billNumber}`;
    if (!salesGroups.has(key)) salesGroups.set(key, []);
    salesGroups.get(key)!.push(s);
  }

  let soCount = 0;
  for (const [key, items] of salesGroups.entries()) {
    const first = items[0];
    const contactId = contactMap.get(first.client.toLowerCase()) || null;
    const subtotal = items.reduce((s: number, i: any) => s + Number(i.total), 0);
    const tax = items.reduce((s: number, i: any) => s + Number(i.vat || 0), 0);
    const total = subtotal + tax;
    const orderDate = parseDate(first.date);

    await prisma.salesOrder.create({
      data: {
        organizationId: orgId,
        orderNumber: `SO-${first.billNumber}-${soCount + 1}`,
        contactId,
        status: OrderStatus.COMPLETED,
        orderDate,
        subtotal,
        tax,
        total,
        notes: `Bill No: ${first.billNumber} | FY: ${first.fiscalYear}`,
        stockPostedAt: orderDate,
        items: {
          create: items.map((i: any) => ({
            productId: productMap.get(i.productName.toLowerCase()) || null,
            description: i.productName,
            quantity: Number(i.quantity) || 1,
            unitPrice: Number(i.unitPrice) || 0,
            amount: Number(i.total) || 0,
          })),
        },
      },
    });

    await prisma.invoice.create({
      data: {
        organizationId: orgId,
        invoiceNumber: `INV-${first.billNumber}-${soCount + 1}`,
        contactId,
        status: DocumentStatus.PAID,
        issueDate: orderDate,
        subtotal,
        tax,
        total,
        paidAmount: total,
        notes: `Simulcast Sales Invoice Bill #${first.billNumber}`,
        items: {
          create: items.map((i: any) => ({
            productId: productMap.get(i.productName.toLowerCase()) || null,
            description: i.productName,
            quantity: Number(i.quantity) || 1,
            unitPrice: Number(i.unitPrice) || 0,
            taxRate: 13,
            amount: Number(i.total) || 0,
          })),
        },
      },
    });
    soCount++;
  }
  console.log(`Imported ${soCount} Sales Orders and Invoices.`);

  // 10. SEED OFFICE EXPENSES
  console.log("\n--- IMPORTING OFFICE EXPENSES ---");
  let oeCount = 0;
  for (const oe of data.officeExpenses) {
    const amount = Number(oe.amount);
    if (amount <= 0) continue;
    await prisma.expense.create({
      data: {
        organizationId: orgId,
        title: oe.particular || "Office Operational Expense",
        vendor: "Simulcast Office",
        type: ExpenseType.ONE_TIME,
        amount,
        occurredAt: parseDate(oe.date),
        notes: "Imported from SIMULCAST STATEMENT (Sheet2)",
      },
    });
    oeCount++;
  }
  console.log(`Imported ${oeCount} office expenses.`);

  console.log("\n=======================================================");
  console.log("ALL DATA TRUNCATED AND IMPORTED SUCCESSFULLY FOR SIMULCAST!");
  console.log("=======================================================");
}

main()
  .catch((e) => {
    console.error("IMPORT ERROR:", e);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
