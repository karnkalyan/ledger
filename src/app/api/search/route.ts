import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { money } from "@/lib/format";
import { formatDualDate } from "@/lib/nepali-calendar";

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get("orgId");
    const q = (searchParams.get("q") || "").trim();
    const category = searchParams.get("category") || "ALL";

    if (!orgId) {
      return NextResponse.json({ error: "Missing orgId" }, { status: 400 });
    }

    // Verify workspace access: user must be Super Admin or member of this organization
    if (user.role !== "SUPER_ADMIN") {
      const membership = await db.membership.findUnique({
        where: { userId_organizationId: { userId: user.id, organizationId: orgId } },
      });
      if (!membership) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const org = await db.organization.findUnique({
      where: { id: orgId },
      select: { currency: true },
    });
    const currency = org?.currency || "NPR";

    if (!q || q.length < 1) {
      return NextResponse.json({ results: [] });
    }

    // Concurrently query matching records across all relevant tables
    const [
      contacts,
      invoices,
      salesOrders,
      purchaseOrders,
      incomes,
      expenses,
      bankAccounts,
      bankTransactions,
      products,
      projects,
      tasks,
    ] = await Promise.all([
      // 1. Contacts (Customers & Vendors)
      category === "ALL" || category === "CRM"
        ? db.contact.findMany({
            where: {
              organizationId: orgId,
              OR: [
                { name: { contains: q } },
                { companyName: { contains: q } },
                { phone: { contains: q } },
                { email: { contains: q } },
                { taxNumber: { contains: q } },
              ],
            },
            take: 8,
          })
        : [],

      // 2. Invoices
      category === "ALL" || category === "INVOICE"
        ? db.invoice.findMany({
            where: {
              organizationId: orgId,
              OR: [
                { invoiceNumber: { contains: q } },
                { notes: { contains: q } },
                { contact: { name: { contains: q } } },
                { contact: { companyName: { contains: q } } },
              ],
            },
            include: { contact: true },
            take: 8,
            orderBy: { issueDate: "desc" },
          })
        : [],

      // 3. Sales Orders
      category === "ALL" || category === "SALES"
        ? db.salesOrder.findMany({
            where: {
              organizationId: orgId,
              OR: [
                { orderNumber: { contains: q } },
                { notes: { contains: q } },
                { contact: { name: { contains: q } } },
                { contact: { companyName: { contains: q } } },
              ],
            },
            include: { contact: true },
            take: 8,
            orderBy: { orderDate: "desc" },
          })
        : [],

      // 4. Purchase Orders
      category === "ALL" || category === "PURCHASE"
        ? db.purchaseOrder.findMany({
            where: {
              organizationId: orgId,
              OR: [
                { orderNumber: { contains: q } },
                { notes: { contains: q } },
                { contact: { name: { contains: q } } },
                { contact: { companyName: { contains: q } } },
              ],
            },
            include: { contact: true },
            take: 8,
            orderBy: { orderDate: "desc" },
          })
        : [],

      // 5. Incomes
      category === "ALL" || category === "INCOME"
        ? db.income.findMany({
            where: {
              organizationId: orgId,
              OR: [
                { title: { contains: q } },
                { source: { contains: q } },
                { notes: { contains: q } },
              ],
            },
            take: 8,
            orderBy: { receivedAt: "desc" },
          })
        : [],

      // 6. Expenses
      category === "ALL" || category === "EXPENSE"
        ? db.expense.findMany({
            where: {
              organizationId: orgId,
              OR: [
                { title: { contains: q } },
                { vendor: { contains: q } },
                { notes: { contains: q } },
              ],
            },
            include: { category: true },
            take: 8,
            orderBy: { occurredAt: "desc" },
          })
        : [],

      // 7. Bank Accounts
      category === "ALL" || category === "BANK"
        ? db.bankAccount.findMany({
            where: {
              organizationId: orgId,
              OR: [
                { bankName: { contains: q } },
                { accountNumber: { contains: q } },
                { accountName: { contains: q } },
              ],
            },
            take: 4,
          })
        : [],

      // 8. Bank Transactions
      category === "ALL" || category === "BANK"
        ? db.bankTransaction.findMany({
            where: {
              organizationId: orgId,
              OR: [
                { description: { contains: q } },
                { reference: { contains: q } },
                { category: { contains: q } },
              ],
            },
            include: { bankAccount: true },
            take: 6,
            orderBy: { transactionDate: "desc" },
          })
        : [],

      // 9. Products
      category === "ALL" || category === "PRODUCT"
        ? db.product.findMany({
            where: {
              organizationId: orgId,
              OR: [
                { name: { contains: q } },
                { sku: { contains: q } },
              ],
            },
            take: 6,
          })
        : [],

      // 10. Projects
      category === "ALL" || category === "PROJECT"
        ? db.project.findMany({
            where: {
              organizationId: orgId,
              OR: [
                { name: { contains: q } },
                { description: { contains: q } },
              ],
            },
            take: 4,
          })
        : [],

      // 11. Tasks
      category === "ALL" || category === "TASK"
        ? db.task.findMany({
            where: {
              organizationId: orgId,
              OR: [
                { title: { contains: q } },
                { description: { contains: q } },
              ],
            },
            take: 4,
          })
        : [],
    ]);

    // Format into unified search result items
    type SearchItem = {
      id: string;
      title: string;
      subtitle: string;
      category: string;
      badge: string;
      badgeCls: string;
      url: string;
      amount?: string;
      date?: string;
    };

    const results: SearchItem[] = [
      // Contacts
      ...contacts.map((c) => ({
        id: `contact-${c.id}`,
        title: c.companyName || c.name,
        subtitle: c.companyName && c.name && c.companyName !== c.name
          ? `Contact Person: ${c.name} · ${c.phone || c.email || ""}`
          : `${c.phone || c.email || c.address || "Contact record"} ${c.taxNumber ? `· PAN: ${c.taxNumber}` : ""}`,
        category: "CRM",
        badge: c.type === "VENDOR" ? "Vendor" : c.type === "BOTH" ? "Customer & Vendor" : "Customer",
        badgeCls: c.type === "VENDOR" ? "purple" : "cyan",
        url: `/${orgId}/crm/${c.id}`,
      })),

      // Invoices
      ...invoices.map((inv) => ({
        id: `inv-${inv.id}`,
        title: `Invoice #${inv.invoiceNumber}`,
        subtitle: `${inv.contact ? (inv.contact.companyName || inv.contact.name) : "Customer"} · Status: ${inv.status}`,
        category: "INVOICE",
        badge: `Invoice · ${inv.status}`,
        badgeCls: inv.status === "PAID" ? "green" : inv.status === "PARTIAL" ? "amber" : "cyan",
        url: `/${orgId}/invoices/${inv.id}`,
        amount: money(inv.total, currency),
        date: formatDualDate(inv.issueDate),
      })),

      // Sales Orders
      ...salesOrders.map((so) => ({
        id: `so-${so.id}`,
        title: `Sales Order #${so.orderNumber}`,
        subtitle: `${so.contact ? (so.contact.companyName || so.contact.name) : "Client"} · Status: ${so.status}`,
        category: "SALES",
        badge: `Sales Order · ${so.status}`,
        badgeCls: so.status === "COMPLETED" ? "green" : "purple",
        url: `/${orgId}/sales/${so.id}`,
        amount: money(so.total, currency),
        date: formatDualDate(so.orderDate),
      })),

      // Purchase Orders
      ...purchaseOrders.map((po) => ({
        id: `po-${po.id}`,
        title: `Purchase Order #${po.orderNumber}`,
        subtitle: `${po.contact ? (po.contact.companyName || po.contact.name) : "Vendor"} · Status: ${po.status}`,
        category: "PURCHASE",
        badge: `Purchase · ${po.status}`,
        badgeCls: po.status === "COMPLETED" ? "green" : "amber",
        url: `/${orgId}/purchase/${po.id}`,
        amount: money(po.total, currency),
        date: formatDualDate(po.orderDate),
      })),

      // Income Receipts
      ...incomes.map((inc) => ({
        id: `inc-${inc.id}`,
        title: inc.title,
        subtitle: `Source: ${inc.source || "Direct Receipt"} · Channel: ${inc.paymentMethod}`,
        category: "INCOME",
        badge: "Income",
        badgeCls: "green",
        url: `/${orgId}/income`,
        amount: `+ ${money(inc.amount, currency)}`,
        date: formatDualDate(inc.receivedAt),
      })),

      // Expenses
      ...expenses.map((exp) => ({
        id: `exp-${exp.id}`,
        title: exp.title,
        subtitle: `Vendor: ${exp.vendor || "Operational"} · Category: ${exp.category?.name || "General"}`,
        category: "EXPENSE",
        badge: "Expense",
        badgeCls: "red",
        url: `/${orgId}/expenses`,
        amount: `- ${money(exp.amount, currency)}`,
        date: formatDualDate(exp.occurredAt),
      })),

      // Bank Accounts
      ...bankAccounts.map((b) => ({
        id: `bank-${b.id}`,
        title: `${b.bankName} (${b.accountNumber})`,
        subtitle: `${b.accountName} · Type: ${b.accountType}`,
        category: "BANK",
        badge: "Bank Account",
        badgeCls: "purple",
        url: `/${orgId}/banking`,
        amount: money(b.currentBalance, currency),
      })),

      // Bank Transactions
      ...bankTransactions.map((tx) => ({
        id: `btx-${tx.id}`,
        title: tx.description || `${tx.type} ${money(tx.amount, currency)}`,
        subtitle: `${tx.bankAccount.bankName} · Ref: ${tx.reference || "N/A"}`,
        category: "BANK",
        badge: tx.type === "DEPOSIT" ? "Deposit" : "Withdrawal",
        badgeCls: tx.type === "DEPOSIT" ? "green" : "red",
        url: `/${orgId}/banking/${tx.id}`,
        amount: `${tx.type === "DEPOSIT" ? "+" : "-"} ${money(tx.amount, currency)}`,
        date: formatDualDate(tx.transactionDate),
      })),

      // Products
      ...products.map((p) => ({
        id: `prod-${p.id}`,
        title: p.name,
        subtitle: `SKU: ${p.sku} · Stock: ${p.stockQty} ${p.unit}`,
        category: "PRODUCT",
        badge: "Inventory / SKU",
        badgeCls: "cyan",
        url: `/${orgId}/stock`,
        amount: money(p.salePrice, currency),
      })),

      // Projects
      ...projects.map((pr) => ({
        id: `proj-${pr.id}`,
        title: pr.name,
        subtitle: pr.description || `Project · Nature: ${pr.workNature || "General"}`,
        category: "PROJECT",
        badge: `Project · ${pr.status}`,
        badgeCls: "purple",
        url: `/${orgId}/projects/${pr.id}`,
      })),

      // Tasks
      ...tasks.map((t) => ({
        id: `task-${t.id}`,
        title: t.title,
        subtitle: `Priority: ${t.priority} · Status: ${t.status}`,
        category: "TASK",
        badge: `Task · ${t.status}`,
        badgeCls: t.status === "DONE" ? "green" : "amber",
        url: `/${orgId}/tasks`,
        date: t.dueAt ? formatDualDate(t.dueAt) : undefined,
      })),
    ];

    return NextResponse.json({ results });
  } catch (error: any) {
    console.error("Global search error:", error);
    return NextResponse.json({ error: error.message || "Search failed" }, { status: 500 });
  }
}
