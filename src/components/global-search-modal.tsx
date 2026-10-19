"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  X,
  FileText,
  ShoppingCart,
  Users,
  Building2,
  DollarSign,
  Landmark,
  Package,
  FolderKanban,
  CheckSquare,
  ArrowRight,
  Loader2,
  CornerDownLeft,
} from "lucide-react";

type SearchResult = {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  badge: string;
  badgeCls: string;
  url: string;
  amount?: string;
  date?: string;
};

const CATEGORIES = [
  { id: "ALL", label: "All Records" },
  { id: "CRM", label: "Customers & Vendors" },
  { id: "INVOICE", label: "Invoices" },
  { id: "SALES", label: "Sales Orders" },
  { id: "PURCHASE", label: "Purchase Orders" },
  { id: "EXPENSE", label: "Expenses" },
  { id: "INCOME", label: "Incomes" },
  { id: "BANK", label: "Banking" },
  { id: "PRODUCT", label: "Stock / SKU" },
];

function getCategoryIcon(cat: string) {
  switch (cat) {
    case "CRM":
      return Users;
    case "INVOICE":
      return FileText;
    case "SALES":
      return ShoppingCart;
    case "PURCHASE":
      return Package;
    case "EXPENSE":
    case "INCOME":
      return DollarSign;
    case "BANK":
      return Landmark;
    case "PRODUCT":
      return Package;
    case "PROJECT":
      return FolderKanban;
    case "TASK":
      return CheckSquare;
    default:
      return Search;
  }
}

export function GlobalSearchModal({
  orgId,
  isOpen,
  onClose,
}: {
  orgId: string;
  isOpen: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    } else {
      setQuery("");
      setResults([]);
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Debounced search fetch
  useEffect(() => {
    if (!isOpen) return;
    if (!query.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const timeout = setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          orgId,
          q: query.trim(),
          category: selectedCategory,
        });
        const res = await fetch(`/api/search?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data.results || []);
          setSelectedIndex(0);
        }
      } catch (err) {
        console.error("Search fetch failed:", err);
      } finally {
        setLoading(false);
      }
    }, 180);

    return () => clearTimeout(timeout);
  }, [query, selectedCategory, orgId, isOpen]);

  // Handle keyboard navigation inside search modal
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }

      if (results.length === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % results.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + results.length) % results.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        const selected = results[selectedIndex];
        if (selected) {
          onClose();
          router.push(selected.url);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, results, selectedIndex, onClose, router]);

  // Scroll active item into view
  useEffect(() => {
    if (listRef.current) {
      const activeEl = listRef.current.children[selectedIndex] as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  return (
    <div className="search-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="search-modal-box" onClick={(e) => e.stopPropagation()}>
        {/* Top Input Bar */}
        <div className="search-input-header">
          <Search size={18} className="search-input-icon" />
          <input
            ref={inputRef}
            type="text"
            className="search-main-input"
            placeholder="Search customers, vendors, sales, invoices, expenses, accounts..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {loading && <Loader2 size={16} className="search-spinner" />}
          {query && !loading && (
            <button
              type="button"
              className="search-clear-btn"
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              title="Clear search"
            >
              <X size={15} />
            </button>
          )}
          <kbd className="search-esc-badge" onClick={onClose}>
            ESC
          </kbd>
        </div>

        {/* Category Filter Pills */}
        <div className="search-category-row">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              className={`search-cat-pill ${selectedCategory === cat.id ? "active" : ""}`}
              onClick={() => setSelectedCategory(cat.id)}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Search Results List */}
        <div className="search-results-list" ref={listRef}>
          {results.map((item, idx) => {
            const Icon = getCategoryIcon(item.category);
            const isSelected = idx === selectedIndex;
            return (
              <div
                key={item.id}
                className={`search-result-item ${isSelected ? "selected" : ""}`}
                onMouseEnter={() => setSelectedIndex(idx)}
                onClick={() => {
                  onClose();
                  router.push(item.url);
                }}
              >
                <div className="search-item-icon-box">
                  <Icon size={16} />
                </div>
                <div className="search-item-info">
                  <div className="search-item-title-row">
                    <span className="search-item-title">{item.title}</span>
                    <span className={`badge ${item.badgeCls}`} style={{ fontSize: 10, padding: "2px 7px" }}>
                      {item.badge}
                    </span>
                  </div>
                  <div className="search-item-sub">{item.subtitle}</div>
                </div>
                {(item.amount || item.date) && (
                  <div className="search-item-meta">
                    {item.amount && <strong className="search-item-amount">{item.amount}</strong>}
                    {item.date && <span className="search-item-date">{item.date}</span>}
                  </div>
                )}
                <div className="search-item-arrow">
                  <ArrowRight size={14} />
                </div>
              </div>
            );
          })}

          {!loading && query.trim() && results.length === 0 && (
            <div className="search-empty-state">
              <Search size={32} style={{ opacity: 0.35, marginBottom: 8 }} />
              <strong>No matching records found</strong>
              <p>No customers, vendors, sales, invoices, or accounts matched &quot;{query}&quot;.</p>
            </div>
          )}

          {!query.trim() && (
            <div className="search-initial-hint">
              <div className="search-hint-grid">
                <div>
                  <strong>Quick jump examples:</strong>
                  <ul>
                    <li>Type customer or vendor name (e.g. <code>Black Swan</code>)</li>
                    <li>Type invoice or order # (e.g. <code>INV-9925139</code>, <code>SO-7994542</code>)</li>
                    <li>Type product name or SKU</li>
                    <li>Type bank account, payee, or particulars</li>
                  </ul>
                </div>
                <div className="search-shortcuts-guide">
                  <div className="search-shortcut-item">
                    <kbd>↑</kbd> <kbd>↓</kbd> <span>Navigate</span>
                  </div>
                  <div className="search-shortcut-item">
                    <kbd>Enter</kbd> <span>Open record</span>
                  </div>
                  <div className="search-shortcut-item">
                    <kbd>ESC</kbd> <span>Close</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="search-modal-footer">
          <span>
            Showing <strong>{results.length}</strong> matching entries in workspace
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <CornerDownLeft size={12} /> Press <strong>Enter</strong> to select
          </span>
        </div>
      </div>
    </div>
  );
}
