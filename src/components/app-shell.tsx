"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeftRight, LogOut, Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Sidebar } from "@/components/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { logoutAction } from "@/app/login/actions";
import { FiscalYearSelector } from "@/components/fiscal-year-selector";
import { FiscalYearInfo } from "@/lib/fiscal-year";
import { TodayTasksNav, PendingItem } from "@/components/today-tasks-nav";
import { NepaliCalendarNav } from "@/components/nepali-calendar-nav";
import { MobileAppBottomNav } from "@/components/mobile-nav";
import { AiChatAssistant } from "@/components/ai-chat-assistant";

export function AppShell({
  children,
  org,
  user,
  fiscalInfo,
  pendingTasks = [],
  pendingReminders = [],
}: {
  children: React.ReactNode;
  org: { id: string; name: string; kind: string; logoUrl?: string | null; taxNumber?: string | null };
  user: { name: string; email: string };
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

  useEffect(() => {
    const saved = localStorage.getItem("sidebar_collapsed");
    if (saved === "true") {
      setSidebarCollapsed(true);
    }
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

      {/* MOBILE APPLICATION APP-LIKE BOTTOM NAVIGATION BAR */}
      <MobileAppBottomNav
        orgId={org.id}
        kind={org.kind}
        onOpenSidebar={() => setSidebarOpen(true)}
      />

      {/* FLOATING AI FINANCIAL COPILOT & DOCUMENT ATTACHMENT ASSISTANT */}
      <AiChatAssistant orgId={org.id} orgName={org.name} />
    </div>
  );
}
