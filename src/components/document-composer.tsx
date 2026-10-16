"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { Plus, Trash2, Search, Check, X, Package, Building2, User } from "lucide-react";
import { createCommerceDocumentAction } from "@/app/(dashboard)/actions";
import { NepaliDatePicker } from "@/components/nepali-date-picker";

export type Line = { description: string; quantity: number; unitPrice: number; taxRate: number; productId?: string };
type Contact = { id: string; name: string; companyName: string | null; type?: string };
type Product = { id: string; name: string; sku: string; salePrice: { toString(): string } | number; purchasePrice: { toString(): string } | number; stockQty?: { toString(): string } | number };

export type DocumentInitialData = {
  id?: string;
  number?: string;
  contactId?: string | null;
  issueDate?: Date | string;
  dueDate?: Date | string | null;
  discount?: number;
  terms?: string | null;
  notes?: string | null;
  lines?: Line[];
};

const labels: Record<string, { title: string; number: string; due: string; party: string }> = {
  INVOICE: { title: "Create invoice", number: "Invoice #", due: "Due Date", party: "Customer" },
  QUOTE: { title: "Create quotation", number: "Quote #", due: "Valid Until", party: "Customer" },
  SALES_ORDER: { title: "Create sales order", number: "Order #", due: "Target Date", party: "Customer" },
  PURCHASE_ORDER: { title: "Create purchase order", number: "PO #", due: "Expected Date", party: "Vendor" },
};

