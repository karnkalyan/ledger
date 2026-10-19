"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { officeNav, personalNav } from "@/lib/nav";
import { canAccessModule } from "@/lib/permissions";
import { ChevronLeft, ChevronRight, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";

export function Sidebar({
  orgId,
  orgName,
  kind,
  logoUrl,
  taxNumber,
  memberRole,
  isOpen = false,
  isCollapsed = false,
  onToggleCollapse,
  onClose,
}: {
  orgId: string;
  orgName: string;
  kind: string;
  logoUrl?: string | null;
  taxNumber?: string | null;
  memberRole?: string;
  isOpen?: boolean;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  onClose?: () => void;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentType = searchParams.get("type");
  const baseNav = kind === "COMPANY" ? officeNav : personalNav;
  const nav =
    kind === "COMPANY" && memberRole
      ? baseNav.filter((item) => {
          const [basePath] = item.href.split("?");
          const mod = basePath.replace(/^\//, "");
          if (!mod) return true;
          if (mod === "users" || mod === "settings") {
            return memberRole === "OWNER" || memberRole === "ADMIN" || memberRole === "MANAGER";
          }
          return canAccessModule(memberRole, mod);
        })
      : baseNav;


  return (
    <>
      {isOpen && (
        <div
          className="sidebar-backdrop"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside className={`sidebar ${isOpen ? "open" : ""} ${isCollapsed ? "collapsed" : ""}`}>
        {/* FIXED HEADER: Company logo, name, PAN & collapse toggle never scroll */}
        <div className="sidebar-fixed-header">
          <div className="sidebar-head">
            <Link
              href={`/${orgId}/settings`}
              className="brand-mark"
              onClick={onClose}
              title={`${orgName} · Settings & Company`}
            >
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={orgName}
                  className="brand-logo-img"
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 7,
                    objectFit: "contain",
                    background: "#ffffff",
                    padding: 2,
                    border: "1px solid var(--line)",
                    flexShrink: 0,
                  }}
                />
              ) : (
                <span className="brand-symbol company-symbol" style={{ flexShrink: 0, fontWeight: 800 }}>
                  {orgName ? orgName.slice(0, 2).toUpperCase() : "KL"}
                </span>
              )}
              {!isCollapsed && (
                <div style={{ minWidth: 0, flex: 1 }}>
                  <span
                    style={{
                      display: "block",
                      fontWeight: 700,
                      fontSize: 13,
                      lineHeight: 1.25,
                      color: "var(--text)",
                      whiteSpace: "normal",
                      wordBreak: "normal",
                      overflowWrap: "break-word",
                    }}
                    title={orgName}
                  >
                    {orgName}
                  </span>
                  <div
                    className="brand-sub"
                    style={{
                      fontSize: 9.5,
                      letterSpacing: "0.04em",
                      color: "var(--text-muted)",
                      marginTop: 2,
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {taxNumber ? `PAN: ${taxNumber}` : kind === "COMPANY" ? "CORPORATE ERP" : "HOUSEHOLD SUITE"}
                  </div>
                </div>
              )}
            </Link>

            {/* Desktop collapse / expand button in header */}
            {onToggleCollapse && (
              <button
                type="button"
                className="sidebar-collapse-btn desktop-only"
                onClick={onToggleCollapse}
                title={isCollapsed ? "Expand sidebar (Ctrl+B)" : "Collapse sidebar"}
                aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
              </button>
            )}

            {/* Mobile close button */}
            {onClose && (
              <button
                type="button"
                className="sidebar-mobile-close-btn mobile-only"
                onClick={onClose}
                title="Close menu"
                aria-label="Close menu"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {!isCollapsed && (
            <div className="workspace-mini">
              <span>{kind === "COMPANY" ? "Commercial ERP" : "Personal Suite"}</span>
              <strong title={orgName}>{orgName}</strong>
            </div>
          )}

          <div className="nav-section-label">{isCollapsed ? "•" : "Modules"}</div>
        </div>

        {/* SCROLLABLE MODULE ITEMS: Only module links scroll vertically */}
        <div className="sidebar-nav-scroll">
          <nav className="nav-list" aria-label="Workspace navigation">
            {nav.map((item) => {
              const href = `/${orgId}${item.href}`;
              const [basePath, queryStr] = item.href.split("?");
              const itemType = queryStr ? new URLSearchParams(queryStr).get("type") : null;
              const active =
                item.href === ""
                  ? pathname === `/${orgId}`
                  : itemType
                  ? pathname === `/${orgId}${basePath}` && currentType === itemType
                  : pathname === `/${orgId}${basePath}` && (!currentType || !basePath.includes("crm"));
              const Icon = item.icon;

              return (
                <Link
                  className={`nav-link ${active ? "active" : ""}`}
                  href={href}
                  key={item.label}
                  onClick={onClose}
                  title={item.label}
                >
                  <span
                    className="nav-icon-badge"
                    style={{
                      color: item.color,
                      background: active ? "var(--surface)" : "transparent",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 22,
                      height: 22,
                      borderRadius: 4,
                      flexShrink: 0,
                      transition: "transform 0.15s ease",
                    }}
                  >
                    <Icon size={16} />
                  </span>
                  {!isCollapsed && <span className="nav-label">{item.label}</span>}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* FIXED BOTTOM TOGGLE */}
        {onToggleCollapse && (
          <div className="sidebar-footer desktop-only">
            <button
              type="button"
              className="sidebar-bottom-toggle"
              onClick={onToggleCollapse}
              title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {isCollapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
              {!isCollapsed && <span>Collapse Sidebar</span>}
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
