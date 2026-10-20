"use client";

import { useMemo, useState, useTransition } from "react";
import { CheckCircle2, X, ReceiptText, Calendar, Clock, Sparkles } from "lucide-react";
import { saveRentalHouseAction, setActiveRentalHouseAction, deleteRentalHouseAction, recordRentalPaymentAction } from "@/app/(dashboard)/actions";
import { NepaliDatePicker } from "@/components/nepali-date-picker";
import {
  adToBs,
  bsToAd,
  formatDualDate,
  formatBsDate,
  getBsMonthRange,
  NEPALI_MONTHS_EN,
  NEPALI_MONTHS_NE,
  getNepaliYearList,
} from "@/lib/nepali-calendar";

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
  notes?: string | null;
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

export function formatDualBillingMonth(monthKey: string): { primary: string; secondary: string } {
  if (!monthKey) return { primary: "—", secondary: "" };
  const parts = monthKey.split("-").map(Number);
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    const [yr, m] = parts;
    if (yr >= 2070 && yr <= 2100) {
      const mIdx = Math.max(0, Math.min(11, m - 1));
      const bsNameEn = NEPALI_MONTHS_EN[mIdx];
      const bsNameNe = NEPALI_MONTHS_NE[mIdx];
      try {
        const range = getBsMonthRange(yr, m);
        const startStr = `${range.startDate.getDate()} ${range.startDate.toLocaleString("default", { month: "short" })}`;
        const endStr = `${range.endDate.getDate()} ${range.endDate.toLocaleString("default", { month: "short" })} ${range.endDate.getFullYear()}`;
        return {
          primary: `${bsNameEn} (${bsNameNe}) ${yr} BS`,
          secondary: `${startStr} – ${endStr} AD`,
        };
      } catch {
        return {
          primary: `${bsNameEn} (${bsNameNe}) ${yr} BS`,
          secondary: `BS Month ${monthKey}`,
        };
      }
    } else if (yr >= 1990 && yr < 2070) {
      const adDate = new Date(yr, m - 1, 15);
      const adName = adDate.toLocaleString("default", { month: "long" });
      try {
        const bs = adToBs(adDate);
        return {
          primary: `${bs.monthName} (${bs.monthNameNe}) ${bs.year} BS`,
          secondary: `${adName} ${yr} AD`,
        };
      } catch {
        return {
          primary: `${adName} ${yr} AD`,
          secondary: monthKey,
        };
      }
    }
  }
  return { primary: monthKey, secondary: "" };
}

