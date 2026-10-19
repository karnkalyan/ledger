"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, X, ReceiptText } from "lucide-react";
import { saveRentalHouseAction, setActiveRentalHouseAction, deleteRentalHouseAction, recordRentalPaymentAction } from "@/app/(dashboard)/actions";

interface RentalPaymentItem {
  id: string;
  amount: number;
  paidAt: string;
  paymentMethod: string;
  reference: string | null;
}

interface RentalBillItem {
  id: string;
  billingMonth: string;
  rentAmount: number;
  electricityAmount: number;
  waterAmount: number;
  otherAmount: number;
  totalAmount: number;
  dueDate: string | null;
  payments: RentalPaymentItem[];
}

export interface RentalHouseItem {
  id: string;
  title: string;
  ownerName: string;
  ownerPhone: string | null;
  address: string | null;
  monthlyRent: number | string;
  electricityRate: number | string;
  waterGarbageFee: number | string;
  notes: string | null;
  isActive: boolean;
  bills: RentalBillItem[];
}

interface RentalHouseSectionProps {
  orgId: string;
  orgKind: string;
  currency: string;
  rentalHouses: RentalHouseItem[];
  paymentAccounts: { id: string; label: string }[];
}

export function RentalHouseSection({
  orgId,
  orgKind,
  currency,
  rentalHouses,
  paymentAccounts,
}: RentalHouseSectionProps) {
  const isCompany = orgKind === "COMPANY";
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [selectedHouse, setSelectedHouse] = useState<RentalHouseItem | null>(null);
  const [isPending, startTransition] = useTransition();
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const activeHouse = rentalHouses.find((house) => house.isActive) || rentalHouses[0];
  const allBills = rentalHouses.flatMap((house) => house.bills);
  const totalBilled = allBills.reduce((sum, bill) => sum + Number(bill.totalAmount), 0);
  const totalPaid = allBills.reduce(
    (sum, bill) => sum + bill.payments.reduce((paymentSum, payment) => paymentSum + Number(payment.amount), 0),
    0,
  );
  const totalDue = Math.max(0, totalBilled - totalPaid);
  const currentMonth = new Date().toISOString().slice(0, 7);

  const handleOpenCreate = () => {
    setSelectedHouse(null);
    setModalMode("create");
  };

  const handleOpenEdit = (house: RentalHouseItem) => {
    setSelectedHouse(house);
    setModalMode("edit");
  };

  const handleClose = () => {
    setModalMode(null);
    setSelectedHouse(null);
  };

  return (
    <div style={{ marginTop: 24, marginBottom: 16 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 12,
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
            {isCompany ? "Office Lease & Premises Management" : "House Owner & Tenancy Management"}
          </h3>
          <p style={{ margin: "3px 0 0", fontSize: 12, color: "var(--text-muted)" }}>
            {isCompany
              ? "Configure office premises, landlord details, monthly office rent, electricity unit rate, and water/CAM maintenance fees. The active lease drives company recurring commitments."
              : "Configure rented residences, landlord details, monthly rent, electricity unit rate, and water/garbage fee. The currently active house automatically drives household commitments."}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          {activeHouse && (
            <button type="button" onClick={() => setShowPaymentForm((value) => !value)} className="success-btn" style={{ padding: "6px 12px", fontSize: 12 }}>
              <ReceiptText size={13} /> Record Rent / Utility Payment
            </button>
          )}
          <button type="button" onClick={handleOpenCreate} className="primary-btn" style={{ padding: "6px 12px", fontSize: 12 }}>
            {isCompany ? "+ Register Office Lease / Premises" : "+ Register Rental House"}
          </button>
        </div>
      </div>

      {allBills.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10, marginBottom: 14 }}>
          {[
            ["Total billed", totalBilled, "var(--text)"],
            ["Actual paid", totalPaid, "var(--success)"],
            ["Remaining dues", totalDue, totalDue > 0 ? "var(--red)" : "var(--success)"],
          ].map(([label, value, color]) => (
            <div key={String(label)} style={{ padding: 12, border: "1px solid var(--line)", borderRadius: 8, background: "var(--soft)" }}>
              <div style={{ fontSize: 10, textTransform: "uppercase", color: "var(--text-muted)", fontWeight: 700 }}>{label}</div>
              <strong style={{ color: String(color), fontSize: 17 }}>{currency} {Number(value).toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
            </div>
          ))}
        </div>
      )}

      {showPaymentForm && activeHouse && (
        <form action={async (formData) => { setShowPaymentForm(false); await recordRentalPaymentAction(formData); }} style={{ background: "var(--soft)", border: "1px solid var(--line)", borderRadius: 8, padding: 14, marginBottom: 16 }}>
          <input type="hidden" name="orgId" value={orgId} />
          <div className="form-grid">
            <label className="field full">Premises<select name="rentalHouseId" defaultValue={activeHouse.id}>{rentalHouses.map((house) => <option key={house.id} value={house.id}>{house.title} - {house.ownerName}</option>)}</select></label>
            <label className="field">Billing Month<input name="billingMonth" type="month" defaultValue={currentMonth} required /></label>
            <label className="field">Due Date<input name="dueDate" type="date" /></label>
            <label className="field">Rent ({currency})<input name="rentAmount" type="number" min="0" step="0.01" defaultValue={Number(activeHouse.monthlyRent)} /></label>
            <label className="field">Electricity ({currency})<input name="electricityAmount" type="number" min="0" step="0.01" defaultValue="0" /></label>
            <label className="field">Water / CAM ({currency})<input name="waterAmount" type="number" min="0" step="0.01" defaultValue={Number(activeHouse.waterGarbageFee)} /></label>
            <label className="field">Other Charges ({currency})<input name="otherAmount" type="number" min="0" step="0.01" defaultValue="0" /></label>
            <label className="field">Amount Paid Now ({currency})<input name="paidAmount" type="number" min="0.01" step="0.01" required /></label>
            <label className="field">Payment Method<select name="paymentMethod"><option value="CASH">Cash</option><option value="BANK">Bank / Wallet / Card</option><option value="OTHER">Other</option></select></label>
            <label className="field full">Payment Account (when Bank / Wallet / Card)<select name="bankAccountId"><option value="">Select account</option>{paymentAccounts.map((account) => <option key={account.id} value={account.id}>{account.label}</option>)}</select></label>
            <label className="field">Reference / Receipt<input name="reference" /></label>
            <label className="field">Notes<input name="notes" /></label>
          </div>
          <div className="form-actions"><button type="button" className="secondary-btn" onClick={() => setShowPaymentForm(false)}>Cancel</button><button className="success-btn" type="submit">Save Actual Payment</button></div>
        </form>
      )}

      <div className="house-card-grid">
        {rentalHouses.map((h) => (
          <div key={h.id} className={`tenant-house-card ${h.isActive ? "active" : ""}`}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: 8,
              }}
            >
              <strong style={{ fontSize: 14 }}>{h.title}</strong>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {h.isActive ? (
                  <span className="tenant-house-badge">
                    <CheckCircle2 size={12} /> ACTIVE
                  </span>
                ) : (
                  <form
                    action={(formData) => {
                      startTransition(async () => {
                        await setActiveRentalHouseAction(formData);
                      });
                    }}
                  >
                    <input type="hidden" name="orgId" value={orgId} />
                    <input type="hidden" name="houseId" value={h.id} />
                    <button
                      className="secondary-btn"
                      style={{ fontSize: 10.5, padding: "2px 8px" }}
                      disabled={isPending}
                    >
                      Set as Active
                    </button>
                  </form>
                )}
              </div>
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
              <div>
                <strong>{isCompany ? "Landlord:" : "Owner:"}</strong> {h.ownerName}{" "}
                {h.ownerPhone ? `(${h.ownerPhone})` : ""}
              </div>
              {h.address && (
                <div>
                  <strong>Location:</strong> {h.address}
                </div>
              )}
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: 6,
                background: "var(--soft)",
                padding: 8,
                borderRadius: 4,
                textAlign: "center",
                fontSize: 11,
              }}
            >
              <div>
                <div style={{ color: "var(--text-muted)", fontSize: 10 }}>RENT</div>
                <strong style={{ fontFamily: "Consolas, monospace" }}>
                  {currency} {Number(h.monthlyRent).toLocaleString()}
                </strong>
              </div>
              <div>
                <div style={{ color: "var(--text-muted)", fontSize: 10 }}>ELECTRICITY</div>
                <strong style={{ fontFamily: "Consolas, monospace" }}>
                  {currency} {Number(h.electricityRate)}/u
                </strong>
              </div>
              <div>
                <div style={{ color: "var(--text-muted)", fontSize: 10 }}>
                  {isCompany ? "WATER & CAM" : "WATER & WASTE"}
                </div>
                <strong style={{ fontFamily: "Consolas, monospace" }}>
                  {currency} {Number(h.waterGarbageFee).toLocaleString()}
                </strong>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10, gap: 6 }}>
              <button
                type="button"
                className="ghost-btn"
                style={{ fontSize: 11, padding: "3px 8px" }}
                onClick={() => handleOpenEdit(h)}
              >
                Modify Charges / Details
              </button>
            </div>

            {h.bills.length > 0 && (
              <div style={{ marginTop: 12, borderTop: "1px solid var(--line)", paddingTop: 10 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 6 }}>Rent &amp; utility payment history</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {h.bills.slice(0, 12).map((bill) => {
                    const paid = bill.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
                    const due = Math.max(0, Number(bill.totalAmount) - paid);
                    return (
                      <details key={bill.id} style={{ background: "var(--soft)", borderRadius: 6, padding: "7px 9px" }}>
                        <summary style={{ cursor: "pointer", display: "flex", justifyContent: "space-between", gap: 8, fontSize: 11 }}>
                          <strong>{bill.billingMonth}</strong>
                          <span>Bill {currency} {bill.totalAmount.toLocaleString()} · Paid <strong style={{ color: "var(--success)" }}>{currency} {paid.toLocaleString()}</strong> · Due <strong style={{ color: due > 0 ? "var(--red)" : "var(--success)" }}>{currency} {due.toLocaleString()}</strong></span>
                        </summary>
                        <div style={{ fontSize: 10.5, marginTop: 7, color: "var(--text-muted)" }}>
                          Rent {bill.rentAmount.toLocaleString()} · Electricity {bill.electricityAmount.toLocaleString()} · Water/CAM {bill.waterAmount.toLocaleString()} · Other {bill.otherAmount.toLocaleString()}
                          {bill.dueDate ? ` · Due date ${new Date(bill.dueDate).toLocaleDateString()}` : ""}
                          {bill.payments.map((payment) => <div key={payment.id} style={{ marginTop: 4 }}>Payment: {currency} {payment.amount.toLocaleString()} on {new Date(payment.paidAt).toLocaleDateString()} via {payment.paymentMethod}{payment.reference ? ` · Ref ${payment.reference}` : ""}</div>)}
                        </div>
                      </details>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ))}

        {!rentalHouses.length && (
          <div
            style={{
              padding: 16,
              background: "var(--soft)",
              borderRadius: 6,
              color: "var(--text-muted)",
              fontSize: 12,
            }}
          >
            {isCompany
              ? 'No office premises registered yet. Click "+ Register Office Lease / Premises" above to configure your office rent and utility rates.'
              : 'No rental residence registered yet. Click "+ Register Rental House" above to configure your landlord details and fixed rates.'}
          </div>
        )}
      </div>

      {/* Controlled Modal Dialog */}
      {modalMode && (
        <div
          className="drawer-backdrop"
          style={{ display: "flex" }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              handleClose();
            }
          }}
        >
          <div className="drawer-panel" role="dialog" aria-modal="true">
            <div className="drawer-head">
              <div>
                <h2>
                  {modalMode === "create"
                    ? isCompany
                      ? "Register Office Lease (Premises)"
                      : "Register Rental House (Tenancy)"
                    : isCompany
                    ? "Modify Office Lease Charges"
                    : "Modify Rental House Charges"}
                </h2>
                <p>
                  {modalMode === "create"
                    ? "Define landlord, property address, fixed rent, electricity rate, and utilities."
                    : "Update monthly rent, electricity rate, utilities, or owner contact info."}
                </p>
              </div>
              <button
                type="button"
                className="modal-close-icon-btn"
                onClick={handleClose}
                aria-label="Close"
              >
                <X size={15} />
              </button>
            </div>

            <form
              action={async (formData) => {
                handleClose();
                await saveRentalHouseAction(formData);
              }}
              onSubmit={() => {
                handleClose();
              }}
              style={{ display: "flex", flexDirection: "column", gap: 12 }}
            >
              <input type="hidden" name="orgId" value={orgId} />
              {modalMode === "edit" && selectedHouse && (
                <input type="hidden" name="id" value={selectedHouse.id} />
              )}

              <label className="field">
                <span className="field-label">
                  {isCompany ? "Office / Premises Title" : "Residence Title / Property Name"}
                </span>
                <input
                  name="title"
                  required
                  defaultValue={selectedHouse?.title || ""}
                  placeholder={
                    isCompany
                      ? "e.g. Simulcast Head Office, Branch Premises"
                      : "e.g. Current Rental Residence, Shantinagar House"
                  }
                />
              </label>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <label className="field">
                  <span className="field-label">
                    {isCompany ? "Landlord / Building Management" : "House Owner (Landlord) Name"}
                  </span>
                  <input
                    name="ownerName"
                    required
                    defaultValue={selectedHouse?.ownerName || ""}
                    placeholder="Full Name of Property Owner / Landlord"
                  />
                </label>
                <label className="field">
                  <span className="field-label">Owner Contact Phone</span>
                  <input
                    name="ownerPhone"
                    defaultValue={selectedHouse?.ownerPhone || ""}
                    placeholder="+977-98XXXXXXXX"
                  />
                </label>
              </div>

              <label className="field">
                <span className="field-label">Property Address / Location</span>
                <input
                  name="address"
                  defaultValue={selectedHouse?.address || ""}
                  placeholder="Tole, Ward, City"
                />
              </label>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <label className="field">
                  <span className="field-label">Monthly Rent ({currency})</span>
                  <input
                    name="monthlyRent"
                    type="number"
                    step="0.01"
                    defaultValue={
                      selectedHouse ? Number(selectedHouse.monthlyRent) : isCompany ? 17500 : 16800
                    }
                    required
                  />
                </label>
                <label className="field">
                  <span className="field-label">Electricity Rate / Unit ({currency})</span>
                  <input
                    name="electricityRate"
                    type="number"
                    step="0.01"
                    defaultValue={selectedHouse ? Number(selectedHouse.electricityRate) : 15}
                    required
                  />
                </label>
                <label className="field">
                  <span className="field-label">
                    {isCompany ? "Water & CAM Fee" : "Water & Garbage Fee"} ({currency})
                  </span>
                  <input
                    name="waterGarbageFee"
                    type="number"
                    step="0.01"
                    defaultValue={
                      selectedHouse
                        ? Number(selectedHouse.waterGarbageFee)
                        : isCompany
                        ? 500
                        : 300
                    }
                    required
                  />
                </label>
              </div>

              <label
                className="field"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  cursor: "pointer",
                  marginTop: 4,
                }}
              >
                <input
                  type="checkbox"
                  name="isActive"
                  value="true"
                  defaultChecked={selectedHouse ? selectedHouse.isActive : true}
                  style={{ width: 16, height: 16 }}
                />
                <span style={{ fontSize: 13, fontWeight: 600 }}>
                  Set as Currently Active Premises (Calculates Monthly Overhead)
                </span>
              </label>

              <label className="field">
                <span className="field-label">Notes / Lease Agreement Details</span>
                <textarea
                  name="notes"
                  defaultValue={selectedHouse?.notes || ""}
                  placeholder="Agreement date, deposit amount, meter location..."
                  rows={2}
                />
              </label>

              <div
                className="form-actions"
                style={{
                  marginTop: 10,
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 8,
                }}
              >
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={handleClose}
                  disabled={isPending}
                >
                  Cancel
                </button>
                <button className="primary-btn" type="submit" disabled={isPending}>
                  {modalMode === "create" ? "Save Premises" : "Update Charges"}
                </button>
              </div>
            </form>

            {modalMode === "edit" && selectedHouse && (
              <form
                action={async (formData) => {
                  handleClose();
                  await deleteRentalHouseAction(formData);
                }}
                onSubmit={() => {
                  handleClose();
                }}
                style={{
                  marginTop: 16,
                  borderTop: "1px solid var(--border)",
                  paddingTop: 12,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <input type="hidden" name="orgId" value={orgId} />
                <input type="hidden" name="houseId" value={selectedHouse.id} />
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  Danger zone: This will remove this rental property entry.
                </span>
                <button
                  className="danger-btn"
                  style={{ fontSize: 11, padding: "4px 10px" }}
                  type="submit"
                  disabled={isPending}
                >
                  Delete Premises Record
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
