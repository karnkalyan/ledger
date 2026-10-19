"use server";

import { Prisma, Recurrence, WorkspaceKind } from "@/generated/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireOrganizationAccess } from "@/lib/session";
import { estimateRecurringExpense } from "@/lib/expense-engine";
import { getDaysInMonth, startOfMonth, endOfMonth } from "date-fns";
import { getBsMonthRange, bsToAd } from "@/lib/nepali-calendar";

type Line = { description: string; quantity: number; unitPrice: number; taxRate?: number; productId?: string };

const s = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
const n = (fd: FormData, key: string, fallback = 0) => {
  const value = Number(fd.get(key));
  return Number.isFinite(value) ? value : fallback;
};
const d = (fd: FormData, key: string) => {
  const value = s(fd, key);
  if (!value) return null;
  const normalized = value.length === 7 ? `${value}-01` : value;
  return new Date(`${normalized}T12:00:00`);
};

async function orgAccess(orgId: string) {
  const access = await requireOrganizationAccess(orgId);
  if (access.membership.role === "VIEWER") throw new Error("Read-only members cannot modify workspace data.");
  return access;
}

function refresh(orgId: string, module = "") {
  revalidatePath(`/${orgId}${module ? `/${module}` : ""}`);
  revalidatePath(`/${orgId}`);
}

function refreshModules(orgId: string, ...modules: string[]) {
  for (const module of new Set(modules)) {
    revalidatePath(`/${orgId}/${module}`);
  }
  revalidatePath(`/${orgId}`);
}

export async function createExpenseAction(formData: FormData) {
  const orgId = s(formData, "orgId"); await orgAccess(orgId);
  const quantity = n(formData, "quantity", 1);
  const rate = n(formData, "unitRate", 0);
  const days = n(formData, "daysCount", 1);
  const entered = n(formData, "amount", 0);
  const formulaAmount = quantity * rate * days;
  const amount = entered > 0 ? entered : formulaAmount;
  let title = s(formData,"title");
  if (!title || amount <= 0) return;

  const isDirectorAccount = s(formData, "isDirectorAccount") === "on" || s(formData, "isDirectorAccount") === "true";
  const directorName = s(formData, "directorName") || "Director";
  const directorTxType = s(formData, "directorTxType") || "DRAWINGS";

  let vendor = s(formData, "vendor") || null;
  let notes = s(formData, "notes") || null;

  if (isDirectorAccount) {
    if (!vendor) {
      vendor = `Director: ${directorName}`;
    }
    const dirNote = `[Director Account: ${directorTxType} - ${directorName}]`;
    notes = notes ? `${dirNote} ${notes}` : dirNote;
    if (!title.toLowerCase().includes("director")) {
      title = `${title} [Director: ${directorName}]`;
    }
  }

  const paymentMethod = (s(formData, "paymentMethod") || "CASH").toUpperCase();
  const rawBankAccountId = s(formData, "bankAccountId");

  const requestedCategory = s(formData, "categoryId");
  const categoryId = requestedCategory && await db.expenseCategory.findFirst({ where: { id: requestedCategory, organizationId: orgId }, select: { id: true } }) ? requestedCategory : null;
  const occurredAt = d(formData, "occurredAt") ?? new Date();

  await db.$transaction(async (tx) => {
    let targetBank = null;
    const walletProvider = s(formData, "walletProvider") || "eSewa";
    const walletId = s(formData, "walletId");

    if (paymentMethod === "BANK" && rawBankAccountId) {
      targetBank = await tx.bankAccount.findFirst({
        where: { id: rawBankAccountId, organizationId: orgId },
      });
    } else if (paymentMethod === "WALLET") {
      targetBank = await tx.bankAccount.findFirst({
        where: {
          organizationId: orgId,
          OR: [
            { bankName: { contains: walletProvider } },
            { accountType: "DIGITAL_WALLET" },
          ],
        },
      });
    } else if (paymentMethod === "CASH") {
      targetBank = await tx.bankAccount.findFirst({
        where: {
          organizationId: orgId,
          OR: [
            { accountType: "CASH" },
            { accountNumber: "CASH-IN-HAND" },
            { bankName: { contains: "Cash" } },
          ],
        },
      });
    }

    const expNotes = notes
      ? `${notes}${paymentMethod === "WALLET" ? ` [Paid via Wallet: ${walletProvider}${walletId ? ` - ${walletId}` : ""}]` : paymentMethod === "BANK" ? ` [Paid via: BANK${targetBank ? ` - ${targetBank.bankName}` : ""}]` : " [Paid via Cash in Hand]"}`
      : (paymentMethod === "WALLET" ? `[Paid via Wallet: ${walletProvider}${walletId ? ` - ${walletId}` : ""}]` : paymentMethod === "BANK" ? `[Paid via: BANK${targetBank ? ` - ${targetBank.bankName}` : ""}]` : "[Paid via Cash in Hand]");

    const exp = await tx.expense.create({
      data: {
        organizationId: orgId,
        categoryId,
        title,
        vendor,
        type: (s(formData, "type") || "ONE_TIME") as never,
        quantity: quantity || null,
        unit: s(formData, "unit") || null,
        unitRate: rate || null,
        daysCount: days || null,
        amount,
        occurredAt,
        notes: expNotes,
      },
    });

    // If linked to bank, wallet, or cash account, create linked bank transaction and deduct balance
    if (targetBank) {
      const curBal = Number(targetBank.currentBalance);
      const newBal = curBal - amount;
      await tx.bankTransaction.create({
        data: {
          organizationId: orgId,
          bankAccountId: targetBank.id,
          transactionDate: occurredAt,
          type: "WITHDRAWAL",
          amount,
          balance: newBal,
          description: `Expense: ${title}`,
          reference: vendor || walletId || null,
          category: isDirectorAccount ? "Director Drawings" : (requestedCategory ? "Operational Expense" : "Direct Expense"),
          expenseId: exp.id,
        },
      });

      await tx.bankAccount.update({
        where: { id: targetBank.id },
        data: { currentBalance: newBal },
      });
    }
  });

  refresh(orgId, "expenses");
  if (rawBankAccountId) {
    refresh(orgId, "banking");
  }
  revalidatePath(`/${orgId}/reports`);
}

export async function updateExpenseAction(formData: FormData) {
  const orgId = s(formData, "orgId");
  await orgAccess(orgId);
  const id = s(formData, "id");
  if (!id) return;

  const quantity = n(formData, "quantity", 1);
  const rate = n(formData, "unitRate", 0);
  const days = n(formData, "daysCount", 1);
  const entered = n(formData, "amount", 0);
  const formulaAmount = quantity * rate * days;
  const amount = entered > 0 ? entered : formulaAmount;
  const title = s(formData, "title");
  if (!title || amount <= 0) return;

  const requestedCategory = s(formData, "categoryId");
  const categoryId = requestedCategory && (await db.expenseCategory.findFirst({ where: { id: requestedCategory, organizationId: orgId }, select: { id: true } })) ? requestedCategory : null;
  const occurredAt = d(formData, "occurredAt") ?? new Date();
  const vendor = s(formData, "vendor") || null;
  const notes = s(formData, "notes") || null;
  const type = (s(formData, "type") || "ONE_TIME") as never;
  const isDirectorAccount = s(formData, "isDirectorAccount") === "on" || s(formData, "isDirectorAccount") === "true";
  const directorName = s(formData, "directorName") || "Director";
  const directorTxType = s(formData, "directorTxType") || "DRAWINGS";

  let effectiveTitle = title;
  let effectiveVendor = vendor;
  let effectiveNotes = notes;

  if (isDirectorAccount) {
    if (!effectiveVendor) {
      effectiveVendor = `Director: ${directorName}`;
    }
    const dirNote = `[Director Account: ${directorTxType} - ${directorName}]`;
    effectiveNotes = effectiveNotes ? `${dirNote} ${effectiveNotes}` : dirNote;
    if (!effectiveTitle.toLowerCase().includes("director")) {
      effectiveTitle = `${effectiveTitle} [Director: ${directorName}]`;
    }
  }

  await db.$transaction(async (tx) => {
    const oldExpense = await tx.expense.findFirst({ where: { id, organizationId: orgId } });
    if (!oldExpense) return;

    await tx.expense.update({
      where: { id },
      data: {
        title: effectiveTitle,
        amount,
        categoryId,
        vendor: effectiveVendor,
        type,
        quantity: quantity || null,
        unit: s(formData, "unit") || null,
        unitRate: rate || null,
        daysCount: days || null,
        occurredAt,
        notes: effectiveNotes,
      },
    });

    // If coupled with bank transaction, adjust amount and description
    const linkedTx = await tx.bankTransaction.findFirst({ where: { expenseId: id } });
    if (linkedTx) {
      const oldAmt = Number(linkedTx.amount);
      const diff = amount - oldAmt; // withdrawal increase means balance drops
      await tx.bankTransaction.update({
        where: { id: linkedTx.id },
        data: {
          amount,
          description: effectiveTitle,
          transactionDate: occurredAt,
        },
      });
      if (diff !== 0) {
        await tx.bankAccount.update({
          where: { id: linkedTx.bankAccountId },
          data: { currentBalance: { decrement: diff } },
        });
      }
    }
  });

  refresh(orgId, "expenses");
  refresh(orgId, "banking");
  revalidatePath(`/${orgId}/reports`);
}

export async function createRecurringExpenseAction(formData: FormData) {
  const orgId = s(formData,"orgId"); await orgAccess(orgId);
  const recurrence = (s(formData,"recurrence") || "MONTHLY") as Recurrence;
  const fixed = n(formData,"fixedAmount",0);
  const quantity = n(formData,"quantity",0);
  const rate = n(formData,"unitRate",0);
  if (!s(formData,"title") || (fixed <= 0 && quantity * rate <= 0)) return;
  const requestedCategory = s(formData,"categoryId");
  const categoryId = requestedCategory && await db.expenseCategory.findFirst({ where: { id: requestedCategory, organizationId: orgId }, select: { id: true } }) ? requestedCategory : null;
  await db.recurringExpense.create({ data: {
    organizationId: orgId, categoryId,
    title: s(formData,"title"), vendor: s(formData,"vendor") || null,
    recurrence, quantity: quantity || null, unit: s(formData,"unit") || null,
    unitRate: rate || null, billingDays: n(formData,"billingDays",0) || null,
    fixedAmount: fixed || null, dayOfMonth: n(formData,"dayOfMonth",0) || null,
    reminderDaysBefore: n(formData,"reminderDaysBefore",3),
    startDate: d(formData,"startDate") ?? new Date(), endDate: d(formData,"endDate"),
    notes: s(formData,"notes") || null,
  }});
  refresh(orgId,"expenses");
}

export async function generateMonthlyEstimatesAction(formData: FormData) {
  const orgId = s(formData, "orgId");
  await orgAccess(orgId);
  const monthString = s(formData, "month");

  let monthStart: Date;
  let monthEnd: Date;
  let labelMonth = monthString || "";
  let bsDaysCount: number | null = null;

  const bsMatch = monthString?.match(/^(\d{4})-(\d{2})$/);
  if (bsMatch && parseInt(bsMatch[1], 10) >= 2070 && parseInt(bsMatch[1], 10) <= 2100) {
    const bsYear = parseInt(bsMatch[1], 10);
    const bsMonth = parseInt(bsMatch[2], 10);
    const range = getBsMonthRange(bsYear, bsMonth);
    monthStart = range.startDate;
    monthEnd = range.endDate;
    labelMonth = `${monthString} (${range.monthName} ${bsYear} BS)`;
    bsDaysCount = range.daysInMonth;
  } else {
    const month = monthString ? new Date(`${monthString}-01T12:00:00`) : new Date();
    monthStart = startOfMonth(month);
    monthEnd = endOfMonth(month);
  }

  // Check if specific items were selected by the user
  const selectedItemIds = formData.getAll("selectedItems").map(String);
  const markAsPaid = formData.get("markAsPaid") === "true";
  const overrideAmountsJson = s(formData, "overrideAmounts");
  let overrideAmounts: Record<string, number> = {};
  if (overrideAmountsJson) {
    try {
      overrideAmounts = JSON.parse(overrideAmountsJson);
    } catch {
      // fallback
    }
  }

  const recurring = await db.recurringExpense.findMany({
    where: {
      organizationId: orgId,
      active: true,
      startDate: { lte: monthEnd },
      OR: [{ endDate: null }, { endDate: { gte: monthStart } }],
      ...(selectedItemIds.length > 0 ? { id: { in: selectedItemIds } } : {}),
    },
  });

  for (const item of recurring) {
    // If specific item IDs were passed, check selection
    if (selectedItemIds.length > 0 && !selectedItemIds.includes(item.id)) {
      continue;
    }

    const exists = await db.expense.findFirst({
      where: {
        recurringExpenseId: item.id,
        occurredAt: { gte: monthStart, lte: monthEnd },
      },
    });
    if (exists) continue;

    const customAmt = overrideAmounts[item.id];
    const amount = typeof customAmt === "number" && customAmt > 0 ? customAmt : estimateRecurringExpense(item, monthStart);
    if (amount <= 0) continue;

    await db.expense.create({
      data: {
        organizationId: orgId,
        categoryId: item.categoryId,
        recurringExpenseId: item.id,
        title: `${item.title} — monthly ${markAsPaid ? "bill" : "estimate"}`,
        vendor: item.vendor,
        type: "RECURRING",
        quantity: item.quantity,
        unit: item.unit,
        unitRate: item.unitRate,
        daysCount: item.recurrence === "DAILY" ? (item.billingDays ?? new Prisma.Decimal(bsDaysCount ?? getDaysInMonth(monthStart))) : item.billingDays,
        amount,
        occurredAt: monthStart,
        isEstimated: !markAsPaid,
        notes: `Selected monthly commitment for ${labelMonth || monthStart.toISOString().slice(0, 7)} (${markAsPaid ? "Marked as Paid" : "Unpaid Commitment"})`,
      },
    });
  }

  refresh(orgId, "expenses");
  revalidatePath(`/${orgId}/reports`);
}

