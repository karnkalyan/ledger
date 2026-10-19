const path = require('path');
const { PrismaClient } = require(path.join(__dirname, '../src/generated/client'));
const prisma = new PrismaClient();

async function linkAvBionics() {
  const av = await prisma.contact.findFirst({
    where: { name: { contains: 'AV Bionics' } }
  });
  if (!av) {
    console.log('AV Bionics contact not found');
    return;
  }
  console.log(`Found AV Bionics: ${av.id} (${av.name}) in org ${av.organizationId}`);

  // Ensure contact type is BOTH because AV Bionics has both purchases and deposits/sales
  if (av.type !== 'BOTH') {
    await prisma.contact.update({
      where: { id: av.id },
      data: { type: 'BOTH' }
    });
    console.log('Updated AV Bionics contact type to BOTH (Vendor & Customer)');
  }

  // Find all bank transactions mentioning Bionics
  const allTxs = await prisma.bankTransaction.findMany({
    where: {
      organizationId: av.organizationId,
    }
  });

  const matchingTxs = allTxs.filter(t => t.description.toLowerCase().includes('bionic'));
  console.log(`Matching transactions count: ${matchingTxs.length}`);

  let updatedCount = 0;
  for (const t of matchingTxs) {
    if (!t.contactId) {
      await prisma.bankTransaction.update({
        where: { id: t.id },
        data: { contactId: av.id }
      });
      updatedCount++;
    }
  }
  console.log(`Linked ${updatedCount} bank transactions directly to AV Bionics contact ID.`);
}

linkAvBionics().finally(() => prisma.$disconnect());
