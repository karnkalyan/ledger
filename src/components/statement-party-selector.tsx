"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  ChevronsUpDown,
  Check,
  ShieldCheck,
  UsersRound,
  Briefcase,
  Building2,
  X,
} from "lucide-react";

type ContactItem = {
  id: string;
  name: string;
  companyName: string | null;
  type: string;
  taxNumber?: string | null;
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
  placeholder = "Select party to open balance sheet...",
  minWidth = 320,
}: {
  orgId: string;
  selectedContactId?: string | null;
  allContacts: ContactItem[];
  placeholder?: string;
  minWidth?: number | string;
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"ALL" | "DIRECTOR" | "CUSTOMER" | "VENDOR" | "BOTH">("ALL");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const classifyRole = (c: ContactItem) => {
    const isDir =
      c.name.toLowerCase().includes("kalyan") ||
      c.name.toLowerCase().includes("director") ||
      Boolean(c.companyName?.toLowerCase().includes("director"));
    if (isDir) return "DIRECTOR" as const;
    if (c.type === "BOTH") return "BOTH" as const;
    if (c.type === "VENDOR") return "VENDOR" as const;
    return "CUSTOMER" as const;
  };

  const selectedContact = allContacts.find((c) => c.id === selectedContactId);
  const selectedRole = selectedContact ? classifyRole(selectedContact) : null;

  // Auto focus search input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    } else {
      setSearch("");
    }
  }, [isOpen]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Keyboard navigation: Escape closes
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Filter contacts
  const filteredContacts = allContacts.filter((c) => {
    const role = classifyRole(c);
    if (roleFilter !== "ALL") {
      if (roleFilter === "DIRECTOR" && role !== "DIRECTOR") return false;
      if (roleFilter === "CUSTOMER" && role !== "CUSTOMER" && role !== "BOTH") return false;
      if (roleFilter === "VENDOR" && role !== "VENDOR" && role !== "BOTH") return false;
      if (roleFilter === "BOTH" && role !== "BOTH") return false;
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchName = c.name.toLowerCase().includes(q);
      const matchCompany = c.companyName?.toLowerCase().includes(q);
      const matchTax = c.taxNumber?.toLowerCase().includes(q);
      if (!matchName && !matchCompany && !matchTax) return false;
    }
    return true;
  });

  const directorList = filteredContacts.filter((c) => classifyRole(c) === "DIRECTOR");
  const bothList = filteredContacts.filter((c) => classifyRole(c) === "BOTH");
  const customerList = filteredContacts.filter((c) => classifyRole(c) === "CUSTOMER");
  const vendorList = filteredContacts.filter((c) => classifyRole(c) === "VENDOR");

  const handleSelect = (contactId: string) => {
    setIsOpen(false);
    router.push(`/${orgId}/statement?contactId=${contactId}`);
  };

  return (
    <div ref={containerRef} style={{ position: "relative", minWidth, display: "inline-block" }}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          padding: "7px 12px",
          borderRadius: "var(--radius-sm)",
          border: isOpen ? "1px solid var(--brand, #0284c7)" : "1px solid var(--line)",
          background: "var(--surface)",
          color: "var(--text)",
          fontSize: 12.5,
          fontWeight: 600,
          cursor: "pointer",
          textAlign: "left",
          boxShadow: isOpen ? "0 0 0 2px rgba(2, 132, 199, 0.2)" : "none",
          transition: "border-color 0.15s ease, box-shadow 0.15s ease",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {selectedRole === "DIRECTOR" && (
            <span className="badge purple" style={{ fontSize: 10, padding: "2px 6px", display: "inline-flex", alignItems: "center", gap: 3 }}>
              <ShieldCheck size={11} /> Director
            </span>
          )}
          {selectedRole === "BOTH" && (
            <span className="badge amber" style={{ fontSize: 10, padding: "2px 6px", display: "inline-flex", alignItems: "center", gap: 3 }}>
              <Building2 size={11} /> Dual-Role
            </span>
          )}
          {selectedRole === "CUSTOMER" && (
            <span className="badge sky" style={{ fontSize: 10, padding: "2px 6px", display: "inline-flex", alignItems: "center", gap: 3 }}>
              <UsersRound size={11} /> Customer
            </span>
          )}
          {selectedRole === "VENDOR" && (
            <span className="badge emerald" style={{ fontSize: 10, padding: "2px 6px", display: "inline-flex", alignItems: "center", gap: 3 }}>
              <Briefcase size={11} /> Vendor
            </span>
          )}

          <span style={{ fontWeight: selectedContact ? 700 : 500, color: selectedContact ? "var(--text)" : "var(--text-muted)" }}>
            {selectedContact ? selectedContact.companyName || selectedContact.name : placeholder}
          </span>
        </div>

        <ChevronsUpDown size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
      </button>

      {/* Searchable Dropdown Popover */}
      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            zIndex: 1000,
            minWidth: 340,
            maxWidth: 420,
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: "var(--radius-md)",
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.25), 0 8px 10px -6px rgba(0, 0, 0, 0.2)",
            overflow: "hidden",
          }}
        >
          {/* Search Input Box */}
          <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--line)", background: "var(--surface-muted, rgba(255,255,255,0.02))" }}>
            <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
              <Search size={14} style={{ position: "absolute", left: 10, color: "var(--text-muted)", pointerEvents: "none" }} />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search vendor, customer, director or PAN..."
                style={{
                  width: "100%",
                  fontSize: 12.5,
                  padding: "6px 28px 6px 30px",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--line)",
                  background: "var(--surface)",
                  color: "var(--text)",
                  outline: "none",
                }}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  style={{
                    position: "absolute",
                    right: 8,
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    padding: 2,
                    color: "var(--text-muted)",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Role Filter Chips */}
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 8 }}>
              <button
                type="button"
                onClick={() => setRoleFilter("ALL")}
                className={`filter-tab ${roleFilter === "ALL" ? "active" : ""}`}
                style={{ fontSize: 10.5, padding: "2px 7px", cursor: "pointer", borderRadius: 4, border: "none" }}
              >
                All ({allContacts.length})
              </button>
              <button
                type="button"
                onClick={() => setRoleFilter("CUSTOMER")}
                className={`filter-tab ${roleFilter === "CUSTOMER" ? "active" : ""}`}
                style={{ fontSize: 10.5, padding: "2px 7px", cursor: "pointer", borderRadius: 4, border: "none", display: "inline-flex", alignItems: "center", gap: 3 }}
              >
                <UsersRound size={10} /> Customers
              </button>
              <button
                type="button"
                onClick={() => setRoleFilter("VENDOR")}
                className={`filter-tab ${roleFilter === "VENDOR" ? "active" : ""}`}
                style={{ fontSize: 10.5, padding: "2px 7px", cursor: "pointer", borderRadius: 4, border: "none", display: "inline-flex", alignItems: "center", gap: 3 }}
              >
                <Briefcase size={10} /> Vendors
              </button>
              <button
                type="button"
                onClick={() => setRoleFilter("DIRECTOR")}
                className={`filter-tab ${roleFilter === "DIRECTOR" ? "active" : ""}`}
                style={{ fontSize: 10.5, padding: "2px 7px", cursor: "pointer", borderRadius: 4, border: "none", display: "inline-flex", alignItems: "center", gap: 3 }}
              >
                <ShieldCheck size={10} /> Directors
              </button>
              <button
                type="button"
                onClick={() => setRoleFilter("BOTH")}
                className={`filter-tab ${roleFilter === "BOTH" ? "active" : ""}`}
                style={{ fontSize: 10.5, padding: "2px 7px", cursor: "pointer", borderRadius: 4, border: "none", display: "inline-flex", alignItems: "center", gap: 3 }}
              >
                <Building2 size={10} /> Dual-Role
              </button>
            </div>
          </div>

          {/* Scrollable Party List */}
          <div style={{ maxHeight: 320, overflowY: "auto", padding: "6px 0" }}>
            {filteredContacts.length === 0 ? (
              <div style={{ padding: "24px 16px", textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>
                No parties match &ldquo;{search}&rdquo;
              </div>
            ) : (
              <>
                {/* 1. Directors Section */}
                {directorList.length > 0 && (
                  <div style={{ marginBottom: 6 }}>
                    <div style={{ padding: "4px 12px", fontSize: 10.5, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 4 }}>
                      <ShieldCheck size={12} style={{ color: "#8b5cf6" }} /> Directors &amp; Shareholders
                    </div>
                    {directorList.map((c) => renderItem(c))}
                  </div>
                )}

                {/* 2. Dual-Role Section */}
                {bothList.length > 0 && (
                  <div style={{ marginBottom: 6 }}>
                    <div style={{ padding: "4px 12px", fontSize: 10.5, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 4 }}>
                      <Building2 size={12} style={{ color: "#f59e0b" }} /> Dual-Role Commercial Partners
                    </div>
                    {bothList.map((c) => renderItem(c))}
                  </div>
                )}

                {/* 3. Customers Section */}
                {customerList.length > 0 && (
                  <div style={{ marginBottom: 6 }}>
                    <div style={{ padding: "4px 12px", fontSize: 10.5, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 4 }}>
                      <UsersRound size={12} style={{ color: "#0284c7" }} /> Commercial Clients &amp; Customers
                    </div>
                    {customerList.map((c) => renderItem(c))}
                  </div>
                )}

                {/* 4. Vendors Section */}
                {vendorList.length > 0 && (
                  <div style={{ marginBottom: 6 }}>
                    <div style={{ padding: "4px 12px", fontSize: 10.5, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 4 }}>
                      <Briefcase size={12} style={{ color: "#10b981" }} /> Trade Vendors &amp; Suppliers
                    </div>
                    {vendorList.map((c) => renderItem(c))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );

  function renderItem(c: ContactItem) {
    const isSelected = c.id === selectedContactId;
    const role = classifyRole(c);
    const txCount = c._count.purchaseOrders + c._count.invoices + c._count.bankTransactions + c._count.incomes;

    return (
      <div
        key={c.id}
        onClick={() => handleSelect(c.id)}
        style={{
          padding: "8px 12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          cursor: "pointer",
          background: isSelected ? "var(--surface-muted, rgba(2, 132, 199, 0.1))" : "transparent",
          borderLeft: isSelected ? "3px solid var(--brand, #0284c7)" : "3px solid transparent",
          transition: "background 0.12s ease",
        }}
        onMouseEnter={(e) => {
          if (!isSelected) e.currentTarget.style.background = "var(--surface-muted, rgba(255, 255, 255, 0.04))";
        }}
        onMouseLeave={(e) => {
          if (!isSelected) e.currentTarget.style.background = "transparent";
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 2, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 12.5, fontWeight: isSelected ? 700 : 600, color: "var(--text)" }}>
              {c.companyName || c.name}
            </span>
            {c.taxNumber && (
              <span className="badge cyan" style={{ fontSize: 9.5, padding: "1px 4px" }}>
                PAN: {c.taxNumber}
              </span>
            )}
          </div>
          {c.companyName && c.name && c.companyName.trim().toLowerCase() !== c.name.trim().toLowerCase() && (
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              Contact: {c.name}
            </span>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          {txCount > 0 && (
            <span style={{ fontSize: 10.5, color: "var(--text-muted)" }}>
              {txCount} txs
            </span>
          )}
          {isSelected && <Check size={14} style={{ color: "var(--brand, #0284c7)" }} />}
        </div>
      </div>
    );
  }
}
