import { db } from "@/lib/db";
import { OrderStatus, ContactType, ExpenseType } from "@/generated/client";

let isChecking = false;
let hasChecked = false;

export async function ensureBlackSwan2083Transactions(orgId: string) {
  if (hasChecked || isChecking) return;
  isChecking = true;

  try {
    const org = await db.organization.findUnique({
      where: { id: orgId },
      select: { id: true, slug: true, kind: true },
    });

    if (!org || org.kind !== "COMPANY" || org.slug !== "simulcast-technologies") {
      hasChecked = true;
      return;
    }

    const txDate2083 = new Date("2026-10-15T12:00:00.000Z"); // 2083-06-29 BS

    // 1. Ensure Black Swan contact exists
    let blackSwan = await db.contact.findFirst({
      where: { organizationId: org.id, name: { contains: "Black Swan" } },
    });
    if (!blackSwan) {
      blackSwan = await db.contact.create({
        data: {
          organizationId: org.id,
          type: ContactType.CUSTOMER,
          name: "Black Swan Nepal",
        },
      });
    }

    // 2. Ensure Sales Order SO-7994542
    const existingSO = await db.salesOrder.findFirst({
      where: { organizationId: org.id, orderNumber: "SO-7994542" },
    });
    if (!existingSO) {
      await db.salesOrder.create({
        data: {
          organizationId: org.id,
          orderNumber: "SO-7994542",
          contactId: blackSwan.id,
          status: OrderStatus.COMPLETED,
          orderDate: txDate2083,
          subtotal: 50000,
          tax: 0,
          discount: 0,
          total: 50000,
          notes: "AP1 Service Charge for Black Swan Nepal (2083-06-29 BS)",
          stockPostedAt: txDate2083,
          items: {
            create: [{
              description: "AP1 Service Charge",
              quantity: 1,
              unitPrice: 50000,
              amount: 50000,
            }],
          },
        },
      });
    }

    // 3. Ensure Invoice INV-SO-7994542
    const existingInv = await db.invoice.findFirst({
      where: {
        organizationId: org.id,
        OR: [
          { invoiceNumber: "INV-SO-7994542" },
          { invoiceNumber: "INV-9925139" },
          { notes: { contains: "SO-7994542" } },
        ],
      },
    });
    if (!existingInv) {
      await db.invoice.create({
        data: {
          organizationId: org.id,
          invoiceNumber: "INV-SO-7994542",
          contactId: blackSwan.id,
          status: "PAID",
          issueDate: txDate2083,
          dueDate: txDate2083,
          subtotal: 50000,
          tax: 0,
          discount: 0,
          total: 50000,
          paidAmount: 50000,
          notes: "Tax invoice for order SO-7994542 - AP1 Service Charge (2083-06-29 BS)",
          items: {
            create: [{
              description: "AP1 Service Charge",
              quantity: 1,
              unitPrice: 50000,
              amount: 50000,
              taxRate: 0,
            }],
          },
        },
      });
    }

    // 4. Ensure Direct Income (+50,000 Cash from Black Swan)
    const existingIncome = await db.income.findFirst({
      where: {
        organizationId: org.id,
        amount: 50000,
        contactId: blackSwan.id,
        receivedAt: txDate2083,
      },
    });
    if (!existingIncome) {
      await db.income.create({
        data: {
          organizationId: org.id,
          title: "AP1 Service Charge From Black Swan",
          source: "Black Swan Nepal",
          amount: 50000,
          receivedAt: txDate2083,
          paymentMethod: "CASH",
          contactId: blackSwan.id,
          notes: "AP1 Service Charge From Black Swan [Cash in Hand] - 2083-06-29 BS",
        },
      });
    }

    // 5. Ensure Cash Out to Kalyan Kumar Karn Director Account
    const existingExpense = await db.expense.findFirst({
      where: {
        organizationId: org.id,
        amount: 50000,
        occurredAt: txDate2083,
        OR: [
          { title: { contains: "Kalyan" } },
          { vendor: { contains: "Kalyan" } },
        ],
      },
    });
    if (!existingExpense) {
      const dirCat = await db.expenseCategory.findFirst({
        where: { organizationId: org.id, name: { contains: "Director Current Account" } },
      });

      await db.expense.create({
        data: {
          organizationId: org.id,
          title: "Cash Out to Kalyan Kumar Karn Director [Director: Kalyan Kumar Karn]",
          vendor: "Director: Kalyan Kumar Karn",
          categoryId: dirCat ? dirCat.id : null,
          type: ExpenseType.ONE_TIME,
          amount: 50000,
          occurredAt: txDate2083,
          isEstimated: false,
          notes: "[Director Account: DRAWINGS - Kalyan Kumar Karn] Cash given to director account Kalyan Karn on 2083-06-29 BS (Cash in Hand)",
        },
      });
    }

    hasChecked = true;
  } catch (err) {
    console.error("ensureBlackSwan2083Transactions background sync error:", err);
  } finally {
    isChecking = false;
  }
}
