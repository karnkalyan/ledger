"use client";

import { useEffect, useState } from "react";
import {
  adToBs,
  bsToAd,
  getDaysInBsMonth,
  getNepaliYearList,
  NEPALI_MONTHS_EN,
  NEPALI_MONTHS_NE,
} from "@/lib/nepali-calendar";
import { Calendar, RefreshCw } from "lucide-react";

interface NepaliDatePickerProps {
  name: string;
  defaultValue?: string | Date;
  label?: string;
  required?: boolean;
  className?: string;
  onChange?: (date: Date) => void;
}

export function NepaliDatePicker({
  name,
  defaultValue,
  label,
  required = false,
  className = "",
  onChange,
}: NepaliDatePickerProps) {
  // Initialize standard date
  const getInitialDate = (): Date => {
    if (!defaultValue) return new Date();
    const d = typeof defaultValue === "string" ? new Date(defaultValue) : defaultValue;
    return isNaN(d.getTime()) ? new Date() : d;
  };

  const [date, setDate] = useState<Date>(getInitialDate);
  const [calendarMode, setCalendarMode] = useState<"BS" | "AD">("BS");

  // BS state
  const bsObj = adToBs(date);
  const [bsYear, setBsYear] = useState<number>(bsObj.year);
  const [bsMonth, setBsMonth] = useState<number>(bsObj.month);
  const [bsDay, setBsDay] = useState<number>(bsObj.day);

  // Sync BS state when date changes
  useEffect(() => {
    const bs = adToBs(date);
    setBsYear(bs.year);
    setBsMonth(bs.month);
    setBsDay(bs.day);
  }, [date]);

  // Update date when BS year/month/day changes
  const handleBsChange = (newYear: number, newMonth: number, newDay: number) => {
    const maxDays = getDaysInBsMonth(newYear, newMonth);
    const validDay = Math.min(newDay, maxDays);
    setBsYear(newYear);
    setBsMonth(newMonth);
    setBsDay(validDay);

    const newAdDate = bsToAd(newYear, newMonth, validDay);
    setDate(newAdDate);
    onChange?.(newAdDate);
  };

  const handleAdChange = (year: number, month: number, day: number) => {
    const lastDay = new Date(year, month, 0).getDate();
    const newDate = new Date(year, month - 1, Math.min(day, lastDay), 12);
    setDate(newDate);
    onChange?.(newDate);
  };

  const adIsoString = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const maxDaysInCurrentBsMonth = getDaysInBsMonth(bsYear, bsMonth);
  const bsYears = getNepaliYearList(2070, 2095);

  return (
    <div className={`nepali-date-picker-wrap ${className}`}>
      {label && <span className="date-picker-label">{label}</span>}
      <div className="date-picker-header">
        <div className="date-mode-toggle" role="group" aria-label="Calendar format">
          <button
            type="button"
            className={`date-mode-btn ${calendarMode === "BS" ? "active" : ""}`}
            onClick={() => setCalendarMode("BS")}
          >
            <Calendar size={12} />
            Nepali (BS)
          </button>
          <button
            type="button"
            className={`date-mode-btn ${calendarMode === "AD" ? "active" : ""}`}
            onClick={() => setCalendarMode("AD")}
          >
            English (AD)
          </button>
        </div>
        <div className="date-sync-indicator">
          {calendarMode === "BS" ? (
            <span>AD: {adIsoString}</span>
          ) : (
            <span>BS: {bsObj.formatted}</span>
          )}
        </div>
      </div>

      {calendarMode === "BS" ? (
        <div className="bs-picker-grid">
          <select
            value={bsYear}
            onChange={(e) => handleBsChange(Number(e.target.value), bsMonth, bsDay)}
            className="bs-select"
            title="BS Year"
          >
            {bsYears.map((y) => (
              <option key={y} value={y}>
                {y} BS
              </option>
            ))}
          </select>

          <select
            value={bsMonth}
            onChange={(e) => handleBsChange(bsYear, Number(e.target.value), bsDay)}
            className="bs-select"
            title="BS Month"
          >
            {NEPALI_MONTHS_EN.map((mName, idx) => (
              <option key={mName} value={idx + 1}>
                {idx + 1}. {mName} ({NEPALI_MONTHS_NE[idx]})
              </option>
            ))}
          </select>

          <select
            value={bsDay}
            onChange={(e) => handleBsChange(bsYear, bsMonth, Number(e.target.value))}
            className="bs-select"
            title="BS Day"
          >
            {Array.from({ length: maxDaysInCurrentBsMonth }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>
                {String(d).padStart(2, "0")}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div className="bs-picker-grid">
          <select aria-label="AD Year" required={required} value={date.getFullYear()} onChange={(e) => handleAdChange(Number(e.target.value), date.getMonth() + 1, date.getDate())}>
            {Array.from({ length: 201 }, (_, i) => 1900 + i).map(year => <option key={year} value={year}>{year} AD</option>)}
          </select>
          <select aria-label="AD Month" required={required} value={date.getMonth() + 1} onChange={(e) => handleAdChange(date.getFullYear(), Number(e.target.value), date.getDate())}>
            {["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map((month, i) => <option key={month} value={i + 1}>{month}</option>)}
          </select>
          <select aria-label="AD Day" required={required} value={date.getDate()} onChange={(e) => handleAdChange(date.getFullYear(), date.getMonth() + 1, Number(e.target.value))}>
            {Array.from({ length: new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate() }, (_, i) => i + 1).map(day => <option key={day} value={day}>{String(day).padStart(2, "0")}</option>)}
          </select>
        </div>
      )}

      {/* Hidden input to supply standard ISO Date format to form actions */}
      <input type="hidden" name={name} value={adIsoString} required={required} />
    </div>
  );
}
