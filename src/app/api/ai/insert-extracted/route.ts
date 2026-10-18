import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { Prisma } from "@/generated/client";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      orgId,
      bankTransactions = [],
      expenses = [],
      invoices = [],
      purchases = [],
      incomes = [],
      updateBankBalances = true,
    } = body;

    if (!orgId) {
      return NextResponse.json({ error: "orgId is required" }, { status: 400 });
    }

    // Check organization membership
    const membership = await db.membership.findFirst({
      where: { userId: user.id, organizationId: orgId },
    });
    if (!membership && user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden: No access to this workspace" }, { status: 403 });
    }

    const insertedCounts = {
      bankTransactions: 0,
      expenses: 0,
      invoices: 0,
      purchases: 0,
      incomes: 0,
    };

    // 1. INSERT BANK TRANSACTIONS
    if (Array.isArray(bankTransactions) && bankTransactions.length > 0) {
      // Group by bank account to compute balance deltas
      const bankBalanceDelta: Record<string, number> = {};

      const orgBankAccounts = await db.bankAccount.findMany({
        where: { organizationId: orgId },
        orderBy: { createdAt: "asc" },
      });
      const defaultBankAccountId = orgBankAccounts[0]?.id;

      for (const tx of bankTransactions) {
        const targetAccountId = tx.bankAccountId || defaultBankAccountId;
        if (!targetAccountId || !tx.amount) continue;

        const txDate = tx.transactionDate ? new Date(tx.transactionDate) : new Date();
        const valDate = tx.valueDate ? new Date(tx.valueDate) : null;
        const txAmount = Math.abs(Number(tx.amount));
        const txType = tx.type === "DEPOSIT" ? "DEPOSIT" : "WITHDRAWAL";

        let incomeId: string | null = null;
        let expenseId: string | null = null;

        if (txType === "DEPOSIT") {
          const inc = await db.income.create({
            data: {
              organizationId: orgId,
              title: tx.description || "Bank Statement Deposit",
              source: tx.reference || "Bank Deposit",
              amount: new Prisma.Decimal(txAmount),
              receivedAt: isNaN(txDate.getTime()) ? new Date() : txDate,
              paymentMethod: "BANK",
              bankAccountId: targetAccountId,
              notes: tx.reference ? `Ref: ${tx.reference}` : null,
            },
          });
          incomeId = inc.id;
        } else {
          const exp = await db.expense.create({
            data: {
              organizationId: orgId,
              title: tx.description || "Bank Statement Withdrawal",
              vendor: tx.reference || "Bank Outflow",
              type: "ONE_TIME",
              amount: new Prisma.Decimal(txAmount),
              occurredAt: isNaN(txDate.getTime()) ? new Date() : txDate,
              notes: tx.reference ? `Ref: ${tx.reference}` : null,
            },
          });
          expenseId = exp.id;
        }

        await db.bankTransaction.create({
          data: {
            organizationId: orgId,
            bankAccountId: targetAccountId,
            transactionDate: isNaN(txDate.getTime()) ? new Date() : txDate,
            valueDate: valDate && !isNaN(valDate.getTime()) ? valDate : null,
            type: txType,
            amount: new Prisma.Decimal(txAmount),
            balance: tx.balance !== undefined && tx.balance !== null ? new Prisma.Decimal(Number(tx.balance)) : null,
            description: tx.description || "Bank statement entry",
            reference: tx.reference || null,
            chequeNumber: tx.chequeNumber || null,
            category: tx.category || null,
            incomeId,
            expenseId,
          },
        });

        insertedCounts.bankTransactions++;

        const delta = txType === "DEPOSIT" ? txAmount : -txAmount;
        bankBalanceDelta[targetAccountId] = (bankBalanceDelta[targetAccountId] || 0) + delta;
      }

      // Update current balance on the bank account
      if (updateBankBalances) {
        for (const [accountId, delta] of Object.entries(bankBalanceDelta)) {
          const bank = await db.bankAccount.findUnique({
            where: { id: accountId },
            select: { currentBalance: true },
          });
          if (bank) {
            const newBal = Number(bank.currentBalance) + delta;
            await db.bankAccount.update({
              where: { id: accountId },
              data: { currentBalance: new Prisma.Decimal(newBal) },
            });
          }
        }
      }
    }

    // 2. INSERT EXPENSES
    if (Array.isArray(expenses) && expenses.length > 0) {
      for (const exp of expenses) {
        if (!exp.title || !exp.amount) continue;

        let categoryId = exp.categoryId;
        if (!categoryId && exp.categoryName) {
          // Find or create category
          const existingCat = await db.expenseCategory.findFirst({
            where: { organizationId: orgId, name: exp.categoryName.trim() },
          });
          if (existingCat) {
            categoryId = existingCat.id;
          } else {
            const createdCat = await db.expenseCategory.create({
              data: {
                organizationId: orgId,
                name: exp.categoryName.trim(),
              },
            });
            categoryId = createdCat.id;
          }
        }

        const occurredDate = exp.occurredAt ? new Date(exp.occurredAt) : new Date();

        await db.expense.create({
          data: {
            organizationId: orgId,
            categoryId: categoryId || null,
            title: exp.title,
            vendor: exp.vendor || null,
            amount: new Prisma.Decimal(Math.abs(Number(exp.amount))),
            occurredAt: isNaN(occurredDate.getTime()) ? new Date() : occurredDate,
            isEstimated: false,
            notes: exp.notes || null,
          },
        });

        insertedCounts.expenses++;
      }
    }

    // 3. INSERT INVOICES
    if (Array.isArray(invoices) && invoices.length > 0) {
      for (const inv of invoices) {
        if (!inv.invoiceNumber || !inv.total) continue;

        let contactId = inv.contactId;
        if (!contactId && inv.customerName) {
          const contact = await db.contact.findFirst({
            where: { organizationId: orgId, name: inv.customerName.trim() },
          });
          if (contact) {
            contactId = contact.id;
          } else {
            const newContact = await db.contact.create({
              data: {
                organizationId: orgId,
                type: "CUSTOMER",
                name: inv.customerName.trim(),
                email: inv.customerEmail || null,
                phone: inv.customerPhone || null,
                taxNumber: inv.customerPanVat || null,
              },
            });
            contactId = newContact.id;
          }
        }

        const issueD = inv.issueDate ? new Date(inv.issueDate) : new Date();
        const dueD = inv.dueDate ? new Date(inv.dueDate) : null;
        const invNum = String(inv.invoiceNumber).trim();

        // Check if invoice number already exists
        const existingInv = await db.invoice.findFirst({
          where: { organizationId: orgId, invoiceNumber: invNum },
        });
        const finalInvNumber = existingInv ? `${invNum}-${Date.now().toString().slice(-4)}` : invNum;

        const itemsData = (inv.items || []).map((it: any) => ({
          description: String(it.description || "Service item"),
          quantity: new Prisma.Decimal(Number(it.quantity) || 1),
          unitPrice: new Prisma.Decimal(Number(it.unitPrice) || Number(it.amount) || 0),
          taxRate: new Prisma.Decimal(Number(it.taxRate) || 0),
          amount: new Prisma.Decimal(Number(it.amount) || (Number(it.quantity || 1) * Number(it.unitPrice || 0))),
        }));

        await db.invoice.create({
          data: {
            organizationId: orgId,
            contactId: contactId || null,
            invoiceNumber: finalInvNumber,
            status: "DRAFT",
            issueDate: isNaN(issueD.getTime()) ? new Date() : issueD,
            dueDate: dueD && !isNaN(dueD.getTime()) ? dueD : null,
            subtotal: new Prisma.Decimal(Number(inv.subtotal) || Number(inv.total)),
            tax: new Prisma.Decimal(Number(inv.tax) || 0),
            discount: new Prisma.Decimal(Number(inv.discount) || 0),
            total: new Prisma.Decimal(Number(inv.total)),
            notes: inv.notes || null,
            items: {
              create: itemsData.length > 0 ? itemsData : [
                {
                  description: "General Service / Products",
                  quantity: new Prisma.Decimal(1),
                  unitPrice: new Prisma.Decimal(Number(inv.total)),
                  amount: new Prisma.Decimal(Number(inv.total)),
                },
              ],
            },
          },
        });

        insertedCounts.invoices++;
      }
    }

    // 4. INSERT PURCHASES
    if (Array.isArray(purchases) && purchases.length > 0) {
      for (const po of purchases) {
        if (!po.orderNumber || !po.total) continue;

        let contactId = po.contactId;
        if (!contactId && po.vendorName) {
          const contact = await db.contact.findFirst({
            where: { organizationId: orgId, name: po.vendorName.trim() },
          });
          if (contact) {
            contactId = contact.id;
          } else {
            const newContact = await db.contact.create({
              data: {
                organizationId: orgId,
                type: "VENDOR",
                name: po.vendorName.trim(),
                email: po.vendorEmail || null,
                phone: po.vendorPhone || null,
                taxNumber: po.vendorPanVat || null,
              },
            });
            contactId = newContact.id;
          }
        }

        const poDate = po.orderDate ? new Date(po.orderDate) : new Date();
        const poNum = String(po.orderNumber).trim();
        const existingPo = await db.purchaseOrder.findFirst({
          where: { organizationId: orgId, orderNumber: poNum },
        });
        const finalPoNum = existingPo ? `${poNum}-${Date.now().toString().slice(-4)}` : poNum;

        const itemsData = (po.items || []).map((it: any) => ({
          description: String(it.description || "Supply item"),
          quantity: new Prisma.Decimal(Number(it.quantity) || 1),
          unitPrice: new Prisma.Decimal(Number(it.unitPrice) || Number(it.amount) || 0),
          amount: new Prisma.Decimal(Number(it.amount) || (Number(it.quantity || 1) * Number(it.unitPrice || 0))),
        }));

        await db.purchaseOrder.create({
          data: {
            organizationId: orgId,
            contactId: contactId || null,
            orderNumber: finalPoNum,
            status: "DRAFT",
            orderDate: isNaN(poDate.getTime()) ? new Date() : poDate,
            subtotal: new Prisma.Decimal(Number(po.subtotal) || Number(po.total)),
            tax: new Prisma.Decimal(Number(po.tax) || 0),
            discount: new Prisma.Decimal(Number(po.discount) || 0),
            total: new Prisma.Decimal(Number(po.total)),
            notes: po.notes || null,
            items: {
              create: itemsData.length > 0 ? itemsData : [
                {
                  description: "Purchased items",
                  quantity: new Prisma.Decimal(1),
                  unitPrice: new Prisma.Decimal(Number(po.total)),
                  amount: new Prisma.Decimal(Number(po.total)),
                },
              ],
            },
          },
        });

        insertedCounts.purchases++;
      }
    }

    // 5. INSERT INCOMES
    if (Array.isArray(incomes) && incomes.length > 0) {
      for (const inc of incomes) {
        if (!inc.title || !inc.amount) continue;
        const recDate = inc.receivedAt ? new Date(inc.receivedAt) : new Date();

        await db.income.create({
          data: {
            organizationId: orgId,
            title: inc.title,
            source: inc.source || "Direct Revenue",
            amount: new Prisma.Decimal(Math.abs(Number(inc.amount))),
            receivedAt: isNaN(recDate.getTime()) ? new Date() : recDate,
            paymentMethod: inc.paymentMethod || "BANK",
            bankAccountId: inc.bankAccountId || null,
            notes: inc.notes || null,
          },
        });

        insertedCounts.incomes++;
      }
    }

    try {
      revalidatePath(`/${orgId}/banking`);
      revalidatePath(`/${orgId}/expenses`);
      revalidatePath(`/${orgId}/income`);
      revalidatePath(`/${orgId}/reports`);
      revalidatePath(`/${orgId}`);
    } catch {}

    return NextResponse.json({
      success: true,
      message: `Successfully inserted into database: ${insertedCounts.bankTransactions} bank transactions, ${insertedCounts.expenses} expenses, ${insertedCounts.invoices} invoices, ${insertedCounts.purchases} purchase orders, ${insertedCounts.incomes} income entries.`,
      insertedCounts,
    });
  } catch (error: any) {
    console.error("[Insert Extracted Error]:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to insert extracted data into database" },
      { status: 500 }
    );
  }
}
