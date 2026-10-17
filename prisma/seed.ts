import {
  PrismaClient,
  ContactType,
  LeadStatus,
  WorkspaceKind,
  MemberRole,
  Recurrence,
  ExpenseType,
  TaskPriority,
  UserRole,
  AccountStatus,
  OrderStatus,
  LoanType,
  InterestFrequency,
  LoanStatus,
} from "../src/generated/client";
import { bsToAd } from "../src/lib/nepali-calendar";
import bcrypt from "bcryptjs";
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

function toTitleCase(str?: string | null): string {
  if (!str) return "";
  return str
    .trim()
    .split(/\s+/)
    .map((word) => {
      if (!word) return "";
      const lower = word.toLowerCase();
      if (["pvt", "ltd"].includes(lower)) return lower === "pvt" ? "Pvt" : "Ltd";
      if (["tv", "ku", "vat", "pan", "ips", "atm", "po", "so", "inv"].includes(lower)) return word.toUpperCase();
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

async function main() {
  console.log("=== KASHTRIX LEDGER & EXPENSE SUITE MASTER PRODUCTION SEED ===");

  try {
    await prisma.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS = 0;");
  } catch {}

  console.log("\n--- PURGING ALL EXISTING DATABASE DATA (FRESH CLEAN PURGE) ---");
  await prisma.bankTransaction.deleteMany();
  await prisma.income.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.recurringExpense.deleteMany();
  await prisma.purchasePayment.deleteMany();
  await prisma.purchaseOrderItem.deleteMany();
  await prisma.purchaseOrder.deleteMany();
  await prisma.invoicePayment.deleteMany();
  await prisma.invoiceItem.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.salesOrderItem.deleteMany();
  await prisma.salesOrder.deleteMany();
  await prisma.quoteItem.deleteMany();
  await prisma.quote.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.product.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.loanPayment.deleteMany();
  await prisma.loan.deleteMany();
  await prisma.rentalHouse.deleteMany();
  await prisma.milkMonthlyLog.deleteMany();
  await prisma.projectMember.deleteMany();
  await prisma.workLog.deleteMany();
  await prisma.walletTransaction.deleteMany();
  await prisma.projectWallet.deleteMany();
  await prisma.project.deleteMany();
  await prisma.task.deleteMany();
  await prisma.payroll.deleteMany();
  await prisma.leaveRequest.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.licenseRecord.deleteMany();
  await prisma.reminder.deleteMany();
  await prisma.bankAccount.deleteMany();
  await prisma.expenseCategory.deleteMany();
  console.log("Database purged cleanly. Proceeding with fresh seed.");

  const passwordHash = await bcrypt.hash("Admin@123", 12);
  const vendorPasswordHash = await bcrypt.hash("Vendor@123", 12);

  // 1. Users
  const superAdmin = await prisma.user.upsert({
    where: { email: "superadmin@kashtrix.com" },
    update: { name: "Kashtrix Super Admin", passwordHash, role: UserRole.SUPER_ADMIN, status: AccountStatus.APPROVED },
    create: { name: "Kashtrix Super Admin", email: "superadmin@kashtrix.com", passwordHash, role: UserRole.SUPER_ADMIN, status: AccountStatus.APPROVED },
  });

  const user = await prisma.user.upsert({
    where: { email: "admin@simulcast.local" },
    update: { name: "System Admin (Simulcast)", passwordHash, role: UserRole.USER, status: AccountStatus.APPROVED },
    create: { name: "System Admin (Simulcast)", email: "admin@simulcast.local", passwordHash, role: UserRole.USER, status: AccountStatus.APPROVED },
  });

  const pendingUser = await prisma.user.upsert({
    where: { email: "vendor@himalayanmart.np" },
    update: { name: "Bikash Gurung", passwordHash: vendorPasswordHash, role: UserRole.USER, status: AccountStatus.PENDING, phone: "+977-9841234567" },
    create: { name: "Bikash Gurung", email: "vendor@himalayanmart.np", passwordHash: vendorPasswordHash, role: UserRole.USER, status: AccountStatus.PENDING, phone: "+977-9841234567" },
  });

  // 2. Organizations
  const company = await prisma.organization.upsert({
    where: { slug: "simulcast-technologies" },
    update: {
      name: "Simulcast Technologies Pvt Ltd",
      status: AccountStatus.APPROVED,
      panVatNumber: "601928374",
      taxNumber: "601928374",
      vendorCategory: "IT & Software",
      address: "Kathmandu, Nepal",
      email: "accounts@simulcast.local",
      logoUrl: "/logo-mark.png",
      defaultTaxPercent: 13.00,
    },
    create: {
      name: "Simulcast Technologies Pvt Ltd",
      slug: "simulcast-technologies",
      kind: WorkspaceKind.COMPANY,
      status: AccountStatus.APPROVED,
      ownerId: user.id,
      currency: "NPR",
      address: "Kathmandu, Nepal",
      email: "accounts@simulcast.local",
      panVatNumber: "601928374",
      taxNumber: "601928374",
      vendorCategory: "IT & Software",
      logoUrl: "/logo-mark.png",
      defaultTaxPercent: 13.00,
    },
  });

  const household = await prisma.organization.upsert({
    where: { slug: "my-house" },
    update: {
      name: "My House",
      kind: WorkspaceKind.HOUSEHOLD,
      currency: "NPR",
      address: "Kathmandu, Nepal",
      logoUrl: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='22' fill='%23059669'/><path d='M50 22 L20 48 L28 48 L28 78 L72 78 L72 48 L80 48 Z' fill='%23ffffff'/><rect x='44' y='52' width='12' height='26' rx='2' fill='%23059669'/></svg>",
      defaultTaxPercent: 13.00,
    },
    create: {
      name: "My House",
      slug: "my-house",
      kind: WorkspaceKind.HOUSEHOLD,
      status: AccountStatus.APPROVED,
      ownerId: user.id,
      currency: "NPR",
      address: "Kathmandu, Nepal",
      logoUrl: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='22' fill='%23059669'/><path d='M50 22 L20 48 L28 48 L28 78 L72 78 L72 48 L80 48 Z' fill='%23ffffff'/><rect x='44' y='52' width='12' height='26' rx='2' fill='%23059669'/></svg>",
      defaultTaxPercent: 13.00,
    },
  });

  const pendingCompany = await prisma.organization.upsert({
    where: { slug: "himalayan-retail-mart" },
    update: { status: AccountStatus.PENDING, panVatNumber: "609876543", vendorCategory: "Trading & Retail" },
    create: {
      name: "Himalayan Retail Mart Pvt Ltd",
      slug: "himalayan-retail-mart",
      kind: WorkspaceKind.COMPANY,
      status: AccountStatus.PENDING,
      ownerId: pendingUser.id,
      currency: "NPR",
      address: "Pokhara, Nepal",
      phone: "+977-9841234567",
      email: "vendor@himalayanmart.np",
      panVatNumber: "609876543",
      vendorCategory: "Trading & Retail",
    },
  });

  // Memberships
  await prisma.membership.upsert({
    where: { userId_organizationId: { userId: user.id, organizationId: company.id } },
    update: { role: MemberRole.OWNER },
    create: { userId: user.id, organizationId: company.id, role: MemberRole.OWNER },
  });
  await prisma.membership.upsert({
    where: { userId_organizationId: { userId: user.id, organizationId: household.id } },
    update: { role: MemberRole.OWNER },
    create: { userId: user.id, organizationId: household.id, role: MemberRole.OWNER },
  });
  await prisma.membership.upsert({
    where: { userId_organizationId: { userId: pendingUser.id, organizationId: pendingCompany.id } },
    update: { role: MemberRole.OWNER },
    create: { userId: pendingUser.id, organizationId: pendingCompany.id, role: MemberRole.OWNER },
  });

  // 3. Expense Categories
  const officeCategories = [
    ["Office Rent", "building"],
    ["Electricity", "zap"],
    ["Internet", "wifi"],
    ["Cost of Goods / Supplies", "shopping-cart"],
    ["Office Setup & Fixtures", "laptop"],
    ["Staff Salary & Payroll", "users"],
    ["Director Current Account (Drawings)", "user-check"],
    ["Bank Service Charges & Tax", "landmark"],
    ["Software & Licenses", "key-round"],
  ] as const;

  const homeCategories = [
    ["House Rent", "house"],
    ["Milk", "milk"],
    ["Water & Garbage", "droplets"],
    ["Electricity", "zap"],
    ["Grocery", "shopping-basket"],
    ["Internet", "wifi"],
    ["Education", "book-open"],
    ["Family Expenses", "heart"],
  ] as const;

  for (const [name, icon] of officeCategories) {
    await prisma.expenseCategory.upsert({
      where: { organizationId_name: { organizationId: company.id, name } },
      update: { icon },
      create: { organizationId: company.id, name, icon },
    });
  }

  for (const [name, icon] of homeCategories) {
    await prisma.expenseCategory.upsert({
      where: { organizationId_name: { organizationId: household.id, name } },
      update: { icon },
      create: { organizationId: household.id, name, icon },
    });
  }

  // 4. HOUSEHOLD COMMITMENTS & SCHEDULES (User specified)
  // House Rent: 16,800
  // Water & Garbage: 300
  // Electricity: 15 rupees per unit (100 units = 1,500)
  // Milk: 115 per liter (1.5 ltr × 115 × 30 days = 5,175)
  console.log("\n--- CONFIGURING HOUSEHOLD COMMITMENTS (MY HOUSE) ---");
  await prisma.expense.deleteMany({ where: { organizationId: household.id } });
  await prisma.income.deleteMany({ where: { organizationId: household.id } });
  await prisma.recurringExpense.deleteMany({ where: { organizationId: household.id } });
  await prisma.loanPayment.deleteMany({ where: { loan: { organizationId: household.id } } });
  await prisma.loan.deleteMany({ where: { organizationId: household.id } });
  await prisma.rentalHouse.deleteMany({ where: { organizationId: household.id } });
  await prisma.electricityReadingLog.deleteMany({ where: { organizationId: household.id } });

  // Active Rental House / Tenancy (User specified: Unit Rate: 12, Garbage: 500, Last Unit: 6632)
  await prisma.rentalHouse.create({
    data: {
      organizationId: household.id,
      title: "Current Rental Residence",
      ownerName: "House Owner (Landlord)",
      ownerPhone: "+977-9800000000",
      address: "Kathmandu, Nepal",
      monthlyRent: 16800,
      electricityRate: 12,
      waterGarbageFee: 500,
      lastElectricityUnit: 6632,
      notes: "Active household tenancy. Electricity at NPR 12/unit, Garbage fee NPR 500, Last meter reading: 6632.",
      isActive: true,
    },
  });

  // Electricity meter initial reading benchmark
  await prisma.electricityReadingLog.create({
    data: {
      organizationId: household.id,
      month: "2083-06",
      meterNumber: "MAIN",
      previousUnit: 6632,
      currentUnit: 6632,
      unitsConsumed: 0,
      ratePerUnit: 12,
      totalCost: 0,
      readingDate: new Date(),
      notes: "Initial meter benchmark reading (6632 units) at NPR 12/unit",
    },
  });

  const homeRentCat = await prisma.expenseCategory.findUnique({
    where: { organizationId_name: { organizationId: household.id, name: "House Rent" } },
  });
  const homeWaterCat = await prisma.expenseCategory.findUnique({
    where: { organizationId_name: { organizationId: household.id, name: "Water & Garbage" } },
  });
  const homeElecCat = await prisma.expenseCategory.findUnique({
    where: { organizationId_name: { organizationId: household.id, name: "Electricity" } },
  });
  const homeMilkCat = await prisma.expenseCategory.findUnique({
    where: { organizationId_name: { organizationId: household.id, name: "Milk" } },
  });

  await prisma.recurringExpense.create({
    data: {
      organizationId: household.id,
      categoryId: homeRentCat?.id,
      title: "House rent",
      vendor: "House Landlord",
      recurrence: Recurrence.MONTHLY,
      fixedAmount: 16800,
      dayOfMonth: 1,
      reminderDaysBefore: 3,
      notes: "Fixed monthly house rent",
    },
  });

  await prisma.recurringExpense.create({
    data: {
      organizationId: household.id,
      categoryId: homeWaterCat?.id,
      title: "Water & Garbage",
      vendor: "Local Committee / Water Board",
      recurrence: Recurrence.MONTHLY,
      fixedAmount: 500,
      dayOfMonth: 1,
      reminderDaysBefore: 2,
      notes: "Fixed monthly water and garbage collection fee (NPR 500)",
    },
  });

  await prisma.recurringExpense.create({
    data: {
      organizationId: household.id,
      categoryId: homeElecCat?.id,
      title: "House electricity",
      vendor: "Nepal Electricity Authority (NEA)",
      recurrence: Recurrence.MONTHLY,
      unit: "unit",
      unitRate: 12,
      quantity: 100,
      dayOfMonth: 5,
      reminderDaysBefore: 3,
      notes: "House electricity at NPR 12/unit (~100 units/mo)",
    },
  });

  await prisma.recurringExpense.create({
    data: {
      organizationId: household.id,
      categoryId: homeMilkCat?.id,
      title: "House daily milk",
      vendor: "Local Dairy",
      recurrence: Recurrence.DAILY,
      unit: "ltr",
      unitRate: 115,
      quantity: 1.5,
      billingDays: 30,
      notes: "Daily fresh milk: 1.5 L/day at NPR 115 per liter",
    },
  });

  // House Bank Accounts (from houseDetails statements)
  await prisma.bankAccount.upsert({
    where: { organizationId_accountNumber: { organizationId: household.id, accountNumber: "01615383041" } },
    update: { bankName: "Siddhartha Bank Ltd", accountName: "Kalyan Kumar Karn", currentBalance: 0 },
    create: {
      organizationId: household.id,
      bankName: "Siddhartha Bank Ltd",
      accountName: "Kalyan Kumar Karn",
      accountNumber: "01615383041",
      accountType: "SVPS (Personal Savings)",
      branch: "Kathmandu Branch",
      currency: "NPR",
      currentBalance: 0,
    },
  });

  await prisma.bankAccount.upsert({
    where: { organizationId_accountNumber: { organizationId: household.id, accountNumber: "55509175153" } },
    update: { bankName: "Siddhartha Bank Ltd", accountName: "Kashvi Karn", currentBalance: 36843.35 },
    create: {
      organizationId: household.id,
      bankName: "Siddhartha Bank Ltd",
      accountName: "Kashvi Karn",
      accountNumber: "55509175153",
      accountType: "SVZA (Personal Savings)",
      branch: "Kathmandu Branch",
      currency: "NPR",
      currentBalance: 36843.35,
    },
  });

  await prisma.bankAccount.upsert({
    where: { organizationId_accountNumber: { organizationId: household.id, accountNumber: "02905120254304" } },
    update: { bankName: "Nepal Investment Mega Bank (NIMB)", accountName: "Kalyan Kumar Karn", currentBalance: 103006.90 },
    create: {
      organizationId: household.id,
      bankName: "Nepal Investment Mega Bank (NIMB)",
      accountName: "Kalyan Kumar Karn",
      accountNumber: "02905120254304",
      accountType: "Personal Account",
      branch: "Kathmandu Branch",
      currency: "NPR",
      currentBalance: 103006.90,
    },
  });

  // eSewa Digital Wallet (9814823222)
  const esewaWallet = await prisma.bankAccount.upsert({
    where: { organizationId_accountNumber: { organizationId: household.id, accountNumber: "9814823222" } },
    update: { bankName: "eSewa Wallet", accountName: "Kalyan Karn (9814823222)", currentBalance: 0 },
    create: {
      organizationId: household.id,
      bankName: "eSewa Wallet",
      accountName: "Kalyan Karn (9814823222)",
      accountNumber: "9814823222",
      accountType: "DIGITAL_WALLET",
      branch: "eSewa Digital Wallet",
      currency: "NPR",
      openingBalance: 0,
      currentBalance: 0,
      isActive: true,
    },
  });

  const gameExpDate = new Date("2026-10-17T14:00:00Z");
  // 1. Inbound Contra Transfer to eSewa from NIMB
  await prisma.bankTransaction.create({
    data: {
      organizationId: household.id,
      bankAccountId: esewaWallet.id,
      transactionDate: gameExpDate,
      type: "DEPOSIT",
      amount: 1000,
      balance: 1000,
      description: "Internal Transfer from Nepal Investment Mega Bank (02905120254304)",
      reference: "168290389",
      category: "Internal Transfer",
    },
  });

  // 2. Game Bad Debt Expense
  const gameExp = await prisma.expense.create({
    data: {
      organizationId: household.id,
      title: "Game Bad Debt",
      vendor: "Game Platform / eSewa",
      type: ExpenseType.ONE_TIME,
      amount: 1000,
      occurredAt: gameExpDate,
      notes: "Game bad debt payment paid from eSewa (9814823222) after transfer from Investment Bank [Paid via Wallet: eSewa - 9814823222]",
    },
  });

  // 3. Outbound Withdrawal from eSewa Wallet
  await prisma.bankTransaction.create({
    data: {
      organizationId: household.id,
      bankAccountId: esewaWallet.id,
      transactionDate: gameExpDate,
      type: "WITHDRAWAL",
      amount: 1000,
      balance: 0,
      description: "Expense: Game Bad Debt",
      reference: "168290389",
      category: "Household Expenditure",
      expenseId: gameExp.id,
    },
  });

  // Import House Bank Statements from extracted_house_data.json
  const houseDataPath = path.join(process.cwd(), "scripts", "extracted_house_data.json");
  if (fs.existsSync(houseDataPath)) {
    console.log("\n--- IMPORTING HOUSE BANK STATEMENT TRANSACTIONS ---");
    const houseData = JSON.parse(fs.readFileSync(houseDataPath, "utf-8"));

    for (const [accNo, txs] of Object.entries(houseData) as [string, any[]][]) {
      const acc = await prisma.bankAccount.findFirst({
        where: { organizationId: household.id, accountNumber: accNo },
      });
      if (acc) {
        await prisma.bankTransaction.deleteMany({ where: { bankAccountId: acc.id } });
        const BATCH_SIZE = 100;
        for (let i = 0; i < txs.length; i += BATCH_SIZE) {
          const chunk = txs.slice(i, i + BATCH_SIZE);
          await prisma.bankTransaction.createMany({
            data: chunk.map((t) => ({
              organizationId: household.id,
              bankAccountId: acc.id,
              transactionDate: new Date(`${t.date}T12:00:00Z`),
              type: t.type,
              amount: t.amount,
              balance: t.balance != null ? Number(t.balance) : null,
              description: t.description || "Bank Transaction",
              reference: t.reference || null,
              category: t.type === "DEPOSIT" ? "Household Inflow" : "Household Expenditure",
            })),
          });
        }
        const lastWithBal = [...txs].reverse().find((t) => t.balance != null);
        const endingBal = lastWithBal ? Number(lastWithBal.balance) : (accNo === "55509175153" ? 36843.35 : (accNo === "02905120254304" ? 3800.58 : 0));

        await prisma.bankAccount.update({
          where: { id: acc.id },
          data: { currentBalance: endingBal },
        });

        console.log(`Imported ${txs.length} transactions for ${acc.bankName} (${accNo}). Verified closing balance set to NPR ${endingBal.toLocaleString()}.`);
      }
    }
  }

  // House Sample Income
  await prisma.income.deleteMany({ where: { organizationId: household.id } });
  await prisma.income.create({
    data: {
      organizationId: household.id,
      title: "Monthly household income",
      source: "Salary / Professional Remittance",
      amount: 180000,
      receivedAt: new Date(),
      notes: "Primary household inflow",
    },
  });

  // 5. COMPLETE CLEAN TRUNCATE OF ALL PREVIOUS COMPANY DATA (FRESH SLATE FOR SEED & IMPORT)
  console.log("\n--- CLEANING ALL PREVIOUS COMPANY DATA (FRESH SLATE FOR NEW IMPORT) ---");
  await prisma.bankTransaction.deleteMany({ where: { organizationId: company.id } });
  await prisma.invoicePayment.deleteMany({ where: { invoice: { organizationId: company.id } } });
  await prisma.invoiceItem.deleteMany({ where: { invoice: { organizationId: company.id } } });
  await prisma.invoice.deleteMany({ where: { organizationId: company.id } });
  await prisma.salesOrderItem.deleteMany({ where: { salesOrder: { organizationId: company.id } } });
  await prisma.salesOrder.deleteMany({ where: { organizationId: company.id } });
  await prisma.purchasePayment.deleteMany({ where: { purchaseOrder: { organizationId: company.id } } });
  await prisma.purchaseOrderItem.deleteMany({ where: { purchaseOrder: { organizationId: company.id } } });
  await prisma.purchaseOrder.deleteMany({ where: { organizationId: company.id } });
  await prisma.quoteItem.deleteMany({ where: { quote: { organizationId: company.id } } });
  await prisma.quote.deleteMany({ where: { organizationId: company.id } });
  await prisma.lead.deleteMany({ where: { organizationId: company.id } });
  await prisma.stockMovement.deleteMany({ where: { organizationId: company.id } });
  await prisma.product.deleteMany({ where: { organizationId: company.id } });
  await prisma.workLog.deleteMany({ where: { organizationId: company.id } });
  await prisma.task.deleteMany({ where: { organizationId: company.id } });
  await prisma.projectMember.deleteMany({ where: { project: { organizationId: company.id } } });
  await prisma.project.deleteMany({ where: { organizationId: company.id } });
  await prisma.walletTransaction.deleteMany({ where: { wallet: { organizationId: company.id } } });
  await prisma.projectWallet.deleteMany({ where: { organizationId: company.id } });
  await prisma.leaveRequest.deleteMany({ where: { organizationId: company.id } });
  await prisma.payroll.deleteMany({ where: { organizationId: company.id } });
  await prisma.employee.deleteMany({ where: { organizationId: company.id } });
  await prisma.contact.deleteMany({ where: { organizationId: company.id } });
  await prisma.income.deleteMany({ where: { organizationId: company.id } });
  await prisma.expense.deleteMany({ where: { organizationId: company.id } });
  await prisma.recurringExpense.deleteMany({ where: { organizationId: company.id } });
  await prisma.loanPayment.deleteMany({ where: { loan: { organizationId: company.id } } });
  await prisma.loan.deleteMany({ where: { organizationId: company.id } });
  await prisma.licenseRecord.deleteMany({ where: { organizationId: company.id } });
  await prisma.reminder.deleteMany({ where: { organizationId: company.id } });
  console.log("All previous company records cleaned successfully.");

  // 6. OFFICE COMMITMENTS (SIMULCAST)
  // Office Rent: 17,500
  // Office Electricity: 15 rupees per unit (150 units = 2,250)
  console.log("\n--- CONFIGURING OFFICE COMMITMENTS (SIMULCAST) ---");

  const officeRentCat = await prisma.expenseCategory.findUnique({
    where: { organizationId_name: { organizationId: company.id, name: "Office Rent" } },
  });
  const officeElecCat = await prisma.expenseCategory.findUnique({
    where: { organizationId_name: { organizationId: company.id, name: "Electricity" } },
  });

  await prisma.recurringExpense.create({
    data: {
      organizationId: company.id,
      categoryId: officeRentCat?.id,
      title: "Office monthly rent",
      vendor: "Office Landlord",
      recurrence: Recurrence.MONTHLY,
      fixedAmount: 17500,
      dayOfMonth: 1,
      reminderDaysBefore: 3,
      notes: "Fixed monthly commercial office rent",
    },
  });

  await prisma.recurringExpense.create({
    data: {
      organizationId: company.id,
      categoryId: officeElecCat?.id,
      title: "Office electricity",
      vendor: "Nepal Electricity Authority (NEA)",
      recurrence: Recurrence.MONTHLY,
      unit: "unit",
      unitRate: 15,
      quantity: 150,
      dayOfMonth: 5,
      reminderDaysBefore: 3,
      notes: "Office commercial electricity at NPR 15/unit (~150 units/mo)",
    },
  });

  // 6. OFFICE SETUP PURCHASE AT NPR 300,000 WITH DUES MANAGEMENT
  console.log("\n--- SEEDING OFFICE SETUP PURCHASE (NPR 300,000) WITH DUES ---");
  const officeVendor = await prisma.contact.upsert({
    where: { id: "c-office-interiors-vendor" },
    update: {
      name: "Commercial Tech & Office Interiors Pvt Ltd",
      companyName: null,
      taxNumber: null,
      address: null,
      phone: null,
      email: null,
      notes: null,
    },
    create: {
      id: "c-office-interiors-vendor",
      organizationId: company.id,
      type: ContactType.VENDOR,
      name: "Commercial Tech & Office Interiors Pvt Ltd",
      companyName: null,
      taxNumber: null,
      address: null,
      phone: null,
      email: null,
      notes: null,
    },
  });

  // Delete prior instance if exists
  const existingOfficePO = await prisma.purchaseOrder.findFirst({
    where: { organizationId: company.id, orderNumber: "PO-OFFICE-SETUP-300K" },
  });
  if (existingOfficePO) {
    await prisma.purchasePayment.deleteMany({ where: { purchaseOrderId: existingOfficePO.id } });
    await prisma.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: existingOfficePO.id } });
    await prisma.purchaseOrder.delete({ where: { id: existingOfficePO.id } });
  }

  const officePO = await prisma.purchaseOrder.create({
    data: {
      organizationId: company.id,
      orderNumber: "PO-OFFICE-SETUP-300K",
      contactId: officeVendor.id,
      status: OrderStatus.PROCESSING,
      orderDate: new Date("2026-09-01T10:00:00Z"),
      subtotal: 300000,
      tax: 0,
      discount: 0,
      total: 300000,
      paidAmount: 100000, // 100k paid, 200k remaining dues
      notes: "Complete office setup purchase package. Total NPR 300,000 with phased milestone dues.",
      stockPostedAt: new Date("2026-09-01T10:00:00Z"),
      items: {
        create: [
          {
            description: "Executive Ergonomic Desks & Workstations (Set of 4)",
            quantity: 4,
            unitPrice: 35000,
            amount: 140000,
          },
          {
            description: "IT Server Rack, Structured Cabling & Networking Patch Panel",
            quantity: 1,
            unitPrice: 90000,
            amount: 90000,
          },
          {
            description: "Acoustic Partitioning, Conference Chairs & LED Overhead Fixtures",
            quantity: 1,
            unitPrice: 70000,
            amount: 70000,
          },
        ],
      },
    },
  });

  // Record initial payment against dues
  await prisma.purchasePayment.create({
    data: {
      purchaseOrderId: officePO.id,
      amount: 100000,
      paidAt: new Date("2026-09-15T14:30:00Z"),
      method: "Bank Transfer (Siddhartha Bank)",
      reference: "CHQ-029108",
      notes: "Initial advance disbursement for office setup. Remaining dues: NPR 200,000.",
    },
  });

  // Log linked expense so it shows in monthly reports (idempotent check)
  const existingOfficeSetupExp = await prisma.expense.findFirst({
    where: {
      organizationId: company.id,
      title: `Payment for PO #${officePO.orderNumber} (${officeVendor.name})`,
    },
  });
  if (!existingOfficeSetupExp) {
    await prisma.expense.create({
      data: {
        organizationId: company.id,
        title: `Payment for PO #${officePO.orderNumber} (${officeVendor.name})`,
        vendor: officeVendor.name,
        type: ExpenseType.ONE_TIME,
        amount: 100000,
        occurredAt: new Date("2026-09-15T14:30:00Z"),
        notes: `Payment towards office setup purchase dues. Remaining order balance: NPR 200,000.`,
      },
    });
  }
  console.log(`Created/Verified Office Purchase Order PO-OFFICE-SETUP-300K: Total 300,000, Paid 100,000, Dues 200,000.`);

  // 7. LOAN CLEANUP (Office Loans Removed per user requirements)
  console.log("\n--- CLEANING PREVIOUS DUMMY LOANS ---");
  await prisma.loanPayment.deleteMany({
    where: { loan: { organizationId: { in: [company.id, household.id] } } },
  });
  await prisma.loan.deleteMany({
    where: { organizationId: { in: [company.id, household.id] } },
  });

  // 7. HOUSEHOLD RENTAL RESIDENCE & TENANCY (USER SPECIFIED)
  console.log("\n--- CONFIGURING TENANCY & HOUSE MANAGEMENT (MY HOUSE) ---");
  await prisma.rentalHouse.deleteMany({ where: { organizationId: household.id } });
  await prisma.rentalHouse.create({
    data: {
      organizationId: household.id,
      title: "Current Rental Residence",
      ownerName: "House Owner (Landlord)",
      ownerPhone: "+977-9841234567",
      address: "Kathmandu, Nepal",
      monthlyRent: 16800,
      electricityRate: 12,
      waterGarbageFee: 500,
      lastElectricityUnit: 6632,
      notes: "Active household tenancy agreement. Monthly rent NPR 16,800, water/garbage NPR 500, electricity NPR 12/unit, last meter reading: 6632.",
      isActive: true,
    },
  });

  // 8. OFFICE PREMISES & LEASE TENANCY (SIMULCAST)
  console.log("\n--- CONFIGURING OFFICE PREMISES & LEASE (SIMULCAST) ---");
  await prisma.rentalHouse.deleteMany({ where: { organizationId: company.id } });
  await prisma.rentalHouse.create({
    data: {
      organizationId: company.id,
      title: "Simulcast Head Office Lease",
      ownerName: "Commercial Office Landlord",
      ownerPhone: "+977-9851000000",
      address: "Kathmandu, Nepal",
      monthlyRent: 17500,
      electricityRate: 15,
      waterGarbageFee: 500,
      notes: "Commercial office lease agreement. Monthly rent NPR 17,500, water/CAM NPR 500, electricity NPR 15/unit.",
      isActive: true,
    },
  });

  // Seed Milk Monthly Log sample (28 days @ 1.5L + 2 days @ 1.0L = 44L @ 115/L = NPR 5,060)
  await prisma.milkMonthlyLog.deleteMany({ where: { organizationId: household.id } });
  await prisma.milkMonthlyLog.create({
    data: {
      organizationId: household.id,
      month: "2083-06",
      ratePerLiter: 115,
      regularDays: 28,
      regularQty: 1.5,
      alternateDays: 2,
      alternateQty: 1.0,
      totalLiters: 44.0,
      totalCost: 5060,
      paid: true,
      notes: "Adjusted milk quota: 28 days @ 1.5L + 2 days @ 1.0L = 44L total @ NPR 115/L.",
    },
  });

  console.log("Configured active rental house (Rent 16.8k, Elec 15/u, Water 300) and sample milk consumption log.");

  // 8. REAL COMPANY DATA IMPORT WITH CRM DEDUPLICATION & TAX ENRICHMENT
  const dataFilePath = path.join(process.cwd(), "scripts", "extracted_company_data.json");
  if (fs.existsSync(dataFilePath)) {
    console.log("\n--- IMPORTING LIVE COMPANY DATA FROM EXTRACTED JSON ---");
    const data = JSON.parse(fs.readFileSync(dataFilePath, "utf-8"));

    // Clean prior child records & contacts (except office interior setup) to maintain relational integrity
    await prisma.bankTransaction.deleteMany({ where: { organizationId: company.id } });
    await prisma.invoicePayment.deleteMany({ where: { invoice: { organizationId: company.id } } });
    await prisma.invoiceItem.deleteMany({ where: { invoice: { organizationId: company.id } } });
    await prisma.invoice.deleteMany({ where: { organizationId: company.id } });
    await prisma.salesOrderItem.deleteMany({ where: { salesOrder: { organizationId: company.id } } });
    await prisma.salesOrder.deleteMany({ where: { organizationId: company.id } });
    await prisma.purchaseOrderItem.deleteMany({ where: { purchaseOrder: { organizationId: company.id, orderNumber: { not: "PO-OFFICE-SETUP-300K" } } } });
    await prisma.purchaseOrder.deleteMany({ where: { organizationId: company.id, orderNumber: { not: "PO-OFFICE-SETUP-300K" } } });
    await prisma.quoteItem.deleteMany({ where: { quote: { organizationId: company.id } } });
    await prisma.quote.deleteMany({ where: { organizationId: company.id } });
    await prisma.lead.deleteMany({ where: { organizationId: company.id } });
    await prisma.stockMovement.deleteMany({ where: { organizationId: company.id } });
    await prisma.product.deleteMany({ where: { organizationId: company.id } });
    await prisma.contact.deleteMany({
      where: {
        organizationId: company.id,
        id: { not: "c-office-interiors-vendor" },
      },
    });

    const CANONICAL_CONTACTS: Record<string, { name: string; type?: ContactType }> = {
      "simulcast": { name: "Simulcast Technologies Pvt Ltd", type: ContactType.BOTH },
      "nav solutions": { name: "Nav Solutions Pvt Ltd", type: ContactType.VENDOR },
      "av bionics": { name: "AV Bionics Pvt Ltd", type: ContactType.BOTH },
      "kathmandu university": { name: "Kathmandu University", type: ContactType.CUSTOMER },
      "dhulikhel": { name: "Dhulikhel Hospital", type: ContactType.CUSTOMER },
      "prime minister": { name: "Prime Minister Office", type: ContactType.CUSTOMER },
      "nepal max tech": { name: "Nepal Max Tech Pvt Ltd", type: ContactType.VENDOR },
      "balkumari electronics": { name: "Balkumari Electronics", type: ContactType.VENDOR },
      "digital camera": { name: "Digital Camera", type: ContactType.VENDOR },
      "shasa enterprises": { name: "Shasa Enterprises", type: ContactType.VENDOR },
      "spykar company": { name: "Spykar Company Pvt Ltd", type: ContactType.VENDOR },
      "neoteric nepal": { name: "Neoteric Nepal Pvt Ltd", type: ContactType.VENDOR },
      "smart enterprises": { name: "Smart Enterprises Pvt Ltd", type: ContactType.VENDOR },
      "cloud tech": { name: "Cloud Tech", type: ContactType.VENDOR },
      "lokesh agarwal": { name: "Lokesh Agarwal", type: ContactType.VENDOR },
      "vianet": { name: "Vianet", type: ContactType.VENDOR },
      "commercial tech": { name: "Commercial Tech & Office Interiors Pvt Ltd", type: ContactType.VENDOR },
      "riddhi siddhi": { name: "Riddhi Siddhi Multipurpose", type: ContactType.CUSTOMER },
      "aashi traders": { name: "Aashi Traders", type: ContactType.CUSTOMER },
      "sujay": { name: "Sujay", type: ContactType.CUSTOMER },
      "illya": { name: "Illya", type: ContactType.VENDOR },
      "quick": { name: "Quick", type: ContactType.VENDOR },
      "air": { name: "Air", type: ContactType.VENDOR },
      "bagmati": { name: "Bagmati TV Network", type: ContactType.CUSTOMER },
      "nepal news": { name: "Nepal News Bank", type: ContactType.CUSTOMER },
      "tv today": { name: "TV Today Network", type: ContactType.CUSTOMER },
      "black swan": { name: "Black Swan Nepal", type: ContactType.CUSTOMER },
      "7 star tv": { name: "7 Star TV", type: ContactType.CUSTOMER },
      "dim movies": { name: "DIM Movies", type: ContactType.CUSTOMER },
      "fewa tv": { name: "Fewa TV Ltd", type: ContactType.CUSTOMER },
    };

    function matchCanonicalKey(rawName: string): string | null {
      const lower = rawName.toLowerCase().trim();
      if (lower === "simul" || lower === "simulcast" || lower.includes("simulcast")) return "simulcast";
      if (lower === "nav" || lower === "navsolutions" || lower.includes("nav solutions")) return "nav solutions";
      if (lower === "av" || lower === "avbionics" || lower.includes("av bionics")) return "av bionics";
      if (lower === "ku" || lower.includes("kayhmandu") || lower.includes("kathmandu university")) return "kathmandu university";
      if (lower.includes("dhulukhel") || lower.includes("dhulikhel")) return "dhulikhel";
      if (lower.includes("primeminister") || lower.includes("prime minister")) return "prime minister";
      if (lower === "max" || lower.includes("max tech")) return "nepal max tech";
      if (lower.includes("comp.pvt") || lower.includes("comp pvt") || lower.includes("commercial tech") || lower.includes("office interiors")) return "commercial tech";
      if (lower.includes("riddhi siddhi")) return "riddhi siddhi";
      if (lower.includes("aashi")) return "aashi traders";
      if (lower.includes("sujay")) return "sujay";
      if (lower.includes("illya")) return "illya";
      if (lower.includes("quick")) return "quick";
      if (lower.includes("air")) return "air";

      for (const k of Object.keys(CANONICAL_CONTACTS)) {
        if (lower.includes(k)) return k;
      }
      return null;
    }

    const contactMap = new Map<string, string>();
    contactMap.set("commercial tech", "c-office-interiors-vendor");
    contactMap.set("commercial tech & office interiors pvt ltd", "c-office-interiors-vendor");

    // Process clients
    for (const clientName of data.clients) {
      if (!clientName || clientName.trim().length < 2) continue;
      const raw = clientName.trim();
      const canonKey = matchCanonicalKey(raw);
      const meta = canonKey ? CANONICAL_CONTACTS[canonKey] : null;
      const compName = meta ? meta.name : toTitleCase(raw);
      const key = (canonKey || raw).toLowerCase();

      if (contactMap.has(key)) continue;

      const c = await prisma.contact.create({
        data: {
          organizationId: company.id,
          type: meta?.type || ContactType.CUSTOMER,
          name: compName,
          companyName: null,
          taxNumber: null,
          address: null,
          phone: null,
          email: null,
          notes: null,
        },
      });
      contactMap.set(key, c.id);
      contactMap.set(raw.toLowerCase(), c.id);
      if (meta) contactMap.set(meta.name.toLowerCase(), c.id);
    }

    // Process vendors
    for (const vendorName of data.vendors) {
      if (!vendorName || vendorName.trim().length < 2) continue;
      const raw = vendorName.trim();
      const canonKey = matchCanonicalKey(raw);
      const meta = canonKey ? CANONICAL_CONTACTS[canonKey] : null;
      const compName = meta ? meta.name : toTitleCase(raw);
      const key = (canonKey || raw).toLowerCase();

      const existingId = contactMap.get(key) || (meta ? contactMap.get(meta.name.toLowerCase()) : undefined);
      if (existingId) {
        await prisma.contact.update({
          where: { id: existingId },
          data: {
            type: ContactType.BOTH,
          },
        });
        contactMap.set(raw.toLowerCase(), existingId);
      } else {
        const c = await prisma.contact.create({
          data: {
            organizationId: company.id,
            type: meta?.type || ContactType.VENDOR,
            name: compName,
            companyName: null,
            taxNumber: null,
            address: null,
            phone: null,
            email: null,
            notes: null,
          },
        });
        contactMap.set(key, c.id);
        contactMap.set(raw.toLowerCase(), c.id);
        if (meta) contactMap.set(meta.name.toLowerCase(), c.id);
      }
    }

    // Products & Stock
    const productMap = new Map<string, string>();
    for (const p of data.products) {
      const prod = await prisma.product.create({
        data: {
          organizationId: company.id,
          sku: p.sku,
          name: p.name,
          unit: p.unit || "pcs",
          purchasePrice: p.purchasePrice,
          salePrice: p.salePrice,
          stockQty: p.stockQty,
          reorderLevel: p.reorderLevel,
          active: true,
        },
      });
      productMap.set(p.name.toLowerCase(), prod.id);
    }

    // Purchases
    const purchaseGroups = new Map<string, typeof data.purchases>();
    for (const p of data.purchases) {
      const key = `${p.vendor}_${p.invoiceNumber}`;
      if (!purchaseGroups.has(key)) purchaseGroups.set(key, []);
      purchaseGroups.get(key)!.push(p);
    }
    let poCount = 0;
    for (const [, items] of purchaseGroups.entries()) {
      const first = items[0];
      const contactId = contactMap.get(first.vendor.toLowerCase()) || null;
      const subtotal = items.reduce((s: number, i: any) => s + Number(i.total), 0);
      const tax = items.reduce((s: number, i: any) => s + Number(i.vat || 0), 0);
      const total = subtotal + tax;
      const orderDate = parseDate(first.date);

      await prisma.purchaseOrder.create({
        data: {
          organizationId: company.id,
          orderNumber: `${first.invoiceNumber}-${poCount + 1}`,
          contactId,
          status: OrderStatus.COMPLETED,
          orderDate,
          subtotal,
          tax,
          total,
          paidAmount: total, // previous historical orders are fully settled
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
    console.log(`Imported ${poCount} historical purchase orders.`);

    // Sales & Invoices
    const salesGroups = new Map<string, typeof data.sales>();
    for (const s of data.sales) {
      const key = `${s.client}_${s.billNumber}`;
      if (!salesGroups.has(key)) salesGroups.set(key, []);
      salesGroups.get(key)!.push(s);
    }
    let soCount = 0;
    for (const [, items] of salesGroups.entries()) {
      const first = items[0];
      const contactId = contactMap.get(first.client.toLowerCase()) || null;
      const subtotal = items.reduce((s: number, i: any) => s + Number(i.total), 0);
      const tax = items.reduce((s: number, i: any) => s + Number(i.vat || 0), 0);
      const total = subtotal + tax;
      const orderDate = parseDate(first.date);

      const so = await prisma.salesOrder.create({
        data: {
          organizationId: company.id,
          orderNumber: `${first.billNumber}-${soCount + 1}`,
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

      await prisma.invoice.create({
        data: {
          organizationId: company.id,
          invoiceNumber: `INV-${so.orderNumber}`,
          contactId,
          status: "PAID",
          issueDate: orderDate,
          dueDate: orderDate,
          subtotal,
          tax,
          total,
          paidAmount: total,
          notes: `Tax invoice for order ${so.orderNumber}`,
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
      soCount++;
    }
    console.log(`Imported ${soCount} sales orders & tax invoices.`);

    // Siddhartha Bank Account & Transactions
    const sBankData = data.siddharthaBank;
    const sBank = await prisma.bankAccount.upsert({
      where: { organizationId_accountNumber: { organizationId: company.id, accountNumber: sBankData.accountNumber } },
      update: {
        bankName: sBankData.bankName,
        accountName: sBankData.accountName,
        accountType: sBankData.accountType,
        branch: "Kathmandu Branch",
        currency: "NPR",
        currentBalance: 27944.68,
      },
      create: {
        organizationId: company.id,
        bankName: sBankData.bankName,
        accountName: sBankData.accountName,
        accountNumber: sBankData.accountNumber,
        accountType: sBankData.accountType,
        branch: "Kathmandu Branch",
        currency: "NPR",
        openingBalance: sBankData.openingBalance,
        currentBalance: 27944.68,
      },
    });

    // Seed Siddhartha Bank Transactions (Guaranteed 0 duplicates)
    const seenTxKeys = new Set<string>();
    for (const tx of sBankData.transactions) {
      const descClean = (tx.description || "").trim();
      const descLower = descClean.toLowerCase();

      if (descLower.includes("kashvi")) {
        // Exclude Kashvi Karn personal transactions from company ledger
        continue;
      }

      const txDate = new Date(`${tx.date}T12:00:00Z`);
      const amount = Number(tx.amount);
      const txKey = `${tx.date}_${amount}_${descLower}_${tx.type}`;

      if (seenTxKeys.has(txKey)) {
        continue;
      }
      seenTxKeys.add(txKey);

      let category = "General Bank Transaction";
      if (descLower.includes("charge") || descLower.includes("fee") || descLower.includes("wtax") || descLower.includes("sms")) {
        category = "Bank Service Charges & Tax";
      } else if (descLower.includes("kalyan") || descLower.includes("director")) {
        category = tx.type === "DEPOSIT" ? "Director Current Account (Inflow)" : "Director Current Account (Drawings)";
      } else if (descLower.includes("salary") || descLower.includes("payroll")) {
        category = "Staff Salary & Payroll";
      } else {
        category = tx.type === "DEPOSIT" ? "Client Revenue / Sales Inflow" : "Vendor / Operating Outflow";
      }

      let incomeId: string | null = null;
      let expenseId: string | null = null;

      if (tx.type === "DEPOSIT") {
        const inc = await prisma.income.create({
          data: {
            organizationId: company.id,
            title: tx.description || "Bank Deposit Receipt",
            source: "Siddhartha Bank Ltd (02017249683)",
            amount,
            receivedAt: txDate,
            paymentMethod: "BANK",
            bankAccountId: sBank.id,
            notes: `Bank ref: ${tx.reference || "N/A"}`,
          },
        });
        incomeId = inc.id;
      } else {
        const exp = await prisma.expense.create({
          data: {
            organizationId: company.id,
            title: tx.description || "Bank Withdrawal Outlay",
            vendor: "Siddhartha Bank Outlay",
            type: ExpenseType.ONE_TIME,
            amount,
            occurredAt: txDate,
            notes: `Bank ref: ${tx.reference || "N/A"}`,
          },
        });
        expenseId = exp.id;
      }

      try {
        await prisma.bankTransaction.create({
          data: {
            organizationId: company.id,
            bankAccountId: sBank.id,
            transactionDate: txDate,
            type: tx.type,
            amount,
            balance: tx.balance != null ? Number(tx.balance) : null,
            description: tx.description,
            reference: tx.reference,
            category,
            incomeId: incomeId ?? undefined,
            expenseId: expenseId ?? undefined,
          },
        });
      } catch (err: any) {
        if (err?.code === "P2003") {
          await prisma.bankTransaction.create({
            data: {
              organizationId: company.id,
              bankAccountId: sBank.id,
              transactionDate: txDate,
              type: tx.type,
              amount,
              balance: tx.balance != null ? Number(tx.balance) : null,
              description: tx.description,
              reference: tx.reference,
              category,
            },
          });
        } else {
          throw err;
        }
      }
    }

    // Add verified transaction on 2026-10-15 (29 Ashwin 2083 BS) - Deduplicated
    const oct15Date = new Date("2026-10-15T12:00:00Z");
    const oct15Desc = "Fund Trf to KALYAN KUMAR KARN-Kalyan Kumar Kar FUN MOB/SBLMOB01Kalyan Kumar Karn";
    const oct15Key = `2026-10-15_15000_${oct15Desc.toLowerCase().trim()}_WITHDRAWAL`;

    if (!seenTxKeys.has(oct15Key)) {
      seenTxKeys.add(oct15Key);

      const oct15Exp = await prisma.expense.create({
        data: {
          organizationId: company.id,
          title: oct15Desc,
          vendor: "Director Current Account (Kalyan Kumar Karn)",
          type: ExpenseType.ONE_TIME,
          amount: 15000,
          occurredAt: oct15Date,
          notes: "Bank ref: MOB/SBLMOB01Kalyan Kumar Karn | Category: Director Current Account (Drawings)",
        },
      });

      try {
        await prisma.bankTransaction.create({
          data: {
            organizationId: company.id,
            bankAccountId: sBank.id,
            transactionDate: oct15Date,
            type: "WITHDRAWAL",
            amount: 15000,
            balance: 12944.68,
            description: oct15Desc,
            reference: "MOB/SBLMOB01Kalyan Kumar Karn",
            category: "Director Current Account (Drawings)",
            expenseId: oct15Exp.id,
          },
        });
      } catch (err: any) {
        if (err?.code === "P2003") {
          await prisma.bankTransaction.create({
            data: {
              organizationId: company.id,
              bankAccountId: sBank.id,
              transactionDate: oct15Date,
              type: "WITHDRAWAL",
              amount: 15000,
              balance: 12944.68,
              description: oct15Desc,
              reference: "MOB/SBLMOB01Kalyan Kumar Karn",
              category: "Director Current Account (Drawings)",
            },
          });
        } else {
          throw err;
        }
      }
    }

    await prisma.bankAccount.update({
      where: { id: sBank.id },
      data: { currentBalance: 12944.68 },
    });

    console.log(`Imported Siddhartha Bank transactions. Verified closing balance set to NPR 12,944.68.`);
  }

  // 9. Staff Clean Directory (No dummy employees seeded per request)
  await prisma.task.deleteMany({ where: { organizationId: company.id, employee: { employeeCode: "EMP-001" } } });
  await prisma.employee.deleteMany({ where: { organizationId: company.id, employeeCode: "EMP-001" } });

  await prisma.licenseRecord.deleteMany({ where: { organizationId: company.id } });
  await prisma.licenseRecord.create({
    data: {
      organizationId: company.id,
      name: "Cloud playout subscription",
      vendor: "Broadcast Cloud Vendor",
      seats: 5,
      renewalCost: 78000,
      expiryDate: new Date(Date.now() + 45 * 86400000),
    },
  });

  console.log("\n=== MASTER SEED COMPLETED SUCCESSFULLY ===");
  console.log("Credentials:");
  console.log("  Super Admin: superadmin@kashtrix.com / Admin@123");
  console.log("  Company Admin: admin@simulcast.local / Admin@123");
  console.log("Workspaces:");
  console.log(`  Simulcast Technologies: ${company.id} (slug: ${company.slug})`);
  console.log(`  My House: ${household.id} (slug: ${household.slug})`);
}

main()
  .catch((e) => {
    console.error("SEEDING ERROR:", e);
    process.exit(1);
  })
  .finally(async () => {
    try {
      await prisma.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS = 1;");
    } catch {}
    await prisma.$disconnect();
  });
