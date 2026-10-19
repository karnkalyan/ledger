"use client";

import { useRouter } from "next/navigation";

type ContactItem = {
  id: string;
  name: string;
  companyName: string | null;
  type: string;
  _count: {
    purchaseOrders: number;
    invoices: number;
    bankTransactions: number;
    incomes: number;
  };
};

export function StatementPartySelector({
  orgId,
  selectedContactId,
  allContacts,
  placeholder = "Select any party to open balance sheet...",
  minWidth = 280,
}: {
  orgId: string;
  selectedContactId?: string | null;
  allContacts: ContactItem[];
  placeholder?: string;
  minWidth?: number | string;
}) {
  const router = useRouter();

  const classifyRole = (c: ContactItem) => {
    const isDir =
      c.name.toLowerCase().includes("kalyan") ||
      c.name.toLowerCase().includes("director") ||
      Boolean(c.companyName?.toLowerCase().includes("director"));
    if (isDir) return "DIRECTOR";
    if (c.type === "BOTH") return "BOTH";
    if (c.type === "VENDOR") return "VENDOR";
    return "CUSTOMER";
  };

  const directorContacts = allContacts.filter((c) => classifyRole(c) === "DIRECTOR");
  const bothContacts = allContacts.filter((c) => classifyRole(c) === "BOTH");
  const customerContacts = allContacts.filter((c) => classifyRole(c) === "CUSTOMER");
  const vendorContacts = allContacts.filter((c) => classifyRole(c) === "VENDOR");

  return (
    <select
      value={selectedContactId || ""}
      onChange={(e) => {
        const val = e.target.value;
        if (val) {
          router.push(`/${orgId}/statement?contactId=${val}`);
        }
      }}
      style={{
        minWidth,
        fontSize: 12.5,
        fontWeight: 600,
        padding: "7px 12px",
        borderRadius: "var(--radius-sm)",
        border: "1px solid var(--line)",
        background: "var(--surface)",
        color: "var(--text)",
        cursor: "pointer",
      }}
    >
      <option value="" disabled>
        {placeholder}
      </option>
      {directorContacts.length > 0 && (
        <optgroup label="👑 Directors & Shareholders">
          {directorContacts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.companyName || c.name} · [DIRECTOR]
            </option>
          ))}
        </optgroup>
      )}
      {bothContacts.length > 0 && (
        <optgroup label="🏢 Dual-Role Commercial Partners">
          {bothContacts.map((c) => {
            const tx = c._count.purchaseOrders + c._count.invoices + c._count.bankTransactions + c._count.incomes;
            return (
              <option key={c.id} value={c.id}>
                {c.companyName || c.name} · [DUAL-ROLE]{tx > 0 ? ` (${tx} txs)` : ""}
              </option>
            );
          })}
        </optgroup>
      )}
      {customerContacts.length > 0 && (
        <optgroup label="💼 Commercial Clients & Customers">
          {customerContacts.map((c) => {
            const tx = c._count.purchaseOrders + c._count.invoices + c._count.bankTransactions + c._count.incomes;
            return (
              <option key={c.id} value={c.id}>
                {c.companyName || c.name} · [CUSTOMER]{tx > 0 ? ` (${tx} txs)` : ""}
              </option>
            );
          })}
        </optgroup>
      )}
      {vendorContacts.length > 0 && (
        <optgroup label="📦 Vendors & Suppliers">
          {vendorContacts.map((c) => {
            const tx = c._count.purchaseOrders + c._count.invoices + c._count.bankTransactions + c._count.incomes;
            return (
              <option key={c.id} value={c.id}>
                {c.companyName || c.name} · [VENDOR]{tx > 0 ? ` (${tx} txs)` : ""}
              </option>
            );
          })}
        </optgroup>
      )}
    </select>
  );
}
