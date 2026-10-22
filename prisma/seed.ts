import {
  PrismaClient,
  PluginAuthType,
  PluginStatus,
} from "../src/generated/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== FLOWLEDGER / SIMULCAST SUITE - PLUGINS & SERVICES SEED ===");
  console.log("Seeding exclusively Plugins & Connectors catalog (no dummy users, vendors, transactions, or warehouses)...");

  // Find all organizations to attach available plugins to (prioritizing company workspaces)
  const organizations = await prisma.organization.findMany({
    where: { kind: "COMPANY" },
  });

  const targetOrgs = organizations.length > 0 
    ? organizations 
    : await prisma.organization.findMany();

  if (targetOrgs.length === 0) {
    console.log("No organization found in database. Create an organization first before seeding plugins.");
    return;
  }

  // Master definition of updated Plugins & Services
  const pluginDefinitions = [
    {
      name: "Kashtrix License Manager",
      slug: "kashtrix-license-manager",
      category: "SECURITY_LICENSING",
      description: "High-assurance Ed25519 commercial licensing, real-time client heartbeat telemetry, automated validity extension, and client hardware activation control.",
      baseUrl: "https://license.simulcast.com.np",
      allowedDomains: "license.simulcast.com.np",
      authType: PluginAuthType.API_KEY,
      logoUrl: "https://license.simulcast.com.np/favicon.ico",
      status: PluginStatus.CONNECTED,
      apiKey: "KTX_LzxJHUeIfpTcNO8LAvHNaYBQSFqHkLz5",
      isEnabled: true,
    },
    {
      name: "Kashtrix RADIUS AAA Engine",
      slug: "kashtrix-radius-aaa",
      category: "NETWORK_AAA",
      description: "High-throughput subscriber authentication, accounting records, bandwidth quota synchronization, and NAS session termination.",
      baseUrl: "https://radius.simulcast.com.np",
      allowedDomains: "radius.simulcast.com.np",
      authType: PluginAuthType.API_KEY,
      logoUrl: "",
      status: PluginStatus.DISCONNECTED,
      apiKey: null,
      isEnabled: true,
    },
    {
      name: "eSewa Nepal ePay Gateway",
      slug: "esewa-nepal-epay",
      category: "PAYMENT_GATEWAY",
      description: "Automated digital wallet checkout, QR payment verification, and instant ledger invoice reconciliation.",
      baseUrl: "https://epay.esewa.com.np",
      allowedDomains: "epay.esewa.com.np",
      authType: PluginAuthType.API_KEY,
      logoUrl: "https://esewa.com.np/common/images/esewa_logo.png",
      status: PluginStatus.DISCONNECTED,
      apiKey: null,
      isEnabled: true,
    },
    {
      name: "MikroTik RouterOS API",
      slug: "mikrotik-routeros",
      category: "NETWORK_INFRASTRUCTURE",
      description: "Direct REST/API interface for MikroTik CCR, queue management, IP pool sync, and live interface traffic monitoring.",
      baseUrl: "https://10.10.100.1:8728",
      allowedDomains: "10.10.100.1",
      authType: PluginAuthType.LOGIN,
      logoUrl: "",
      status: PluginStatus.DISCONNECTED,
      apiKey: null,
      isEnabled: true,
    },
    {
      name: "Kashtrix TR-069 ACS Server",
      slug: "kashtrix-tr069-acs",
      category: "DEVICE_MANAGEMENT",
      description: "Auto-configuration server (CWMP), CPE diagnostic telemetry, Wi-Fi provisioning, and firmware lifecycle management.",
      baseUrl: "https://acs.simulcast.com.np",
      allowedDomains: "acs.simulcast.com.np",
      authType: PluginAuthType.API_KEY,
      logoUrl: "",
      status: PluginStatus.DISCONNECTED,
      apiKey: null,
      isEnabled: true,
    },
    {
      name: "Fonepay Merchant QR API",
      slug: "fonepay-merchant-qr",
      category: "PAYMENT_GATEWAY",
      description: "Dynamic interoperable NepalPay QR generation, push payment webhook notification, and automated transaction settlement.",
      baseUrl: "https://clientapi.fonepay.com",
      allowedDomains: "fonepay.com",
      authType: PluginAuthType.API_KEY,
      logoUrl: "",
      status: PluginStatus.DISCONNECTED,
      apiKey: null,
      isEnabled: true,
    },
  ];

  for (const org of targetOrgs) {
    console.log(`\nAttaching Plugins to workspace: ${org.name} (${org.slug})...`);

    for (const def of pluginDefinitions) {
      await prisma.plugin.upsert({
        where: {
          organizationId_slug: {
            organizationId: org.id,
            slug: def.slug,
          },
        },
        update: {
          name: def.name,
          category: def.category,
          description: def.description,
          baseUrl: def.baseUrl,
          allowedDomains: def.allowedDomains,
          authType: def.authType,
          logoUrl: def.logoUrl || undefined,
          status: def.status,
          apiKey: def.apiKey || undefined,
          isEnabled: def.isEnabled,
        },
        create: {
          organizationId: org.id,
          name: def.name,
          slug: def.slug,
          category: def.category,
          description: def.description,
          baseUrl: def.baseUrl,
          allowedDomains: def.allowedDomains,
          authType: def.authType,
          logoUrl: def.logoUrl,
          status: def.status,
          apiKey: def.apiKey,
          isEnabled: def.isEnabled,
        },
      });
      console.log(`  + Plugin [${def.name}] (${def.authType}) -> ${def.status}`);
    }
  }

  console.log("\nPlugins & Services seed finished successfully. No users, vendors, transactions, or warehouses touched.");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
