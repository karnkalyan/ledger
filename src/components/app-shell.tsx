"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeftRight, LogOut, Menu, PanelLeftClose, PanelLeftOpen, Search } from "lucide-react";
import { Sidebar } from "@/components/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { logoutAction } from "@/app/login/actions";
import { FiscalYearSelector } from "@/components/fiscal-year-selector";
import { FiscalYearInfo } from "@/lib/fiscal-year";
import { TodayTasksNav, PendingItem } from "@/components/today-tasks-nav";
import { NepaliCalendarNav } from "@/components/nepali-calendar-nav";
import { MobileAppBottomNav } from "@/components/mobile-nav";
import { AiChatAssistant } from "@/components/ai-chat-assistant";
import { GlobalSearchModal } from "@/components/global-search-modal";

export function AppShell({
  children,
  org,
  user,
  memberRole,
  fiscalInfo,
  pendingTasks = [],
  pendingReminders = [],
}: {
  children: React.ReactNode;
  org: { id: string; name: string; kind: string; logoUrl?: string | null; taxNumber?: string | null };
  user: { name: string; email: string };
  memberRole?: string;
  fiscalInfo?: {
    availableYears: FiscalYearInfo[];
    currentFiscalYear: FiscalYearInfo;
    activeCode: string | null;
  };
  pendingTasks?: PendingItem[];
  pendingReminders?: PendingItem[];
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchModalOpen, setSearchModalOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("sidebar_collapsed");
    if (saved === "true") {
      setSidebarCollapsed(true);
    }
  }, []);

  // Global Ctrl+K / Cmd+K keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchModalOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const toggleSidebarCollapsed = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("sidebar_collapsed", String(next));
      return next;
    });
  };

  return (
    <div className={`app-shell ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      <Sidebar
        orgId={org.id}
        orgName={org.name}
        kind={org.kind}
        logoUrl={org.logoUrl}
        taxNumber={org.taxNumber}
        memberRole={memberRole}
        isOpen={sidebarOpen}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={toggleSidebarCollapsed}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="main-column">
        <header className="topbar">
          <div className="topbar-left">
            <Link
              href={`/${org.id}/menu`}
              className="mobile-menu-btn"
              aria-label="Open menu page"
              title="Open module menu"
            >
              <Menu size={18} />
            </Link>
            <button
              type="button"
              className="ghost-btn icon-btn desktop-only"
              onClick={toggleSidebarCollapsed}
              title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              style={{ width: 28, height: 28, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
            >
              {sidebarCollapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
            </button>
            <div className="topbar-title-wrap">
              <div className="topbar-kicker">
                {org.kind === "COMPANY" ? "Kashtrix ERP" : "Kashtrix Personal ERP"}
              </div>
              <h2 className="topbar-title">{org.name}</h2>
            </div>
          </div>

          {/* GLOBAL SEARCH NAVBAR BUTTON / TRIGGER */}
          <div className="topbar-search-wrap">
            <button
              type="button"
              className="topbar-search-trigger"
              onClick={() => setSearchModalOpen(true)}
              title="Search customers, vendors, sales, invoices, accounts (Ctrl+K)"
              aria-label="Search records"
            >
              <Search size={14} className="search-icon" />
              <span className="search-placeholder">Search customers, vendors, sales, invoices...</span>
              <kbd className="search-kbd">Ctrl K</kbd>
            </button>
          </div>

          <div className="topbar-actions">
            <div className="topbar-extra-desktop">
              <NepaliCalendarNav />
            </div>
            {fiscalInfo && (
              <div className="topbar-extra-desktop">
                <FiscalYearSelector
                  availableYears={fiscalInfo.availableYears}
                  currentFiscalYear={fiscalInfo.currentFiscalYear}
                  activeCode={fiscalInfo.activeCode}
                />
              </div>
            )}
            <TodayTasksNav orgId={org.id} tasks={pendingTasks} reminders={pendingReminders} />
            <ThemeToggle />
            <Link href="/workspaces" className="ghost-btn hide-mobile" title="Switch workspace">
              <ArrowLeftRight size={13} style={{ verticalAlign: "middle", marginRight: 4 }} />
              <span>Switch</span>
            </Link>
            <div className="user-pill">
              <div className="avatar">{user.name.slice(0, 1).toUpperCase()}</div>
              <div className="hide-mobile">
                <strong>{user.name}</strong>
                <small>{user.email}</small>
              </div>
            </div>
            <form action={logoutAction}>
              <button className="ghost-btn icon-btn" title="Sign out" aria-label="Sign out">
                <LogOut size={14} />
              </button>
            </form>
          </div>
        </header>
        {children}
      </div>

      {/* GLOBAL SEARCH COMMAND PALETTE MODAL (CTRL + K) */}
      <GlobalSearchModal
        orgId={org.id}
        isOpen={searchModalOpen}
        onClose={() => setSearchModalOpen(false)}
      />

      {/* MOBILE APPLICATION APP-LIKE BOTTOM NAVIGATION BAR */}
      <div className="no-print">
        <MobileAppBottomNav
          orgId={org.id}
          kind={org.kind}
          onOpenSidebar={() => setSidebarOpen(true)}
        />
      </div>

      {/* FLOATING AI FINANCIAL COPILOT & DOCUMENT ATTACHMENT ASSISTANT */}
      <div className="no-print">
        <AiChatAssistant orgId={org.id} orgName={org.name} />
      </div>
    </div>
  );
}