export async function createIncomeAction(formData: FormData) {
  const orgId = s(formData, "orgId");
  await orgAccess(orgId);
  const amount = n(formData, "amount");
  const title = s(formData, "title");
  if (!title || amount <= 0) return;

  const rawContactId = s(formData, "contactId");
  const validContact = rawContactId
    ? await db.contact.findFirst({ where: { id: rawContactId, organizationId: orgId } })
    : null;
  const contactId = validContact ? validContact.id : null;

  const rawBankAccountId = s(formData, "bankAccountId");
  let paymentMethod = (s(formData, "paymentMethod") || "CASH").toUpperCase();
  if (rawBankAccountId) {
    paymentMethod = "BANK";
  }

  const isDirectorAccount = s(formData, "isDirectorAccount") === "on" || s(formData, "isDirectorAccount") === "true";
  const directorName = s(formData, "directorName") || "Director";
  const directorTxType = s(formData, "directorTxType") || "CAPITAL";

  let source = s(formData, "source") || null;
  if (!source && validContact) {
    source = validContact.companyName || validContact.name;
  }
  if (isDirectorAccount && !source) {
    source = `Director: ${directorName}`;
  }

  const receivedAt = d(formData, "receivedAt") ?? new Date();
  let notes = s(formData, "notes") || null;
  if (isDirectorAccount) {
    const dirNote = `[Director Account: ${directorTxType} - ${directorName}]`;
    notes = notes ? `${dirNote} ${notes}` : dirNote;
  }

  let bankAccountId: string | null = null;
  let bankAccount = null;

  if (rawBankAccountId) {
    paymentMethod = "BANK";
    bankAccount = await db.bankAccount.findFirst({
      where: { id: rawBankAccountId, organizationId: orgId },
    });
    if (bankAccount) {
      bankAccountId = bankAccount.id;
    }
  }

  await db.$transaction(async (tx) => {
    const inc = await tx.income.create({
      data: {
        organizationId: orgId,
        title,
        source,
        amount,
        receivedAt,
        paymentMethod: paymentMethod === "BANK" ? "BANK" : paymentMethod === "OTHER" ? "OTHER" : "CASH",
        contactId,
        bankAccountId,
        notes,
      },
    });

    // If deposited into a Bank Account, automatically reflect in bank account balance and ledger!
    if (bankAccount && bankAccountId) {
      const curBal = Number(bankAccount.currentBalance);
      const newBal = curBal + amount;

      await tx.bankTransaction.create({
        data: {
          organizationId: orgId,
          bankAccountId,
          transactionDate: receivedAt,
          type: "DEPOSIT",
          amount,
          balance: newBal,
          description: isDirectorAccount && !title.toLowerCase().includes("director")
            ? `Income: ${title} [Director: ${directorName} - ${directorTxType}]`
            : `Income Receipt: ${title}`,
          reference: source || (validContact ? (validContact.companyName || validContact.name) : null),
          category: isDirectorAccount ? "Director Current Account (Inflow)" : "Payment Received",
          incomeId: inc.id,
          contactId,
        },
      });

      await tx.bankAccount.update({
        where: { id: bankAccountId },
        data: { currentBalance: newBal },
      });
    }
  });

  refresh(orgId, "income");
  if (bankAccountId) {
    refresh(orgId, "banking");
  }
  if (contactId) {
    refresh(orgId, "crm");
  }
  revalidatePath(`/${orgId}/reports`);
}

export async function updateIncomeAction(formData: FormData) {
  const orgId = s(formData, "orgId");
  await orgAccess(orgId);
  const id = s(formData, "id");
  if (!id) return;

  const amount = n(formData, "amount");
  const title = s(formData, "title");
  if (!title || amount <= 0) return;

  const rawContactId = s(formData, "contactId");
  const validContact = rawContactId
    ? await db.contact.findFirst({ where: { id: rawContactId, organizationId: orgId } })
    : null;
  const contactId = validContact ? validContact.id : null;

  const rawBankAccountId = s(formData, "bankAccountId");
  let paymentMethod = (s(formData, "paymentMethod") || "CASH").toUpperCase();
  if (rawBankAccountId) {
    paymentMethod = "BANK";
  }
  let bankAccountId: string | null = null;
  let targetBank = null;

  if (rawBankAccountId) {
    targetBank = await db.bankAccount.findFirst({
      where: { id: rawBankAccountId, organizationId: orgId },
    });
    if (targetBank) {
      bankAccountId = targetBank.id;
    }
  }

  const isDirectorAccount = s(formData, "isDirectorAccount") === "on" || s(formData, "isDirectorAccount") === "true";
  const directorName = s(formData, "directorName") || "Director";
  const directorTxType = s(formData, "directorTxType") || "CAPITAL";

  let source = s(formData, "source") || null;
  if (!source && validContact) {
    source = validContact.companyName || validContact.name;
  }
  if (isDirectorAccount && !source) {
    source = `Director: ${directorName}`;
  }

  let effectiveTitle = title;
  if (isDirectorAccount && !effectiveTitle.toLowerCase().includes("director")) {
    effectiveTitle = `${effectiveTitle} [Director: ${directorName}]`;
  }

  const receivedAt = d(formData, "receivedAt") ?? new Date();
  let notes = s(formData, "notes") || null;
  if (isDirectorAccount) {
    const dirNote = `[Director Account: ${directorTxType} - ${directorName}]`;
    notes = notes ? `${dirNote} ${notes}` : dirNote;
  }

  await db.$transaction(async (tx) => {
    const existing = await tx.income.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!existing) return;

    const oldAmount = Number(existing.amount);
    const oldBankAccountId = existing.bankAccountId;
    const oldPaymentMethod = existing.paymentMethod;

    // 1. Revert old bank balance if old income was deposited into bank
    if (oldPaymentMethod === "BANK" && oldBankAccountId) {
      await tx.bankAccount.update({
        where: { id: oldBankAccountId },
        data: { currentBalance: { decrement: oldAmount } },
      });
      await tx.bankTransaction.deleteMany({
        where: { incomeId: id },
      });
    }

    // 2. Apply new bank balance if new income is BANK
    if (paymentMethod === "BANK" && bankAccountId && targetBank) {
      const freshAcc = await tx.bankAccount.findUnique({ where: { id: bankAccountId } });
      const curBal = Number(freshAcc?.currentBalance || 0);
      const newBal = curBal + amount;

      await tx.bankAccount.update({
        where: { id: bankAccountId },
        data: { currentBalance: newBal },
      });

      await tx.bankTransaction.create({
        data: {
          organizationId: orgId,
          bankAccountId,
          transactionDate: receivedAt,
          type: "DEPOSIT",
          amount,
          balance: newBal,
          description: isDirectorAccount && !title.toLowerCase().includes("director")
            ? `Income: ${title} [Director: ${directorName} - ${directorTxType}]`
            : `Income Receipt: ${title}`,
          reference: source || (validContact ? (validContact.companyName || validContact.name) : null),
          category: isDirectorAccount ? "Director Current Account (Inflow)" : "Payment Received",
          incomeId: id,
          contactId,
        },
      });
    }

    // 3. Update the Income record
    await tx.income.update({
      where: { id },
      data: {
        title: effectiveTitle,
        amount,
        receivedAt,
        source,
        paymentMethod: paymentMethod === "BANK" ? "BANK" : paymentMethod === "OTHER" ? "OTHER" : "CASH",
        bankAccountId: paymentMethod === "BANK" ? bankAccountId : null,
        contactId,
        notes,
      },
    });
  });

  refresh(orgId, "income");
  refresh(orgId, "banking");
  if (contactId) {
    refresh(orgId, "crm");
  }
  revalidatePath(`/${orgId}/reports`);
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

export async function createContactAction(formData: FormData) {
  const orgId = s(formData,"orgId"); const { organization } = await orgAccess(orgId); if (organization.kind !== WorkspaceKind.COMPANY) return;
  if (!s(formData,"name")) return;
  const name = toTitleCase(s(formData, "name"));
  const companyName = s(formData, "companyName") ? toTitleCase(s(formData, "companyName")) : null;
  await db.contact.create({ data: { organizationId: orgId, type: (s(formData,"type") || "CUSTOMER") as never, name, companyName, email: s(formData,"email") || null, phone: s(formData,"phone") || null, address: s(formData,"address") || null, taxNumber: s(formData,"taxNumber") || null, notes: s(formData,"notes") || null } });
  refresh(orgId,"crm");
}

export async function createLeadAction(formData: FormData) {
  const orgId = s(formData,"orgId"); await orgAccess(orgId); if (!s(formData,"title")) return;
  const requestedContact = s(formData,"contactId");
  const contactId = requestedContact && await db.contact.findFirst({ where: { id: requestedContact, organizationId: orgId }, select: { id: true } }) ? requestedContact : null;
  await db.lead.create({ data: { organizationId: orgId, contactId, title: s(formData,"title"), source: s(formData,"source") || null, status: (s(formData,"status") || "NEW") as never, value: n(formData,"value"), nextFollowUpAt: d(formData,"nextFollowUpAt"), notes: s(formData,"notes") || null } });
  refresh(orgId,"leads");
}

export async function createProductAction(formData: FormData) {
  const orgId = s(formData,"orgId"); await orgAccess(orgId); const sku=s(formData,"sku"), name=s(formData,"name"); if(!sku||!name)return;
  const openingStock=n(formData,"openingStock");
  await db.$transaction(async (tx) => {
    const product=await tx.product.create({ data: { organizationId: orgId, sku, name, unit: s(formData,"unit") || "pcs", salePrice: n(formData,"salePrice"), purchasePrice: n(formData,"purchasePrice"), stockQty: openingStock, reorderLevel: n(formData,"reorderLevel") } });
    if(openingStock>0) await tx.stockMovement.create({data:{organizationId:orgId,productId:product.id,type:"IN",quantity:openingStock,reference:"OPENING",note:"Opening stock"}});
  });
  refresh(orgId,"stock");
}

export async function createStockMovementAction(formData: FormData) {
  const orgId=s(formData,"orgId"); await orgAccess(orgId); const productId=s(formData,"productId"), type=s(formData,"type") || "IN", quantity=n(formData,"quantity"); if(!productId||quantity<=0)return;
  const product = await db.product.findFirst({ where: { id: productId, organizationId: orgId }, select: { id: true } }); if (!product) return;
  const sign = type === "OUT" ? -1 : 1;
  await db.$transaction([
    db.stockMovement.create({ data: { organizationId: orgId, productId, type: type as never, quantity, reference: s(formData,"reference") || null, note: s(formData,"note") || null, occurredAt: d(formData,"occurredAt") ?? new Date() } }),
    db.product.update({ where: { id: productId }, data: { stockQty: { increment: sign * quantity } } }),
  ]);
  refresh(orgId,"stock");
}

export async function createEmployeeAction(formData: FormData) {
  const orgId=s(formData,"orgId"); await orgAccess(orgId); if(!s(formData,"employeeCode")||!s(formData,"name"))return;
  await db.employee.create({ data: { organizationId: orgId, employeeCode:s(formData,"employeeCode"), name:s(formData,"name"), email:s(formData,"email")||null, phone:s(formData,"phone")||null, designation:s(formData,"designation")||null, department:s(formData,"department")||null, joinDate:d(formData,"joinDate")??new Date(), basicSalary:n(formData,"basicSalary") } });
  refresh(orgId,"staff");
}

export async function createPayrollAction(formData: FormData) {
  const orgId=s(formData,"orgId"); await orgAccess(orgId); const employeeId=s(formData,"employeeId"); const month=d(formData,"month"); if(!employeeId||!month)return;
  if (!await db.employee.findFirst({ where: { id: employeeId, organizationId: orgId }, select: { id: true } })) return;
  const basic=n(formData,"basic"), allowance=n(formData,"allowance"), overtime=n(formData,"overtime"), deduction=n(formData,"deduction"), tax=n(formData,"tax");
  const netPay=basic+allowance+overtime-deduction-tax;
  await db.payroll.create({ data: { organizationId:orgId, employeeId, month:startOfMonth(month), basic, allowance, overtime, deduction, tax, netPay, paidAt:d(formData,"paidAt"), notes:s(formData,"notes")||null } });
  refresh(orgId,"payroll");
}

export async function createLeaveAction(formData: FormData) {
  const orgId=s(formData,"orgId"); await orgAccess(orgId); const employeeId=s(formData,"employeeId"), from=d(formData,"fromDate"), to=d(formData,"toDate"); if(!employeeId||!from||!to)return;
  if (!await db.employee.findFirst({ where: { id: employeeId, organizationId: orgId }, select: { id: true } })) return;
  const days=Math.max(1, Math.floor((to.getTime()-from.getTime())/86400000)+1);
  await db.leaveRequest.create({ data: { organizationId:orgId, employeeId, leaveType:s(formData,"leaveType")||"Annual", fromDate:from, toDate:to, days, reason:s(formData,"reason")||null } });
  refresh(orgId,"leaves");
}

