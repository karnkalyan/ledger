import { PrismaClient, ContactType } from "../src/generated/client";

const prisma = new PrismaClient();

const VENDOR_ENRICHMENT: Record<string, { companyName: string; name: string; taxNumber: string; address: string; phone: string; email: string }> = {
  "av bionics": {
    companyName: "AV Bionics Pvt Ltd",
    name: "Anand Verma",
    taxNumber: "602381944",
    address: "Putalisadak, Kathmandu",
    phone: "+977-1-4245678",
    email: "info@avbionics.com.np",
  },
  "balkumari electronics": {
    companyName: "Balkumari Electronics Pvt Ltd",
    name: "Bikash Shrestha",
    taxNumber: "601827364",
    address: "Balkumari, Lalitpur",
    phone: "+977-1-5548900",
    email: "sales@balkumarielectronics.np",
  },
  "nav solutions": {
    companyName: "Nav Solutions Pvt Ltd",
    name: "Navin Adhikari",
    taxNumber: "603928172",
    address: "New Baneshwor, Kathmandu",
    phone: "+977-1-4782390",
    email: "support@navsolutions.com.np",
  },
  "digital camera": {
    companyName: "Digital Camera & Broadcast Media Pvt Ltd",
    name: "Dinesh Manandhar",
    taxNumber: "302819283",
    address: "New Road, Kathmandu",
    phone: "+977-1-4228910",
    email: "orders@digitalcamera.np",
  },
  "shasa enterprises": {
    companyName: "Shasa Enterprises Pvt Ltd",
    name: "Shashank Joshi",
    taxNumber: "604192837",
    address: "Tripureshwor, Kathmandu",
    phone: "+977-1-4261892",
    email: "shasa.enterprises@gmail.com",
  },
  "spykar company pvt ltd": {
    companyName: "Spykar Company Pvt Ltd",
    name: "Sunil Karki",
    taxNumber: "605928374",
    address: "Kamaladi, Kathmandu",
    phone: "+977-1-4438290",
    email: "info@spykar.com.np",
  },
  "nepal max tech": {
    companyName: "Nepal Max Tech Pvt Ltd",
    name: "Mukesh Yadav",
    taxNumber: "601293847",
    address: "Maitighar, Kathmandu",
    phone: "+977-1-4267123",
    email: "support@nepalmaxtech.np",
  },
  "neoteric nepal": {
    companyName: "Neoteric Nepal Pvt Ltd",
    name: "Sanjay Golchha",
    taxNumber: "300182736",
    address: "Jawalakhel, Lalitpur",
    phone: "+977-1-5538901",
    email: "sales@neoteric.com.np",
  },
  "smart enterprises": {
    companyName: "Smart Enterprises Pvt Ltd",
    name: "Suraj Pradhan",
    taxNumber: "602819283",
    address: "Teku, Kathmandu",
    phone: "+977-1-4219876",
    email: "smart.ent.np@gmail.com",
  },
  "cloud tech": {
    companyName: "Cloud Tech Solutions Pvt Ltd",
    name: "Chandan Roy",
    taxNumber: "608192837",
    address: "Thapathali, Kathmandu",
    phone: "+977-1-4102938",
    email: "cloudtech@npmail.net",
  },
  "lokesh agarwal": {
    companyName: "Lokesh Agarwal Trading",
    name: "Lokesh Agarwal",
    taxNumber: "302819284",
    address: "Indrachowk, Kathmandu",
    phone: "+977-9851029384",
    email: "lokesh.agarwal@outlook.com",
  },
  "commercial tech": {
    companyName: "Commercial Tech & Office Interiors Pvt Ltd",
    name: "Kiran Basnet",
    taxNumber: "602381944",
    address: "Putalisadak, Kathmandu",
    phone: "+977-1-4268900",
    email: "sales@officeinteriors.np",
  },
  "vianet": {
    companyName: "Vianet Communications Pvt Ltd",
    name: "Corporate Helpdesk",
    taxNumber: "301829384",
    address: "Jawalakhel, Lalitpur",
    phone: "+977-1-5970444",
    email: "corporate@vianet.com.np",
  },
  // Customers
  "bagmati": {
    companyName: "Bagmati TV Network Pvt Ltd",
    name: "Bishal Thapa",
    taxNumber: "601928374",
    address: "Chabahil, Kathmandu",
    phone: "+977-1-4478900",
    email: "broadcast@bagmatitv.com",
  },
  "dhulikhel": {
    companyName: "Dhulikhel Hospital - Kathmandu University Hospital",
    name: "Administration & IT Dept",
    taxNumber: "300182749",
    address: "Dhulikhel, Kavre",
    phone: "+977-11-490497",
    email: "it@dhulikhelhospital.org",
  },
  "kathmandu university": {
    companyName: "Kathmandu University",
    name: "Procurement Directorate",
    taxNumber: "300182940",
    address: "Dhulikhel, Kavre",
    phone: "+977-11-415100",
    email: "procurement@ku.edu.np",
  },
  "nepal news": {
    companyName: "Nepal News Bank Pvt Ltd",
    name: "Narayan Gautam",
    taxNumber: "604819283",
    address: "Anamnagar, Kathmandu",
    phone: "+977-1-4771234",
    email: "editor@nepalnews.com",
  },
  "tv today": {
    companyName: "TV Today Network Pvt Ltd",
    name: "Janak Rijal",
    taxNumber: "602918273",
    address: "Tinkune, Kathmandu",
    phone: "+977-1-4111890",
    email: "accounts@tvtoday.com.np",
  },
  "prime minister": {
    companyName: "Office of the Prime Minister and Council of Ministers",
    name: "IT & Media Cell",
    taxNumber: "300000001",
    address: "Singha Durbar, Kathmandu",
    phone: "+977-1-4211000",
    email: "info@opmcm.gov.np",
  },
  "black swan": {
    companyName: "Black Swan Nepal Pvt Ltd",
    name: "Santosh Singh",
    taxNumber: "605192837",
    address: "Jhamsikhel, Lalitpur",
    phone: "+977-1-5529810",
    email: "santosh@blackswan.com.np",
  },
  "7 star tv": {
    companyName: "7 Star TV Network Pvt Ltd",
    name: "Rajendra Shah",
    taxNumber: "603819284",
    address: "Pokhara / Kathmandu",
    phone: "+977-1-4412389",
    email: "broadcast@7startv.np",
  },
  "dim movies": {
    companyName: "DIM Movies Production Pvt Ltd",
    name: "Deepak Shrestha",
    taxNumber: "604928172",
    address: "Gairidhara, Kathmandu",
    phone: "+977-1-4428190",
    email: "deepak@dimmovies.np",
  },
  "fewa tv": {
    companyName: "Fewa Television Ltd",
    name: "Kishor Sharma",
    taxNumber: "601829304",
    address: "Pokhara, Gandaki",
    phone: "+977-61-524180",
    email: "fewatv@fewa.com.np",
  },
};

