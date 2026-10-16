"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { createCommerceDocumentAction } from "@/app/(dashboard)/actions";
import { NepaliDatePicker } from "@/components/nepali-date-picker";

export type Line = { description: string; quantity: number; unitPrice: number; taxRate: number; productId?: string };
type Contact = { id: string; name: string; companyName: string | null };
type Product = { id: string; name: string; sku: string; salePrice: { toString(): string } | number; purchasePrice: { toString(): string } | number };

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
  const [discount, setDiscount] = useState<number>(Number(initialData?.discount || 0));
  const L = labels[kind];
  const subtotal = useMemo(() => lines.reduce((a, l) => a + l.quantity * l.unitPrice, 0), [lines]);
  const tax = useMemo(() => lines.reduce((a, l) => a + (l.quantity * l.unitPrice * (l.taxRate ?? defaultTaxRate)) / 100, 0), [lines, defaultTaxRate]);
  const total = Math.max(0, subtotal + tax - discount);

  const update = (i: number, key: keyof Line, value: string | number) =>
    setLines((old) => old.map((l, x) => (x === i ? { ...l, [key]: value } : l)));

  const chooseProduct = (i: number, id: string) => {
    const p = products.find((x) => x.id === id);
    setLines((old) =>
      old.map((l, x) =>
        x === i
          ? {
              ...l,
              productId: id || undefined,
              description: p?.name || l.description,
              unitPrice: p ? Number(kind === "PURCHASE_ORDER" ? p.purchasePrice : p.salePrice) : l.unitPrice,
              taxRate: l.taxRate || defaultTaxRate,
            }
          : l
      )
    );
  };

  return (
    <form action={action}>
      <input type="hidden" name="orgId" value={orgId} />
      <input type="hidden" name="kind" value={kind} />
      {initialData?.id && <input type="hidden" name="id" value={initialData.id} />}
      <input type="hidden" name="lines" value={JSON.stringify(lines)} />

      <div className="form-grid">
        <label className="field">
          <span className="field-label">{L.number}</span>
          <input
            name="number"
            defaultValue={initialData?.number || ""}
            placeholder="Auto-generated if blank"
          />
        </label>
        <label className="field">
          <span className="field-label">{L.party}</span>
          <select name="contactId" defaultValue={initialData?.contactId || ""}>
            <option value="">Select {L.party.toLowerCase()}</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.companyName || c.name}
              </option>
            ))}
          </select>
        </label>
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

      <div className="section-heading" style={{ marginTop: 20, marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Itemized Document Lines</h3>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text-muted)" }}>Select products from catalog or enter custom line items, quantities, and rates.</p>
        </div>
        <button
          className="secondary-btn"
          type="button"
          onClick={() => setLines((x) => [...x, { description: "", quantity: 1, unitPrice: 0, taxRate: defaultTaxRate }])}
          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <Plus size={14} /> Add Line Item
        </button>
      </div>

      <div className="doc-lines-card">
        <div className="doc-lines-header">
          <div>Item / Description</div>
          <div style={{ textAlign: "right" }}>Qty</div>
          <div style={{ textAlign: "right" }}>Rate ({currency})</div>
          <div style={{ textAlign: "right" }}>Tax ({defaultTaxRate}%)</div>
          <div style={{ textAlign: "right" }}>Amount (Excl. Tax)</div>
          <div style={{ textAlign: "center" }}>Action</div>
        </div>

        <div className="doc-lines-body">
          {lines.map((line, i) => {
            const lineSub = line.quantity * line.unitPrice;
            const currentTaxRate = line.taxRate !== undefined && !isNaN(line.taxRate) ? line.taxRate : defaultTaxRate;
            const lineTax = (lineSub * currentTaxRate) / 100;

            return (
              <div className="doc-line-row" key={i}>
                <div className="doc-item-select-group">
                  <select
                    value={line.productId || ""}
                    onChange={(e) => chooseProduct(i, e.target.value)}
                    style={{ fontSize: 12, padding: "5px 8px" }}
                  >
                    <option value="">Custom Item / Service</option>
                    {products.map((p) => (
                      <option value={p.id} key={p.id}>
                        {p.sku} · {p.name}
                      </option>
                    ))}
                  </select>
                  <input
                    value={line.description}
                    onChange={(e) => update(i, "description", e.target.value)}
                    placeholder="Item description or service particulars..."
                    required
                    style={{ fontSize: 12.5 }}
                  />
                </div>

                <div>
                  <input
                    type="number"
                    min="0.001"
                    step="any"
                    value={line.quantity}
                    onChange={(e) => update(i, "quantity", Number(e.target.value))}
                    required
                    style={{ textAlign: "right", fontFamily: "Consolas, monospace" }}
                  />
                </div>

                <div>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.unitPrice}
                    onChange={(e) => update(i, "unitPrice", Number(e.target.value))}
                    required
                    style={{ textAlign: "right", fontFamily: "Consolas, monospace" }}
                  />
                </div>

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

                <div className="doc-line-total">
                  {currency} {lineSub.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>

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
            <b>{currency} {subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b>
          </div>
          <div className="doc-summary-row">
            <span>Estimated VAT / Tax</span>
            <b>{currency} {tax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b>
          </div>
          {discount > 0 && (
            <div className="doc-summary-row" style={{ color: "var(--red)" }}>
              <span>Deducted Discount</span>
              <b>- {currency} {discount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b>
            </div>
          )}
          <div className="doc-summary-row grand-total">
            <span>Grand Total</span>
            <b>{currency} {total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b>
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