export async function createTaskAction(formData: FormData) {
  const orgId=s(formData,"orgId"); await orgAccess(orgId); if(!s(formData,"title"))return;
  const requestedEmployee = s(formData,"employeeId");
  const employeeId = requestedEmployee && await db.employee.findFirst({ where: { id: requestedEmployee, organizationId: orgId }, select: { id: true } }) ? requestedEmployee : null;
  const requestedProject = s(formData,"projectId");
  const projectId = requestedProject && await db.project.findFirst({ where: { id: requestedProject, organizationId: orgId }, select: { id: true } }) ? requestedProject : null;
  const allocatedHours = n(formData,"allocatedHours",0);
  await db.task.create({ data: { organizationId:orgId, title:s(formData,"title"), description:s(formData,"description")||null, status:(s(formData,"status")||"TODO") as never, priority:(s(formData,"priority")||"MEDIUM") as never, dueAt:d(formData,"dueAt"), employeeId, projectId, allocatedHours } });
  refresh(orgId,"tasks");
}

export async function createLicenseAction(formData: FormData) {
  const orgId=s(formData,"orgId"); await orgAccess(orgId); if(!s(formData,"name"))return;
  await db.licenseRecord.create({ data: { organizationId:orgId, name:s(formData,"name"), vendor:s(formData,"vendor")||null, licenseKey:s(formData,"licenseKey")||null, seats:n(formData,"seats",1), purchaseDate:d(formData,"purchaseDate"), expiryDate:d(formData,"expiryDate"), renewalCost:n(formData,"renewalCost",0)||null, notes:s(formData,"notes")||null } });
  refresh(orgId,"licenses");
}

export async function createReminderAction(formData: FormData) {
  const orgId=s(formData,"orgId"); await orgAccess(orgId); const dueAt=d(formData,"dueAt"); if(!s(formData,"title")||!dueAt)return;
  await db.reminder.create({ data: { organizationId:orgId, title:s(formData,"title"), dueAt, notes:s(formData,"notes")||null } });
  refresh(orgId,"reminders");
}

export async function createCommerceDocumentAction(formData: FormData) {
  const orgId=s(formData,"orgId"); await orgAccess(orgId); const kind=s(formData,"kind");
  let lines: Line[] = [];
  try { lines = JSON.parse(s(formData,"lines")); } catch { return; }
  lines = lines.filter((x) => x.description && Number(x.quantity)>0 && Number(x.unitPrice)>=0);
  if (!lines.length) return;
  const discount=n(formData,"discount",0);
  const subtotal=lines.reduce((a,l)=>a+Number(l.quantity)*Number(l.unitPrice),0);
  const tax=lines.reduce((a,l)=>a+(Number(l.quantity)*Number(l.unitPrice)*Number(l.taxRate||0)/100),0);
  const total=Math.max(0,subtotal+tax-discount);
  const requestedContact=s(formData,"contactId");
  const contactId=requestedContact && await db.contact.findFirst({where:{id:requestedContact,organizationId:orgId},select:{id:true}}) ? requestedContact : null;
  const productIds=[...new Set(lines.map(l=>l.productId).filter((x): x is string => Boolean(x)))];
  const allowedProducts=productIds.length ? await db.product.findMany({where:{organizationId:orgId,id:{in:productIds}},select:{id:true}}) : [];
  const allowedProductIds=new Set(allowedProducts.map(p=>p.id));
  const now=Date.now().toString().slice(-7);
  const lineData = lines.map(l=>({ productId:l.productId&&allowedProductIds.has(l.productId)?l.productId:null, description:l.description, quantity:Number(l.quantity), unitPrice:Number(l.unitPrice), taxRate:Number(l.taxRate||0), amount:Number(l.quantity)*Number(l.unitPrice) }));

  if(kind==="INVOICE") {
    await db.invoice.create({ data:{ organizationId:orgId, invoiceNumber:s(formData,"number")||`INV-${now}`, contactId, issueDate:d(formData,"issueDate")??new Date(), dueDate:d(formData,"dueDate"), subtotal, tax, discount, total, notes:s(formData,"notes")||null, terms:s(formData,"terms")||null, items:{create:lineData} } });
    refresh(orgId,"invoices"); return;
  }
  if(kind==="QUOTE") {
    await db.quote.create({ data:{ organizationId:orgId, quoteNumber:s(formData,"number")||`QUO-${now}`, contactId, issueDate:d(formData,"issueDate")??new Date(), validUntil:d(formData,"dueDate"), subtotal, tax, discount, total, notes:s(formData,"notes")||null, terms:s(formData,"terms")||null, items:{create:lineData} } });
    refresh(orgId,"quotes"); return;
  }
  const orderLines = lines.map(l=>({ productId:l.productId&&allowedProductIds.has(l.productId)?l.productId:null, description:l.description, quantity:Number(l.quantity), unitPrice:Number(l.unitPrice), amount:Number(l.quantity)*Number(l.unitPrice) }));
  if(kind==="SALES_ORDER") {
    await db.salesOrder.create({ data:{ organizationId:orgId, orderNumber:s(formData,"number")||`SO-${now}`, contactId, orderDate:d(formData,"issueDate")??new Date(), subtotal, tax, discount, total, notes:s(formData,"notes")||null, items:{create:orderLines} } });
    refresh(orgId,"sales"); return;
  }
  if(kind==="PURCHASE_ORDER") {
    await db.purchaseOrder.create({ data:{ organizationId:orgId, orderNumber:s(formData,"number")||`PO-${now}`, contactId, orderDate:d(formData,"issueDate")??new Date(), subtotal, tax, discount, total, notes:s(formData,"notes")||null, items:{create:orderLines} } });
    refresh(orgId,"purchase");
  }
}

export async function updateCommerceDocumentAction(formData: FormData) {
  const orgId = s(formData, "orgId");
  await orgAccess(orgId);
  const kind = s(formData, "kind");
  const id = s(formData, "id");
  if (!id) return;

  let lines: Line[] = [];
  try {
    lines = JSON.parse(s(formData, "lines"));
  } catch {
    return;
  }
  lines = lines.filter((x) => x.description && Number(x.quantity) > 0 && Number(x.unitPrice) >= 0);
  if (!lines.length) return;

  const discount = n(formData, "discount", 0);
  const subtotal = lines.reduce((a, l) => a + Number(l.quantity) * Number(l.unitPrice), 0);
  const tax = lines.reduce((a, l) => a + (Number(l.quantity) * Number(l.unitPrice) * Number(l.taxRate || 0)) / 100, 0);
  const total = Math.max(0, subtotal + tax - discount);
  const requestedContact = s(formData, "contactId");
  const contactId = requestedContact && (await db.contact.findFirst({ where: { id: requestedContact, organizationId: orgId }, select: { id: true } })) ? requestedContact : null;
  const productIds = [...new Set(lines.map((l) => l.productId).filter((x): x is string => Boolean(x)))];
  const allowedProducts = productIds.length ? await db.product.findMany({ where: { organizationId: orgId, id: { in: productIds } }, select: { id: true } }) : [];
  const allowedProductIds = new Set(allowedProducts.map((p) => p.id));
  const lineData = lines.map((l) => ({
    productId: l.productId && allowedProductIds.has(l.productId) ? l.productId : null,
    description: l.description,
    quantity: Number(l.quantity),
    unitPrice: Number(l.unitPrice),
    taxRate: Number(l.taxRate || 0),
    amount: Number(l.quantity) * Number(l.unitPrice),
  }));

  if (kind === "QUOTE") {
    const quote = await db.quote.findFirst({ where: { id, organizationId: orgId } });
    if (!quote) return;
    await db.$transaction(async (tx) => {
      await tx.quoteItem.deleteMany({ where: { quoteId: id } });
      await tx.quote.update({
        where: { id },
        data: {
          quoteNumber: s(formData, "number") || quote.quoteNumber,
          contactId,
          issueDate: d(formData, "issueDate") ?? quote.issueDate,
          validUntil: d(formData, "dueDate") ?? quote.validUntil,
          subtotal,
          tax,
          discount,
          total,
          notes: s(formData, "notes") || null,
          terms: s(formData, "terms") || null,
          items: { create: lineData },
        },
      });
    });
    refresh(orgId, "quotes");
    redirect(`/${orgId}/quotes/${id}`);
  }

  if (kind === "INVOICE") {
    const invoice = await db.invoice.findFirst({ where: { id, organizationId: orgId } });
    if (!invoice) return;
    await db.$transaction(async (tx) => {
      await tx.invoiceItem.deleteMany({ where: { invoiceId: id } });
      await tx.invoice.update({
        where: { id },
        data: {
          invoiceNumber: s(formData, "number") || invoice.invoiceNumber,
          contactId,
          issueDate: d(formData, "issueDate") ?? invoice.issueDate,
          dueDate: d(formData, "dueDate") ?? invoice.dueDate,
          subtotal,
          tax,
          discount,
          total,
          notes: s(formData, "notes") || null,
          terms: s(formData, "terms") || null,
          items: { create: lineData },
        },
      });
    });
    refresh(orgId, "invoices");
    redirect(`/${orgId}/invoices/${id}`);
  }
}

export async function updateStatusAction(formData: FormData) {
  const orgId=s(formData,"orgId"); await orgAccess(orgId); const resource=s(formData,"resource"), id=s(formData,"id"), status=s(formData,"status"); if(!id||!status)return;
  const allowed: Record<string, string[]> = {
    invoice:["DRAFT","SENT","PARTIAL","PAID","OVERDUE","CANCELLED"],
    quote:["DRAFT","SENT","ACCEPTED","REJECTED","CANCELLED"],
    sales:["DRAFT","CONFIRMED","PROCESSING","COMPLETED","CANCELLED"],
    purchase:["DRAFT","CONFIRMED","PROCESSING","COMPLETED","CANCELLED"],
    lead:["NEW","CONTACTED","QUALIFIED","PROPOSAL","WON","LOST"],
    task:["TODO","IN_PROGRESS","BLOCKED","DONE"],
    leave:["PENDING","APPROVED","REJECTED","CANCELLED"],
    reminder:["PENDING","DONE","DISMISSED"],
    license:["ACTIVE","EXPIRING","EXPIRED","CANCELLED"],
  };
  if (!allowed[resource]?.includes(status)) return;
  if(resource==="sales") {
    const order=await db.salesOrder.findFirst({where:{id,organizationId:orgId},include:{items:true}}); if(!order)return;
    if(order.stockPostedAt && status!=="COMPLETED") return;
    if(status==="COMPLETED" && !order.stockPostedAt) {
      await db.$transaction(async tx=>{
        for(const item of order.items){ if(!item.productId)continue; await tx.stockMovement.create({data:{organizationId:orgId,productId:item.productId,type:"OUT",quantity:item.quantity,reference:order.orderNumber,note:"Auto-posted from completed sales order"}}); await tx.product.update({where:{id:item.productId},data:{stockQty:{decrement:item.quantity}}}); }
        await tx.salesOrder.update({where:{id:order.id},data:{status:"COMPLETED",stockPostedAt:new Date()}});
      });
    } else await db.salesOrder.update({where:{id:order.id},data:{status:status as never}});
  }
  else if(resource==="purchase") {
    const order=await db.purchaseOrder.findFirst({where:{id,organizationId:orgId},include:{items:true}}); if(!order)return;
    if(order.stockPostedAt && status!=="COMPLETED") return;
    if(status==="COMPLETED" && !order.stockPostedAt) {
      await db.$transaction(async tx=>{
        for(const item of order.items){ if(!item.productId)continue; await tx.stockMovement.create({data:{organizationId:orgId,productId:item.productId,type:"IN",quantity:item.quantity,reference:order.orderNumber,note:"Auto-posted from completed purchase order"}}); await tx.product.update({where:{id:item.productId},data:{stockQty:{increment:item.quantity}}}); }
        await tx.purchaseOrder.update({where:{id:order.id},data:{status:"COMPLETED",stockPostedAt:new Date()}});
      });
    } else await db.purchaseOrder.update({where:{id:order.id},data:{status:status as never}});
  }
  else if(resource==="invoice") await db.invoice.updateMany({where:{id,organizationId:orgId},data:{status:status as never}});
  else if(resource==="quote") await db.quote.updateMany({where:{id,organizationId:orgId},data:{status:status as never}});
  else if(resource==="lead") await db.lead.updateMany({where:{id,organizationId:orgId},data:{status:status as never}});
  else if(resource==="task") await db.task.updateMany({where:{id,organizationId:orgId},data:{status:status as never}});
  else if(resource==="leave") await db.leaveRequest.updateMany({where:{id,organizationId:orgId},data:{status:status as never}});
  else if(resource==="reminder") await db.reminder.updateMany({where:{id,organizationId:orgId},data:{status:status as never}});
  else if(resource==="license") await db.licenseRecord.updateMany({where:{id,organizationId:orgId},data:{status:status as never}});
  refresh(orgId, resource === "invoice" ? "invoices" : resource === "quote" ? "quotes" : resource);
  if(resource==="sales"||resource==="purchase") revalidatePath(`/${orgId}/stock`);
}

