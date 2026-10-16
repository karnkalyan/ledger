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
  await prisma.recurringExpense.deleteMany({ where: { organizationId: household.id } });

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
      fixedAmount: 300,
      dayOfMonth: 1,
      reminderDaysBefore: 2,
      notes: "Fixed monthly water and garbage collection fee",
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
      unitRate: 15,
      quantity: 100,
      dayOfMonth: 5,
      reminderDaysBefore: 3,
      notes: "House electricity at NPR 15/unit (~100 units/mo)",
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
    update: { bankName: "Nepal Investment Mega Bank (NIMB)", accountName: "Kalyan Kumar Karn", currentBalance: 3800.58 },
    create: {
      organizationId: household.id,
      bankName: "Nepal Investment Mega Bank (NIMB)",
      accountName: "Kalyan Kumar Karn",
      accountNumber: "02905120254304",
      accountType: "Personal Account",
      branch: "Kathmandu Branch",
      currency: "NPR",
      currentBalance: 3800.58,
    },
  });

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

  // 5. OFFICE COMMITMENTS (SIMULCAST)
  // Office Rent: 17,500
  // Office Electricity: 15 rupees per unit (150 units = 2,250)
  console.log("\n--- CONFIGURING OFFICE COMMITMENTS (SIMULCAST) ---");
  await prisma.recurringExpense.deleteMany({ where: { organizationId: company.id } });

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
      name: "Commercial Tech & Office Interiors",
      companyName: "Commercial Tech & Office Interiors Pvt Ltd",
      taxNumber: "602381944",
      address: "Putalisadak, Kathmandu",
      phone: "+977-1-4268900",
      email: "sales@officeinteriors.np",
    },
    create: {
      id: "c-office-interiors-vendor",
      organizationId: company.id,
      type: ContactType.VENDOR,
      name: "Commercial Tech & Office Interiors",
      companyName: "Commercial Tech & Office Interiors Pvt Ltd",
      taxNumber: "602381944",
      address: "Putalisadak, Kathmandu",
      phone: "+977-1-4268900",
      email: "sales@officeinteriors.np",
      notes: "Approved vendor for commercial workstations, rack infrastructure and interior setup",
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
      electricityRate: 15,
      waterGarbageFee: 300,
      notes: "Active household tenancy agreement. Monthly rent NPR 16,800, water/garbage NPR 300, electricity NPR 15/unit.",
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

    const CANONICAL_CONTACTS: Record<string, { companyName: string; name: string; taxNumber?: string; address?: string; phone?: string; email?: string; type?: ContactType }> = {
      "simulcast": { companyName: "Simulcast Technologies Pvt Ltd", name: "Simulcast Technologies", taxNumber: "601928374", address: "Kathmandu, Nepal", phone: "+977-1-4412345", email: "accounts@simulcast.local", type: ContactType.BOTH },
      "nav solutions": { companyName: "Nav Solutions Pvt Ltd", name: "Navin Adhikari", taxNumber: "603928172", address: "New Baneshwor, Kathmandu", phone: "+977-1-4782390", email: "support@navsolutions.com.np", type: ContactType.VENDOR },
      "av bionics": { companyName: "AV Bionics Pvt Ltd", name: "Anand Verma", taxNumber: "602381944", address: "Putalisadak, Kathmandu", phone: "+977-1-4245678", email: "info@avbionics.com.np", type: ContactType.BOTH },
      "kathmandu university": { companyName: "Kathmandu University", name: "Procurement Directorate", taxNumber: "300182940", address: "Dhulikhel, Kavre", phone: "+977-11-415100", email: "procurement@ku.edu.np", type: ContactType.CUSTOMER },
      "dhulikhel": { companyName: "Dhulikhel Hospital - Kathmandu University Hospital", name: "Administration & IT Dept", taxNumber: "300182749", address: "Dhulikhel, Kavre", phone: "+977-11-490497", email: "it@dhulikhelhospital.org", type: ContactType.CUSTOMER },
      "prime minister": { companyName: "Office of the Prime Minister and Council of Ministers", name: "IT & Media Cell", taxNumber: "300000001", address: "Singha Durbar, Kathmandu", phone: "+977-1-4211000", email: "info@opmcm.gov.np", type: ContactType.CUSTOMER },
      "nepal max tech": { companyName: "Nepal Max Tech Pvt Ltd", name: "Mukesh Yadav", taxNumber: "601293847", address: "Maitighar, Kathmandu", phone: "+977-1-4267123", email: "support@nepalmaxtech.np", type: ContactType.VENDOR },
      "balkumari electronics": { companyName: "Balkumari Electronics Pvt Ltd", name: "Bikash Shrestha", taxNumber: "601827364", address: "Balkumari, Lalitpur", phone: "+977-1-5548900", email: "sales@balkumarielectronics.np", type: ContactType.VENDOR },
      "digital camera": { companyName: "Digital Camera & Broadcast Media Pvt Ltd", name: "Dinesh Manandhar", taxNumber: "302819283", address: "New Road, Kathmandu", phone: "+977-1-4228910", email: "orders@digitalcamera.np", type: ContactType.VENDOR },
      "shasa enterprises": { companyName: "Shasa Enterprises Pvt Ltd", name: "Shashank Joshi", taxNumber: "604192837", address: "Tripureshwor, Kathmandu", phone: "+977-1-4261892", email: "shasa.enterprises@gmail.com", type: ContactType.VENDOR },
      "spykar company": { companyName: "Spykar Company Pvt Ltd", name: "Sunil Karki", taxNumber: "605928374", address: "Kamaladi, Kathmandu", phone: "+977-1-4438290", email: "info@spykar.com.np", type: ContactType.VENDOR },
      "neoteric nepal": { companyName: "Neoteric Nepal Pvt Ltd", name: "Sanjay Golchha", taxNumber: "300182736", address: "Jawalakhel, Lalitpur", phone: "+977-1-5538901", email: "sales@neoteric.com.np", type: ContactType.VENDOR },
      "smart enterprises": { companyName: "Smart Enterprises Pvt Ltd", name: "Suraj Pradhan", taxNumber: "602819283", address: "Teku, Kathmandu", phone: "+977-1-4219876", email: "smart.ent.np@gmail.com", type: ContactType.VENDOR },
      "cloud tech": { companyName: "Cloud Tech Solutions Pvt Ltd", name: "Chandan Roy", taxNumber: "608192837", address: "Thapathali, Kathmandu", phone: "+977-1-4102938", email: "cloudtech@npmail.net", type: ContactType.VENDOR },
      "lokesh agarwal": { companyName: "Lokesh Agarwal Trading", name: "Lokesh Agarwal", taxNumber: "302819284", address: "Indrachowk, Kathmandu", phone: "+977-9851029384", email: "lokesh.agarwal@outlook.com", type: ContactType.VENDOR },
      "vianet": { companyName: "Vianet Communications Pvt Ltd", name: "Corporate Helpdesk", taxNumber: "301829384", address: "Jawalakhel, Lalitpur", phone: "+977-1-5970444", email: "corporate@vianet.com.np", type: ContactType.VENDOR },
      "commercial tech": { companyName: "Commercial Tech & Office Interiors Pvt Ltd", name: "Kiran Basnet", taxNumber: "602381944", address: "Putalisadak, Kathmandu", phone: "+977-1-4268900", email: "sales@officeinteriors.np", type: ContactType.VENDOR },
      "riddhi siddhi": { companyName: "Riddhi Siddhi Multipurpose Pvt Ltd", name: "Riddhi Siddhi Multipurpose", taxNumber: "603819201", address: "Kathmandu, Nepal", type: ContactType.CUSTOMER },
      "aashi traders": { companyName: "Aashi Traders Pvt Ltd", name: "Aashi Traders", taxNumber: "604819280", address: "Kathmandu, Nepal", type: ContactType.CUSTOMER },
      "sujay": { companyName: "Sujay Enterprises", name: "Sujay", address: "Kathmandu, Nepal", type: ContactType.CUSTOMER },
      "illya": { companyName: "Illya Electronics", name: "Illya", address: "Kathmandu, Nepal", type: ContactType.VENDOR },
      "quick": { companyName: "Quick Logistics", name: "Quick", address: "Kathmandu, Nepal", type: ContactType.VENDOR },
      "air": { companyName: "Air Logistics", name: "Air", address: "Kathmandu, Nepal", type: ContactType.VENDOR },
      "bagmati": { companyName: "Bagmati TV Network Pvt Ltd", name: "Bishal Thapa", taxNumber: "601928374", address: "Chabahil, Kathmandu", phone: "+977-1-4478900", email: "broadcast@bagmatitv.com", type: ContactType.CUSTOMER },
      "nepal news": { companyName: "Nepal News Bank Pvt Ltd", name: "Narayan Gautam", taxNumber: "604819283", address: "Anamnagar, Kathmandu", phone: "+977-1-4771234", email: "editor@nepalnews.com", type: ContactType.CUSTOMER },
      "tv today": { companyName: "TV Today Network Pvt Ltd", name: "Janak Rijal", taxNumber: "602918273", address: "Tinkune, Kathmandu", phone: "+977-1-4111890", email: "accounts@tvtoday.com.np", type: ContactType.CUSTOMER },
      "black swan": { companyName: "Black Swan Nepal Pvt Ltd", name: "Santosh Singh", taxNumber: "605192837", address: "Jhamsikhel, Lalitpur", phone: "+977-1-5529810", email: "santosh@blackswan.com.np", type: ContactType.CUSTOMER },
      "7 star tv": { companyName: "7 Star TV Network Pvt Ltd", name: "Rajendra Shah", taxNumber: "603819284", address: "Pokhara / Kathmandu", phone: "+977-1-4412389", email: "broadcast@7startv.np", type: ContactType.CUSTOMER },
      "dim movies": { companyName: "DIM Movies Production Pvt Ltd", name: "Deepak Shrestha", taxNumber: "604928172", address: "Gairidhara, Kathmandu", phone: "+977-1-4428190", email: "deepak@dimmovies.np", type: ContactType.CUSTOMER },
      "fewa tv": { companyName: "Fewa Television Ltd", name: "Kishor Sharma", taxNumber: "601829304", address: "Pokhara, Gandaki", phone: "+977-61-524180", email: "fewatv@fewa.com.np", type: ContactType.CUSTOMER },
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

    // Process clients
    for (const clientName of data.clients) {
      if (!clientName || clientName.trim().length < 2) continue;
      const raw = clientName.trim();
      const canonKey = matchCanonicalKey(raw);
      const meta = canonKey ? CANONICAL_CONTACTS[canonKey] : null;
      const compName = meta ? meta.companyName : toTitleCase(raw);
      const key = (canonKey || raw).toLowerCase();

      if (contactMap.has(key)) continue;

      const c = await prisma.contact.create({
        data: {
          organizationId: company.id,
          type: meta?.type || ContactType.CUSTOMER,
          name: meta ? meta.name : compName,
          companyName: compName,
          taxNumber: meta?.taxNumber || null,
          address: meta?.address || null,
          phone: meta?.phone || null,
          email: meta?.email || null,
          notes: "Imported from Simulcast client directory",
        },
      });
      contactMap.set(key, c.id);
      contactMap.set(raw.toLowerCase(), c.id);
      if (meta) contactMap.set(meta.companyName.toLowerCase(), c.id);
    }

    // Process vendors
    for (const vendorName of data.vendors) {
      if (!vendorName || vendorName.trim().length < 2) continue;
      const raw = vendorName.trim();
      const canonKey = matchCanonicalKey(raw);
      const meta = canonKey ? CANONICAL_CONTACTS[canonKey] : null;
      const compName = meta ? meta.companyName : toTitleCase(raw);
      const key = (canonKey || raw).toLowerCase();

      const existingId = contactMap.get(key) || (meta ? contactMap.get(meta.companyName.toLowerCase()) : undefined);
      if (existingId) {
        await prisma.contact.update({
          where: { id: existingId },
          data: {
            type: ContactType.BOTH,
            ...(meta ? { taxNumber: meta.taxNumber, address: meta.address, phone: meta.phone, email: meta.email, companyName: meta.companyName } : {}),
          },
        });
        contactMap.set(raw.toLowerCase(), existingId);
      } else {
        const c = await prisma.contact.create({
          data: {
            organizationId: company.id,
            type: meta?.type || ContactType.VENDOR,
            name: meta ? meta.name : compName,
            companyName: compName,
            taxNumber: meta?.taxNumber || null,
            address: meta?.address || null,
            phone: meta?.phone || null,
            email: meta?.email || null,
            notes: "Imported from Simulcast vendor directory",
          },
        });
        contactMap.set(key, c.id);
        contactMap.set(raw.toLowerCase(), c.id);
        if (meta) contactMap.set(meta.companyName.toLowerCase(), c.id);
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

    // Idempotent cleanup: remove prior bank transactions and linked bank-incomes/expenses
    const oldBankTxs = await prisma.bankTransaction.findMany({
      where: { organizationId: company.id },
      select: { incomeId: true, expenseId: true },
    });
    const oldIncIds = oldBankTxs.map((t) => t.incomeId).filter((id): id is string => Boolean(id));
    const oldExpIds = oldBankTxs.map((t) => t.expenseId).filter((id): id is string => Boolean(id));

    await prisma.bankTransaction.deleteMany({ where: { organizationId: company.id } });
    if (oldIncIds.length > 0) {
      await prisma.income.deleteMany({ where: { id: { in: oldIncIds } } });
    }
    if (oldExpIds.length > 0) {
      await prisma.expense.deleteMany({ where: { id: { in: oldExpIds } } });
    }
    // Safety cleanup: ensure no orphaned Siddhartha bank inflows or outflows exist
    await prisma.income.deleteMany({
      where: {
        organizationId: company.id,
        source: "Siddhartha Bank Ltd (02017249683)",
      },
    });
    await prisma.expense.deleteMany({
      where: {
        organizationId: company.id,
        vendor: { in: ["Siddhartha Bank Outlay", "Director Current Account (Kalyan Kumar Karn)"] },
      },
    });

    // Seed Siddhartha Bank Transactions
    for (const tx of sBankData.transactions) {
      const txDate = new Date(`${tx.date}T12:00:00Z`);
      const amount = Number(tx.amount);
      const descLower = (tx.description || "").toLowerCase();

      if (descLower.includes("kashvi")) {
        // Exclude Kashvi Karn personal transactions from company ledger
        continue;
      }
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
          incomeId,
          expenseId,
        },
      });
    }

    // Add verified transaction on 2026-10-15 (29 Ashwin 2083 BS)
    const oct15Date = new Date("2026-10-15T12:00:00Z");
    const oct15Desc = "Fund Trf to KALYAN KUMAR KARN-Kalyan Kumar Kar FUN MOB/SBLMOB01Kalyan Kumar Karn";
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
  .finally(async () => prisma.$disconnect());
