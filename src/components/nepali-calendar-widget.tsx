"use client";

import React, { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { NepaliFunctions } from "@/lib/nepaliFunctions";
import { adToBs } from "@/lib/nepali-calendar";

export function NepaliCalendarWidget() {
  const [viewYear, setViewYear] = useState<number>(2083);
  const [viewMonth, setViewMonth] = useState<number>(6); // 1-indexed (1-12)
  const [todayDate, setTodayDate] = useState<{ year: number; month: number; day: number } | null>(null);

  useEffect(() => {
    try {
      const cur = adToBs(new Date());
      setTodayDate({ year: cur.year, month: cur.month, day: cur.day });
      setViewYear(cur.year);
      setViewMonth(cur.month);
    } catch {
      setViewYear(2083);
      setViewMonth(6);
    }
  }, []);

  const handlePrevMonth = () => {
    setViewMonth((prev) => {
      if (prev === 1) {
        setViewYear((y) => y - 1);
        return 12;
      }
      return prev - 1;
    });
  };

  const handleNextMonth = () => {
    setViewMonth((prev) => {
      if (prev === 12) {
        setViewYear((y) => y + 1);
        return 1;
      }
      return prev + 1;
    });
  };

  const daysInMonth = NepaliFunctions.GetDaysInBsMonth(viewYear, viewMonth) || 30;

  let startDayIndex = 0;
  try {
    const pad = (n: number) => String(n).padStart(2, "0");
    const bsStr = `${viewYear}-${pad(viewMonth)}-01`;
    const adDateStr = NepaliFunctions.BS2AD(bsStr, "YYYY-MM-DD", "YYYY-MM-DD");
    if (typeof adDateStr === "string") {
      const [y, m, d] = adDateStr.split("-").map(Number);
      startDayIndex = new Date(y, m - 1, d).getDay();
    }
  } catch {
    startDayIndex = 0;
  }

  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const blanksArray = Array.from({ length: startDayIndex }, (_, i) => i);

  const monthNames = NepaliFunctions.GetBsMonths();
  const nepaliMonthNames = NepaliFunctions.GetBsMonthsInUnicode();
  const weekDaysShort = ["आइत", "सोम", "मंगल", "बुध", "बिहि", "शुक्र", "शनि"];
  const years = Array.from({ length: 50 }, (_, i) => 2060 + i);

  return (
    <div className="panel" style={{ padding: "16px 18px", gap: 12 }}>
      <div className="panel-head" style={{ borderBottom: "1px solid var(--line)", paddingBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Calendar size={16} style={{ color: "var(--brand, #2563eb)" }} />
          <div>
            <h3 style={{ fontSize: 14 }}>Nepali Patro &amp; Calendar (BS)</h3>
            <span style={{ fontSize: 11 }}>Official Bikram Sambat date engine</span>
          </div>
        </div>
        {todayDate && (
          <span className="badge green" style={{ fontSize: 10, padding: "2px 6px" }}>
            Today: {todayDate.day} {monthNames[todayDate.month - 1]} {todayDate.year} BS
          </span>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {/* Navigation Controls */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <button
            type="button"
            className="ghost-btn icon-btn"
            style={{ width: 28, height: 28, padding: 0 }}
            onClick={handlePrevMonth}
            title="Previous Month"
            aria-label="Previous Month"
          >
            <ChevronLeft size={15} />
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <select
              value={viewMonth}
              onChange={(e) => setViewMonth(parseInt(e.target.value, 10))}
              style={{
                fontSize: 12,
                fontWeight: 700,
                padding: "3px 8px",
                borderRadius: "var(--radius-sm, 6px)",
                border: "1px solid var(--line)",
                background: "var(--surface)",
                color: "var(--text)",
              }}
            >
              {nepaliMonthNames.map((name: string, i: number) => (
                <option key={i} value={i + 1}>
                  {name} ({monthNames[i]})
                </option>
              ))}
            </select>

            <select
              value={viewYear}
              onChange={(e) => setViewYear(parseInt(e.target.value, 10))}
              style={{
                fontSize: 12,
                fontWeight: 700,
                padding: "3px 8px",
                borderRadius: "var(--radius-sm, 6px)",
                border: "1px solid var(--line)",
                background: "var(--surface)",
                color: "var(--text)",
              }}
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y} BS
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            className="ghost-btn icon-btn"
            style={{ width: 28, height: 28, padding: 0 }}
            onClick={handleNextMonth}
            title="Next Month"
            aria-label="Next Month"
          >
            <ChevronRight size={15} />
          </button>
        </div>

        {/* Weekday headers */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            gap: 4,
            textAlign: "center",
            fontSize: 10,
            fontWeight: 700,
            color: "var(--text-muted)",
          }}
        >
          {weekDaysShort.map((day, idx) => (
            <div
              key={idx}
              style={{
                height: 24,
                display: "grid",
                placeItems: "center",
                color: idx === 6 ? "var(--danger, #ef4444)" : "var(--text-muted)",
              }}
            >
              {day}
            </div>
          ))}
        </div>

        {/* Grid of days */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            gap: 4,
            textAlign: "center",
            fontSize: 11.5,
          }}
        >
          {blanksArray.map((_, idx) => (
            <div key={`blank-${idx}`} style={{ height: 28, display: "grid", placeItems: "center", opacity: 0.2 }}>
              ·
            </div>
          ))}
          {daysArray.map((day) => {
            const isToday =
              todayDate?.year === viewYear &&
              todayDate?.month === viewMonth &&
              todayDate?.day === day;

            return (
              <div
                key={day}
                style={{
                  height: 28,
                  display: "grid",
                  placeItems: "center",
                  borderRadius: 4,
                  fontWeight: isToday ? 800 : 500,
                  background: isToday ? "var(--brand, #2563eb)" : "var(--soft)",
                  color: isToday ? "#ffffff" : "var(--text)",
                  border: isToday ? "1px solid var(--brand)" : "1px solid var(--line)",
                  transition: "background 0.15s ease",
                }}
              >
                {day}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