export async function recordInvoicePaymentAction(formData: FormData) {
  const orgId=s(formData,"orgId"); await orgAccess(orgId); const invoiceId=s(formData,"invoiceId"), amount=n(formData,"amount"); if(!invoiceId||amount<=0)return;
  const invoice=await db.invoice.findFirst({where:{id:invoiceId,organizationId:orgId}}); if(!invoice)return;
  const remaining=Math.max(0,Number(invoice.total)-Number(invoice.paidAmount));
  const acceptedAmount=Math.min(remaining,amount); if (acceptedAmount <= 0) return;
  const newPaid=Number(invoice.paidAmount)+acceptedAmount;
  await db.$transaction([
    db.invoicePayment.create({data:{invoiceId,amount:acceptedAmount,paidAt:d(formData,"paidAt")??new Date(),method:s(formData,"method")||null,reference:s(formData,"reference")||null,notes:s(formData,"notes")||null}}),
    db.invoice.update({where:{id:invoiceId},data:{paidAmount:newPaid,status:newPaid>=Number(invoice.total)?"PAID":"PARTIAL"}}),
  ]);
  refresh(orgId,"invoices"); revalidatePath(`/${orgId}/invoices/${invoiceId}`);
}

export async function convertQuoteToInvoiceAction(formData: FormData) {
  const orgId=s(formData,"orgId"); await orgAccess(orgId); const quoteId=s(formData,"quoteId"); if(!quoteId)return;
  const quote=await db.quote.findFirst({where:{id:quoteId,organizationId:orgId},include:{items:true,convertedInvoice:true}}); if(!quote)return;
  if (quote.convertedInvoice) redirect(`/${orgId}/invoices/${quote.convertedInvoice.id}`);
  const number=`INV-${Date.now().toString().slice(-9)}`;
  const invoice=await db.invoice.create({data:{organizationId:orgId,invoiceNumber:number,sourceQuoteId:quote.id,contactId:quote.contactId,status:"DRAFT",issueDate:new Date(),subtotal:quote.subtotal,tax:quote.tax,discount:quote.discount,total:quote.total,notes:quote.notes,terms:quote.terms,items:{create:quote.items.map(i=>({productId:i.productId,description:i.description,quantity:i.quantity,unitPrice:i.unitPrice,taxRate:i.taxRate,amount:i.amount}))}}});
  await db.quote.update({where:{id:quote.id},data:{status:"ACCEPTED"}});
  refresh(orgId,"quotes"); refresh(orgId,"invoices"); revalidatePath(`/${orgId}/invoices/${invoice.id}`);
  redirect(`/${orgId}/invoices/${invoice.id}`);
}

export async function createBankAccountAction(formData: FormData) {
  const orgId = s(formData, "orgId");
  await orgAccess(orgId);
  const bankName = s(formData, "bankName");
  const accountNumber = s(formData, "accountNumber");
  if (!bankName || !accountNumber) return;

  const openingBalance = n(formData, "openingBalance", 0);
  const holdAmount = n(formData, "holdAmount", 0);
  const creditLimit = n(formData, "creditLimit", 0);
  const statementDay = n(formData, "statementDay", 0);
  const paymentDueDay = n(formData, "paymentDueDay", 0);
  await db.bankAccount.create({
    data: {
      organizationId: orgId,
      bankName,
      accountName: s(formData, "accountName") || bankName,
      accountNumber,
      accountType: s(formData, "accountType") || "CURRENT",
      branch: s(formData, "branch") || null,
      currency: s(formData, "currency") || "NPR",
      openingBalance,
      currentBalance: openingBalance,
      holdAmount,
      creditLimit: creditLimit > 0 ? creditLimit : null,
      statementDay: statementDay >= 1 && statementDay <= 31 ? statementDay : null,
      paymentDueDay: paymentDueDay >= 1 && paymentDueDay <= 31 ? paymentDueDay : null,
      notes: s(formData, "notes") || null,
    },
  });
  refresh(orgId, "banking");
}

export async function recordBankTransactionAction(formData: FormData) {
  const orgId = s(formData, "orgId");
  await orgAccess(orgId);
  const bankAccountId = s(formData, "bankAccountId");
  const type = s(formData, "type") === "DEPOSIT" ? "DEPOSIT" : "WITHDRAWAL";
  const amount = n(formData, "amount", 0);
  const description = s(formData, "description");
  if (!bankAccountId || amount <= 0 || !description) return;

  const bankAccount = await db.bankAccount.findFirst({
    where: { id: bankAccountId, organizationId: orgId },
  });
  if (!bankAccount) return;

  const rawContactId = s(formData, "contactId");
  const validContact = rawContactId
    ? await db.contact.findFirst({ where: { id: rawContactId, organizationId: orgId } })
    : null;
  const contactId = validContact ? validContact.id : null;
  const contactName = validContact ? (validContact.companyName || validContact.name) : null;
  const customParty = s(formData, "partyName") || null;

  const txDate = d(formData, "transactionDate") ?? new Date();
  const reference = s(formData, "reference") || null;
  const chequeNumber = s(formData, "chequeNumber") || null;
  const category = s(formData, "category") || null;

  const isDirectorAccount = s(formData, "isDirectorAccount") === "on" || s(formData, "isDirectorAccount") === "true";
  const directorName = s(formData, "directorName") || "Director";
  const directorTxType = s(formData, "directorTxType") || (type === "DEPOSIT" ? "CAPITAL" : "DRAWINGS");

  const transferTarget = s(formData, "transferTarget") || ""; // e.g. "CASH_IN_HAND" | "ESEWA" | "KHALTI" | other wallet
  const isTransfer = type === "WITHDRAWAL" && (
    transferTarget !== "" ||
    category?.toLowerCase().includes("transfer") ||
    category?.toLowerCase().includes("atm") ||
    description.toLowerCase().includes("atm withdrawal") ||
    description.toLowerCase().includes("cash withdrawal") ||
    description.toLowerCase().includes("load esewa") ||
    description.toLowerCase().includes("load khalti") ||
    description.toLowerCase().includes("to wallet")
  );

  const effectiveCategory = isDirectorAccount
    ? `Director: ${directorName} (${directorTxType === "CAPITAL" ? "Capital Inflow" : directorTxType === "DRAWINGS" ? "Personal Drawings" : directorTxType})`
    : isTransfer
    ? (category || (description.toLowerCase().includes("esewa") ? "Digital Wallet: eSewa Transfer" : description.toLowerCase().includes("khalti") ? "Digital Wallet: Khalti Transfer" : "Internal Transfer: ATM / Cash in Hand"))
    : (category || (contactName ? `CRM: ${contactName}` : null));

  const effectiveDescription = isDirectorAccount && !description.toLowerCase().includes("director")
    ? `${description} [Director: ${directorName} - ${directorTxType}]`
    : description;

  await db.$transaction(async (tx) => {
    let incomeId: string | null = null;
    let expenseId: string | null = null;
    const updatedSourceAccount = await tx.bankAccount.update({
      where: { id: bankAccountId },
      data: {
        currentBalance: type === "DEPOSIT" ? { increment: amount } : { decrement: amount },
      },
    });
    const newBal = Number(updatedSourceAccount.currentBalance);

    if (type === "DEPOSIT") {
      const inc = await tx.income.create({
        data: {
          organizationId: orgId,
          title: effectiveDescription,
          source: isDirectorAccount ? `Director: ${directorName}` : (contactName || customParty || `${bankAccount.bankName} (${bankAccount.accountNumber})`),
          amount,
          receivedAt: txDate,
          paymentMethod: "BANK",
          bankAccountId,
          contactId,
          notes: isDirectorAccount ? `[Director Account: ${directorTxType}] ${reference ? `Ref: ${reference}` : ""}`.trim() : (reference ? `Ref: ${reference}` : null),
        },
      });
      incomeId = inc.id;
    } else if (isTransfer) {
      // INTERNAL ACCOUNTING / CONTRA ENTRY (Bank -> Cash in Hand / ATM or Wallet)
      // Pure asset transfer: Strictly NEITHER an Expense NOR an Income in the P&L!
      // Only subsequent spending from the wallet or cash records an actual Expense.
      incomeId = null;
      expenseId = null;

      const targetChannel = transferTarget === "ESEWA" || description.toLowerCase().includes("esewa")
        ? "ESEWA"
        : transferTarget === "KHALTI" || description.toLowerCase().includes("khalti")
        ? "KHALTI"
        : transferTarget === "OTHER_WALLET"
        ? "OTHER_WALLET"
        : "CASH";

      let destAccount = null;
      if (targetChannel === "CASH") {
        destAccount = await tx.bankAccount.findFirst({
          where: {
            organizationId: orgId,
            OR: [
              { accountType: "CASH" },
              { accountNumber: "CASH-IN-HAND" },
              { bankName: { contains: "Cash" } },
            ],
          },
        });
        if (!destAccount) {
          destAccount = await tx.bankAccount.create({
            data: {
              organizationId: orgId,
              bankName: "Cash in Hand",
              accountName: "Cash in Hand / Petty Cash",
              accountNumber: "CASH-IN-HAND",
              accountType: "CASH",
              currency: bankAccount.currency || "NPR",
              openingBalance: 0,
              currentBalance: 0,
              isActive: true,
            },
          });
        }
      } else if (targetChannel === "ESEWA") {
        destAccount = await tx.bankAccount.findFirst({
          where: {
            organizationId: orgId,
            OR: [
              { accountNumber: "ESEWA-WALLET" },
              { bankName: { contains: "eSewa" } },
            ],
          },
        });
        if (!destAccount) {
          destAccount = await tx.bankAccount.create({
            data: {
              organizationId: orgId,
              bankName: "eSewa Wallet",
              accountName: "eSewa Digital Wallet",
              accountNumber: "ESEWA-WALLET",
              accountType: "DIGITAL_WALLET",
              currency: bankAccount.currency || "NPR",
              openingBalance: 0,
              currentBalance: 0,
              isActive: true,
            },
          });
        }
      } else if (targetChannel === "KHALTI") {
        destAccount = await tx.bankAccount.findFirst({
          where: {
            organizationId: orgId,
            OR: [
              { accountNumber: "KHALTI-WALLET" },
              { bankName: { contains: "Khalti" } },
            ],
          },
        });
        if (!destAccount) {
          destAccount = await tx.bankAccount.create({
            data: {
              organizationId: orgId,
              bankName: "Khalti Wallet",
              accountName: "Khalti Digital Wallet",
              accountNumber: "KHALTI-WALLET",
              accountType: "DIGITAL_WALLET",
              currency: bankAccount.currency || "NPR",
              openingBalance: 0,
              currentBalance: 0,
              isActive: true,
            },
          });
        }
      } else {
        destAccount = await tx.bankAccount.findFirst({
          where: {
            organizationId: orgId,
            accountType: "DIGITAL_WALLET",
          },
        });
        if (!destAccount) {
          destAccount = await tx.bankAccount.create({
            data: {
              organizationId: orgId,
              bankName: "Digital Wallet",
              accountName: "Personal Digital Wallet",
              accountNumber: "DIGITAL-WALLET",
              accountType: "DIGITAL_WALLET",
              currency: bankAccount.currency || "NPR",
              openingBalance: 0,
              currentBalance: 0,
              isActive: true,
            },
          });
        }
      }

      // Credit destination account and log reciprocal deposit transaction (internal contra, no P&L impact)
      const updatedDestination = await tx.bankAccount.update({
        where: { id: destAccount.id },
        data: { currentBalance: { increment: amount } },
      });
      const destNewBal = Number(updatedDestination.currentBalance);

      await tx.bankTransaction.create({
        data: {
          organizationId: orgId,
          bankAccountId: destAccount.id,
          transactionDate: txDate,
          type: "DEPOSIT",
          amount,
          balance: destNewBal,
          description: `Internal Transfer from ${bankAccount.bankName} (${bankAccount.accountNumber})`,
          reference: reference || `TRF-FROM-${bankAccount.accountNumber.slice(-4)}`,
          category: "Internal Transfer",
          contactId,
          incomeId: null,
          expenseId: null,
        },
      });

    } else {
      const exp = await tx.expense.create({
        data: {
          organizationId: orgId,
          title: effectiveDescription,
          vendor: isDirectorAccount ? `Director: ${directorName}` : (contactName || customParty || reference || bankAccount.bankName),
          type: "ONE_TIME",
          amount,
          occurredAt: txDate,
          notes: isDirectorAccount ? `[Director Account: ${directorTxType}] ${chequeNumber ? `Cheque #${chequeNumber}` : ""}`.trim() : (chequeNumber ? `Cheque #${chequeNumber}` : null),
        },
      });
      expenseId = exp.id;
    }

    await tx.bankTransaction.create({
      data: {
        organizationId: orgId,
        bankAccountId,
        transactionDate: txDate,
        type,
        amount,
        balance: newBal,
        description: isTransfer ? `Internal Transfer to ${effectiveCategory}: ${description}` : effectiveDescription,
        reference,
        chequeNumber,
        category: effectiveCategory,
        contactId,
        incomeId,
        expenseId,
      },
    });
  });

  refreshModules(orgId, "banking", "expenses", "income");
  if (contactId) {
    revalidatePath(`/${orgId}/crm`);
  }
  revalidatePath(`/${orgId}/reports`);
}

