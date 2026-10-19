const { PrismaClient } = require('../src/generated/client');
const prisma = new PrismaClient();

async function ensureSync() {
  try {
    const org = await prisma.organization.findFirst({
      where: { slug: 'simulcast-technologies' },
    });
    if (!org) return;

    let blackSwan = await prisma.contact.findFirst({
      where: { organizationId: org.id, name: { contains: 'Black Swan' } },
    });
    if (!blackSwan) {
      blackSwan = await prisma.contact.create({
        data: {
          organizationId: org.id,
          type: 'CUSTOMER',
          name: 'Black Swan Nepal',
        },
      });
      console.log('[Sync] Created Black Swan Nepal contact:', blackSwan.id);
    }

    const txDate2083 = new Date('2026-10-15T12:00:00.000Z'); // 2083-06-29 BS

    // 1. Sales Order
    const existingSO = await prisma.salesOrder.findFirst({
      where: { organizationId: org.id, orderNumber: 'SO-7994542' },
    });
    if (!existingSO) {
      const so = await prisma.salesOrder.create({
        data: {
          organizationId: org.id,
          orderNumber: 'SO-7994542',
          contactId: blackSwan.id,
          status: 'COMPLETED',
          orderDate: txDate2083,
          subtotal: 50000,
          tax: 0,
          discount: 0,
          total: 50000,
          notes: 'AP1 Service Charge for Black Swan Nepal (2083-06-29 BS)',
          stockPostedAt: txDate2083,
          items: {
            create: [{
              description: 'AP1 Service Charge',
              quantity: 1,
              unitPrice: 50000,
              amount: 50000,
            }],
          },
        },
      });
      console.log('[Sync] Created Sales Order SO-7994542:', so.id);
    }

    // 2. Invoice
    const existingInv = await prisma.invoice.findFirst({
      where: {
        organizationId: org.id,
        OR: [
          { invoiceNumber: 'INV-SO-7994542' },
          { invoiceNumber: 'INV-9925139' },
          { notes: { contains: 'SO-7994542' } },
        ],
      },
    });
    if (!existingInv) {
      const inv = await prisma.invoice.create({
        data: {
          organizationId: org.id,
          invoiceNumber: 'INV-SO-7994542',
          contactId: blackSwan.id,
          status: 'PAID',
          issueDate: txDate2083,
          dueDate: txDate2083,
          subtotal: 50000,
          tax: 0,
          discount: 0,
          total: 50000,
          paidAmount: 50000,
          notes: 'Tax invoice for order SO-7994542 - AP1 Service Charge (2083-06-29 BS)',
          items: {
            create: [{
              description: 'AP1 Service Charge',
              quantity: 1,
              unitPrice: 50000,
              amount: 50000,
              taxRate: 0,
            }],
          },
        },
      });
      console.log('[Sync] Created Invoice INV-SO-7994542:', inv.id);
    }

    // 3. Direct Income Receipt
    const existingIncome = await prisma.income.findFirst({
      where: {
        organizationId: org.id,
        amount: 50000,
        contactId: blackSwan.id,
        receivedAt: txDate2083,
      },
    });
    if (!existingIncome) {
      const inc = await prisma.income.create({
        data: {
          organizationId: org.id,
          title: 'AP1 Service Charge From Black Swan',
          source: 'Black Swan Nepal',
          amount: 50000,
          receivedAt: txDate2083,
          paymentMethod: 'CASH',
          contactId: blackSwan.id,
          notes: 'AP1 Service Charge From Black Swan [Cash in Hand] - 2083-06-29 BS',
        },
      });
      console.log('[Sync] Created Income receipt for Black Swan:', inc.id);
    }

    // 4. Director Drawings Expense
    const existingExpense = await prisma.expense.findFirst({
      where: {
        organizationId: org.id,
        amount: 50000,
        occurredAt: txDate2083,
        OR: [
          { title: { contains: 'Kalyan' } },
          { vendor: { contains: 'Kalyan' } },
        ],
      },
    });
    if (!existingExpense) {
      const dirCat = await prisma.expenseCategory.findFirst({
        where: { organizationId: org.id, name: { contains: 'Director Current Account' } },
      });

      const exp = await prisma.expense.create({
        data: {
          organizationId: org.id,
          title: 'Cash Out to Kalyan Kumar Karn Director [Director: Kalyan Kumar Karn]',
          vendor: 'Director: Kalyan Kumar Karn',
          categoryId: dirCat ? dirCat.id : null,
          type: 'ONE_TIME',
          amount: 50000,
          occurredAt: txDate2083,
          isEstimated: false,
          notes: '[Director Account: DRAWINGS - Kalyan Kumar Karn] Cash given to director account Kalyan Karn on 2083-06-29 BS (Cash in Hand)',
        },
      });
      console.log('[Sync] Created Director cash out expense for Kalyan Karn:', exp.id);
    }

    console.log('[Sync] Verified 2083-06-29 BS transactions for Black Swan & Director Kalyan Karn.');
  } catch (err) {
    console.error('[Sync] Error verifying transactions:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  ensureSync().catch(console.error);
}

module.exports = { ensureSync };
