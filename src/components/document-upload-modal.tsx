"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Upload,
  FileText,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
  Trash2,
  ArrowRight,
  Landmark,
  Building2,
  Receipt,
  FileCheck,
  TrendingDown,
  TrendingUp,
  Plus,
} from "lucide-react";
import toast from "react-hot-toast";

interface BankAccountOption {
  id: string;
  bankName: string;
  accountNumber: string;
}

interface DocumentUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  orgId: string;
  initialBankAccountId?: string;
  bankAccounts?: BankAccountOption[];
  currency?: string;
  onSuccess?: () => void;
}

export function DocumentUploadModal({
  isOpen,
  onClose,
  orgId,
  initialBankAccountId,
  bankAccounts = [],
  currency = "NPR",
  onSuccess,
}: DocumentUploadModalProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [files, setFiles] = useState<File[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [inserting, setInserting] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState(0);

  // Per-result configuration state
  const [selectedBankAccounts, setSelectedBankAccounts] = useState<Record<number, string>>({});
  const [updateBalances, setUpdateBalances] = useState<Record<number, boolean>>({});
  const [selectedTxMap, setSelectedTxMap] = useState<Record<number, Record<number, boolean>>>({});

  if (!isOpen) return null;

  const handleFilesSelected = (newFiles: FileList | null) => {
    if (!newFiles || newFiles.length === 0) return;
    const added = Array.from(newFiles);
    setFiles((prev) => [...prev, ...added]);
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleStartAnalysis = async () => {
    if (files.length === 0) {
      toast.error("Please attach at least one document (statement, invoice, or receipt).");
      return;
    }

    setAnalyzing(true);
    const formData = new FormData();
    formData.append("orgId", orgId);
    if (initialBankAccountId) {
      formData.append("bankAccountId", initialBankAccountId);
    }

    for (const f of files) {
      formData.append("files", f);
    }

    try {
      const res = await fetch("/api/ai/analyze-document", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to analyze documents");
      }

      setResults(data.results || []);
      setActiveTab(0);

      // Pre-select bank accounts and transaction checkboxes
      const bankMap: Record<number, string> = {};
      const balMap: Record<number, boolean> = {};
      const txMap: Record<number, Record<number, boolean>> = {};

      (data.results || []).forEach((r: any, rIdx: number) => {
        bankMap[rIdx] = r.matchedBankAccountId || initialBankAccountId || (bankAccounts[0]?.id || "");
        balMap[rIdx] = true;

        if (r.extracted?.bankStatement?.transactions) {
          const rowMap: Record<number, boolean> = {};
          r.extracted.bankStatement.transactions.forEach((_: any, tIdx: number) => {
            rowMap[tIdx] = true;
          });
          txMap[rIdx] = rowMap;
        }
      });

      setSelectedBankAccounts(bankMap);
      setUpdateBalances(balMap);
      setSelectedTxMap(txMap);

      toast.success(`Kashtrix AI successfully parsed ${data.results.length} document(s)!`);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Document analysis failed");
    } finally {
      setAnalyzing(false);
    }
  };

  const toggleAllTransactions = (resIdx: number, select: boolean) => {
    const txs = results[resIdx]?.extracted?.bankStatement?.transactions || [];
    setSelectedTxMap((prev) => {
      const nextRes: Record<number, boolean> = {};
      txs.forEach((_: any, idx: number) => {
        nextRes[idx] = select;
      });
      return { ...prev, [resIdx]: nextRes };
    });
  };

  const toggleSingleTransaction = (resIdx: number, txIdx: number) => {
    setSelectedTxMap((prev) => {
      const current = prev[resIdx] || {};
      return {
        ...prev,
        [resIdx]: {
          ...current,
          [txIdx]: !current[txIdx],
        },
      };
    });
  };

  const handleConfirmAndInsert = async () => {
    setInserting(true);

    const bankTransactionsToInsert: any[] = [];
    const expensesToInsert: any[] = [];
    const invoicesToInsert: any[] = [];
    const purchasesToInsert: any[] = [];
    const incomesToInsert: any[] = [];

    results.forEach((r, idx) => {
      const ext = r.extracted;
      if (!ext) return;

      // 1. Bank Statement
      if (ext.documentType === "BANK_STATEMENT" && ext.bankStatement) {
        const targetBankId = selectedBankAccounts[idx] || initialBankAccountId;
        const txs = ext.bankStatement.transactions || [];
        const selection = selectedTxMap[idx] || {};

        txs.forEach((tx: any, tIdx: number) => {
          if (selection[tIdx] !== false) {
            bankTransactionsToInsert.push({
              bankAccountId: targetBankId,
              transactionDate: tx.transactionDate,
              valueDate: tx.valueDate,
              type: tx.type,
              amount: tx.amount,
              balance: tx.balance,
              description: tx.description,
              reference: tx.reference,
              chequeNumber: tx.chequeNumber,
              category: tx.category,
            });
          }
        });
      }

      // 2. Expense
      if (ext.documentType === "EXPENSE" && ext.expense) {
        expensesToInsert.push({
          title: ext.expense.title,
          vendor: ext.expense.vendor,
          categoryName: ext.expense.categoryName,
          amount: ext.expense.amount,
          occurredAt: ext.expense.occurredAt,
          notes: ext.expense.notes,
        });
      }

      // 3. Invoice
      if (ext.documentType === "INVOICE" && ext.invoice) {
        invoicesToInsert.push(ext.invoice);
      }

      // 4. Purchase
      if (ext.documentType === "PURCHASE_ORDER" && ext.purchase) {
        purchasesToInsert.push(ext.purchase);
      }

      // 5. Income
      if (ext.documentType === "INCOME" && ext.income) {
        incomesToInsert.push({
          ...ext.income,
          bankAccountId: selectedBankAccounts[idx] || initialBankAccountId,
        });
      }
    });

    try {
      const res = await fetch("/api/ai/insert-extracted", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId,
          bankTransactions: bankTransactionsToInsert,
          expenses: expensesToInsert,
          invoices: invoicesToInsert,
          purchases: purchasesToInsert,
          incomes: incomesToInsert,
          updateBankBalances: true,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to insert records into database");
      }

      toast.success(data.message || "Records inserted into database successfully!");
      if (onSuccess) onSuccess();
      router.refresh();
      onClose();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to commit database insertion");
    } finally {
      setInserting(false);
    }
  };

  const currentResult = results[activeTab];
  const currentExtracted = currentResult?.extracted;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(15, 23, 42, 0.65)",
        backdropFilter: "blur(4px)",
        padding: 16,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !analyzing && !inserting) onClose();
      }}
    >
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: 16,
          boxShadow: "0 20px 40px -8px rgba(0, 0, 0, 0.25)",
          width: "100%",
          maxWidth: 940,
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          animation: "modalFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--line)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "linear-gradient(135deg, rgba(74, 8, 107, 0.05) 0%, rgba(239, 8, 111, 0.05) 100%)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 9,
                background: "linear-gradient(135deg, #4a086b 0%, #ef086f 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#ffffff",
                boxShadow: "0 3px 8px rgba(74, 8, 107, 0.25)",
              }}
            >
              <Sparkles size={17} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--text)" }}>
                AI Document & Bank Statement Extraction
              </h3>
              <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>
                Attach statements, bills, or receipts. Gemini AI analyzes, asks for your review, and auto-updates the database.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={analyzing || inserting}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--text-muted)",
              padding: 6,
              borderRadius: 6,
              display: "flex",
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
          {results.length === 0 ? (
            /* Upload Phase */
            <div>
              <div
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: "2px dashed var(--line-strong)",
                  borderRadius: 14,
                  padding: "36px 20px",
                  textAlign: "center",
                  background: "var(--soft)",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  handleFilesSelected(e.dataTransfer.files);
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.png,.jpg,.jpeg,.webp,.csv,.txt"
                  style={{ display: "none" }}
                  onChange={(e) => handleFilesSelected(e.target.files)}
                />
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 26,
                    background: "var(--brand-soft)",
                    color: "var(--brand)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 12px",
                  }}
                >
                  <Upload size={24} />
                </div>
                <h4 style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 650, color: "var(--text)" }}>
                  Click to browse or drag & drop documents here
                </h4>
                <p style={{ margin: "0 0 10px", fontSize: 12.5, color: "var(--text-muted)" }}>
                  Supports <strong>Bank Statements (PDF/CSV/Image)</strong>, <strong>Vendor Invoices</strong>, <strong>Bills</strong>, and <strong>Receipts</strong>. Multiple files supported!
                </p>
                <span
                  style={{
                    display: "inline-block",
                    padding: "4px 10px",
                    background: "var(--surface)",
                    border: "1px solid var(--line)",
                    borderRadius: 20,
                    fontSize: 11,
                    fontWeight: 600,
                    color: "var(--brand)",
                  }}
                >
                  Powered by Kashtrix Smart AI
                </span>
              </div>

              {/* Selected Files List */}
              {files.length > 0 && (
                <div style={{ marginTop: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-secondary)" }}>
                      Selected Files ({files.length}):
                    </span>
                    <button
                      type="button"
                      onClick={() => setFiles([])}
                      style={{
                        background: "none",
                        border: "none",
                        color: "var(--danger)",
                        fontSize: 11.5,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <Trash2 size={12} /> Clear All
                    </button>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {files.map((file, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "10px 14px",
                          borderRadius: 10,
                          border: "1px solid var(--line)",
                          background: "var(--surface)",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <FileText size={18} style={{ color: "var(--brand)" }} />
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
                              {file.name}
                            </div>
                            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                              {(file.size / 1024).toFixed(1)} KB · {file.type || "Document"}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFile(idx)}
                          style={{
                            background: "none",
                            border: "none",
                            color: "var(--text-muted)",
                            cursor: "pointer",
                            padding: 4,
                          }}
                        >
                          <X size={15} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Review & Confirmation Phase */
            <div>
              {/* Document Tabs */}
              {results.length > 1 && (
                <div style={{ display: "flex", gap: 8, marginBottom: 16, overflowX: "auto", paddingBottom: 4 }}>
                  {results.map((r, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setActiveTab(idx)}
                      style={{
                        padding: "6px 14px",
                        borderRadius: 20,
                        fontSize: 12,
                        fontWeight: 650,
                        border: activeTab === idx ? "1.5px solid var(--brand)" : "1px solid var(--line)",
                        background: activeTab === idx ? "var(--brand-soft)" : "var(--surface)",
                        color: activeTab === idx ? "var(--brand)" : "var(--text-secondary)",
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <FileCheck size={13} />
                      {r.filename} ({r.extracted?.documentType || "DOCUMENT"})
                    </button>
                  ))}
                </div>
              )}

              {/* Document Overview Banner */}
              <div
                style={{
                  padding: "14px 18px",
                  borderRadius: 12,
                  background: "var(--soft)",
                  border: "1px solid var(--line)",
                  marginBottom: 16,
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 16,
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 800,
                        padding: "2px 8px",
                        borderRadius: 20,
                        background: "var(--brand-soft)",
                        color: "var(--brand)",
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                      }}
                    >
                      {currentExtracted?.documentType?.replace("_", " ") || "DOCUMENT"}
                    </span>
                    <span style={{ fontSize: 11, color: "var(--success)", fontWeight: 650, display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <CheckCircle2 size={12} /> {Math.round((currentExtracted?.confidence || 0.95) * 100)}% Match Confidence
                    </span>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
                    {currentExtracted?.summary}
                  </div>
                </div>

                {/* Target Bank Account Selection (if statement or income) */}
                {(currentExtracted?.documentType === "BANK_STATEMENT" || currentExtracted?.documentType === "INCOME") && (
                  <div style={{ minWidth: 260 }}>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 4 }}>
                      Assign to Bank Account:
                    </label>
                    <select
                      value={selectedBankAccounts[activeTab] || ""}
                      onChange={(e) => setSelectedBankAccounts((prev) => ({ ...prev, [activeTab]: e.target.value }))}
                      style={{
                        width: "100%",
                        padding: "6px 10px",
                        fontSize: 12,
                        borderRadius: 8,
                        border: "1px solid var(--line)",
                        background: "var(--surface)",
                        color: "var(--text)",
                      }}
                    >
                      {bankAccounts.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.bankName} ({b.accountNumber})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* 1. BANK STATEMENT TRANSACTIONS TABLE */}
              {currentExtracted?.documentType === "BANK_STATEMENT" && (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>
                      Detected Transactions ({currentExtracted.bankStatement?.transactions?.length || 0}):
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => toggleAllTransactions(activeTab, true)}
                        style={{ background: "none", border: "none", color: "var(--brand)", fontSize: 11.5, fontWeight: 600, cursor: "pointer" }}
                      >
                        Select All
                      </button>
                      <span style={{ color: "var(--line)" }}>|</span>
                      <button
                        type="button"
                        onClick={() => toggleAllTransactions(activeTab, false)}
                        style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 11.5, fontWeight: 600, cursor: "pointer" }}
                      >
                        Deselect All
                      </button>
                    </div>
                  </div>

                  <div style={{ border: "1px solid var(--line)", borderRadius: 10, overflow: "hidden", maxHeight: 320, overflowY: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, textAlign: "left" }}>
                      <thead>
                        <tr style={{ background: "var(--soft)", borderBottom: "1px solid var(--line)", position: "sticky", top: 0, zIndex: 2 }}>
                          <th style={{ padding: "8px 10px", width: 36 }}></th>
                          <th style={{ padding: "8px 10px" }}>Date</th>
                          <th style={{ padding: "8px 10px" }}>Type</th>
                          <th style={{ padding: "8px 10px" }}>Description</th>
                          <th style={{ padding: "8px 10px" }}>Reference</th>
                          <th style={{ padding: "8px 10px", textAlign: "right" }}>Amount ({currency})</th>
                          <th style={{ padding: "8px 10px", textAlign: "right" }}>Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(currentExtracted.bankStatement?.transactions || []).map((tx: any, tIdx: number) => {
                          const isSelected = selectedTxMap[activeTab]?.[tIdx] !== false;
                          const isDeposit = tx.type === "DEPOSIT";

                          return (
                            <tr
                              key={tIdx}
                              onClick={() => toggleSingleTransaction(activeTab, tIdx)}
                              style={{
                                borderBottom: "1px solid var(--line)",
                                background: isSelected ? "var(--surface)" : "var(--soft)",
                                opacity: isSelected ? 1 : 0.5,
                                cursor: "pointer",
                              }}
                            >
                              <td style={{ padding: "8px 10px" }}>
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => {}}
                                  style={{ cursor: "pointer" }}
                                />
                              </td>
                              <td style={{ padding: "8px 10px", whiteSpace: "nowrap", fontFamily: "monospace" }}>
                                {tx.transactionDate}
                              </td>
                              <td style={{ padding: "8px 10px" }}>
                                <span
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 3,
                                    fontSize: 10,
                                    fontWeight: 700,
                                    padding: "2px 6px",
                                    borderRadius: 4,
                                    background: isDeposit ? "var(--success-soft)" : "var(--danger-soft)",
                                    color: isDeposit ? "var(--success)" : "var(--danger)",
                                  }}
                                >
                                  {isDeposit ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                                  {tx.type}
                                </span>
                              </td>
                              <td style={{ padding: "8px 10px", maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {tx.description}
                              </td>
                              <td style={{ padding: "8px 10px", fontSize: 11, color: "var(--text-muted)", fontFamily: "monospace" }}>
                                {tx.reference || tx.chequeNumber || "-"}
                              </td>
                              <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700, color: isDeposit ? "var(--success)" : "var(--danger)" }}>
                                {isDeposit ? "+" : "-"}{Number(tx.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </td>
                              <td style={{ padding: "8px 10px", textAlign: "right", color: "var(--text-muted)", fontSize: 11, fontFamily: "monospace" }}>
                                {tx.balance !== undefined ? Number(tx.balance).toLocaleString(undefined, { minimumFractionDigits: 2 }) : "-"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 2. INVOICE REVIEW */}
              {currentExtracted?.documentType === "INVOICE" && currentExtracted.invoice && (
                <div style={{ border: "1px solid var(--line)", borderRadius: 10, padding: 16 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 14 }}>
                    <div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase" }}>Customer</div>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>{currentExtracted.invoice.customerName}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase" }}>Invoice Number</div>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>{currentExtracted.invoice.invoiceNumber}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase" }}>Issue Date</div>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>{currentExtracted.invoice.issueDate}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase" }}>Total Amount</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: "var(--brand)" }}>
                        {currency} {Number(currentExtracted.invoice.total || 0).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 3. EXPENSE REVIEW */}
              {currentExtracted?.documentType === "EXPENSE" && currentExtracted.expense && (
                <div style={{ border: "1px solid var(--line)", borderRadius: 10, padding: 16 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase" }}>Title</div>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>{currentExtracted.expense.title}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase" }}>Vendor</div>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>{currentExtracted.expense.vendor || "N/A"}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase" }}>Category</div>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>{currentExtracted.expense.categoryName || "General"}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase" }}>Amount</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: "var(--danger)" }}>
                        {currency} {Number(currentExtracted.expense.amount || 0).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: "14px 20px",
            borderTop: "1px solid var(--line)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "var(--surface)",
          }}
        >
          {results.length === 0 ? (
            <>
              <button
                type="button"
                onClick={onClose}
                disabled={analyzing}
                style={{
                  padding: "8px 16px",
                  borderRadius: 8,
                  border: "1px solid var(--line)",
                  background: "var(--surface)",
                  color: "var(--text)",
                  cursor: "pointer",
                  fontSize: 13,
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleStartAnalysis}
                disabled={files.length === 0 || analyzing}
                style={{
                  padding: "9px 20px",
                  borderRadius: 8,
                  border: "none",
                  background: files.length === 0 || analyzing ? "var(--line)" : "linear-gradient(135deg, #4a086b 0%, #ef086f 100%)",
                  color: "#ffffff",
                  fontWeight: 650,
                  fontSize: 13,
                  cursor: files.length === 0 || analyzing ? "not-allowed" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  boxShadow: files.length > 0 && !analyzing ? "0 4px 12px rgba(74, 8, 107, 0.25)" : "none",
                }}
              >
                {analyzing ? (
                  <>
                    <Loader2 size={16} className="spin" />
                    Analyzing with Kashtrix AI...
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    Analyze & Extract Data ({files.length})
                  </>
                )}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setResults([])}
                disabled={inserting}
                style={{
                  padding: "8px 16px",
                  borderRadius: 8,
                  border: "1px solid var(--line)",
                  background: "var(--surface)",
                  color: "var(--text)",
                  cursor: "pointer",
                  fontSize: 13,
                }}
              >
                ← Back to Uploads
              </button>
              <button
                type="button"
                onClick={handleConfirmAndInsert}
                disabled={inserting}
                style={{
                  padding: "9px 22px",
                  borderRadius: 8,
                  border: "none",
                  background: "linear-gradient(135deg, #059669 0%, #10b981 100%)",
                  color: "#ffffff",
                  fontWeight: 700,
                  fontSize: 13.5,
                  cursor: inserting ? "not-allowed" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  boxShadow: "0 4px 12px rgba(5, 150, 105, 0.3)",
                }}
              >
                {inserting ? (
                  <>
                    <Loader2 size={16} className="spin" />
                    Updating Database...
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={16} />
                    Approve & Insert into Database
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