export async function updateBankTransactionAction(formData: FormData) {
  const orgId = s(formData, "orgId");
  await orgAccess(orgId);
  const id = s(formData, "id");
  if (!id) return;

  const targetBankAccountId = s(formData, "bankAccountId");
  const newType = (s(formData, "type") || "DEPOSIT").toUpperCase() as "DEPOSIT" | "WITHDRAWAL";
  const newAmount = n(formData, "amount");
  const transactionDate = d(formData, "transactionDate") ?? new Date();
  const description = s(formData, "description");
  const category = s(formData, "category") || null;
  const reference = s(formData, "reference") || null;
  const chequeNumber = s(formData, "chequeNumber") || null;
  const isDirectorAccount = s(formData, "isDirectorAccount") === "on" || s(formData, "isDirectorAccount") === "true";
  const directorName = s(formData, "directorName") || "Director";
  const directorTxType = s(formData, "directorTxType") || (newType === "DEPOSIT" ? "CAPITAL" : "DRAWINGS");

  let effectiveCategory = category;
  let effectiveDescription = description || `${newType === "DEPOSIT" ? "Deposit" : "Withdrawal"} record`;

  if (isDirectorAccount) {
    effectiveCategory = `Director: ${directorName} (${directorTxType === "CAPITAL" ? "Capital Inflow" : directorTxType === "DRAWINGS" ? "Personal Drawings" : directorTxType})`;
    if (!effectiveDescription.toLowerCase().includes("director")) {
      effectiveDescription = `${effectiveDescription} [Director: ${directorName} - ${directorTxType}]`;
    }
  }

  const rawContactId = s(formData, "contactId");
  if (!targetBankAccountId || newAmount <= 0) return;

  await db.$transaction(async (tx) => {
    const existing = await tx.bankTransaction.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!existing) return;

    const oldBankAccountId = existing.bankAccountId;
    const oldType = existing.type;
    const oldAmount = Number(existing.amount);

    // Revert old effect
    const oldRevertDelta = oldType === "DEPOSIT" ? -oldAmount : oldAmount;
    await tx.bankAccount.update({
      where: { id: oldBankAccountId },
      data: { currentBalance: { increment: oldRevertDelta } },
    });

    // Apply new effect
    const newApplyDelta = newType === "DEPOSIT" ? newAmount : -newAmount;
    const updatedTargetAccount = await tx.bankAccount.update({
      where: { id: targetBankAccountId },
      data: { currentBalance: { increment: newApplyDelta } },
    });

    const validContact = rawContactId
      ? await tx.contact.findFirst({ where: { id: rawContactId, organizationId: orgId } })
      : null;

    await tx.bankTransaction.update({
      where: { id },
      data: {
        bankAccountId: targetBankAccountId,
        type: newType,
        amount: newAmount,
        transactionDate,
        description: effectiveDescription,
        category: effectiveCategory,
        reference,
        chequeNumber,
        balance: updatedTargetAccount.currentBalance,
        contactId: validContact ? validContact.id : null,
      },
    });

    // Synchronize coupled income record if present
    if (existing.incomeId) {
      await tx.income.updateMany({
        where: { id: existing.incomeId, organizationId: orgId },
        data: {
          amount: newAmount,
          receivedAt: transactionDate,
          title: effectiveDescription,
          bankAccountId: targetBankAccountId,
          paymentMethod: "BANK",
          contactId: validContact ? validContact.id : undefined,
        },
      });
    }

    // Synchronize coupled expense record if present
    if (existing.expenseId) {
      await tx.expense.updateMany({
        where: { id: existing.expenseId, organizationId: orgId },
        data: {
          amount: newAmount,
          occurredAt: transactionDate,
          title: effectiveDescription,
        },
      });
    }
  });

  refresh(orgId, "banking");
  refresh(orgId, "income");
  refresh(orgId, "expenses");
  refresh(orgId, "crm");
  revalidatePath(`/${orgId}/reports`);
}

export async function recordPurchasePaymentAction(formData: FormData) {
  const orgId = s(formData, "orgId");
  await orgAccess(orgId);
  const purchaseOrderId = s(formData, "purchaseOrderId");
  const amount = n(formData, "amount", 0);
  if (!purchaseOrderId || amount <= 0) return;

  const po = await db.purchaseOrder.findFirst({
    where: { id: purchaseOrderId, organizationId: orgId },
    include: { contact: true },
  });
  if (!po) return;

  const payDate = d(formData, "paidAt") || new Date();
  const method = s(formData, "method") || "Bank Transfer";
  const reference = s(formData, "reference") || null;
  const notes = s(formData, "notes") || null;

  await db.$transaction(async (tx) => {
    // 1. Record Purchase Payment
    await tx.purchasePayment.create({
      data: {
        purchaseOrderId: po.id,
        amount,
        paidAt: payDate,
        method,
        reference,
        notes,
      },
    });

    // 2. Update Purchase Order paidAmount and status
    const newPaid = Number(po.paidAmount) + amount;
    const isFullyPaid = newPaid >= Number(po.total);
    await tx.purchaseOrder.update({
      where: { id: po.id },
      data: {
        paidAmount: newPaid,
        status: isFullyPaid ? "COMPLETED" : po.status,
      },
    });

    // 3. Create linked Expense so it immediately reflects in reports
    await tx.expense.create({
      data: {
        organizationId: orgId,
        title: `Payment for PO #${po.orderNumber}${notes ? ` (${notes})` : ""}`,
        vendor: po.contact?.companyName || po.contact?.name || "Vendor",
        type: "ONE_TIME",
        amount,
        occurredAt: payDate,
        notes: `Procurement dues settlement against PO #${po.orderNumber}. Ref: ${reference || "N/A"}`,
      },
    });
  });

  refresh(orgId, "purchase");
  refresh(orgId, "expenses");
  revalidatePath(`/${orgId}/purchase/${po.id}`);
  revalidatePath(`/${orgId}/reports`);
}

export async function createLoanAction(formData: FormData) {
  const orgId = s(formData, "orgId");
  await orgAccess(orgId);
  const partyName = s(formData, "partyName");
  const principalAmount = n(formData, "principalAmount", 0);
  if (!partyName || principalAmount <= 0) return;

  const type = (s(formData, "type") || "TAKEN") as "TAKEN" | "GIVEN";
  const startDate = d(formData, "startDate") || new Date();
  const dueDate = d(formData, "dueDate");
  const hasInterest = s(formData, "hasInterest") === "true" || formData.get("hasInterest") === "on";
  const interestRate = hasInterest ? n(formData, "interestRate", 0) : 0;
  const interestFrequency = (s(formData, "interestFrequency") || "MONTHLY") as "DAILY" | "MONTHLY" | "YEARLY";
  const notes = s(formData, "notes") || null;

  await db.loan.create({
    data: {
      organizationId: orgId,
      partyName,
      type,
      principalAmount,
      startDate,
      dueDate,
      hasInterest,
      interestRate,
      interestFrequency,
      notes,
    },
  });

  refresh(orgId, "loans");
  revalidatePath(`/${orgId}/reports`);
  redirect(`/${orgId}/loans`);
}

export async function settleLoanAction(formData: FormData) {
  const orgId = s(formData, "orgId");
  await orgAccess(orgId);
  const loanId = s(formData, "loanId");
  const principalAmount = n(formData, "principalAmount", 0);
  const interestAmount = n(formData, "interestAmount", 0);
  const totalAmount = principalAmount + interestAmount;
  if (!loanId || totalAmount <= 0) return;

  const loan = await db.loan.findFirst({
    where: { id: loanId, organizationId: orgId },
  });
  if (!loan) return;

  const paymentDate = d(formData, "paymentDate") || new Date();
  const notes = s(formData, "notes") || null;

  await db.$transaction(async (tx) => {
    // 1. Create Loan Payment record
    await tx.loanPayment.create({
      data: {
        loanId: loan.id,
        paymentDate,
        principalAmount,
        interestAmount,
        totalAmount,
        notes,
      },
    });

    // 2. Update Loan totals and status
    const newPrincipalPaid = Number(loan.totalPrincipalPaid) + principalAmount;
    const newInterestPaid = Number(loan.totalInterestPaid) + interestAmount;
    const isFullySettled = newPrincipalPaid >= Number(loan.principalAmount);

    await tx.loan.update({
      where: { id: loan.id },
      data: {
        totalPrincipalPaid: newPrincipalPaid,
        totalInterestPaid: newInterestPaid,
        status: isFullySettled ? "SETTLED" : "ACTIVE",
        settledAt: isFullySettled ? paymentDate : loan.settledAt,
      },
    });

    // 3. Sync to Income or Expense ledger for reporting
    if (loan.type === "TAKEN") {
      // Repayment of loan taken is an Outlay / Expense
      await tx.expense.create({
        data: {
          organizationId: orgId,
          title: `Loan Repayment to ${loan.partyName}${interestAmount > 0 ? ` (Principal: ${principalAmount}, Int: ${interestAmount})` : ""}`,
          vendor: loan.partyName,
          type: "ONE_TIME",
          amount: totalAmount,
          occurredAt: paymentDate,
          notes: `Settlement for Loan #${loan.id.slice(-6)}. Notes: ${notes || "None"}`,
        },
      });
    } else {
      // Repayment of loan given is an Inflow / Income
      await tx.income.create({
        data: {
          organizationId: orgId,
          title: `Loan Collection from ${loan.partyName}${interestAmount > 0 ? ` (Principal: ${principalAmount}, Int: ${interestAmount})` : ""}`,
          source: loan.partyName,
          amount: totalAmount,
          receivedAt: paymentDate,
          notes: `Settlement collection for Loan #${loan.id.slice(-6)}. Notes: ${notes || "None"}`,
        },
      });
    }
  });

  refresh(orgId, "loans");
  refresh(orgId, "income");
  refresh(orgId, "expenses");
  revalidatePath(`/${orgId}/loans/${loan.id}`);
  revalidatePath(`/${orgId}/reports`);
}

export async function saveRentalHouseAction(formData: FormData) {
  const orgId = s(formData, "orgId");
  await orgAccess(orgId);
  const houseId = s(formData, "id");
  const title = s(formData, "title") || "Current Rental Residence";
  const ownerName = s(formData, "ownerName") || "House Owner";
  const ownerPhone = s(formData, "ownerPhone");
  const address = s(formData, "address");
  const monthlyRent = n(formData, "monthlyRent") || 16800;
  const electricityRate = n(formData, "electricityRate") || 15;
  const waterGarbageFee = n(formData, "waterGarbageFee") || 300;
  const notes = s(formData, "notes");
  const makeActive = formData.get("isActive") === "true";

  let createdHouseId = houseId;

  if (houseId) {
    await db.rentalHouse.update({
      where: { id: houseId },
      data: {
        title,
        ownerName,
        ownerPhone,
        address,
        monthlyRent,
        electricityRate,
        waterGarbageFee,
        notes,
        ...(makeActive ? { isActive: true } : {}),
      },
    });
  } else {
    const count = await db.rentalHouse.count({ where: { organizationId: orgId } });
    const isActive = makeActive || count === 0;
    const h = await db.rentalHouse.create({
      data: {
        organizationId: orgId,
        title,
        ownerName,
        ownerPhone,
        address,
        monthlyRent,
        electricityRate,
        waterGarbageFee,
        notes,
        isActive,
      },
    });
    createdHouseId = h.id;
  }

  const isAlreadyActive = houseId ? await db.rentalHouse.findFirst({ where: { id: houseId, isActive: true } }) : null;

  if (makeActive || isAlreadyActive || (!houseId && createdHouseId)) {
    await syncActiveHouseCommitments(orgId, {
      title,
      ownerName,
      monthlyRent,
      electricityRate,
      waterGarbageFee,
    });
    if (createdHouseId) {
      await db.rentalHouse.updateMany({
        where: { organizationId: orgId, id: { not: createdHouseId } },
        data: { isActive: false },
      });
      await db.rentalHouse.update({
        where: { id: createdHouseId },
        data: { isActive: true },
      });
    }
  }

  refresh(orgId, "expenses");
  revalidatePath(`/${orgId}`);
  revalidatePath(`/${orgId}/expenses`);
  revalidatePath(`/${orgId}/reports`);
}