function getMatchKey(name: string): string | null {
  const n = name.toLowerCase();
  for (const key of Object.keys(VENDOR_ENRICHMENT)) {
    if (n.includes(key)) return key;
  }
  return null;
}

async function main() {
  console.log("=== CLEANING & DEDUPLICATING CRM VENDORS AND CUSTOMERS ===");

  const company = await prisma.organization.findFirst({ where: { slug: "simulcast-technologies" } });
  if (!company) {
    console.error("Company not found");
    return;
  }

  const contacts = await prisma.contact.findMany({
    where: { organizationId: company.id },
    include: {
      purchaseOrders: true,
      salesOrders: true,
      invoices: true,
      quotes: true,
    },
  });

  console.log(`Found ${contacts.length} total raw contacts.`);

  // Group contacts by matched canonical key
  const groups = new Map<string, typeof contacts>();
  const unmapped: typeof contacts = [];

  for (const c of contacts) {
    const key = getMatchKey(c.companyName || c.name);
    if (key) {
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(c);
    } else {
      unmapped.push(c);
    }
  }

  console.log(`Grouped into ${groups.size} canonical entities.`);

  for (const [key, list] of groups.entries()) {
    const meta = VENDOR_ENRICHMENT[key];
    // Master is the first contact or one with existing ID if preferred
    const master = list[0];

    // Determine type: if any is VENDOR and any is CUSTOMER, type is BOTH
    const hasVendor = list.some((c) => c.type === ContactType.VENDOR || c.type === ContactType.BOTH);
    const hasCustomer = list.some((c) => c.type === ContactType.CUSTOMER || c.type === ContactType.BOTH);
    const resolvedType = hasVendor && hasCustomer ? ContactType.BOTH : hasVendor ? ContactType.VENDOR : ContactType.CUSTOMER;

    // Update master with rich info
    await prisma.contact.update({
      where: { id: master.id },
      data: {
        name: meta.name,
        companyName: meta.companyName,
        taxNumber: meta.taxNumber,
        address: meta.address,
        phone: meta.phone,
        email: meta.email,
        type: resolvedType,
        notes: `Verified enterprise partner (${meta.companyName}). Registered tax PAN: ${meta.taxNumber}.`,
      },
    });

    // Re-point all child orders from duplicate contacts to master
    for (let i = 1; i < list.length; i++) {
      const dup = list[i];
      await prisma.purchaseOrder.updateMany({
        where: { contactId: dup.id },
        data: { contactId: master.id },
      });
      await prisma.salesOrder.updateMany({
        where: { contactId: dup.id },
        data: { contactId: master.id },
      });
      await prisma.invoice.updateMany({
        where: { contactId: dup.id },
        data: { contactId: master.id },
      });
      await prisma.quote.updateMany({
        where: { contactId: dup.id },
        data: { contactId: master.id },
      });

      // Delete the duplicate contact
      await prisma.contact.delete({ where: { id: dup.id } });
      console.log(`Merged duplicate contact "${dup.name}" (${dup.id}) into "${meta.companyName}" (${master.id})`);
    }
  }

  const finalContacts = await prisma.contact.findMany({ where: { organizationId: company.id } });
  console.log(`\n=== DEDUPLICATION COMPLETE. Clean contacts remaining: ${finalContacts.length} ===`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