export function DualBillingMonthPicker({
  value,
  onChange,
  name = "billingMonth",
}: {
  value: string;
  onChange: (val: string) => void;
  name?: string;
}) {
  const currentBs = useMemo(() => {
    try {
      return adToBs(new Date());
    } catch {
      return { year: 2083, month: 7 };
    }
  }, []);

  const now = new Date();
  const [calendarMode, setCalendarMode] = useState<"BS" | "AD">("BS");

  const [bsYear, setBsYear] = useState<number>(() => {
    const p = value.split("-").map(Number);
    return p.length === 2 && p[0] >= 2070 ? p[0] : currentBs.year;
  });
  const [bsMonth, setBsMonth] = useState<number>(() => {
    const p = value.split("-").map(Number);
    return p.length === 2 && p[0] >= 2070 ? p[1] : currentBs.month;
  });
  const [adYear, setAdYear] = useState<number>(() => {
    const p = value.split("-").map(Number);
    return p.length === 2 && p[0] < 2070 ? p[0] : now.getFullYear();
  });
  const [adMonth, setAdMonth] = useState<number>(() => {
    const p = value.split("-").map(Number);
    return p.length === 2 && p[0] < 2070 ? p[1] : now.getMonth() + 1;
  });

  const handleBsUpdate = (y: number, m: number) => {
    setBsYear(y);
    setBsMonth(m);
    const key = `${y}-${String(m).padStart(2, "0")}`;
    onChange(key);
  };

  const handleAdUpdate = (y: number, m: number) => {
    setAdYear(y);
    setAdMonth(m);
    const key = `${y}-${String(m).padStart(2, "0")}`;
    onChange(key);
  };

  let previewText = "";
  if (calendarMode === "BS") {
    const mIdx = Math.max(0, Math.min(11, bsMonth - 1));
    const bsName = NEPALI_MONTHS_EN[mIdx];
    const bsNe = NEPALI_MONTHS_NE[mIdx];
    try {
      const range = getBsMonthRange(bsYear, bsMonth);
      const startStr = `${range.startDate.getDate()} ${range.startDate.toLocaleString("default", { month: "short" })}`;
      const endStr = `${range.endDate.getDate()} ${range.endDate.toLocaleString("default", { month: "short" })} ${range.endDate.getFullYear()}`;
      previewText = `Nepali BS: ${bsName} (${bsNe}) ${bsYear} BS | AD: ${startStr} – ${endStr} AD`;
    } catch {
      previewText = `Nepali BS: ${bsName} ${bsYear} BS`;
    }
  } else {
    const d = new Date(adYear, adMonth - 1, 15);
    const adName = d.toLocaleString("default", { month: "long" });
    try {
      const bs = adToBs(d);
      previewText = `English AD: ${adName} ${adYear} AD | BS: ${bs.monthName} (${bs.monthNameNe}) ${bs.year} BS`;
    } catch {
      previewText = `English AD: ${adName} ${adYear} AD`;
    }
  }

  const quickPills = useMemo(() => {
    const cy = currentBs.year;
    const cm = currentBs.month;
    const pills = [];
    for (let offset = 0; offset < 6; offset++) {
      let m = cm - offset;
      let y = cy;
      while (m < 1) {
        m += 12;
        y -= 1;
      }
      const key = `${y}-${String(m).padStart(2, "0")}`;
      const name = NEPALI_MONTHS_EN[m - 1];
      const ne = NEPALI_MONTHS_NE[m - 1];
      pills.push({ key, label: `${name} ${y}`, sub: ne, y, m });
    }
    return pills;
  }, [currentBs]);

  const bsYears = getNepaliYearList(2075, 2090);
  const adYears = Array.from({ length: 16 }, (_, i) => 2020 + i);

  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 8, padding: 12, marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Calendar size={14} color="var(--brand)" />
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>Billing Month (Dual BS &amp; AD System)</span>
        </div>
        <div className="date-mode-toggle" style={{ margin: 0 }}>
          <button
            type="button"
            className={`date-mode-btn ${calendarMode === "BS" ? "active" : ""}`}
            onClick={() => {
              setCalendarMode("BS");
              handleBsUpdate(bsYear, bsMonth);
            }}
          >
            Nepali (BS)
          </button>
          <button
            type="button"
            className={`date-mode-btn ${calendarMode === "AD" ? "active" : ""}`}
            onClick={() => {
              setCalendarMode("AD");
              handleAdUpdate(adYear, adMonth);
            }}
          >
            English (AD)
          </button>
        </div>
      </div>

      {calendarMode === "BS" ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 8, marginBottom: 8 }}>
          <div>
            <label style={{ fontSize: 10, color: "var(--text-muted)", display: "block", marginBottom: 3, fontWeight: 600 }}>BS YEAR</label>
            <select
              value={bsYear}
              onChange={(e) => handleBsUpdate(Number(e.target.value), bsMonth)}
              style={{ width: "100%", padding: "6px 8px", borderRadius: 6, border: "1px solid var(--line)", background: "var(--background)", color: "var(--text)", fontSize: 12 }}
            >
              {bsYears.map((y) => (
                <option key={y} value={y}>{y} BS</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 10, color: "var(--text-muted)", display: "block", marginBottom: 3, fontWeight: 600 }}>BS NEPALI MONTH</label>
            <select
              value={bsMonth}
              onChange={(e) => handleBsUpdate(bsYear, Number(e.target.value))}
              style={{ width: "100%", padding: "6px 8px", borderRadius: 6, border: "1px solid var(--line)", background: "var(--background)", color: "var(--text)", fontSize: 12 }}
            >
              {NEPALI_MONTHS_EN.map((mName, idx) => (
                <option key={mName} value={idx + 1}>
                  {idx + 1}. {mName} ({NEPALI_MONTHS_NE[idx]})
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 8, marginBottom: 8 }}>
          <div>
            <label style={{ fontSize: 10, color: "var(--text-muted)", display: "block", marginBottom: 3, fontWeight: 600 }}>AD YEAR</label>
            <select
              value={adYear}
              onChange={(e) => handleAdUpdate(Number(e.target.value), adMonth)}
              style={{ width: "100%", padding: "6px 8px", borderRadius: 6, border: "1px solid var(--line)", background: "var(--background)", color: "var(--text)", fontSize: 12 }}
            >
              {adYears.map((y) => (
                <option key={y} value={y}>{y} AD</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 10, color: "var(--text-muted)", display: "block", marginBottom: 3, fontWeight: 600 }}>AD MONTH</label>
            <select
              value={adMonth}
              onChange={(e) => handleAdUpdate(adYear, Number(e.target.value))}
              style={{ width: "100%", padding: "6px 8px", borderRadius: 6, border: "1px solid var(--line)", background: "var(--background)", color: "var(--text)", fontSize: 12 }}
            >
              {["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map((name, i) => (
                <option key={name} value={i + 1}>
                  {i + 1}. {name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Live Dual Synchronization Banner */}
      <div style={{ fontSize: 11, color: "var(--brand)", background: "var(--brand-soft)", padding: "5px 10px", borderRadius: 6, marginBottom: 8, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
        <Clock size={12} />
        <span>{previewText}</span>
      </div>

      {/* Quick Picks for Nepali Months */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <span style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>Quick Pick:</span>
        {quickPills.map((pill) => {
          const isActive = calendarMode === "BS" && bsYear === pill.y && bsMonth === pill.m;
          return (
            <button
              key={pill.key}
              type="button"
              onClick={() => {
                setCalendarMode("BS");
                handleBsUpdate(pill.y, pill.m);
              }}
              style={{
                fontSize: 10.5,
                padding: "2px 7px",
                borderRadius: 4,
                border: isActive ? "1px solid var(--brand)" : "1px solid var(--line)",
                background: isActive ? "var(--brand)" : "var(--background)",
                color: isActive ? "#ffffff" : "var(--text)",
                cursor: "pointer",
                fontWeight: isActive ? 700 : 500,
              }}
            >
              {pill.label} ({pill.sub})
            </button>
          );
        })}
      </div>

      <input type="hidden" name={name} value={value} required />
    </div>
  );
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

  const defaultBsMonthKey = useMemo(() => {
    try {
      const bs = adToBs(new Date());
      return `${bs.year}-${String(bs.month).padStart(2, "0")}`;
    } catch {
      return "2083-07";
    }
  }, []);

  const [selectedBillingMonth, setSelectedBillingMonth] = useState<string>(defaultBsMonthKey);

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
            <button
              type="button"
              onClick={() => setShowPaymentForm((value) => !value)}
              className="success-btn"
              style={{ padding: "6px 12px", fontSize: 12 }}
            >
              <ReceiptText size={13} /> {showPaymentForm ? "Close Payment Form" : "Record Rent / Utility Payment"}
            </button>
          )}
          <button
            type="button"
            onClick={handleOpenCreate}
            className="primary-btn"
            style={{ padding: "6px 12px", fontSize: 12 }}
          >
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
              <strong style={{ color: String(color), fontSize: 17 }}>
                {currency} {Number(value).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </strong>
            </div>
          ))}
        </div>
      )}

      {showPaymentForm && activeHouse && (
        <form
          action={async (formData) => {
            setShowPaymentForm(false);
            await recordRentalPaymentAction(formData);
          }}
          style={{ background: "var(--soft)", border: "1px solid var(--line)", borderRadius: 8, padding: 16, marginBottom: 16 }}
        >
          <input type="hidden" name="orgId" value={orgId} />
          <div style={{ marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <strong style={{ fontSize: 14, color: "var(--text)" }}>Record Rent &amp; Utility Payment (Dual BS / AD Supported)</strong>
            <button type="button" onClick={() => setShowPaymentForm(false)} className="ghost-btn" style={{ fontSize: 11, padding: "2px 6px" }}>
              <X size={14} /> Close
            </button>
          </div>

          <div className="form-grid">
            <label className="field full">
              Premises
              <select name="rentalHouseId" defaultValue={activeHouse.id}>
                {rentalHouses.map((house) => (
                  <option key={house.id} value={house.id}>
                    {house.title} - {house.ownerName}
                  </option>
                ))}
              </select>
            </label>

            <div className="field full">
              <DualBillingMonthPicker
                value={selectedBillingMonth}
                onChange={setSelectedBillingMonth}
                name="billingMonth"
              />
            </div>

            <div className="field">
              <NepaliDatePicker
                name="dueDate"
                label="Bill Due Date (Nepali BS / English AD)"
              />
            </div>

            <div className="field">
              <NepaliDatePicker
                name="paidAt"
                label="Payment Date / Paid At (BS / AD)"
                defaultValue={new Date()}
                required
              />
            </div>

            <label className="field">
              Rent ({currency})
              <input name="rentAmount" type="number" min="0" step="0.01" defaultValue={Number(activeHouse.monthlyRent)} />
            </label>

            <label className="field">
              Electricity ({currency})
              <input name="electricityAmount" type="number" min="0" step="0.01" defaultValue="0" />
            </label>

            <label className="field">
              Water / CAM ({currency})
              <input name="waterAmount" type="number" min="0" step="0.01" defaultValue={Number(activeHouse.waterGarbageFee)} />
            </label>

            <label className="field">
              Other Charges ({currency})
              <input name="otherAmount" type="number" min="0" step="0.01" defaultValue="0" />
            </label>

            <label className="field">
              Amount Paid Now ({currency})
              <input name="paidAmount" type="number" min="0" step="0.01" defaultValue="0" placeholder="0.00 (Enter 0 for UNPAID)" />
              <span style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 2 }}>
                Enter 0.00 to record this month as an <strong>UNPAID</strong> bill for statement tracking.
              </span>
            </label>

            <label className="field">
              Payment Method
              <select name="paymentMethod">
                <option value="CASH">Cash in Hand</option>
                <option value="BANK">Bank / Digital Wallet / Card</option>
                <option value="OTHER">Other Method</option>
              </select>
            </label>

            <label className="field full">
              Payment Account (when Bank / Wallet / Card)
              <select name="bankAccountId">
                <option value="">Select financial account</option>
                {paymentAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              Reference / Receipt No
              <input name="reference" placeholder="e.g. Receipt #104, Cheque 0824, eSewa Ref" />
            </label>

            <label className="field">
              Notes
              <input name="notes" placeholder="e.g. Cleared full rent, electricity meter units..." />
            </label>
          </div>

          <div className="form-actions" style={{ marginTop: 12 }}>
            <button type="button" className="secondary-btn" onClick={() => setShowPaymentForm(false)}>
              Cancel
            </button>
            <button className="success-btn" type="submit">
              Save Bill / Payment
            </button>
          </div>
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
              <div style={{ marginTop: 14, borderTop: "1px solid var(--line)", paddingTop: 12 }}>
                <div
                  style={{
                    fontSize: 10.5,
                    fontWeight: 800,
                    color: "var(--text-muted)",
                    textTransform: "uppercase",
                    marginBottom: 8,
                    letterSpacing: "0.04em",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <Clock size={12} />
                  <span>Rent &amp; Utility Billing History (Dual BS / AD Reconciliation)</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {h.bills.slice(0, 16).map((bill) => {
                    const paid = bill.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
                    const due = Math.max(0, Number(bill.totalAmount) - paid);
                    const dualMonth = formatDualBillingMonth(bill.billingMonth);
                    return (
                      <details
                        key={bill.id}
                        className="rental-bill-details"
                        style={{
                          background: "var(--soft)",
                          border: "1px solid var(--line)",
                          borderRadius: 8,
                          padding: "8px 12px",
                          breakInside: "avoid",
                          pageBreakInside: "avoid",
                        }}
                      >
                        <summary
                          style={{
                            cursor: "pointer",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: 12,
                            flexWrap: "wrap",
                            fontSize: 12,
                            breakInside: "avoid",
                            pageBreakInside: "avoid",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontWeight: 700, color: "var(--brand)", fontSize: 13 }}>
                              {dualMonth.primary}
                            </span>
                            {dualMonth.secondary && (
                              <span
                                style={{
                                  fontSize: 11,
                                  color: "var(--text-muted)",
                                  background: "var(--surface)",
                                  border: "1px solid var(--line)",
                                  padding: "1px 6px",
                                  borderRadius: 4,
                                }}
                              >
                                {dualMonth.secondary}
                              </span>
                            )}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 11.5 }}>
                            <span>
                              Bill: <strong>{currency} {Number(bill.totalAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
                            </span>
                            <span>
                              · Paid: <strong style={{ color: "var(--success)" }}>{currency} {paid.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
                            </span>
                            <span>
                              · Due: <strong style={{ color: due > 0 ? "var(--red)" : "var(--success)" }}>{currency} {due.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
                            </span>
                          </div>
                        </summary>

                        <div style={{ fontSize: 11.5, marginTop: 10, paddingTop: 8, borderTop: "1px dashed var(--line)", color: "var(--text)" }}>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 8, color: "var(--text-muted)" }}>
                            <span>Rent: <strong>{currency} {Number(bill.rentAmount).toLocaleString()}</strong></span>
                            <span>Electricity: <strong>{currency} {Number(bill.electricityAmount).toLocaleString()}</strong></span>
                            <span>Water/CAM: <strong>{currency} {Number(bill.waterAmount).toLocaleString()}</strong></span>
                            {Number(bill.otherAmount) > 0 && <span>Other: <strong>{currency} {Number(bill.otherAmount).toLocaleString()}</strong></span>}
                            {bill.dueDate && (
                              <span style={{ marginLeft: "auto", color: "var(--brand)" }}>
                                Due Date: <strong>{formatDualDate(bill.dueDate)}</strong>
                              </span>
                            )}
                          </div>
                          {bill.notes && (
                            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8, fontStyle: "italic" }}>
                              Note: {bill.notes}
                            </div>
                          )}

                          <div style={{ borderTop: "1px solid var(--line)", paddingTop: 8, marginTop: 4 }}>
                            <strong style={{ fontSize: 10.5, color: "var(--text-muted)", textTransform: "uppercase" }}>
                              Actual Payment Records:
                            </strong>
                            {bill.payments.length === 0 ? (
                              <div style={{ fontSize: 11, color: "var(--red)", marginTop: 4 }}>
                                No payments recorded yet for this bill.
                              </div>
                            ) : (
                              <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 4 }}>
                                {bill.payments.map((payment) => (
                                  <div
                                    key={payment.id}
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 8,
                                      fontSize: 11,
                                      background: "var(--surface)",
                                      padding: "5px 8px",
                                      borderRadius: 4,
                                      border: "1px solid var(--line)",
                                      flexWrap: "wrap",
                                    }}
                                  >
                                    <CheckCircle2 size={13} color="var(--success)" style={{ flexShrink: 0 }} />
                                    <span style={{ fontWeight: 650, color: "var(--success)" }}>
                                      {currency} {Number(payment.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </span>
                                    <span style={{ color: "var(--text-muted)" }}>on</span>
                                    <span style={{ fontWeight: 600, color: "var(--brand)" }}>
                                      {formatDualDate(payment.paidAt)}
                                    </span>
                                    <span style={{ color: "var(--text-muted)" }}>via {payment.paymentMethod}</span>
                                    {payment.reference && (
                                      <span style={{ color: "var(--text-muted)" }}>
                                        · Ref: <code>{payment.reference}</code>
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
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
