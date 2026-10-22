"use client";

import { useMemo, useState, useTransition } from "react";
import {
  CheckCircle2,
  X,
  ReceiptText,
  Calendar,
  Clock,
  Sparkles,
  Layers,
  ArrowDownCircle,
  PlusCircle,
  Check,
  AlertTriangle,
  CreditCard,
  Building2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  saveRentalHouseAction,
  setActiveRentalHouseAction,
  deleteRentalHouseAction,
  recordRentalPaymentAction,
  recordLumpSumRentPaymentAction,
  batchGenerateRentalBillsAction,
} from "@/app/(dashboard)/actions";
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
      return { year: 2083, month: 7, day: 1 };
    }
  }, []);

  const [calendarMode, setCalendarMode] = useState<"BS" | "AD">("BS");
  const parsed = useMemo(() => {
    const parts = (value || "").split("-").map(Number);
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      return { y: parts[0], m: parts[1] };
    }
    return { y: currentBs.year, m: currentBs.month };
  }, [value, currentBs]);

  const [bsYear, setBsYear] = useState<number>(parsed.y >= 2070 ? parsed.y : currentBs.year);
  const [bsMonth, setBsMonth] = useState<number>(parsed.y >= 2070 ? parsed.m : currentBs.month);
  const [adYear, setAdYear] = useState<number>(parsed.y < 2070 ? parsed.y : new Date().getFullYear());
  const [adMonth, setAdMonth] = useState<number>(parsed.y < 2070 ? parsed.m : new Date().getMonth() + 1);

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
    <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--radius-sm)", padding: 12, marginBottom: 12 }}>
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
              style={{ width: "100%", padding: "5px 8px", borderRadius: "var(--radius-sm)", border: "1px solid var(--line)", background: "var(--surface)", color: "var(--text)", fontSize: 12 }}
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
              style={{ width: "100%", padding: "5px 8px", borderRadius: "var(--radius-sm)", border: "1px solid var(--line)", background: "var(--surface)", color: "var(--text)", fontSize: 12 }}
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
              style={{ width: "100%", padding: "5px 8px", borderRadius: "var(--radius-sm)", border: "1px solid var(--line)", background: "var(--surface)", color: "var(--text)", fontSize: 12 }}
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
              style={{ width: "100%", padding: "5px 8px", borderRadius: "var(--radius-sm)", border: "1px solid var(--line)", background: "var(--surface)", color: "var(--text)", fontSize: 12 }}
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
      <div style={{ fontSize: 11, color: "var(--brand)", background: "var(--brand-soft)", padding: "4px 8px", borderRadius: 4, marginBottom: 8, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
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
                background: isActive ? "var(--brand)" : "var(--surface)",
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

  // Dialog states
  const [showSingleBillForm, setShowSingleBillForm] = useState(false);
  const [showLumpSumModal, setShowLumpSumModal] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"ALL" | "DUE" | "PAID">("ALL");
  const [expandedBillId, setExpandedBillId] = useState<string | null>(null);

  // Lump sum calculation state
  const [lumpSumAmount, setLumpSumAmount] = useState<number>(30000);

  // Batch generator state
  const currentBsYear = 2083;
  const [batchYear, setBatchYear] = useState<number>(currentBsYear);
  const [batchMonths, setBatchMonths] = useState<number[]>([1, 2, 3, 4, 5]);

  const activeHouse = rentalHouses.find((house) => house.isActive) || rentalHouses[0];
  const allBills = useMemo(() => {
    return rentalHouses.flatMap((house) => house.bills).sort((a, b) => b.billingMonth.localeCompare(a.billingMonth));
  }, [rentalHouses]);

  const totalBilled = allBills.reduce((sum, bill) => sum + Number(bill.totalAmount), 0);
  const totalPaid = allBills.reduce(
    (sum, bill) => sum + bill.payments.reduce((pSum, p) => pSum + Number(p.amount), 0),
    0
  );
  const totalDue = Math.max(0, totalBilled - totalPaid);

  const unpaidBillsCount = allBills.filter((b) => {
    const paid = b.payments.reduce((sum, p) => sum + Number(p.amount), 0);
    return Number(b.totalAmount) - paid > 0;
  }).length;

  const defaultBsMonthKey = useMemo(() => {
    try {
      const bs = adToBs(new Date());
      return `${bs.year}-${String(bs.month).padStart(2, "0")}`;
    } catch {
      return "2083-07";
    }
  }, []);

  const [selectedBillingMonth, setSelectedBillingMonth] = useState<string>(defaultBsMonthKey);

  // Lump sum breakdown simulation preview
  const lumpSumBreakdown = useMemo(() => {
    if (!activeHouse || lumpSumAmount <= 0) return { settled: [], partial: null, remainingDues: 0 };
    let rem = lumpSumAmount;
    const settled: { month: string; amount: number }[] = [];
    let partial: { month: string; paid: number; dueRemaining: number } | null = null;

    const billsChronological = [...activeHouse.bills].sort((a, b) => a.billingMonth.localeCompare(b.billingMonth));
    for (const b of billsChronological) {
      if (rem <= 0) break;
      const bTotal = Number(b.totalAmount);
      const bPaid = b.payments.reduce((s, p) => s + Number(p.amount), 0);
      const due = Math.max(0, bTotal - bPaid);
      if (due <= 0) continue;

      if (rem >= due) {
        settled.push({ month: b.billingMonth, amount: due });
        rem -= due;
      } else {
        partial = { month: b.billingMonth, paid: rem, dueRemaining: due - rem };
        rem = 0;
      }
    }
    const currentUnpaidTotal = billsChronological.reduce((sum, b) => {
      const p = b.payments.reduce((s, x) => s + Number(x.amount), 0);
      return sum + Math.max(0, Number(b.totalAmount) - p);
    }, 0);
    const remainingDues = Math.max(0, currentUnpaidTotal - lumpSumAmount);

    return { settled, partial, remainingDues };
  }, [activeHouse, lumpSumAmount]);

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

  const filteredBills = allBills.filter((bill) => {
    const paid = bill.payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const due = Math.max(0, Number(bill.totalAmount) - paid);
    if (statusFilter === "DUE") return due > 0;
    if (statusFilter === "PAID") return due <= 0;
    return true;
  });

  return (
    <div style={{ marginTop: 24, marginBottom: 20 }}>
      {/* Header View */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 14,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <span className="page-eyebrow">
            {isCompany ? "PREMISES & FACILITY MANAGEMENT" : "HOUSEHOLD RENT & COMMITMENT LEDGER"}
          </span>
          <h3 style={{ margin: "2px 0 0", fontSize: 16, fontWeight: 700, color: "var(--text)" }}>
            {isCompany ? "Office Lease & Premises Statement" : "House Owner & Tenancy Statement"}
          </h3>
          <p style={{ margin: "3px 0 0", fontSize: 12, color: "var(--text-muted)" }}>
            Multi-month rent statement, automatic FIFO payment allocation, dual BS/AD accounting, and liability tracking.
          </p>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {activeHouse && (
            <>
              {/* Batch Generate Months */}
              <button
                type="button"
                onClick={() => setShowBatchModal(true)}
                className="secondary-btn"
                title="Auto-insert multi-month commitments into the statement"
              >
                <Layers size={13} /> Auto-Generate Months (BS)
              </button>

              {/* Record Lump Sum Payment */}
              <button
                type="button"
                onClick={() => {
                  setLumpSumAmount(Number(activeHouse.monthlyRent) * 2 || 30000);
                  setShowLumpSumModal(true);
                }}
                className="primary-btn"
                title="Pay arbitrary lump-sum (e.g. NPR 30,000 or 70,000) and auto-allocate across oldest unpaid months"
              >
                <ArrowDownCircle size={13} /> Record Lump-Sum Rent Payment
              </button>

              {/* Single Month Entry */}
              <button
                type="button"
                onClick={() => setShowSingleBillForm((v) => !v)}
                className="secondary-btn"
              >
                <ReceiptText size={13} /> {showSingleBillForm ? "Close Form" : "Single Month Bill"}
              </button>
            </>
          )}

          <button
            type="button"
            onClick={handleOpenCreate}
            className="secondary-btn"
          >
            {isCompany ? "+ Register Office Lease" : "+ Register Rental House"}
          </button>
        </div>
      </div>

      {/* KPI Highlight Strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10, marginBottom: 16 }}>
        <div className="kpi-card" style={{ padding: "12px 16px" }}>
          <div className="kpi-top">
            <span>Total Accrued Bills</span>
            <Building2 size={15} color="var(--text-muted)" />
          </div>
          <div className="kpi-value">
            {currency} {totalBilled.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div className="kpi-meta">{allBills.length} recorded billing periods</div>
        </div>

        <div className="kpi-card" style={{ padding: "12px 16px" }}>
          <div className="kpi-top">
            <span>Total Paid to Landlord</span>
            <CheckCircle2 size={15} color="var(--success)" />
          </div>
          <div className="kpi-value" style={{ color: "var(--success)" }}>
            {currency} {totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div className="kpi-meta">Actual disbursements disbursed</div>
        </div>

        <div className="kpi-card" style={{ padding: "12px 16px", borderColor: totalDue > 0 ? "var(--danger-border)" : "var(--line)" }}>
          <div className="kpi-top">
            <span>Remaining Unpaid Dues</span>
            <AlertTriangle size={15} color={totalDue > 0 ? "var(--danger)" : "var(--success)"} />
          </div>
          <div className="kpi-value" style={{ color: totalDue > 0 ? "var(--danger)" : "var(--success)" }}>
            {currency} {totalDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div className="kpi-meta">
            {totalDue > 0 ? `${unpaidBillsCount} unpaid/partial billing period(s) pending` : "All rent & utilities fully settled"}
          </div>
        </div>

        {activeHouse && (
          <div className="kpi-card" style={{ padding: "12px 16px" }}>
            <div className="kpi-top">
              <span>Active Residence Terms</span>
              <Sparkles size={15} color="var(--brand)" />
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, marginTop: 4, color: "var(--text)" }}>
              {activeHouse.ownerName} ({activeHouse.title})
            </div>
            <div className="kpi-meta">
              Rent: {currency} {Number(activeHouse.monthlyRent).toLocaleString()} · Elec: {currency} {Number(activeHouse.electricityRate)}/u
            </div>
          </div>
        )}
      </div>

      {/* Single Month Form */}
      {showSingleBillForm && activeHouse && (
        <form
          action={async (formData) => {
            setShowSingleBillForm(false);
            await recordRentalPaymentAction(formData);
          }}
          className="table-card"
          style={{ padding: 16, marginBottom: 16, background: "var(--soft)" }}
        >
          <input type="hidden" name="orgId" value={orgId} />
          <div style={{ marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <strong style={{ fontSize: 13.5, color: "var(--text)" }}>Record Single Month Bill / Payment</strong>
            <button type="button" onClick={() => setShowSingleBillForm(false)} className="secondary-btn" style={{ height: 26, padding: "2px 6px" }}>
              <X size={13} /> Close
            </button>
          </div>

          <div className="form-grid">
            <label className="field full">
              <span className="field-label">Premises</span>
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
                label="Bill Due Date (BS / AD)"
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
              <span className="field-label">Rent ({currency})</span>
              <input name="rentAmount" type="number" min="0" step="0.01" defaultValue={Number(activeHouse.monthlyRent)} />
            </label>

            <label className="field">
              <span className="field-label">Electricity ({currency})</span>
              <input name="electricityAmount" type="number" min="0" step="0.01" defaultValue="0" />
            </label>

            <label className="field">
              <span className="field-label">Water &amp; Waste ({currency})</span>
              <input name="waterAmount" type="number" min="0" step="0.01" defaultValue={Number(activeHouse.waterGarbageFee)} />
            </label>

            <label className="field">
              <span className="field-label">Other Charges ({currency})</span>
              <input name="otherAmount" type="number" min="0" step="0.01" defaultValue="0" />
            </label>

            <label className="field">
              <span className="field-label">Amount Paid Now ({currency})</span>
              <input name="paidAmount" type="number" min="0" step="0.01" defaultValue="0" placeholder="0.00 for UNPAID" />
              <span style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 2 }}>
                Enter 0.00 to record this month as an <strong>UNPAID</strong> commitment (shows as dues).
              </span>
            </label>

            <label className="field">
              <span className="field-label">Payment Method</span>
              <select name="paymentMethod">
                <option value="CASH">Cash in Hand</option>
                <option value="BANK">Bank / Wallet / Transfer</option>
                <option value="OTHER">Other Method</option>
              </select>
            </label>

            <label className="field full">
              <span className="field-label">Payment Account (When Bank / Wallet)</span>
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
              <span className="field-label">Reference / Receipt No</span>
              <input name="reference" placeholder="e.g. Receipt #104, Cheque 0824" />
            </label>

            <label className="field">
              <span className="field-label">Notes</span>
              <input name="notes" placeholder="e.g. Paid in full" />
            </label>
          </div>

          <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button type="button" className="secondary-btn" onClick={() => setShowSingleBillForm(false)}>
              Cancel
            </button>
            <button className="primary-btn" type="submit">
              Save Bill / Payment
            </button>
          </div>
        </form>
      )}

      {/* Main Statement Table */}
      <div className="table-card">
        {/* Table Filter Tabs */}
        <div
          style={{
            padding: "10px 14px",
            borderBottom: "1px solid var(--line)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 10,
            background: "var(--soft)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button
              type="button"
              onClick={() => setStatusFilter("ALL")}
              className={`filter-preset-chip ${statusFilter === "ALL" ? "active" : ""}`}
            >
              All Periods ({allBills.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("DUE")}
              className={`filter-preset-chip ${statusFilter === "DUE" ? "active" : ""}`}
            >
              Unpaid Dues Only ({unpaidBillsCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("PAID")}
              className={`filter-preset-chip ${statusFilter === "PAID" ? "active" : ""}`}
            >
              Fully Settled ({allBills.length - unpaidBillsCount})
            </button>
          </div>

          <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
            Showing <b>{filteredBills.length}</b> statement entries
          </div>
        </div>

        <div className="table-scroll">
          <table className="responsive-table data-table" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}>Billing Month (BS / AD)</th>
                <th style={{ textAlign: "right" }}>Monthly Rent</th>
                <th style={{ textAlign: "right" }}>Electricity</th>
                <th style={{ textAlign: "right" }}>Water &amp; Waste</th>
                <th style={{ textAlign: "right" }}>Total Billed</th>
                <th style={{ textAlign: "right" }}>Amount Paid</th>
                <th style={{ textAlign: "right" }}>Remaining Due</th>
                <th style={{ textAlign: "center" }}>Status</th>
                <th style={{ textAlign: "center", width: 60 }}>Details</th>
              </tr>
            </thead>
            <tbody>
              {filteredBills.map((bill) => {
                const paid = bill.payments.reduce((sum, p) => sum + Number(p.amount), 0);
                const due = Math.max(0, Number(bill.totalAmount) - paid);
                const isPaid = due <= 0;
                const isPartial = paid > 0 && due > 0;
                const dual = formatDualBillingMonth(bill.billingMonth);
                const isExpanded = expandedBillId === bill.id;

                return (
                  <tr key={bill.id}>
                    {/* Month */}
                    <td data-label="Billing Month">
                      <div style={{ fontWeight: 700, color: "var(--text)" }}>{dual.primary}</div>
                      {dual.secondary && (
                        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>
                          {dual.secondary}
                        </div>
                      )}
                    </td>

                    {/* Rent */}
                    <td data-label="Rent" style={{ textAlign: "right", fontFamily: "Consolas, monospace" }}>
                      {currency} {Number(bill.rentAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>

                    {/* Electricity */}
                    <td data-label="Electricity" style={{ textAlign: "right", fontFamily: "Consolas, monospace" }}>
                      {currency} {Number(bill.electricityAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>

                    {/* Water */}
                    <td data-label="Water" style={{ textAlign: "right", fontFamily: "Consolas, monospace" }}>
                      {currency} {Number(bill.waterAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>

                    {/* Total Billed */}
                    <td data-label="Total Billed" style={{ textAlign: "right", fontFamily: "Consolas, monospace", fontWeight: 700 }}>
                      {currency} {Number(bill.totalAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>

                    {/* Paid */}
                    <td data-label="Amount Paid" style={{ textAlign: "right", fontFamily: "Consolas, monospace", fontWeight: 700, color: "var(--success)" }}>
                      {currency} {paid.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>

                    {/* Due */}
                    <td data-label="Remaining Due" style={{ textAlign: "right", fontFamily: "Consolas, monospace", fontWeight: 800, color: due > 0 ? "var(--danger)" : "var(--success)" }}>
                      {currency} {due.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>

                    {/* Status Badge */}
                    <td data-label="Status" style={{ textAlign: "center" }}>
                      <span
                        className={`badge ${
                          isPaid
                            ? "badge-active"
                            : isPartial
                            ? "badge-pending"
                            : "badge-cancelled"
                        }`}
                        style={{ fontSize: "11px" }}
                      >
                        {isPaid ? "PAID" : isPartial ? "PARTIAL" : "UNPAID"}
                      </span>
                    </td>

                    {/* Details Action */}
                    <td data-label="Details" style={{ textAlign: "center" }}>
                      <button
                        type="button"
                        onClick={() => setExpandedBillId(isExpanded ? null : bill.id)}
                        className="secondary-btn"
                        style={{ minHeight: 26, height: 26, padding: "2px 6px", fontSize: 11 }}
                        title="Toggle payment audit details"
                      >
                        {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                      </button>
                    </td>
                  </tr>
                );
              })}

              {!filteredBills.length && (
                <tr>
                  <td colSpan={9} style={{ padding: "30px 16px", textAlign: "center", color: "var(--text-muted)" }}>
                    <ReceiptText size={24} color="var(--text-muted)" style={{ margin: "0 auto 8px" }} />
                    <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text)" }}>No rental bills recorded yet</div>
                    <div style={{ fontSize: 12, marginTop: 4 }}>
                      Click "Auto-Generate Months (BS)" or "Single Month Bill" to populate the statement.
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* LUMP SUM RENT PAYMENT / FIFO ALLOCATION MODAL                            */}
      {/* ========================================================================= */}
      {showLumpSumModal && activeHouse && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(4px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setShowLumpSumModal(false)}
        >
          <div
            className="table-card"
            style={{
              width: "100%",
              maxWidth: 520,
              padding: 0,
              boxShadow: "var(--modal-shadow)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <form
              action={async (formData) => {
                setShowLumpSumModal(false);
                await recordLumpSumRentPaymentAction(formData);
              }}
            >
              <input type="hidden" name="orgId" value={orgId} />
              <input type="hidden" name="rentalHouseId" value={activeHouse.id} />

              <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--line)", background: "var(--soft)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "var(--text)" }}>
                    Record Lump-Sum Rent Payment
                  </h3>
                  <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 2 }}>
                    Pays {activeHouse.ownerName} &amp; automatically distributes across oldest unpaid months (FIFO).
                  </div>
                </div>
                <button type="button" onClick={() => setShowLumpSumModal(false)} style={{ color: "var(--text-muted)" }}>
                  <X size={16} />
                </button>
              </div>

              <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
                {/* Outstanding Dues Summary */}
                <div style={{ padding: "10px 14px", borderRadius: "var(--radius-sm)", background: "var(--danger-soft)", border: "1px solid var(--danger-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "var(--danger)", textTransform: "uppercase" }}>Current Unpaid Dues</span>
                    <div style={{ fontSize: 16, fontWeight: 800, color: "var(--danger)" }}>
                      {currency} {totalDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--text)", textAlign: "right" }}>
                    Monthly Rent: <b>{currency} {Number(activeHouse.monthlyRent).toLocaleString()}</b>
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: 11.5, fontWeight: 650, color: "var(--text)", display: "block", marginBottom: 4 }}>
                    Lump-Sum Amount to Pay ({currency}) *
                  </label>
                  <input
                    type="number"
                    name="paidAmount"
                    required
                    min={1}
                    step="0.01"
                    value={lumpSumAmount}
                    onChange={(e) => setLumpSumAmount(Number(e.target.value))}
                    style={{
                      width: "100%",
                      height: 34,
                      borderRadius: "var(--radius-sm)",
                      border: "1px solid var(--line)",
                      background: "var(--surface)",
                      color: "var(--text)",
                      padding: "0 10px",
                      fontSize: 14,
                      fontWeight: 700,
                      fontFamily: "Consolas, monospace",
                    }}
                  />
                  {/* Quick Preset Buttons */}
                  <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                    {[16800, 30000, 50000, 70000, 84000].map((amt) => (
                      <button
                        type="button"
                        key={amt}
                        onClick={() => setLumpSumAmount(amt)}
                        className="secondary-btn"
                        style={{ height: 24, fontSize: 10.5, padding: "0 6px" }}
                      >
                        {amt.toLocaleString()}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Live Distribution Simulation Preview */}
                <div style={{ padding: "10px 12px", borderRadius: "var(--radius-sm)", background: "var(--soft)", border: "1px solid var(--line)", fontSize: 12 }}>
                  <div style={{ fontWeight: 700, color: "var(--brand)", marginBottom: 4, display: "flex", alignItems: "center", gap: 5 }}>
                    <Sparkles size={13} />
                    <span>Auto-Allocation Simulation:</span>
                  </div>
                  {lumpSumBreakdown.settled.length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <div style={{ color: "var(--success)", fontWeight: 650 }}>
                        ✓ {lumpSumBreakdown.settled.length} month(s) fully settled: {lumpSumBreakdown.settled.map((s) => s.month).join(", ")}
                      </div>
                      {lumpSumBreakdown.partial && (
                        <div style={{ color: "var(--warning)", fontWeight: 650 }}>
                          ◐ Partial allocation: {lumpSumBreakdown.partial.month} gets {currency} {lumpSumBreakdown.partial.paid.toLocaleString()}, leaving {currency} {lumpSumBreakdown.partial.dueRemaining.toLocaleString()} remaining due.
                        </div>
                      )}
                      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                        New remaining dues to landlord after payment: <b>{currency} {lumpSumBreakdown.remainingDues.toLocaleString()}</b>
                      </div>
                    </div>
                  ) : (
                    <div style={{ color: "var(--text-muted)" }}>
                      Payment will be credited against pending monthly commitments.
                    </div>
                  )}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 11.5, fontWeight: 650, color: "var(--text)", display: "block", marginBottom: 4 }}>
                      Payment Source *
                    </label>
                    <select
                      name="paymentMethod"
                      style={{
                        width: "100%",
                        height: 32,
                        borderRadius: "var(--radius-sm)",
                        border: "1px solid var(--line)",
                        background: "var(--surface)",
                        color: "var(--text)",
                        fontSize: 12,
                      }}
                    >
                      <option value="CASH">Physical Cash in Hand</option>
                      <option value="BANK">Bank / Wallet Account</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: 11.5, fontWeight: 650, color: "var(--text)", display: "block", marginBottom: 4 }}>
                      Account (When Bank / Wallet)
                    </label>
                    <select
                      name="bankAccountId"
                      style={{
                        width: "100%",
                        height: 32,
                        borderRadius: "var(--radius-sm)",
                        border: "1px solid var(--line)",
                        background: "var(--surface)",
                        color: "var(--text)",
                        fontSize: 12,
                      }}
                    >
                      <option value="">Select account</option>
                      {paymentAccounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <NepaliDatePicker
                    name="paidAt"
                    label="Payment Date (Nepali BS / English AD) *"
                    defaultValue={new Date()}
                    required
                  />
                </div>

                <div>
                  <label style={{ fontSize: 11.5, fontWeight: 650, color: "var(--text)", display: "block", marginBottom: 4 }}>
                    Reference / Notes (Optional)
                  </label>
                  <input
                    type="text"
                    name="reference"
                    placeholder="e.g. Paid in cash to landlord / Receipt given"
                    style={{
                      width: "100%",
                      height: 32,
                      borderRadius: "var(--radius-sm)",
                      border: "1px solid var(--line)",
                      background: "var(--surface)",
                      color: "var(--text)",
                      padding: "0 10px",
                      fontSize: 12,
                    }}
                  />
                </div>
              </div>

              <div style={{ padding: "12px 20px", borderTop: "1px solid var(--line)", background: "var(--soft)", display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button type="button" onClick={() => setShowLumpSumModal(false)} className="secondary-btn">
                  Cancel
                </button>
                <button type="submit" className="primary-btn">
                  Disburse &amp; Clear Rent Dues
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* BATCH GENERATE RECURRING MONTHS (BS) MODAL                                */}
      {/* ========================================================================= */}
      {showBatchModal && activeHouse && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(4px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setShowBatchModal(false)}
        >
          <div
            className="table-card"
            style={{
              width: "100%",
              maxWidth: 480,
              padding: 0,
              boxShadow: "var(--modal-shadow)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <form
              action={async (formData) => {
                const monthKeys = batchMonths.map((m) => `${batchYear}-${String(m).padStart(2, "0")}`);
                formData.set("months", JSON.stringify(monthKeys));
                setShowBatchModal(false);
                await batchGenerateRentalBillsAction(formData);
              }}
            >
              <input type="hidden" name="orgId" value={orgId} />
              <input type="hidden" name="rentalHouseId" value={activeHouse.id} />

              <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--line)", background: "var(--soft)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "var(--text)" }}>
                    Auto-Generate Recurring Rent Months
                  </h3>
                  <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 2 }}>
                    Quickly batch insert unpaid rent commitments across Nepali BS months.
                  </div>
                </div>
                <button type="button" onClick={() => setShowBatchModal(false)} style={{ color: "var(--text-muted)" }}>
                  <X size={16} />
                </button>
              </div>

              <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={{ fontSize: 11.5, fontWeight: 650, color: "var(--text)", display: "block", marginBottom: 4 }}>
                    Select BS Year
                  </label>
                  <select
                    value={batchYear}
                    onChange={(e) => setBatchYear(Number(e.target.value))}
                    style={{
                      width: "100%",
                      height: 32,
                      borderRadius: "var(--radius-sm)",
                      border: "1px solid var(--line)",
                      background: "var(--surface)",
                      color: "var(--text)",
                      fontSize: 12,
                    }}
                  >
                    {[2081, 2082, 2083, 2084, 2085].map((y) => (
                      <option key={y} value={y}>{y} BS</option>
                    ))}
                  </select>
                </div>

                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <label style={{ fontSize: 11.5, fontWeight: 650, color: "var(--text)" }}>
                      Select Months to Insert ({batchMonths.length} selected)
                    </label>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button
                        type="button"
                        onClick={() => setBatchMonths([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])}
                        className="secondary-btn"
                        style={{ height: 22, fontSize: 10, padding: "0 6px" }}
                      >
                        All 12
                      </button>
                      <button
                        type="button"
                        onClick={() => setBatchMonths([1, 2, 3, 4, 5])}
                        className="secondary-btn"
                        style={{ height: 22, fontSize: 10, padding: "0 6px" }}
                      >
                        First 5
                      </button>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
                    {NEPALI_MONTHS_EN.map((name, idx) => {
                      const mNum = idx + 1;
                      const isChecked = batchMonths.includes(mNum);
                      return (
                        <label
                          key={name}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "6px 8px",
                            borderRadius: "var(--radius-sm)",
                            border: isChecked ? "1px solid var(--brand)" : "1px solid var(--line)",
                            background: isChecked ? "var(--brand-soft)" : "var(--surface)",
                            cursor: "pointer",
                            fontSize: 11.5,
                            fontWeight: isChecked ? 700 : 500,
                            color: isChecked ? "var(--brand)" : "var(--text)",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setBatchMonths([...batchMonths, mNum].sort((a, b) => a - b));
                              } else {
                                setBatchMonths(batchMonths.filter((x) => x !== mNum));
                              }
                            }}
                            style={{ width: 14, height: 14 }}
                          />
                          <span>{mNum}. {name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 11.5, fontWeight: 650, color: "var(--text)", display: "block", marginBottom: 4 }}>
                      Monthly Rent Rate ({currency})
                    </label>
                    <input
                      type="number"
                      name="monthlyRent"
                      defaultValue={Number(activeHouse.monthlyRent)}
                      style={{
                        width: "100%",
                        height: 32,
                        borderRadius: "var(--radius-sm)",
                        border: "1px solid var(--line)",
                        background: "var(--surface)",
                        color: "var(--text)",
                        padding: "0 10px",
                        fontSize: 12,
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 11.5, fontWeight: 650, color: "var(--text)", display: "block", marginBottom: 4 }}>
                      Water &amp; Waste ({currency})
                    </label>
                    <input
                      type="number"
                      name="waterGarbageFee"
                      defaultValue={Number(activeHouse.waterGarbageFee)}
                      style={{
                        width: "100%",
                        height: 32,
                        borderRadius: "var(--radius-sm)",
                        border: "1px solid var(--line)",
                        background: "var(--surface)",
                        color: "var(--text)",
                        padding: "0 10px",
                        fontSize: 12,
                      }}
                    />
                  </div>
                </div>
              </div>

              <div style={{ padding: "12px 20px", borderTop: "1px solid var(--line)", background: "var(--soft)", display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button type="button" onClick={() => setShowBatchModal(false)} className="secondary-btn">
                  Cancel
                </button>
                <button type="submit" className="primary-btn" disabled={batchMonths.length === 0}>
                  Insert {batchMonths.length} Months into Statement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Controlled Modal Dialog for Property Edit */}
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
                <span style={{ fontSize: 13, fontWeight: 650 }}>
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