export async function recordRentalPaymentAction(formData: FormData) {
  const orgId = s(formData, "orgId");
  await orgAccess(orgId);
  const rentalHouseId = s(formData, "rentalHouseId");
  const billingMonth = s(formData, "billingMonth");
  const paidAmount = n(formData, "paidAmount", 0);
  if (!rentalHouseId || !/^\d{4}-\d{2}$/.test(billingMonth) || paidAmount <= 0) {
    throw new Error("House, billing month, and a positive payment amount are required.");
  }

  const house = await db.rentalHouse.findFirst({
    where: { id: rentalHouseId, organizationId: orgId },
  });
  if (!house) throw new Error("Rental property not found.");

  const rentAmount = n(formData, "rentAmount", Number(house.monthlyRent));
  const electricityAmount = n(formData, "electricityAmount", 0);
  const waterAmount = n(formData, "waterAmount", Number(house.waterGarbageFee));
  const otherAmount = n(formData, "otherAmount", 0);
  const totalAmount = rentAmount + electricityAmount + waterAmount + otherAmount;
  const paidAt = d(formData, "paidAt") ?? new Date();
  const dueDate = d(formData, "dueDate");
  const paymentMethod = (s(formData, "paymentMethod") || "CASH").toUpperCase();
  const bankAccountId = s(formData, "bankAccountId");
  const reference = s(formData, "reference") || null;
  const notes = s(formData, "notes") || null;

  await db.$transaction(async (tx) => {
    const bill = await tx.rentalBill.upsert({
      where: { rentalHouseId_billingMonth: { rentalHouseId, billingMonth } },
      update: { rentAmount, electricityAmount, waterAmount, otherAmount, totalAmount, dueDate, notes },
      create: {
        organizationId: orgId,
        rentalHouseId,
        billingMonth,
        rentAmount,
        electricityAmount,
        waterAmount,
        otherAmount,
        totalAmount,
        dueDate,
        notes,
      },
    });

    let category = await tx.expenseCategory.findFirst({
      where: { organizationId: orgId, name: { contains: "Rent" } },
    });
    if (!category) {
      category = await tx.expenseCategory.create({
        data: { organizationId: orgId, name: "Rent & Premises", icon: "home" },
      });
    }

    const expense = await tx.expense.create({
      data: {
        organizationId: orgId,
        categoryId: category.id,
        title: `Rental payment - ${house.title} (${billingMonth})`,
        vendor: house.ownerName,
        type: "ONE_TIME",
        amount: paidAmount,
        occurredAt: paidAt,
        isEstimated: false,
        notes: [
          `Bill ${billingMonth}: rent ${rentAmount}, electricity ${electricityAmount}, water/CAM ${waterAmount}, other ${otherAmount}.`,
          reference ? `Reference: ${reference}.` : "",
          notes || "",
        ].filter(Boolean).join(" "),
      },
    });

    await tx.rentalPayment.create({
      data: {
        organizationId: orgId,
        rentalBillId: bill.id,
        amount: paidAmount,
        paidAt,
        paymentMethod,
        reference,
        notes,
        expenseId: expense.id,
      },
    });

    if (paymentMethod === "BANK" && bankAccountId) {
      const account = await tx.bankAccount.findFirst({ where: { id: bankAccountId, organizationId: orgId } });
      if (!account) throw new Error("Selected payment account was not found.");
      const updated = await tx.bankAccount.update({
        where: { id: account.id },
        data: { currentBalance: { decrement: paidAmount } },
      });
      await tx.bankTransaction.create({
        data: {
          organizationId: orgId,
          bankAccountId: account.id,
          transactionDate: paidAt,
          type: "WITHDRAWAL",
          amount: paidAmount,
          balance: updated.currentBalance,
          description: `Rental payment - ${house.title} (${billingMonth})`,
          reference,
          category: "Rent & Premises",
          expenseId: expense.id,
        },
      });
    }
  });

  refreshModules(orgId, "expenses", "banking", "reports");
}

export async function setActiveRentalHouseAction(formData: FormData) {
  const orgId = s(formData, "orgId");
  const houseId = s(formData, "houseId");
  await orgAccess(orgId);

  const house = await db.rentalHouse.findFirst({ where: { id: houseId, organizationId: orgId } });
  if (!house) return;

  await db.rentalHouse.updateMany({
    where: { organizationId: orgId },
    data: { isActive: false },
  });

  await db.rentalHouse.update({
    where: { id: house.id },
    data: { isActive: true },
  });

  await syncActiveHouseCommitments(orgId, {
    title: house.title,
    ownerName: house.ownerName,
    monthlyRent: Number(house.monthlyRent),
    electricityRate: Number(house.electricityRate),
    waterGarbageFee: Number(house.waterGarbageFee),
  });

  refresh(orgId, "expenses");
  revalidatePath(`/${orgId}`);
  revalidatePath(`/${orgId}/expenses`);
  revalidatePath(`/${orgId}/reports`);
}

export async function deleteRentalHouseAction(formData: FormData) {
  const orgId = s(formData, "orgId");
  const houseId = s(formData, "houseId");
  await orgAccess(orgId);

  if (houseId) {
    await db.rentalHouse.deleteMany({
      where: { id: houseId, organizationId: orgId },
    });
  }

  refresh(orgId, "expenses");
  revalidatePath(`/${orgId}`);
  revalidatePath(`/${orgId}/expenses`);
  revalidatePath(`/${orgId}/reports`);
}

async function syncActiveHouseCommitments(orgId: string, house: {
  title: string;
  ownerName: string;
  monthlyRent: number;
  electricityRate: number;
  waterGarbageFee: number;
}) {
  const org = await db.organization.findUnique({ where: { id: orgId }, select: { kind: true } });
  const isCompany = org?.kind === "COMPANY";
  const rentTitle = isCompany ? "Office Rent (Monthly)" : "House Rent (Monthly)";

  let rentCat = await db.expenseCategory.findFirst({
    where: { organizationId: orgId, name: { contains: "rent" } },
  });
  if (!rentCat) {
    rentCat = await db.expenseCategory.findFirst({ where: { organizationId: orgId } });
    if (!rentCat) {
      rentCat = await db.expenseCategory.create({
        data: { organizationId: orgId, name: "Rent & Premises" },
      });
    }
  }

  const rentRec = await db.recurringExpense.findFirst({
    where: { organizationId: orgId, title: { contains: "rent" } },
  });
  if (rentRec) {
    await db.recurringExpense.update({
      where: { id: rentRec.id },
      data: {
        title: rentTitle,
        fixedAmount: house.monthlyRent,
        vendor: house.ownerName || (isCompany ? "Office Landlord" : "House Landlord"),
        notes: `Premises rent for ${house.title} (Owner: ${house.ownerName})`,
      },
    });
  } else if (house.monthlyRent > 0) {
    await db.recurringExpense.create({
      data: {
        organizationId: orgId,
        categoryId: rentCat.id,
        title: rentTitle,
        active: true,
        fixedAmount: house.monthlyRent,
        vendor: house.ownerName || (isCompany ? "Office Landlord" : "House Landlord"),
        notes: `Monthly lease commitment for ${house.title}`,
      },
    });
  }

  const elecRec = await db.recurringExpense.findFirst({
    where: { organizationId: orgId, title: { contains: "electricity" } },
  });
  if (elecRec) {
    await db.recurringExpense.update({
      where: { id: elecRec.id },
      data: {
        unitRate: house.electricityRate,
      },
    });
  } else if (house.electricityRate > 0) {
    await db.recurringExpense.create({
      data: {
        organizationId: orgId,
        categoryId: rentCat.id,
        title: isCompany ? "Office Electricity" : "House Electricity",
        active: true,
        unitRate: house.electricityRate,
        vendor: "Nepal Electricity Authority (NEA)",
      },
    });
  }

  const waterRec = await db.recurringExpense.findFirst({
    where: { organizationId: orgId, title: { contains: "Water" } },
  });
  if (waterRec) {
    await db.recurringExpense.update({
      where: { id: waterRec.id },
      data: {
        fixedAmount: house.waterGarbageFee,
      },
    });
  } else if (house.waterGarbageFee > 0) {
    await db.recurringExpense.create({
      data: {
        organizationId: orgId,
        categoryId: rentCat.id,
        title: isCompany ? "Office Water & Maintenance" : "Water & Waste Management",
        active: true,
        fixedAmount: house.waterGarbageFee,
      },
    });
  }
}

export async function saveMilkLogAction(formData: FormData) {
  const orgId = s(formData, "orgId");
  await orgAccess(orgId);
  const month = s(formData, "month") || new Date().toISOString().slice(0, 7);
  const ratePerLiter = n(formData, "ratePerLiter") || 115;
  const regularDays = Math.max(0, parseInt(s(formData, "regularDays") || "30", 10));
  const regularQty = n(formData, "regularQty") || 1.5;
  const alternateDays = Math.max(0, parseInt(s(formData, "alternateDays") || "0", 10));
  const alternateQty = n(formData, "alternateQty") || 0;
  const notes = s(formData, "notes");

  const totalLiters = (regularDays * regularQty) + (alternateDays * alternateQty);
  const totalCost = totalLiters * ratePerLiter;

  const paid = formData.get("paid") === "true";

  await db.milkMonthlyLog.upsert({
    where: { organizationId_month: { organizationId: orgId, month } },
    update: {
      ratePerLiter,
      regularDays,
      regularQty,
      alternateDays,
      alternateQty,
      totalLiters,
      totalCost,
      paid,
      notes,
    },
    create: {
      organizationId: orgId,
      month,
      ratePerLiter,
      regularDays,
      regularQty,
      alternateDays,
      alternateQty,
      totalLiters,
      totalCost,
      paid,
      notes,
    },
  });

  const milkCat = await db.expenseCategory.findFirst({
    where: { organizationId: orgId, name: { contains: "Milk" } },
  });

  const expenseTitle = `Daily milk bill (${month}): ${regularDays}d × ${regularQty}L${alternateDays > 0 ? ` + ${alternateDays}d × ${alternateQty}L` : ""} = ${totalLiters}L @ ${ratePerLiter}/L`;

  const existingExp = await db.expense.findFirst({
    where: { organizationId: orgId, title: { contains: `Daily milk bill (${month})` } },
  });

  let occurredAt = new Date();
  const bsMatch = month.match(/^(\d{4})-(\d{2})$/);
  if (bsMatch && parseInt(bsMatch[1], 10) >= 2070 && parseInt(bsMatch[1], 10) <= 2100) {
    occurredAt = bsToAd(parseInt(bsMatch[1], 10), parseInt(bsMatch[2], 10), 28);
  } else {
    occurredAt = new Date(`${month.slice(0, 7)}-28T12:00:00Z`);
  }

  if (existingExp) {
    await db.expense.update({
      where: { id: existingExp.id },
      data: {
        title: expenseTitle,
        amount: totalCost,
        occurredAt,
        isEstimated: !paid,
        notes: `Calculated from milk consumption log: ${totalLiters} liters total at NPR ${ratePerLiter}/liter.`,
      },
    });
  } else {
    await db.expense.create({
      data: {
        organizationId: orgId,
        categoryId: milkCat?.id,
        title: expenseTitle,
        vendor: "Local Dairy",
        type: "ONE_TIME",
        amount: totalCost,
        occurredAt,
        isEstimated: !paid,
        notes: `Calculated from milk consumption log: ${totalLiters} liters total at NPR ${ratePerLiter}/liter.`,
      },
    });
  }

  refresh(orgId, "expenses");
  revalidatePath(`/${orgId}`);
  revalidatePath(`/${orgId}/expenses`);
  revalidatePath(`/${orgId}/reports`);
}

export async function saveElectricityLogAction(formData: FormData) {
  const orgId = s(formData, "orgId");
  await orgAccess(orgId);

  const month = s(formData, "month") || new Date().toISOString().slice(0, 7);
  const meterNumber = s(formData, "meterNumber") || "MAIN";
  const previousUnit = n(formData, "previousUnit", 0);
  const currentUnit = n(formData, "currentUnit", 0);
  const ratePerUnit = n(formData, "ratePerUnit", 15);
  const readingDate = d(formData, "readingDate") ?? new Date();
  const notes = s(formData, "notes") || null;

  if (currentUnit < previousUnit) {
    throw new Error("Current meter unit cannot be less than previous unit.");
  }

  const unitsConsumed = Math.max(0, currentUnit - previousUnit);
  const totalCost = unitsConsumed * ratePerUnit;

  // Find or create Electricity expense category
  let elecCat = await db.expenseCategory.findFirst({
    where: {
      organizationId: orgId,
      OR: [
        { name: { contains: "Electricity" } },
        { name: { contains: "Utilities" } },
      ],
    },
  });
  if (!elecCat) {
    elecCat = await db.expenseCategory.create({
      data: {
        organizationId: orgId,
        name: "Electricity & Utilities",
        icon: "zap",
      },
    });
  }

  const expenseTitle = `Electricity bill (${month}): ${unitsConsumed.toFixed(1)} units (${previousUnit} -> ${currentUnit}) @ NPR ${ratePerUnit}/unit`;
  const expenseNotes = `Auto-calculated electricity consumption: Previous meter reading = ${previousUnit}, Current meter reading = ${currentUnit}. Net units consumed = ${unitsConsumed} units @ NPR ${ratePerUnit}/unit.${notes ? ` Notes: ${notes}` : ""}`;

  const isPaid = formData.get("paid") !== "false";

  await db.$transaction(async (tx) => {
    // 1. Check existing expense for this month
    const existingExp = await tx.expense.findFirst({
      where: {
        organizationId: orgId,
        title: { contains: `Electricity bill (${month})` },
      },
    });

    let expenseId: string;
    if (existingExp) {
      const updated = await tx.expense.update({
        where: { id: existingExp.id },
        data: {
          title: expenseTitle,
          amount: totalCost,
          unitRate: ratePerUnit,
          quantity: unitsConsumed,
          unit: "units",
          occurredAt: readingDate,
          isEstimated: !isPaid,
          notes: expenseNotes,
        },
      });
      expenseId = updated.id;
    } else {
      const created = await tx.expense.create({
        data: {
          organizationId: orgId,
          categoryId: elecCat.id,
          title: expenseTitle,
          vendor: "Nepal Electricity Authority / Landlord",
          type: "ONE_TIME",
          amount: totalCost,
          unitRate: ratePerUnit,
          quantity: unitsConsumed,
          unit: "units",
          occurredAt: readingDate,
          isEstimated: !isPaid,
          notes: expenseNotes,
        },
      });
      expenseId = created.id;
    }

    // 2. Upsert ElectricityReadingLog
    await tx.electricityReadingLog.upsert({
      where: {
        organizationId_month: {
          organizationId: orgId,
          month,
        },
      },
      update: {
        meterNumber,
        previousUnit,
        currentUnit,
        unitsConsumed,
        ratePerUnit,
        totalCost,
        readingDate,
        expenseId,
        paid: formData.get("paid") !== "false",
        notes,
      },
      create: {
        organizationId: orgId,
        month,
        meterNumber,
        previousUnit,
        currentUnit,
        unitsConsumed,
        ratePerUnit,
        totalCost,
        readingDate,
        expenseId,
        paid: formData.get("paid") !== "false",
        notes,
      },
    });

    // 3. Update active RentalHouse lastElectricityUnit if present
    const activeHouse = await tx.rentalHouse.findFirst({
      where: { organizationId: orgId, isActive: true },
    });
    if (activeHouse) {
      await tx.rentalHouse.update({
        where: { id: activeHouse.id },
        data: { lastElectricityUnit: currentUnit },
      });
    }
  });

  refresh(orgId, "expenses");
  revalidatePath(`/${orgId}`);
  revalidatePath(`/${orgId}/expenses`);
  revalidatePath(`/${orgId}/reports`);
}

