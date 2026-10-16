"use client";

import {
  Children,
  cloneElement,
  isValidElement,
  useId,
  useMemo,
  useState,
  type ReactNode,
  type ReactElement,
  type HTMLAttributes,
} from "react";
import { Search, X, Printer } from "lucide-react";

type ElementProps = HTMLAttributes<HTMLElement> & { children?: ReactNode; colSpan?: number };

function extractTextFromNode(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (!node) return "";
  if (Array.isArray(node)) return node.map(extractTextFromNode).join(" ");
  if (isValidElement(node)) {
    const props = node.props as { children?: ReactNode };
    return props.children ? extractTextFromNode(props.children) : "";
  }
  return "";
}

/** Keeps all server-rendered rows available for printing, while filtering and paging the screen view. */
export function DataTable({
  children,
  className = "",
  paginate = true,
  searchable = true,
}: {
  children: ReactNode;
  className?: string;
  paginate?: boolean;
  searchable?: boolean;
}) {
  const id = useId();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [searchQuery, setSearchQuery] = useState("");

  const sections = Children.toArray(children);
  const body = sections.find(
    (child) => isValidElement(child) && child.type === "tbody"
  ) as ReactElement<ElementProps> | undefined;

  const rawRows = Children.toArray(body?.props.children).filter(isValidElement) as ReactElement<ElementProps>[];
  const isOriginallyEmpty =
    rawRows.length === 1 &&
    Children.toArray(rawRows[0].props.children).some(
      (cell) => isValidElement<ElementProps>(cell) && (cell.props.colSpan || 0) > 1
    );

  const totalRawCount = isOriginallyEmpty ? 0 : rawRows.length;
  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredRows = useMemo(() => {
    if (isOriginallyEmpty || !normalizedQuery) return rawRows;
    return rawRows.filter((row) => {
      const text = extractTextFromNode(row).toLowerCase();
      return text.includes(normalizedQuery);
    });
  }, [rawRows, normalizedQuery, isOriginallyEmpty]);

  const activeCount = isOriginallyEmpty ? 0 : filteredRows.length;
  const pages = Math.max(1, Math.ceil(activeCount / pageSize));
  const current = Math.min(page, pages);
  const start = (current - 1) * pageSize;
  const paging = paginate && activeCount > 0;

  return (
    <div className="data-table-container">
      {searchable && totalRawCount > 0 && (
        <div className="table-search-toolbar no-print">
          <div className="table-search-input-wrap">
            <Search size={14} className="table-search-icon" />
            <input
              type="text"
              placeholder="Search records, names, amounts, tags..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="table-search-input"
              aria-label="Filter table records"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setPage(1);
                }}
                className="table-search-clear-btn"
                title="Clear search"
                aria-label="Clear search"
              >
                <X size={13} />
              </button>
            )}
          </div>
          {searchQuery && (
            <span className="table-search-badge">
              {activeCount} of {totalRawCount} match{activeCount === 1 ? "" : "es"}
            </span>
          )}
        </div>
      )}

      <div className="data-table-scroll" role="region" aria-label="Scrollable table" tabIndex={0}>
        <table id={id} className={className}>
          {sections.map((section) => {
            if (!isValidElement<ElementProps>(section) || section.type !== "tbody") return section;

            if (searchQuery && activeCount === 0 && !isOriginallyEmpty) {
              return cloneElement(
                section,
                {},
                <tr key="no-search-results">
                  <td
                    colSpan={100}
                    style={{
                      textAlign: "center",
                      padding: "36px 16px",
                      color: "var(--text-muted)",
                      fontSize: 13,
                    }}
                  >
                    No records found matching &ldquo;<strong>{searchQuery}</strong>&rdquo;. Try adjusting your search query.
                  </td>
                </tr>
              );
            }

            return cloneElement(
              section,
              {},
              filteredRows.map((row, index) =>
                cloneElement(row, {
                  className: `${row.props.className || ""}${
                    paging && (index < start || index >= start + pageSize) ? " table-row-off-page" : ""
                  }`,
                })
              )
            );
          })}
        </table>
      </div>

      {paging && (
        <div className="table-pagination no-print" aria-label="Table pagination">
          <span role="status">
            {start + 1}–{Math.min(start + pageSize, activeCount)} of {activeCount} rows
            {searchQuery && totalRawCount !== activeCount ? ` (filtered from ${totalRawCount})` : ""}
          </span>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <label>
              Rows per page{" "}
              <select
                value={pageSize}
                onChange={(event) => {
                  setPageSize(Number(event.target.value));
                  setPage(1);
                }}
              >
                {[10, 25, 50, 100, 250, 500].map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
                {activeCount > 25 && <option value={activeCount}>All ({activeCount})</option>}
              </select>
            </label>
            <button
              type="button"
              className="ghost-btn no-print"
              style={{ fontSize: 11.5, padding: "4px 8px", display: "inline-flex", alignItems: "center", gap: 4 }}
              onClick={() => {
                window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
                setTimeout(() => window.print(), 50);
              }}
              title="Print all records across this table to PDF"
            >
              <Printer size={12} /> Print / PDF (All {activeCount})
            </button>
          </div>
          <div className="pagination-buttons">
            <button
              type="button"
              aria-controls={id}
              disabled={current === 1}
              onClick={() => setPage(current - 1)}
            >
              Previous
            </button>
            <span>
              Page {current} of {pages}
            </span>
            <button
              type="button"
              aria-controls={id}
              disabled={current === pages}
              onClick={() => setPage(current + 1)}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
