import { db } from "../src/lib/db";

async function main() {
  console.log("Updating organization branding & logos...");
  await db.organization.updateMany({
    where: { slug: "simulcast-technologies" },
    data: {
      logoUrl: "/logo-mark.png",
      defaultTaxPercent: 13.00,
      taxNumber: "609670271",
      panVatNumber: "609670271",
    },
  });

  await db.organization.updateMany({
    where: { slug: "my-house" },
    data: {
      logoUrl: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='22' fill='%23059669'/><path d='M50 22 L20 48 L28 48 L28 78 L72 78 L72 48 L80 48 Z' fill='%23ffffff'/><rect x='44' y='52' width='12' height='26' rx='2' fill='%23059669'/></svg>",
      defaultTaxPercent: 13.00,
    },
  });

  console.log("Updated organization branding successfully!");
}

main().catch(console.error).finally(() => process.exit(0));
