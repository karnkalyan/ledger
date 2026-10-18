"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Receipt,
  Plus,
  TrendingUp,
  Landmark,
  Menu,
  X,
  CreditCard,
  UserPlus,
  Zap,
  Building,
  FileText
} from "lucide-react";

export function MobileAppBottomNav({
  orgId,
  kind,
  onOpenSidebar,
}: {
  orgId: string;
  kind: string;
  onOpenSidebar?: () => void;
}) {
  const pathname = usePathname();
  const [quickMenuOpen, setQuickMenuOpen] = useState(false);

  const isActive = (path: string, exact = false) => {
    if (exact) return pathname === path;
    return pathname.startsWith(path);
  };

  return (
    <>
      {/* QUICK ADD MODAL POPUP */}
      {quickMenuOpen && (
        <div
          className="mobile-quick-menu-backdrop no-print"
          onClick={() => setQuickMenuOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(6px)",
            zIndex: 1300,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            padding: "0 12px 76px 12px",
            animation: "fadeIn 0.15s ease",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 420,
              background: "var(--surface)",
              borderRadius: "16px",
              padding: "20px",
              boxShadow: "0 -8px 30px rgba(0, 0, 0, 0.25)",
              border: "1px solid var(--line)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Quick Record &amp; Actions</h3>
                <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>Select an entry to record into ledger</span>
              </div>
              <button
                type="button"
                onClick={() => setQuickMenuOpen(false)}
                className="secondary-btn"
                style={{ padding: 4, width: 28, height: 28, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
              >
                <X size={15} />
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Link
                href={`/${orgId}/expenses/new?type=new-expense`}
                onClick={() => setQuickMenuOpen(false)}
                className="quick-action-item"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "12px",
                  borderRadius: 10,
                  background: "var(--soft)",
                  border: "1px solid var(--line)",
                  textDecoration: "none",
                  color: "var(--text)",
                }}
              >
                <div style={{ background: "var(--danger-soft)", color: "var(--danger)", padding: 8, borderRadius: 8 }}>
                  <Receipt size={18} />
                </div>
                <div>
                  <strong style={{ fontSize: 12.5, display: "block" }}>Expense</strong>
                  <span style={{ fontSize: 10, color: "var(--text-muted)" }}>Record Paid Out</span>
                </div>
              </Link>

              <Link
                href={`/${orgId}/income/new?type=record-income`}
                onClick={() => setQuickMenuOpen(false)}
                className="quick-action-item"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "12px",
                  borderRadius: 10,
                  background: "var(--soft)",
                  border: "1px solid var(--line)",
                  textDecoration: "none",
                  color: "var(--text)",
                }}
              >
                <div style={{ background: "var(--success-soft)", color: "var(--success)", padding: 8, borderRadius: 8 }}>
                  <TrendingUp size={18} />
                </div>
                <div>
                  <strong style={{ fontSize: 12.5, display: "block" }}>Income</strong>
                  <span style={{ fontSize: 10, color: "var(--text-muted)" }}>Cash or Bank In</span>
                </div>
              </Link>

              <Link
                href={`/${orgId}/banking/new?type=record-deposit`}
                onClick={() => setQuickMenuOpen(false)}
                className="quick-action-item"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "12px",
                  borderRadius: 10,
                  background: "var(--soft)",
                  border: "1px solid var(--line)",
                  textDecoration: "none",
                  color: "var(--text)",
                }}
              >
                <div style={{ background: "var(--cyan-soft)", color: "var(--cyan)", padding: 8, borderRadius: 8 }}>
                  <Landmark size={18} />
                </div>
                <div>
                  <strong style={{ fontSize: 12.5, display: "block" }}>Bank Deposit</strong>
                  <span style={{ fontSize: 10, color: "var(--text-muted)" }}>Customer / Transfer</span>
                </div>
              </Link>

              <Link
                href={`/${orgId}/expenses#electricity-meter-logger`}
                onClick={() => setQuickMenuOpen(false)}
                className="quick-action-item"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "12px",
                  borderRadius: 10,
                  background: "var(--soft)",
                  border: "1px solid var(--line)",
                  textDecoration: "none",
                  color: "var(--text)",
                }}
              >
                <div style={{ background: "var(--warning-soft)", color: "var(--warning)", padding: 8, borderRadius: 8 }}>
                  <Zap size={18} />
                </div>
                <div>
                  <strong style={{ fontSize: 12.5, display: "block" }}>Electricity</strong>
                  <span style={{ fontSize: 10, color: "var(--text-muted)" }}>Meter Unit Bill</span>
                </div>
              </Link>

              <Link
                href={`/${orgId}/crm/new?type=add-contact`}
                onClick={() => setQuickMenuOpen(false)}
                className="quick-action-item"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "12px",
                  borderRadius: 10,
                  background: "var(--soft)",
                  border: "1px solid var(--line)",
                  textDecoration: "none",
                  color: "var(--text)",
                }}
              >
                <div style={{ background: "var(--purple-soft)", color: "var(--purple)", padding: 8, borderRadius: 8 }}>
                  <UserPlus size={18} />
                </div>
                <div>
                  <strong style={{ fontSize: 12.5, display: "block" }}>Contact / CRM</strong>
                  <span style={{ fontSize: 10, color: "var(--text-muted)" }}>Customer or Vendor</span>
                </div>
              </Link>

              <Link
                href={`/${orgId}/reports`}
                onClick={() => setQuickMenuOpen(false)}
                className="quick-action-item"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "12px",
                  borderRadius: 10,
                  background: "var(--soft)",
                  border: "1px solid var(--line)",
                  textDecoration: "none",
                  color: "var(--text)",
                }}
              >
                <div style={{ background: "var(--brand-soft)", color: "var(--brand)", padding: 8, borderRadius: 8 }}>
                  <FileText size={18} />
                </div>
                <div>
                  <strong style={{ fontSize: 12.5, display: "block" }}>Reports</strong>
                  <span style={{ fontSize: 10, color: "var(--text-muted)" }}>Audited Ledger</span>
                </div>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* MOBILE BOTTOM NAVIGATION BAR (EXACTLY 5 SYMMETRIC SLOTS: 2 LEFT, CENTER +, 2 RIGHT) */}
      <style>{`
        @media print {
          .mobile-app-bottom-bar,
          nav.mobile-app-bottom-bar,
          .mobile-quick-menu-backdrop,
          .mobile-tab-btn,
          .mobile-center-add-btn {
            display: none !important;
            visibility: hidden !important;
            height: 0 !important;
            min-height: 0 !important;
            max-height: 0 !important;
            opacity: 0 !important;
            position: absolute !important;
            bottom: -9999px !important;
            left: -9999px !important;
            pointer-events: none !important;
          }
        }
      `}</style>
      <nav
        className="mobile-app-bottom-bar no-print"
        aria-label="Mobile Navigation"
      >
        <Link
          href={`/${orgId}`}
          className={`mobile-tab-btn ${isActive(`/${orgId}`, true) ? "active" : ""}`}
        >
          <LayoutDashboard size={20} />
          <span>Home</span>
        </Link>

        <Link
          href={`/${orgId}/expenses`}
          className={`mobile-tab-btn ${isActive(`/${orgId}/expenses`) ? "active" : ""}`}
        >
          <Receipt size={20} />
          <span>Expenses</span>
        </Link>

        {/* ELEVATED CENTER QUICK ADD BUTTON */}
        <button
          type="button"
          onClick={() => setQuickMenuOpen((prev) => !prev)}
          className="mobile-center-add-btn"
          aria-label="Quick Action"
        >
          <Plus size={24} />
        </button>

        <Link
          href={`/${orgId}/banking`}
          className={`mobile-tab-btn ${isActive(`/${orgId}/banking`) || isActive(`/${orgId}/income`) ? "active" : ""}`}
        >
          <Landmark size={20} />
          <span>Banking</span>
        </Link>

        <Link
          href={`/${orgId}/menu`}
          className={`mobile-tab-btn ${isActive(`/${orgId}/menu`) ? "active" : ""}`}
          aria-label="Open module menu"
        >
          <Menu size={20} />
          <span>Menu</span>
        </Link>
      </nav>
    </>
  );
}