export function DocumentComposer({
  orgId,
  kind,
  contacts,
  products,
  currency = "NPR",
  defaultTaxRate = 13,
  action = createCommerceDocumentAction,
  initialData,
  isEdit = false,
}: {
  orgId: string;
  kind: "INVOICE" | "QUOTE" | "SALES_ORDER" | "PURCHASE_ORDER";
  contacts: Contact[];
  products: Product[];
  currency?: string;
  defaultTaxRate?: number;
  action?: (formData: FormData) => Promise<void>;
  initialData?: DocumentInitialData;
  isEdit?: boolean;
}) {
  const [lines, setLines] = useState<Line[]>(
    initialData?.lines && initialData.lines.length > 0
      ? initialData.lines
      : [{ description: "", quantity: 1, unitPrice: 0, taxRate: defaultTaxRate }]
  );
  const [selectedContactId, setSelectedContactId] = useState<string>(initialData?.contactId || "");
  const [contactSearch, setContactSearch] = useState<string>("");
  const [contactDropdownOpen, setContactDropdownOpen] = useState(false);
  const contactDropdownRef = useRef<HTMLDivElement>(null);

  // Active product search combobox state per line index
  const [activeSearchIndex, setActiveSearchIndex] = useState<number | null>(null);
  const [itemQuery, setItemQuery] = useState<string>("");
  const [highlightedProdIndex, setHighlightedProdIndex] = useState<number>(0);
  const searchInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const qtyInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const rateInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const [discount, setDiscount] = useState<number>(Number(initialData?.discount || 0));
  const L = labels[kind];
  const subtotal = useMemo(() => lines.reduce((a, l) => a + Number(l.quantity || 0) * Number(l.unitPrice || 0), 0), [lines]);
  const tax = useMemo(
    () =>
      lines.reduce(
        (a, l) =>
          a +
          (Number(l.quantity || 0) *
            Number(l.unitPrice || 0) *
            Number(l.taxRate !== undefined && !isNaN(l.taxRate) ? l.taxRate : defaultTaxRate)) /
            100,
        0
      ),
    [lines, defaultTaxRate]
  );
  const total = Math.max(0, subtotal + tax - discount);

  // Selected contact object
  const currentContact = useMemo(() => contacts.find((c) => c.id === selectedContactId), [contacts, selectedContactId]);

  // Filter contacts based on search
  const filteredContacts = useMemo(() => {
    if (!contactSearch.trim()) return contacts.slice(0, 50);
    const q = contactSearch.toLowerCase();
    return contacts.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.companyName && c.companyName.toLowerCase().includes(q))
    ).slice(0, 50);
  }, [contacts, contactSearch]);

  // Click outside to close contact dropdown
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (contactDropdownRef.current && !contactDropdownRef.current.contains(e.target as Node)) {
        setContactDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const update = (i: number, key: keyof Line, value: string | number) =>
    setLines((old) => old.map((l, x) => (x === i ? { ...l, [key]: value } : l)));

  // Filter products for active line search
  const matchingProducts = useMemo(() => {
    if (!itemQuery.trim()) return products.slice(0, 15);
    const q = itemQuery.toLowerCase();
    return products
      .filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))
      .slice(0, 15);
  }, [products, itemQuery]);

  const selectProductForLine = (lineIdx: number, p: Product) => {
    const price = Number(kind === "PURCHASE_ORDER" ? p.purchasePrice : p.salePrice) || 0;
    setLines((old) =>
      old.map((l, x) =>
        x === lineIdx
          ? {
              ...l,
              productId: p.id,
              description: p.name,
              unitPrice: price,
              taxRate: l.taxRate || defaultTaxRate,
            }
          : l
      )
    );
    setActiveSearchIndex(null);
    setItemQuery("");
    // Focus quantity input for fast data entry
    setTimeout(() => {
      qtyInputRefs.current[lineIdx]?.focus();
      qtyInputRefs.current[lineIdx]?.select();
    }, 50);
  };

  const useCustomItemForLine = (lineIdx: number, customName: string) => {
    if (!customName.trim()) return;
    setLines((old) =>
      old.map((l, x) =>
        x === lineIdx
          ? {
              ...l,
              productId: undefined,
              description: customName.trim(),
            }
          : l
      )
    );
    setActiveSearchIndex(null);
    setItemQuery("");
    setTimeout(() => {
      qtyInputRefs.current[lineIdx]?.focus();
      qtyInputRefs.current[lineIdx]?.select();
    }, 50);
  };

  const addNewLine = () => {
    setLines((prev) => [...prev, { description: "", quantity: 1, unitPrice: 0, taxRate: defaultTaxRate }]);
    setTimeout(() => {
      const nextIdx = lines.length;
      searchInputRefs.current[nextIdx]?.focus();
    }, 50);
  };

  return (
    <form action={action}>
      <input type="hidden" name="orgId" value={orgId} />
      <input type="hidden" name="kind" value={kind} />
      {initialData?.id && <input type="hidden" name="id" value={initialData.id} />}
      <input type="hidden" name="lines" value={JSON.stringify(lines)} />
      <input type="hidden" name="contactId" value={selectedContactId} />

      <div className="form-grid">
        <label className="field">
          <span className="field-label">{L.number}</span>
          <input
            name="number"
            defaultValue={initialData?.number || ""}
            placeholder="Auto-generated if blank (e.g. QUO-83001)"
          />
        </label>

        {/* User-friendly Searchable Contact / Party Selector */}
        <div className="field" ref={contactDropdownRef} style={{ position: "relative" }}>
          <span className="field-label">{L.party} (Search & Select)</span>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              border: "1px solid var(--line)",
              borderRadius: "var(--radius-sm, 6px)",
              padding: "6px 10px",
              background: "var(--surface)",
              cursor: "pointer",
            }}
            onClick={() => setContactDropdownOpen((prev) => !prev)}
          >
            <Building2 size={15} style={{ color: "var(--brand)", flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {currentContact ? (
                <span style={{ fontWeight: 600 }}>
                  {currentContact.companyName || currentContact.name}
                  {currentContact.companyName && currentContact.name && currentContact.companyName !== currentContact.name && (
                    <span style={{ opacity: 0.65, fontWeight: 400, marginLeft: 6, fontSize: 11 }}>
                      ({currentContact.name})
                    </span>
                  )}
                </span>
              ) : (
                <span style={{ color: "var(--text-muted)" }}>Search & select {L.party.toLowerCase()}...</span>
              )}
            </div>
            {selectedContactId && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedContactId("");
                  setContactSearch("");
                }}
                style={{ opacity: 0.6, padding: 2 }}
                title="Clear contact"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {contactDropdownOpen && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 4px)",
                left: 0,
                right: 0,
                background: "var(--surface)",
                border: "1px solid var(--line)",
                borderRadius: "var(--radius, 8px)",
                boxShadow: "0 10px 25px -5px rgba(0,0,0,0.2)",
                zIndex: 999,
                padding: 8,
                maxHeight: 280,
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                <Search size={14} style={{ position: "absolute", left: 8, color: "var(--text-muted)" }} />
                <input
                  type="text"
                  autoFocus
                  placeholder={`Search ${L.party.toLowerCase()} name, company...`}
                  value={contactSearch}
                  onChange={(e) => setContactSearch(e.target.value)}
                  style={{
                    paddingLeft: 28,
                    fontSize: 12,
                    height: 32,
                    width: "100%",
                    borderRadius: "var(--radius-sm, 6px)",
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>

              <div style={{ overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
                <button
                  type="button"
                  style={{
                    textAlign: "left",
                    padding: "6px 8px",
                    borderRadius: 4,
                    fontSize: 12,
                    color: "var(--text-muted)",
                  }}
                  onClick={() => {
                    setSelectedContactId("");
                    setContactDropdownOpen(false);
                  }}
                >
                  — No linked {L.party.toLowerCase()} (Walk-in / Direct)
                </button>
                {filteredContacts.map((c) => {
                  const isSelected = c.id === selectedContactId;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      style={{
                        textAlign: "left",
                        padding: "7px 10px",
                        borderRadius: 6,
                        fontSize: 12,
                        background: isSelected ? "var(--brand-soft)" : "transparent",
                        color: isSelected ? "var(--brand)" : "var(--text)",
                        fontWeight: isSelected ? 700 : 500,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                      onClick={() => {
                        setSelectedContactId(c.id);
                        setContactDropdownOpen(false);
                      }}
                    >
                      <div style={{ minWidth: 0, overflow: "hidden" }}>
                        <div style={{ fontWeight: 600 }}>{c.companyName || c.name}</div>
                        {c.companyName && c.name && c.companyName !== c.name && (
                          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{c.name}</div>
                        )}
                      </div>
                      {isSelected && <Check size={14} style={{ color: "var(--brand)" }} />}
                    </button>
                  );
                })}
                {!filteredContacts.length && (
                  <div style={{ padding: "12px 8px", textAlign: "center", fontSize: 12, color: "var(--text-muted)" }}>
                    No matching contacts found.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="field">
          <NepaliDatePicker
            name="issueDate"
            label="Issue Date (BS / AD)"
            defaultValue={initialData?.issueDate ? new Date(initialData.issueDate) : undefined}
            required
          />
        </div>
        <div className="field">
          <NepaliDatePicker
            name="dueDate"
            label={`${L.due} (BS / AD)`}
            defaultValue={initialData?.dueDate ? new Date(initialData.dueDate) : undefined}
          />
        </div>
      </div>

      <div
        className="section-heading"
        style={{
          marginTop: 24,
          marginBottom: 12,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Itemized Document Lines</h3>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text-muted)" }}>
            Search & select products from catalog, hit <strong>Enter</strong> to select, and automatically add new rows.
          </p>
        </div>
        <button
          className="secondary-btn"
          type="button"
          onClick={addNewLine}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 600 }}
        >
          <Plus size={14} /> Add Line Item (Enter)
        </button>
      </div>

      <div className="doc-lines-card">
        <div className="doc-lines-header">
          <div style={{ paddingLeft: 4 }}>Item / Description (Search & Select)</div>
          <div style={{ textAlign: "right" }}>Qty</div>
          <div style={{ textAlign: "right" }}>Rate ({currency})</div>
          <div style={{ textAlign: "right" }}>Tax ({defaultTaxRate}%)</div>
          <div style={{ textAlign: "right" }}>Amount (Excl. Tax)</div>
          <div style={{ textAlign: "center" }}>Action</div>
        </div>

        <div className="doc-lines-body">
          {lines.map((line, i) => {
            const lineSub = Number(line.quantity || 0) * Number(line.unitPrice || 0);
            const currentTaxRate =
              line.taxRate !== undefined && !isNaN(line.taxRate) ? line.taxRate : defaultTaxRate;
            const lineTax = (lineSub * currentTaxRate) / 100;
            const isSearchingThisLine = activeSearchIndex === i;

            return (
              <div className="doc-line-row" key={i}>
                {/* Search & Select Combobox for Item */}
                <div style={{ position: "relative" }}>
                  <div style={{ display: "flex", alignItems: "center", position: "relative" }}>
                    <input
                      ref={(el) => {
                        searchInputRefs.current[i] = el;
                      }}
                      value={isSearchingThisLine ? itemQuery : line.description}
                      onChange={(e) => {
                        if (!isSearchingThisLine) {
                          setActiveSearchIndex(i);
                        }
                        setItemQuery(e.target.value);
                        update(i, "description", e.target.value);
                        setHighlightedProdIndex(0);
                      }}
                      onFocus={() => {
                        setActiveSearchIndex(i);
                        setItemQuery(line.description);
                        setHighlightedProdIndex(0);
                      }}
                      onKeyDown={(e) => {
                        if (isSearchingThisLine) {
                          if (e.key === "ArrowDown") {
                            e.preventDefault();
                            setHighlightedProdIndex((prev) =>
                              prev < matchingProducts.length - 1 ? prev + 1 : prev
                            );
                          } else if (e.key === "ArrowUp") {
                            e.preventDefault();
                            setHighlightedProdIndex((prev) => (prev > 0 ? prev - 1 : 0));
                          } else if (e.key === "Enter") {
                            e.preventDefault();
                            if (matchingProducts.length > 0 && highlightedProdIndex < matchingProducts.length) {
                              selectProductForLine(i, matchingProducts[highlightedProdIndex]);
                            } else if (itemQuery.trim()) {
                              useCustomItemForLine(i, itemQuery);
                            } else {
                              // If empty and enter, jump to qty
                              qtyInputRefs.current[i]?.focus();
                            }
                          } else if (e.key === "Escape") {
                            setActiveSearchIndex(null);
                          }
                        } else if (e.key === "Enter") {
                          e.preventDefault();
                          qtyInputRefs.current[i]?.focus();
                        }
                      }}
                      placeholder="Type SKU or product name to search catalog, or enter custom..."
                      required
                      style={{
                        fontSize: 12.5,
                        width: "100%",
                        paddingRight: line.productId ? 80 : 30,
                      }}
                    />
                    {line.productId ? (
                      <span
                        style={{
                          position: "absolute",
                          right: 8,
                          fontSize: 10,
                          fontWeight: 700,
                          background: "var(--brand-soft)",
                          color: "var(--brand)",
                          padding: "2px 6px",
                          borderRadius: 4,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                        title="Linked to product catalog"
                      >
                        <Package size={11} />
                        Catalog
                        <button
                          type="button"
                          onClick={() => update(i, "productId", "")}
                          style={{ padding: 0, opacity: 0.7 }}
                          title="Unlink catalog"
                        >
                          ×
                        </button>
                      </span>
                    ) : (
                      <Search
                        size={13}
                        style={{ position: "absolute", right: 8, color: "var(--text-muted)", pointerEvents: "none" }}
                      />
                    )}
                  </div>

                  {/* Suggestion Popover */}
                  {isSearchingThisLine && (
                    <div
                      style={{
                        position: "absolute",
                        top: "calc(100% + 4px)",
                        left: 0,
                        right: 0,
                        background: "var(--surface)",
                        border: "1px solid var(--line)",
                        borderRadius: "var(--radius, 8px)",
                        boxShadow: "0 10px 30px rgba(0,0,0,0.18)",
                        zIndex: 999,
                        maxHeight: 220,
                        overflowY: "auto",
                        padding: 6,
                        display: "flex",
                        flexDirection: "column",
                        gap: 2,
                      }}
                      onMouseDown={(e) => e.preventDefault()} // Prevent blur before click
                    >
                      {matchingProducts.map((p, idx) => {
                        const isHigh = idx === highlightedProdIndex;
                        const price = Number(kind === "PURCHASE_ORDER" ? p.purchasePrice : p.salePrice) || 0;
                        return (
                          <div
                            key={p.id}
                            style={{
                              padding: "6px 10px",
                              borderRadius: 4,
                              fontSize: 12,
                              background: isHigh ? "var(--brand)" : "transparent",
                              color: isHigh ? "#ffffff" : "var(--text)",
                              cursor: "pointer",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                            }}
                            onClick={() => selectProductForLine(i, p)}
                            onMouseEnter={() => setHighlightedProdIndex(idx)}
                          >
                            <div>
                              <strong style={{ color: isHigh ? "#ffffff" : "inherit" }}>{p.name}</strong>
                              <div style={{ fontSize: 11, color: isHigh ? "rgba(255,255,255,0.8)" : "var(--text-muted)" }}>
                                SKU: {p.sku} {p.stockQty != null && `• Stock: ${p.stockQty}`}
                              </div>
                            </div>
                            <div style={{ fontWeight: 700, fontFamily: "Consolas, monospace", color: isHigh ? "#ffffff" : "var(--brand)" }}>
                              {currency} {price.toLocaleString()}
                            </div>
                          </div>
                        );
                      })}

                      {itemQuery.trim() && (
                        <div
                          style={{
                            padding: "7px 10px",
                            borderRadius: 4,
                            fontSize: 11.5,
                            background:
                              highlightedProdIndex === matchingProducts.length ? "var(--brand)" : "var(--soft)",
                            color:
                              highlightedProdIndex === matchingProducts.length ? "#ffffff" : "var(--text-secondary)",
                            cursor: "pointer",
                            borderTop: "1px dashed var(--line)",
                            marginTop: 2,
                            fontWeight: 600,
                          }}
                          onClick={() => useCustomItemForLine(i, itemQuery)}
                        >
                          ➕ Use &ldquo;{itemQuery.trim()}&rdquo; as custom item (Press Enter)
                        </div>
                      )}

                      {!matchingProducts.length && !itemQuery.trim() && (
                        <div style={{ padding: 10, textAlign: "center", fontSize: 11.5, color: "var(--text-muted)" }}>
                          Type product name or SKU to search catalog...
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Quantity */}
                <div>
                  <input
                    ref={(el) => {
                      qtyInputRefs.current[i] = el;
                    }}
                    type="number"
                    min="0.001"
                    step="any"
                    value={line.quantity}
                    onChange={(e) => update(i, "quantity", Number(e.target.value))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        rateInputRefs.current[i]?.focus();
                        rateInputRefs.current[i]?.select();
                      }
                    }}
                    required
                    style={{ textAlign: "right", fontFamily: "Consolas, monospace" }}
                  />
                </div>

                {/* Rate */}
                <div>
                  <input
                    ref={(el) => {
                      rateInputRefs.current[i] = el;
                    }}
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.unitPrice}
                    onChange={(e) => update(i, "unitPrice", Number(e.target.value))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        // Auto add new line for rapid item addition
                        addNewLine();
                      }
                    }}
                    required
                    style={{ textAlign: "right", fontFamily: "Consolas, monospace" }}
                  />
                </div>

                {/* Tax Rate */}
                <div>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={currentTaxRate}
                    onChange={(e) => update(i, "taxRate", Number(e.target.value))}
                    style={{ textAlign: "right", fontFamily: "Consolas, monospace" }}
                  />
                  <div style={{ fontSize: 9.5, textAlign: "right", color: "var(--text-muted)", marginTop: 2 }}>
                    +{currency} {lineTax.toFixed(2)}
                  </div>
                </div>

                {/* Line Total */}
                <div className="doc-line-total">
                  {currency} {lineSub.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>

                {/* Delete Line */}
                <div style={{ textAlign: "center" }}>
                  <button
                    className="danger-btn"
                    type="button"
                    title="Remove item"
                    disabled={lines.length === 1}
                    onClick={() => setLines((x) => (x.length === 1 ? x : x.filter((_, idx) => idx !== i)))}
                    style={{ padding: "6px 8px", opacity: lines.length === 1 ? 0.4 : 1 }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 24, marginTop: 20, alignItems: "start" }}>
        <div className="form-grid" style={{ margin: 0 }}>
          <label className="field">
            <span className="field-label">Special Discount ({currency})</span>
            <input
              name="discount"
              type="number"
              step="0.01"
              min="0"
              value={discount}
              onChange={(e) => setDiscount(Number(e.target.value))}
              placeholder="0.00"
              style={{ fontFamily: "Consolas, monospace" }}
            />
          </label>
          <label className="field">
            <span className="field-label">Payment & Delivery Terms</span>
            <input
              name="terms"
              defaultValue={initialData?.terms || ""}
              placeholder="e.g. 50% advance, balance on delivery"
            />
          </label>
          <label className="field full">
            <span className="field-label">Client Notes & Remarks</span>
            <textarea
              name="notes"
              defaultValue={initialData?.notes || ""}
              placeholder="Optional notes to print on document..."
              rows={3}
            />
          </label>
        </div>

        <div className="doc-summary-card">
          <div className="doc-summary-row">
            <span>Lines Subtotal</span>
            <b>
              {currency}{" "}
              {subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </b>
          </div>
          <div className="doc-summary-row">
            <span>Estimated VAT / Tax</span>
            <b>
              {currency}{" "}
              {tax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </b>
          </div>
          {discount > 0 && (
            <div className="doc-summary-row" style={{ color: "var(--red)" }}>
              <span>Deducted Discount</span>
              <b>
                - {currency}{" "}
                {discount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </b>
            </div>
          )}
          <div className="doc-summary-row grand-total">
            <span>Grand Total</span>
            <b>
              {currency}{" "}
              {total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </b>
          </div>
        </div>
      </div>

      <div className="form-actions" style={{ marginTop: 24, display: "flex", justifyContent: "flex-end" }}>
        <button className="primary-btn" type="submit" style={{ padding: "10px 24px", fontSize: 14 }}>
          {isEdit ? `Update ${L.title.replace("Create ", "")}` : `Save ${L.title.replace("Create ", "")}`}
        </button>
      </div>
    </form>
  );
}
