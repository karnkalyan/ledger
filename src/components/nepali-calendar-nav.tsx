"use client";

import { useState, useRef, useEffect } from "react";
import { Calendar, X } from "lucide-react";
import { NepaliCalendarWidget } from "@/components/nepali-calendar-widget";
import { adToBs } from "@/lib/nepali-calendar";
import { NepaliFunctions } from "@/lib/nepaliFunctions";

export function NepaliCalendarNav() {
  const [open, setOpen] = useState(false);
  const [bsDateStr, setBsDateStr] = useState<string>("Patro (BS)");
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const cur = adToBs(new Date());
      const monthNames = NepaliFunctions.GetBsMonths();
      const mName = monthNames[cur.month - 1] || "";
      setBsDateStr(`${cur.day} ${mName} ${cur.year} BS`);
    } catch {
      setBsDateStr("Patro (BS)");
    }
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div style={{ position: "relative" }} ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="ghost-btn"
        title="Open Nepali Patro & Calendar (BS)"
        aria-label="Open Nepali Patro & Calendar"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "4px 10px",
          borderRadius: "var(--radius-sm, 6px)",
          border: "1px solid var(--line)",
          background: open ? "var(--soft)" : "var(--surface)",
          color: "var(--text)",
          fontSize: 11.5,
          fontWeight: 650,
          cursor: "pointer",
        }}
      >
        <Calendar size={13} style={{ color: "var(--brand, #2563eb)" }} />
        <span>{bsDateStr}</span>
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            width: 330,
            maxWidth: "92vw",
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: "var(--radius, 10px)",
            boxShadow: "var(--modal-shadow, 0 20px 25px -5px rgba(0, 0, 0, 0.25))",
            zIndex: 1000,
            overflow: "hidden",
            animation: "fadeIn 0.15s ease-out",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 14px",
              borderBottom: "1px solid var(--line)",
              background: "var(--soft)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Calendar size={14} style={{ color: "var(--brand, #2563eb)" }} />
              <strong style={{ fontSize: 12, color: "var(--text)" }}>Nepali Patro &amp; Calendar Widget</strong>
            </div>
            <button
              type="button"
              className="ghost-btn icon-btn"
              onClick={() => setOpen(false)}
              style={{ width: 24, height: 24, padding: 0 }}
              title="Close calendar"
              aria-label="Close calendar"
            >
              <X size={13} />
            </button>
          </div>

          <div style={{ padding: 10 }}>
            <NepaliCalendarWidget />
          </div>
        </div>
      )}
    </div>
  );
}
