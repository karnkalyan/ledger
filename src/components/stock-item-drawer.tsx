"use client";

import { useState } from "react";
import Link from "next/link";
import { Package, X, Building2, UsersRound, ArrowDownLeft, ArrowUpRight, Boxes } from "lucide-react";
import { money, shortDate } from "@/lib/format";
import { formatBsDate } from "@/lib/nepali-calendar";

export interface StockProductDetail {
  id: string;
  sku: string;
  name: string;
  unit: string;
  stockQty: number;
  reorderLevel: number;
  purchasePrice: number;
  salePrice: number;
  purchases: {
    id: string;
    orderNumber: string;
    vendorName: string;
    orderDate: Date;
    quantity: number;
    unitPrice: number;
    amount: number;
    status: string;
    poId: string;
  }[];
  sales: {
    id: string;
    docNumber: string;
    customerName: string;
    date: Date;
    quantity: number;
    unitPrice: number;
    amount: number;
    status: string;
    type: "so" | "inv";
    docId: string;
  }[];
}

export function StockItemDrawer({
  orgId,
  currency,
  product,
  triggerText,
}: {
  orgId: string;
  currency: string;
  product: StockProductDetail;
  triggerText?: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"vendors" | "customers" | "all">("all");

  const totalPurchasedQty = product.purchases.reduce((s, p) => s + p.quantity, 0);
  const totalSoldQty = product.sales.reduce((s, p) => s + p.quantity, 0);

  return (
    <>
      <span
        onClick={() => setIsOpen(true)}
        className="table-clickable-title"
        style={{ cursor: "pointer" }}
        title={`View vendor & customer history for ${product.name}`}
      >
        {triggerText || product.name}
      </span>

      {isOpen && (
        <div className="drawer-backdrop" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="drawer-panel" style={{ width: "min(720px, 95vw)", maxHeight: "90vh" }}>
            <div className="drawer-head">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 8,
                    background: "var(--brand-soft)",
                    color: "var(--brand)",
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  <Boxes size={20} />
                </div>
                <div>
                  <h2 style={{ fontSize: 17 }}>{product.name}</h2>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                    <span>SKU: <strong>{product.sku}</strong></span>
                    <span>·</span>
                    <span>Current Stock: <strong>{product.stockQty} {product.unit}</strong></span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="modal-close-icon-btn"
                onClick={() => setIsOpen(false)}
                aria-label="Close"
              >
                <X size={14} />
              </button>
            </div>

            {/* Quick KPI Strip */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, margin: "12px 0 16px" }}>
              <div style={{ padding: "8px 10px", background: "var(--soft)", borderRadius: 6, border: "1px solid var(--line)" }}>
                <span style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>In Stock</span>
                <strong style={{ display: "block", fontSize: 14, color: "var(--text)", marginTop: 2 }}>{product.stockQty} {product.unit}</strong>
              </div>
              <div style={{ padding: "8px 10px", background: "var(--soft)", borderRadius: 6, border: "1px solid var(--line)" }}>
                <span style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>Cost Price</span>
                <strong style={{ display: "block", fontSize: 14, color: "var(--text)", marginTop: 2 }}>{money(product.purchasePrice, currency)}</strong>
              </div>
              <div style={{ padding: "8px 10px", background: "var(--soft)", borderRadius: 6, border: "1px solid var(--line)" }}>
                <span style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>Selling Price</span>
                <strong style={{ display: "block", fontSize: 14, color: "var(--text)", marginTop: 2 }}>{money(product.salePrice, currency)}</strong>
              </div>
              <div style={{ padding: "8px 10px", background: "var(--soft)", borderRadius: 6, border: "1px solid var(--line)" }}>
                <span style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>Reorder Alert</span>
                <strong style={{ display: "block", fontSize: 14, color: product.stockQty <= product.reorderLevel ? "var(--danger)" : "var(--text)", marginTop: 2 }}>
                  {product.reorderLevel} {product.unit}
                </strong>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div style={{ display: "flex", gap: 6, borderBottom: "1px solid var(--line)", paddingBottom: 8, marginBottom: 14 }}>
              <button
                type="button"
                className={`filter-tab ${activeTab === "all" ? "active" : ""}`}
                onClick={() => setActiveTab("all")}
              >
                All History ({product.purchases.length + product.sales.length})
              </button>
              <button
                type="button"
                className={`filter-tab ${activeTab === "vendors" ? "active" : ""}`}
                onClick={() => setActiveTab("vendors")}
                style={{ display: "flex", alignItems: "center", gap: 6 }}
              >
                <Building2 size={13} /> Vendors Purchased From ({product.purchases.length})
              </button>
              <button
                type="button"
                className={`filter-tab ${activeTab === "customers" ? "active" : ""}`}
                onClick={() => setActiveTab("customers")}
                style={{ display: "flex", alignItems: "center", gap: 6 }}
              >
                <UsersRound size={13} /> Customers Sold To ({product.sales.length})
              </button>
            </div>

            {/* VENDORS SECTION */}
            {(activeTab === "all" || activeTab === "vendors") && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Building2 size={15} style={{ color: "var(--brand)" }} />
                    <h3 style={{ margin: 0, fontSize: 13.5, fontWeight: 700 }}>Vendors Purchased From</h3>
                  </div>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Total Inflow: {totalPurchasedQty} {product.unit}</span>
                </div>

                {product.purchases.length > 0 ? (
                  <div className="table-scroll">
                    <table className="responsive-table" style={{ width: "100%", fontSize: 11.5 }}>
                      <thead>
                        <tr>
                          <th>Vendor / Supplier</th>
                          <th>PO #</th>
                          <th>Date</th>
                          <th style={{ textAlign: "right" }}>Qty</th>
                          <th style={{ textAlign: "right" }}>Unit Rate</th>
                          <th style={{ textAlign: "right" }}>Total Cost</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {product.purchases.map((p) => (
                          <tr key={p.id}>
                            <td><strong>{p.vendorName}</strong></td>
                            <td>
                              <Link href={`/${orgId}/purchase/${p.poId}`} className="table-clickable-title">
                                {p.orderNumber}
                              </Link>
                            </td>
                            <td>
                              <div>{formatBsDate(new Date(p.orderDate))}</div>
                              <small style={{ color: "var(--text-muted)" }}>{shortDate(new Date(p.orderDate))}</small>
                            </td>
                            <td style={{ textAlign: "right", fontWeight: 700 }}>{p.quantity} {product.unit}</td>
                            <td style={{ textAlign: "right" }}>{money(p.unitPrice, currency)}</td>
                            <td style={{ textAlign: "right", fontWeight: 700, color: "var(--danger)" }}>{money(p.amount, currency)}</td>
                            <td><span className="badge cyan" style={{ fontSize: 9.5 }}>{p.status}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{ padding: "12px", background: "var(--soft)", borderRadius: 6, fontSize: 11.5, color: "var(--text-muted)", textAlign: "center" }}>
                    No purchase orders recorded for this item yet.
                  </div>
                )}
              </div>
            )}

            {/* CUSTOMERS SECTION */}
            {(activeTab === "all" || activeTab === "customers") && (
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <UsersRound size={15} style={{ color: "var(--success)" }} />
                    <h3 style={{ margin: 0, fontSize: 13.5, fontWeight: 700 }}>Customers Who Purchased</h3>
                  </div>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Total Sold: {totalSoldQty} {product.unit}</span>
                </div>

                {product.sales.length > 0 ? (
                  <div className="table-scroll">
                    <table className="responsive-table" style={{ width: "100%", fontSize: 11.5 }}>
                      <thead>
                        <tr>
                          <th>Customer Name</th>
                          <th>Doc #</th>
                          <th>Date</th>
                          <th style={{ textAlign: "right" }}>Qty</th>
                          <th style={{ textAlign: "right" }}>Sale Price</th>
                          <th style={{ textAlign: "right" }}>Total Revenue</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {product.sales.map((s) => (
                          <tr key={s.id}>
                            <td><strong>{s.customerName}</strong></td>
                            <td>
                              <Link
                                href={s.type === "inv" ? `/${orgId}/invoices/${s.docId}` : `/${orgId}/sales/${s.docId}`}
                                className="table-clickable-title"
                              >
                                {s.docNumber}
                              </Link>
                            </td>
                            <td>
                              <div>{formatBsDate(new Date(s.date))}</div>
                              <small style={{ color: "var(--text-muted)" }}>{shortDate(new Date(s.date))}</small>
                            </td>
                            <td style={{ textAlign: "right", fontWeight: 700 }}>{s.quantity} {product.unit}</td>
                            <td style={{ textAlign: "right" }}>{money(s.unitPrice, currency)}</td>
                            <td style={{ textAlign: "right", fontWeight: 700, color: "var(--success)" }}>{money(s.amount, currency)}</td>
                            <td><span className="badge green" style={{ fontSize: 9.5 }}>{s.status}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{ padding: "12px", background: "var(--soft)", borderRadius: 6, fontSize: 11.5, color: "var(--text-muted)", textAlign: "center" }}>
                    No sales orders or invoices issued for this item yet.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