export async function toggleElectricityLogStatusAction(formData: FormData) {
  const orgId = s(formData, "orgId");
  await orgAccess(orgId);
  const logId = s(formData, "logId");
  if (!logId) return;

  const log = await db.electricityReadingLog.findFirst({
    where: { id: logId, organizationId: orgId },
  });
  if (!log) return;

  const newPaid = !log.paid;
  await db.electricityReadingLog.update({
    where: { id: log.id },
    data: { paid: newPaid },
  });

  if (log.expenseId) {
    await db.expense.update({
      where: { id: log.expenseId },
      data: { isEstimated: !newPaid },
    });
  }

  refresh(orgId, "expenses");
  revalidatePath(`/${orgId}/expenses`);
  revalidatePath(`/${orgId}/reports`);
}

export async function toggleMilkLogStatusAction(formData: FormData) {
  const orgId = s(formData, "orgId");
  await orgAccess(orgId);
  const logId = s(formData, "logId");
  if (!logId) return;

  const log = await db.milkMonthlyLog.findFirst({
    where: { id: logId, organizationId: orgId },
  });
  if (!log) return;

  const newPaid = !log.paid;
  await db.milkMonthlyLog.update({
    where: { id: log.id },
    data: { paid: newPaid },
  });

  refresh(orgId, "expenses");
  revalidatePath(`/${orgId}/expenses`);
  revalidatePath(`/${orgId}/reports`);
}

export async function toggleExpenseStatusAction(formData: FormData) {
  const orgId = s(formData, "orgId");
  await orgAccess(orgId);
  const expenseId = s(formData, "expenseId");
  if (!expenseId) return;

  const expense = await db.expense.findFirst({
    where: { id: expenseId, organizationId: orgId },
  });
  if (!expense) return;

  const newIsEstimated = !expense.isEstimated;
  await db.expense.update({
    where: { id: expense.id },
    data: { isEstimated: newIsEstimated },
  });

  // If this expense is tied to an electricity reading log, keep it in sync
  await db.electricityReadingLog.updateMany({
    where: { expenseId: expense.id, organizationId: orgId },
    data: { paid: !newIsEstimated },
  });

  refresh(orgId, "expenses");
  revalidatePath(`/${orgId}/expenses`);
  revalidatePath(`/${orgId}/reports`);
}

export async function saveOrganizationSettingsAction(formData: FormData) {
  const orgId = s(formData, "orgId");
  await orgAccess(orgId);
  const name = s(formData, "name");
  if (!name) return;

  const logoUrl = s(formData, "logoUrl") || null;
  const taxNumber = s(formData, "taxNumber") || null;
  const email = s(formData, "email") || null;
  const phone = s(formData, "phone") || null;
  const address = s(formData, "address") || null;
  const currency = s(formData, "currency") || "NPR";
  const defaultTaxPercent = n(formData, "defaultTaxPercent", 13);
  const vendorCategory = s(formData, "vendorCategory") || null;
  const fiscalYearStart = n(formData, "fiscalYearStart", 4);
  const officeOpenTime = s(formData, "officeOpenTime") || "09:30";
  const officeCloseTime = s(formData, "officeCloseTime") || "18:00";
  const minWorkHours = n(formData, "minWorkHours", 8.0);
  const tdsRate = n(formData, "tdsRate", 1.5);
  const archivedDaysThreshold = n(formData, "archivedDaysThreshold", 30);
  const worklogEntryPermission = s(formData, "worklogEntryPermission") || "ALL";
  const initialInvoiceCount = n(formData, "initialInvoiceCount", 1);
  const initialReceiptCount = n(formData, "initialReceiptCount", 1);
  const initialDebitNoteCount = n(formData, "initialDebitNoteCount", 1);
  const initialCreditNoteCount = n(formData, "initialCreditNoteCount", 1);

  await db.organization.update({
    where: { id: orgId },
    data: {
      name,
      logoUrl,
      taxNumber,
      panVatNumber: taxNumber,
      email,
      phone,
      address,
      currency,
      defaultTaxPercent,
      vendorCategory,
      fiscalYearStart,
      officeOpenTime,
      officeCloseTime,
      minWorkHours,
      tdsRate,
      archivedDaysThreshold,
      worklogEntryPermission,
      initialInvoiceCount,
      initialReceiptCount,
      initialDebitNoteCount,
      initialCreditNoteCount,
    },
  });

  revalidatePath(`/${orgId}`);
  revalidatePath(`/${orgId}/settings`);
  revalidatePath(`/${orgId}/quotes`);
  revalidatePath(`/${orgId}/invoices`);
  revalidatePath(`/${orgId}/sales`);
  revalidatePath(`/${orgId}/purchase`);
  redirect(`/${orgId}/settings?saved=true`);
}

export async function deleteQuoteAction(formData: FormData) {
  const orgId = s(formData, "orgId");
  await orgAccess(orgId);
  const quoteId = s(formData, "quoteId");
  if (!quoteId) return;

  await db.quoteItem.deleteMany({
    where: { quoteId },
  });
  await db.quote.delete({
    where: { id: quoteId, organizationId: orgId },
  });

  refresh(orgId, "quotes");
  revalidatePath(`/${orgId}/quotes`);
  revalidatePath(`/${orgId}`);
}

export async function hardDeleteRecordAction(formData: FormData) {
  const orgId = s(formData, "orgId");
  await orgAccess(orgId);
  const resource = s(formData, "resource");
  const id = s(formData, "id");
  if (!id || !resource) return;

  const moduleMap: Record<string, string> = {
    purchase: "purchase",
    sales: "sales",
    invoice: "invoices",
    quote: "quotes",
    expense: "expenses",
    recurring_expense: "expenses",
    income: "income",
    contact: "crm",
    lead: "leads",
    task: "tasks",
    product: "stock",
    leave: "leaves",
    reminder: "reminders",
    license: "licenses",
    loan: "loans",
    payroll: "payroll",
    bank_tx: "banking",
    milk_log: "expenses",
    project: "projects",
    employee: "staff",
  };

  await db.$transaction(async (tx) => {
    switch (resource) {
      case "purchase":
        await tx.purchasePayment.deleteMany({ where: { purchaseOrderId: id } });
        await tx.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: id } });
        await tx.purchaseOrder.deleteMany({ where: { id, organizationId: orgId } });
        break;

      case "sales":
        await tx.salesOrderItem.deleteMany({ where: { salesOrderId: id } });
        await tx.salesOrder.deleteMany({ where: { id, organizationId: orgId } });
        break;

      case "invoice":
        await tx.invoicePayment.deleteMany({ where: { invoiceId: id } });
        await tx.invoiceItem.deleteMany({ where: { invoiceId: id } });
        await tx.invoice.deleteMany({ where: { id, organizationId: orgId } });
        break;

      case "quote":
        await tx.quoteItem.deleteMany({ where: { quoteId: id } });
        await tx.quote.deleteMany({ where: { id, organizationId: orgId } });
        break;

      case "expense": {
        const linkedBankTxs = await tx.bankTransaction.findMany({
          where: { expenseId: id, organizationId: orgId },
        });
        for (const btx of linkedBankTxs) {
          // Deleting expense outlay restores money back to the bank account
          await tx.bankAccount.update({
            where: { id: btx.bankAccountId },
            data: { currentBalance: { increment: Number(btx.amount) } },
          });
        }
        await tx.bankTransaction.deleteMany({ where: { expenseId: id } });
        await tx.expense.deleteMany({ where: { id, organizationId: orgId } });
        break;
      }

      case "recurring_expense":
        await tx.expense.updateMany({ where: { recurringExpenseId: id }, data: { recurringExpenseId: null } });
        await tx.recurringExpense.deleteMany({ where: { id, organizationId: orgId } });
        break;

      case "income": {
        const linkedBankTxs = await tx.bankTransaction.findMany({
          where: { incomeId: id, organizationId: orgId },
        });
        for (const btx of linkedBankTxs) {
          // Deleting income inflow removes money from the bank account
          await tx.bankAccount.update({
            where: { id: btx.bankAccountId },
            data: { currentBalance: { decrement: Number(btx.amount) } },
          });
        }
        await tx.bankTransaction.deleteMany({ where: { incomeId: id } });
        await tx.income.deleteMany({ where: { id, organizationId: orgId } });
        break;
      }

      case "contact":
        await tx.contact.deleteMany({ where: { id, organizationId: orgId } });
        break;

      case "lead":
        await tx.lead.deleteMany({ where: { id, organizationId: orgId } });
        break;

      case "task":
        await tx.workLog.updateMany({ where: { taskId: id }, data: { taskId: null } });
        await tx.task.deleteMany({ where: { id, organizationId: orgId } });
        break;

      case "product":
        await tx.stockMovement.deleteMany({ where: { productId: id } });
        await tx.product.deleteMany({ where: { id, organizationId: orgId } });
        break;

      case "leave":
        await tx.leaveRequest.deleteMany({ where: { id, organizationId: orgId } });
        break;

      case "reminder":
        await tx.reminder.deleteMany({ where: { id, organizationId: orgId } });
        break;

      case "license":
        await tx.licenseRecord.deleteMany({ where: { id, organizationId: orgId } });
        break;

      case "loan":
        await tx.loanPayment.deleteMany({ where: { loanId: id } });
        await tx.loan.deleteMany({ where: { id, organizationId: orgId } });
        break;

      case "payroll":
        await tx.payroll.deleteMany({ where: { id, organizationId: orgId } });
        break;

      case "bank_tx": {
        const existingTx = await tx.bankTransaction.findFirst({
          where: { id, organizationId: orgId },
        });
        if (existingTx) {
          const amt = Number(existingTx.amount);
          // Reverting effect: DEPOSIT deletion reduces balance, WITHDRAWAL deletion increases balance
          const delta = existingTx.type === "DEPOSIT" ? -amt : amt;
          await tx.bankAccount.update({
            where: { id: existingTx.bankAccountId },
            data: { currentBalance: { increment: delta } },
          });

          // Delete coupled income or expense if present
          if (existingTx.incomeId) {
            await tx.income.deleteMany({ where: { id: existingTx.incomeId, organizationId: orgId } });
          }
          if (existingTx.expenseId) {
            await tx.expense.deleteMany({ where: { id: existingTx.expenseId, organizationId: orgId } });
          }

          await tx.bankTransaction.delete({ where: { id } });
        }
        break;
      }

      case "milk_log":
        await tx.milkMonthlyLog.deleteMany({ where: { id, organizationId: orgId } });
        break;

      case "project":
        await tx.project.deleteMany({ where: { id, organizationId: orgId } });
        break;

      case "employee":
        await tx.employee.deleteMany({ where: { id, organizationId: orgId } });
        break;

      default:
        break;
    }
  });

  const targetModule = moduleMap[resource] || "";
  refresh(orgId, targetModule);
  if (targetModule) revalidatePath(`/${orgId}/${targetModule}`);
  revalidatePath(`/${orgId}`);
  if (resource === "purchase" || resource === "sales" || resource === "product") {
    revalidatePath(`/${orgId}/stock`);
  }
  if (resource === "bank_tx" || resource === "expense" || resource === "income") {
    refreshModules(orgId, "banking", "expenses", "income");
    revalidatePath(`/${orgId}/banking`);
    revalidatePath(`/${orgId}/expenses`);
    revalidatePath(`/${orgId}/income`);
    revalidatePath(`/${orgId}/reports`);
  }
}

