"use client";

import { useState } from "react";
import { Printer, ChevronDown, FileText, Check } from "lucide-react";

export function PrintButton({
  label = "Print / Save PDF",
  className = "print-btn",
  defaultOrientation = "landscape",
}: {
  label?: string;
  className?: string;
  defaultOrientation?: "portrait" | "landscape";
}) {
  const [orientation, setOrientation] = useState<"portrait" | "landscape">(defaultOrientation);
  const [isOpen, setIsOpen] = useState(false);

  const handlePrint = async (orient: "portrait" | "landscape" = orientation) => {
    setIsOpen(false);
    // 1. Inject dynamic @page orientation rule
    let styleEl = document.getElementById("dynamic-print-page-style") as HTMLStyleElement;
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = "dynamic-print-page-style";
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = `@media print { @page { size: A4 ${orient} !important; margin: 8mm !important; } }`;
    document.body.dataset.printOrientation = orient;

    // 2. Await full web font resolution (Poppins & Inter)
    if (typeof document !== "undefined" && "fonts" in document) {
      try {
        await document.fonts.ready;
      } catch {
        // Continue if font API unavailable
      }
    }

    // 3. Reset scroll so print begins cleanly from top
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });

    // 4. Trigger browser print / PDF export
    setTimeout(() => {
      window.print();
    }, 120);
  };

  return (
    <div className="print-btn-group no-print" style={{ display: "inline-flex", alignItems: "center", position: "relative" }}>
      <button
        type="button"
        className={className}
        onClick={() => handlePrint(orientation)}
        title={`Print or Save as PDF (${orientation.toUpperCase()} - Ctrl/Cmd + P)`}
        style={{
          borderTopRightRadius: 0,
          borderBottomRightRadius: 0,
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <Printer size={14} />
        <span>{label}</span>
        <span
          style={{
            fontSize: 9.5,
            opacity: 0.8,
            textTransform: "uppercase",
            fontWeight: 700,
            background: "rgba(0,0,0,0.12)",
            padding: "1px 5px",
            borderRadius: 3,
            letterSpacing: 0.4,
          }}
        >
          {orientation === "landscape" ? "Landscape" : "Portrait"}
        </span>
      </button>

      <button
        type="button"
        className={className}
        onClick={() => setIsOpen((prev) => !prev)}
        title="Choose Page Orientation (Portrait or Landscape)"
        style={{
          borderTopLeftRadius: 0,
          borderBottomLeftRadius: 0,
          borderLeft: "1px solid rgba(255, 255, 255, 0.25)",
          padding: "5px 6px",
          minWidth: 26,
        }}
      >
        <ChevronDown size={13} />
      </button>

      {isOpen && (
        <>
          <div
            style={{ position: "fixed", inset: 0, zIndex: 998 }}
            onClick={() => setIsOpen(false)}
          />
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 4px)",
              right: 0,
              zIndex: 999,
              background: "var(--surface, #ffffff)",
              border: "1px solid var(--line, #e2e8f0)",
              borderRadius: "var(--radius-sm, 6px)",
              boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.2)",
              padding: 6,
              minWidth: 190,
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted, #64748b)", padding: "4px 8px", textTransform: "uppercase" }}>
              PDF Page Orientation
            </div>
            <button
              type="button"
              onClick={() => {
                setOrientation("landscape");
                handlePrint("landscape");
              }}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "6px 10px",
                fontSize: 12,
                borderRadius: 4,
                cursor: "pointer",
                border: "none",
                background: orientation === "landscape" ? "var(--brand-soft, #eff6ff)" : "transparent",
                color: orientation === "landscape" ? "var(--brand, #2563eb)" : "var(--text, #0f172a)",
                fontWeight: orientation === "landscape" ? 600 : 400,
                textAlign: "left",
                gap: 8,
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <FileText size={14} style={{ transform: "rotate(90deg)" }} />
                Landscape (Wide tables)
              </span>
              {orientation === "landscape" && <Check size={14} />}
            </button>
            <button
              type="button"
              onClick={() => {
                setOrientation("portrait");
                handlePrint("portrait");
              }}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "6px 10px",
                fontSize: 12,
                borderRadius: 4,
                cursor: "pointer",
                border: "none",
                background: orientation === "portrait" ? "var(--brand-soft, #eff6ff)" : "transparent",
                color: orientation === "portrait" ? "var(--brand, #2563eb)" : "var(--text, #0f172a)",
                fontWeight: orientation === "portrait" ? 600 : 400,
                textAlign: "left",
                gap: 8,
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <FileText size={14} />
                Portrait (Invoices &amp; Docs)
              </span>
              {orientation === "portrait" && <Check size={14} />}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
