"use client";

import { useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Calendar, Check, ChevronDown, Globe, Plus, Sparkles, X } from "lucide-react";
import { FiscalYearInfo, buildFiscalYearFromStart } from "@/lib/fiscal-year";

export function FiscalYearSelector({
  availableYears,
  currentFiscalYear,
  activeCode,
}: {
  availableYears: FiscalYearInfo[];
  currentFiscalYear: FiscalYearInfo;
  activeCode: string | null; // e.g. "83-84" or null for all
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [customBsYearInput, setCustomBsYearInput] = useState<number>(
    availableYears[0] ? availableYears[0].startBsYear + 1 : currentFiscalYear.startBsYear + 1
  );

  const selectedYear = activeCode
    ? availableYears.find((y) => y.slug === activeCode || y.code === activeCode)
    : null;

  const displayLabel = selectedYear
    ? selectedYear.code
    : activeCode === "all"
    ? "All Years"
    : currentFiscalYear.code;

  const handleSelect = (slug: string | null) => {
    setOpen(false);
    setShowAddForm(false);
    // 1. Set cookie for persistence across entire site
    const cookieValue = slug || "all";
    document.cookie = `flowledger_fy=${cookieValue}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;

    // 2. Update URL query params
    const p = new URLSearchParams(searchParams.toString());
    if (slug) {
      p.set("fy", slug);
    } else {
      p.set("fy", "all");
    }
    router.push(`${pathname}?${p.toString()}`);
    router.refresh();
  };

  const handleAddNewFiscalYear = (startBsYear: number) => {
    // 1. Calculate the new fiscal year object
    const newFy = buildFiscalYearFromStart(startBsYear, false);

    // 2. Save custom start year in cookie and localStorage
    const saved = localStorage.getItem("flowledger_custom_fy") || "";
    const list = saved ? saved.split(",").map(Number).filter(Boolean) : [];
    if (!list.includes(startBsYear)) {
      list.push(startBsYear);
    }
    const val = list.join(",");
    localStorage.setItem("flowledger_custom_fy", val);
    document.cookie = `flowledger_custom_fy=${val}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;

    // 3. Immediately select this new fiscal year
    handleSelect(newFy.slug);
  };

  const previewNewFy = buildFiscalYearFromStart(customBsYearInput, false);

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="ghost-btn"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "5px 10px",
          borderRadius: "var(--radius-sm, 6px)",
          border: "1px solid var(--line, #e2e8f0)",
          background: "var(--surface, #ffffff)",
          fontSize: 11.5,
          fontWeight: 650,
          color: "var(--text, #0f172a)",
          boxShadow: "var(--shadow-sm)",
          textDecoration: "none",
        }}
        title="Fiscal Year Filter (Nepali BS Shrawan–Ashadh system & AD equivalent)"
      >
        <Calendar size={13} style={{ color: "var(--brand, #2563eb)" }} />
        <span>FY {displayLabel}</span>
        {currentFiscalYear.slug === (selectedYear?.slug || currentFiscalYear.slug) && activeCode !== "all" && (
          <span
            style={{
              fontSize: 9,
              background: "var(--success-soft, #ecfdf5)",
              color: "var(--success, #059669)",
              padding: "1px 5px",
              borderRadius: 10,
              fontWeight: 700,
            }}
          >
            ACTIVE
          </span>
        )}
        <ChevronDown size={12} style={{ opacity: 0.6 }} />
      </button>

      {open && (
        <>
          <div
            style={{ position: "fixed", inset: 0, zIndex: 998 }}
            onClick={() => {
              setOpen(false);
              setShowAddForm(false);
            }}
          />
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 5px)",
              right: 0,
              zIndex: 999,
              background: "var(--surface, #ffffff)",
              border: "1px solid var(--line, #e2e8f0)",
              borderRadius: "var(--radius, 10px)",
              boxShadow: "0 14px 30px -4px rgba(0, 0, 0, 0.18)",
              padding: "8px",
              minWidth: 320,
              maxWidth: "92vw",
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            <div
              style={{
                fontSize: 10.5,
                fontWeight: 750,
                textTransform: "uppercase",
                letterSpacing: 0.5,
                color: "var(--text-muted, #64748b)",
                padding: "6px 8px",
                borderBottom: "1px solid var(--line, #e2e8f0)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span>Nepali Fiscal System</span>
              <span style={{ fontSize: 9.5, opacity: 0.8 }}>Shrawan 1 – Ashadh End</span>
            </div>

            <div style={{ maxHeight: 320, overflowY: "auto", display: "flex", flexDirection: "column", gap: 3 }}>
              {availableYears.map((fy) => {
                const isSelected =
                  (selectedYear && selectedYear.slug === fy.slug) ||
                  (!selectedYear && activeCode !== "all" && fy.isCurrent);

                return (
                  <button
                    key={fy.slug}
                    type="button"
                    onClick={() => handleSelect(fy.slug)}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      padding: "8px 10px",
                      borderRadius: 6,
                      border: "none",
                      background: isSelected ? "var(--brand-soft, #eff6ff)" : "transparent",
                      color: isSelected ? "var(--brand, #2563eb)" : "var(--text, #0f172a)",
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "background 0.15s ease",
                      gap: 8,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 12.5,
                          fontWeight: isSelected ? 700 : 600,
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <span>
                          FY {fy.fullCode} ({fy.code})
                        </span>
                        {fy.isCurrent && (
                          <span
                            style={{
                              fontSize: 9,
                              padding: "1px 5px",
                              borderRadius: 8,
                              background: "var(--brand, #2563eb)",
                              color: "#fff",
                              fontWeight: 700,
                            }}
                          >
                            CURRENT
                          </span>
                        )}
                      </div>
                      {/* DUAL DATE: BS & AD */}
                      <div style={{ fontSize: 10.5, color: "var(--text-muted, #64748b)", marginTop: 2 }}>
                        <div>
                          <strong>BS:</strong> {fy.startDateBs} to {fy.endDateBs}
                        </div>
                        <div style={{ marginTop: 1, color: "var(--text-secondary)" }}>
                          <strong>AD:</strong> {fy.startDateAdFormatted} to {fy.endDateAdFormatted}
                        </div>
                      </div>
                    </div>
                    {isSelected && <Check size={15} style={{ flexShrink: 0, color: "var(--brand)", marginTop: 2 }} />}
                  </button>
                );
              })}
            </div>

            {/* QUICK ADD NEW FISCAL YEAR SECTION */}
            <div style={{ borderTop: "1px solid var(--line, #e2e8f0)", paddingTop: 6, marginTop: 4 }}>
              {!showAddForm ? (
                <button
                  type="button"
                  onClick={() => setShowAddForm(true)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    width: "100%",
                    padding: "6px 10px",
                    borderRadius: 6,
                    border: "1px dashed var(--line-strong, #cbd5e1)",
                    background: "var(--soft, #f8fafc)",
                    color: "var(--text, #0f172a)",
                    cursor: "pointer",
                    fontSize: 11.5,
                    fontWeight: 650,
                  }}
                >
                  <Plus size={13} style={{ color: "var(--brand, #2563eb)" }} />
                  <span>Add Next / Custom Fiscal Year</span>
                </button>
              ) : (
                <div
                  style={{
                    padding: "8px",
                    background: "var(--soft, #f8fafc)",
                    borderRadius: 6,
                    border: "1px solid var(--line, #e2e8f0)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text)" }}>Add Fiscal Year (BS)</span>
                    <button
                      type="button"
                      onClick={() => setShowAddForm(false)}
                      style={{ border: "none", background: "transparent", cursor: "pointer", padding: 2 }}
                    >
                      <X size={12} />
                    </button>
                  </div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <label style={{ fontSize: 11, color: "var(--text-muted)" }}>Start BS Year:</label>
                    <input
                      type="number"
                      value={customBsYearInput}
                      onChange={(e) => setCustomBsYearInput(Number(e.target.value))}
                      min={2070}
                      max={2120}
                      style={{
                        width: 75,
                        padding: "3px 6px",
                        fontSize: 12,
                        borderRadius: 4,
                        border: "1px solid var(--line, #cbd5e1)",
                        background: "var(--surface, #ffffff)",
                        fontWeight: 650,
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => handleAddNewFiscalYear(customBsYearInput)}
                      className="primary-btn"
                      style={{ fontSize: 11, padding: "4px 8px", minHeight: "auto" }}
                    >
                      <Sparkles size={11} /> Create &amp; Activate
                    </button>
                  </div>
                  {/* LIVE PREVIEW OF BS AND AD DATES */}
                  <div
                    style={{
                      fontSize: 10,
                      color: "var(--text-muted)",
                      background: "var(--surface)",
                      padding: "4px 6px",
                      borderRadius: 4,
                      border: "1px solid var(--line)",
                    }}
                  >
                    <div>
                      <strong>Target:</strong> {previewNewFy.label}
                    </div>
                    <div>
                      <strong>BS:</strong> {previewNewFy.startDateBs} to {previewNewFy.endDateBs}
                    </div>
                    <div>
                      <strong>AD:</strong> {previewNewFy.startDateAdFormatted} to {previewNewFy.endDateAdFormatted}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* OPTION FOR ALL FISCAL YEARS (FULL LEDGER) */}
            <div style={{ borderTop: "1px solid var(--line, #e2e8f0)", paddingTop: 4 }}>
              <button
                type="button"
                onClick={() => handleSelect(null)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  width: "100%",
                  padding: "6px 10px",
                  borderRadius: 6,
                  border: "none",
                  background: activeCode === "all" ? "var(--brand-soft, #eff6ff)" : "transparent",
                  color: activeCode === "all" ? "var(--brand, #2563eb)" : "var(--text, #0f172a)",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: activeCode === "all" ? 700 : 500,
                  textAlign: "left",
                }}
              >
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <Globe size={13} /> All Fiscal Years (Full Ledger)
                </span>
                {activeCode === "all" && <Check size={14} style={{ color: "var(--brand)" }} />}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