export async function softDeleteRecordAction(formData: FormData) {
  const orgId = s(formData, "orgId");
  await orgAccess(orgId);
  const resource = s(formData, "resource");
  const id = s(formData, "id");
  if (!id || !resource) return;

  const moduleMap: Record<string, string> = {
    purchase: "purchase",
    sales: "sales",
    invoice: "invoices",
    quote: "quotes",
    expense: "expenses",
    recurring_expense: "expenses",
    income: "income",
    contact: "crm",
    lead: "leads",
    task: "tasks",
    product: "stock",
    leave: "leaves",
    reminder: "reminders",
    license: "licenses",
    loan: "loans",
    payroll: "payroll",
    bank_tx: "banking",
    milk_log: "expenses",
    project: "projects",
    employee: "staff",
  };

  switch (resource) {
    case "purchase":
      await db.purchaseOrder.updateMany({ where: { id, organizationId: orgId }, data: { status: "CANCELLED" } });
      break;

    case "sales":
      await db.salesOrder.updateMany({ where: { id, organizationId: orgId }, data: { status: "CANCELLED" } });
      break;

    case "invoice":
      await db.invoice.updateMany({ where: { id, organizationId: orgId }, data: { status: "CANCELLED" } });
      break;

    case "quote":
      await db.quote.updateMany({ where: { id, organizationId: orgId }, data: { status: "CANCELLED" } });
      break;

    case "lead":
      await db.lead.updateMany({ where: { id, organizationId: orgId }, data: { status: "LOST" } });
      break;

    case "task":
      await db.task.updateMany({ where: { id, organizationId: orgId }, data: { status: "BLOCKED" } });
      break;

    case "leave":
      await db.leaveRequest.updateMany({ where: { id, organizationId: orgId }, data: { status: "CANCELLED" } });
      break;

    case "reminder":
      await db.reminder.updateMany({ where: { id, organizationId: orgId }, data: { status: "DISMISSED" } });
      break;

    case "license":
      await db.licenseRecord.updateMany({ where: { id, organizationId: orgId }, data: { status: "CANCELLED" } });
      break;

    case "product":
      await db.product.updateMany({ where: { id, organizationId: orgId }, data: { active: false } });
      break;

    case "recurring_expense":
      await db.recurringExpense.updateMany({ where: { id, organizationId: orgId }, data: { active: false } });
      break;

    case "loan":
      await db.loan.updateMany({ where: { id, organizationId: orgId }, data: { status: "SETTLED" } });
      break;

    case "employee":
      await db.employee.updateMany({ where: { id, organizationId: orgId }, data: { status: "INACTIVE" } });
      break;

    case "expense": {
      const exp = await db.expense.findFirst({ where: { id, organizationId: orgId } });
      if (exp && !exp.notes?.includes("[CANCELLED]")) {
        await db.expense.update({
          where: { id },
          data: { notes: `[CANCELLED] ${exp.notes || ""}`.trim() },
        });
      }
      break;
    }

    case "income": {
      const inc = await db.income.findFirst({ where: { id, organizationId: orgId } });
      if (inc && !inc.notes?.includes("[CANCELLED]")) {
        await db.income.update({
          where: { id },
          data: { notes: `[CANCELLED] ${inc.notes || ""}`.trim() },
        });
      }
      break;
    }

    case "contact": {
      const cnt = await db.contact.findFirst({ where: { id, organizationId: orgId } });
      if (cnt && !cnt.notes?.includes("[INACTIVE]")) {
        await db.contact.update({
          where: { id },
          data: { notes: `[INACTIVE] ${cnt.notes || ""}`.trim() },
        });
      }
      break;
    }

    case "bank_tx": {
      const btx = await db.bankTransaction.findFirst({ where: { id, organizationId: orgId } });
      if (btx && !btx.description.includes("[CANCELLED]")) {
        const amt = Number(btx.amount);
        const delta = btx.type === "DEPOSIT" ? -amt : amt;
        await db.bankAccount.update({
          where: { id: btx.bankAccountId },
          data: { currentBalance: { increment: delta } },
        });
        await db.bankTransaction.update({
          where: { id },
          data: {
            description: `[CANCELLED] ${btx.description}`.trim(),
            category: "Cancelled Transaction",
          },
        });
      }
      break;
    }

    default:
      break;
  }

  const targetModule = moduleMap[resource] || "";
  refresh(orgId, targetModule);
  if (targetModule) revalidatePath(`/${orgId}/${targetModule}`);
  revalidatePath(`/${orgId}`);
  if (resource === "bank_tx" || resource === "expense" || resource === "income") {
    refreshModules(orgId, "banking", "expenses", "income");
    revalidatePath(`/${orgId}/banking`);
    revalidatePath(`/${orgId}/expenses`);
    revalidatePath(`/${orgId}/income`);
    revalidatePath(`/${orgId}/reports`);
  }
}

export async function updateTaskAction(formData: FormData) {
  const orgId = s(formData, "orgId");
  await orgAccess(orgId);
  const taskId = s(formData, "taskId");
  const title = s(formData, "title");
  if (!taskId || !title) return;

  const description = s(formData, "description") || null;
  const status = (s(formData, "status") || "TODO") as any;
  const priority = (s(formData, "priority") || "MEDIUM") as any;
  const dueAt = d(formData, "dueAt");
  const employeeId = s(formData, "employeeId") || null;
  const projectId = s(formData, "projectId") || null;
  const allocatedHours = n(formData, "allocatedHours", 0);

  await db.task.update({
    where: { id: taskId, organizationId: orgId },
    data: {
      title,
      description,
      status,
      priority,
      dueAt,
      employeeId,
      projectId,
      allocatedHours,
    },
  });

  refresh(orgId, "tasks");
  revalidatePath(`/${orgId}/tasks`);
  revalidatePath(`/${orgId}`);
}

export async function saveProjectAction(formData: FormData) {
  const orgId = s(formData, "orgId");
  await orgAccess(orgId);
  const projectId = s(formData, "id");
  const name = s(formData, "name");
  if (!name) return;

  const description = s(formData, "description") || null;
  const contactId = s(formData, "contactId") || null;
  const teamLeaderId = s(formData, "teamLeaderId") || null;
  const status = s(formData, "status") || "ACTIVE";
  const priority = (s(formData, "priority") || "MEDIUM") as any;
  const workNature = s(formData, "workNature") || null;
  const subWorkNature = s(formData, "subWorkNature") || null;
  const fiscalYear = s(formData, "fiscalYear") || null;
  const budget = n(formData, "budget", 0);
  const startDate = d(formData, "startDate");
  const endDate = d(formData, "endDate");
  const memberIdsRaw = s(formData, "memberIds");
  const memberIds = memberIdsRaw ? memberIdsRaw.split(",").map((m) => m.trim()).filter(Boolean) : [];

  let project;
  if (projectId) {
    project = await db.project.update({
      where: { id: projectId, organizationId: orgId },
      data: {
        name,
        description,
        contactId,
        teamLeaderId,
        status,
        priority,
        workNature,
        subWorkNature,
        fiscalYear,
        budget,
        startDate,
        endDate,
      },
    });
  } else {
    project = await db.project.create({
      data: {
        organizationId: orgId,
        name,
        description,
        contactId,
        teamLeaderId,
        status,
        priority,
        workNature,
        subWorkNature,
        fiscalYear,
        budget,
        startDate,
        endDate,
      },
    });
  }

  // Handle members
  if (memberIds.length > 0) {
    await db.projectMember.deleteMany({ where: { projectId: project.id } });
    await db.projectMember.createMany({
      data: memberIds.map((empId) => ({
        projectId: project.id,
        employeeId: empId,
        role: "MEMBER",
      })),
      skipDuplicates: true,
    });
  }

  // Upsert ProjectWallet
  await db.projectWallet.upsert({
    where: { organizationId_projectId: { organizationId: orgId, projectId: project.id } },
    update: { totalBudget: budget },
    create: {
      organizationId: orgId,
      projectId: project.id,
      totalBudget: budget,
      transferredAmount: 0,
      holdAmount: 0,
      leaderHoldAmount: 0,
      balance: budget,
    },
  });

  revalidatePath(`/${orgId}`);
  revalidatePath(`/${orgId}/projects`);
  revalidatePath(`/${orgId}/wallets`);
}

export async function deleteProjectAction(formData: FormData) {
  const orgId = s(formData, "orgId");
  await orgAccess(orgId);
  const projectId = s(formData, "id");
  if (!projectId) return;

  await db.project.delete({
    where: { id: projectId, organizationId: orgId },
  });

  revalidatePath(`/${orgId}`);
  revalidatePath(`/${orgId}/projects`);
  revalidatePath(`/${orgId}/wallets`);
}

export async function saveWorkLogAction(formData: FormData) {
  const orgId = s(formData, "orgId");
  await orgAccess(orgId);
  const logId = s(formData, "id");
  const projectId = s(formData, "projectId") || null;
  const taskId = s(formData, "taskId") || null;
  const employeeId = s(formData, "employeeId") || null;
  const logDate = d(formData, "logDate") ?? new Date();
  const nepaliDate = s(formData, "nepaliDate") || null;
  const startTime = s(formData, "startTime") || null;
  const endTime = s(formData, "endTime") || null;
  const durationMinutes = n(formData, "durationMinutes", 0);
  const comment = s(formData, "comment") || null;
  const isHolidayOrLeave = s(formData, "isHolidayOrLeave") === "true";
  const isChargeable = s(formData, "isChargeable") !== "false";

  if (logId) {
    await db.workLog.update({
      where: { id: logId, organizationId: orgId },
      data: {
        projectId,
        taskId,
        employeeId,
        logDate,
        nepaliDate,
        startTime,
        endTime,
        durationMinutes,
        comment,
        isHolidayOrLeave,
        isChargeable,
      },
    });
  } else {
    await db.workLog.create({
      data: {
        organizationId: orgId,
        projectId,
        taskId,
        employeeId,
        logDate,
        nepaliDate,
        startTime,
        endTime,
        durationMinutes,
        comment,
        isHolidayOrLeave,
        isChargeable,
        status: "PENDING",
      },
    });
  }

  revalidatePath(`/${orgId}`);
  revalidatePath(`/${orgId}/worklogs`);
  revalidatePath(`/${orgId}/projects`);
  revalidatePath(`/${orgId}/tasks`);
}

export async function updateWorkLogStatusAction(formData: FormData) {
  const orgId = s(formData, "orgId");
  const access = await orgAccess(orgId);
  const logId = s(formData, "id");
  const status = s(formData, "status");
  if (!logId || !status) return;

  await db.workLog.update({
    where: { id: logId, organizationId: orgId },
    data: {
      status,
      approvedById: access.user.id,
      approvedAt: status === "APPROVED" ? new Date() : null,
    },
  });

  revalidatePath(`/${orgId}/worklogs`);
  revalidatePath(`/${orgId}/projects`);
}

export async function saveWalletTransactionAction(formData: FormData) {
  const orgId = s(formData, "orgId");
  await orgAccess(orgId);
  const walletId = s(formData, "walletId");
  const type = s(formData, "type") || "REQUEST";
  const amount = n(formData, "amount", 0);
  if (!walletId || amount <= 0) return;

  const paymentMode = s(formData, "paymentMode") || "Fonepay";
  const requestedById = s(formData, "requestedById") || null;
  const transferToId = s(formData, "transferToId") || null;
  const description = s(formData, "description") || null;

  const wallet = await db.projectWallet.findUnique({
    where: { id: walletId },
  });
  if (!wallet) return;

  if (type === "TRANSFER") {
    const newTransferred = Number(wallet.transferredAmount) + amount;
    const newBalance = Math.max(0, Number(wallet.totalBudget) - newTransferred);

    await db.walletTransaction.create({
      data: {
        organizationId: orgId,
        walletId,
        type: "TRANSFER",
        amount,
        paymentMode,
        requestedById,
        transferToId,
        leaderApproval: "APPROVED",
        adminApproval: "APPROVED",
        status: "TRANSFERRED",
        description,
      },
    });

    await db.projectWallet.update({
      where: { id: walletId },
      data: {
        transferredAmount: newTransferred,
        balance: newBalance,
      },
    });
  } else {
    const newHold = Number(wallet.holdAmount) + amount;

    await db.walletTransaction.create({
      data: {
        organizationId: orgId,
        walletId,
        type: "REQUEST",
        amount,
        paymentMode,
        requestedById,
        transferToId,
        leaderApproval: "PENDING",
        adminApproval: "PENDING",
        status: "PENDING",
        description,
      },
    });

    await db.projectWallet.update({
      where: { id: walletId },
      data: {
        holdAmount: newHold,
      },
    });
  }

  revalidatePath(`/${orgId}/wallets`);
  revalidatePath(`/${orgId}/projects`);
}

export async function updateWalletTransactionStatusAction(formData: FormData) {
  const orgId = s(formData, "orgId");
  await orgAccess(orgId);
  const txId = s(formData, "id");
  const actionType = s(formData, "actionType");
  if (!txId || !actionType) return;

  const tx = await db.walletTransaction.findUnique({
    where: { id: txId },
    include: { wallet: true },
  });
  if (!tx) return;

  if (actionType === "LEADER_APPROVE") {
    await db.walletTransaction.update({
      where: { id: txId },
      data: { leaderApproval: "APPROVED" },
    });
  } else if (actionType === "ADMIN_APPROVE") {
    await db.walletTransaction.update({
      where: { id: txId },
      data: { adminApproval: "APPROVED" },
    });
  } else if (actionType === "REJECT") {
    if (tx.wallet && tx.status === "PENDING") {
      const newHold = Math.max(0, Number(tx.wallet.holdAmount) - Number(tx.amount));
      await db.projectWallet.update({
        where: { id: tx.walletId },
        data: { holdAmount: newHold },
      });
    }
    await db.walletTransaction.update({
      where: { id: txId },
      data: {
        status: "REJECTED",
        leaderApproval: "REJECTED",
        adminApproval: "REJECTED",
      },
    });
  } else if (actionType === "COMPLETE_TRANSFER") {
    if (tx.wallet) {
      const newHold = Math.max(0, Number(tx.wallet.holdAmount) - Number(tx.amount));
      const newTransferred = Number(tx.wallet.transferredAmount) + Number(tx.amount);
      const newBalance = Math.max(0, Number(tx.wallet.totalBudget) - newTransferred);
      await db.projectWallet.update({
        where: { id: tx.walletId },
        data: {
          holdAmount: newHold,
          transferredAmount: newTransferred,
          balance: newBalance,
        },
      });
    }
    await db.walletTransaction.update({
      where: { id: txId },
      data: {
        status: "TRANSFERRED",
        leaderApproval: "APPROVED",
        adminApproval: "APPROVED",
      },
    });
  }

  revalidatePath(`/${orgId}/wallets`);
  revalidatePath(`/${orgId}/projects`);
}
