"use client";

import { useState, useRef, useEffect } from "react";
import {
  MessageSquare,
  Sparkles,
  X,
  Paperclip,
  Send,
  Loader2,
  CheckCircle2,
  Building2,
  Landmark,
  FileText,
  TrendingDown,
  TrendingUp,
  Receipt,
  Maximize2,
  Minimize2,
  Bot,
  User,
  ArrowRight,
  Calendar,
} from "lucide-react";
import toast from "react-hot-toast";

interface FinancialSummaryData {
  income?: string;
  expense?: string;
  net?: string;
  isOutflow?: boolean;
  period?: string;
}

function parseInlineMarkdown(text: string) {
  const parts: (string | React.ReactNode)[] = [];
  const regex = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith("**") && token.endsWith("**")) {
      parts.push(
        <strong key={match.index} style={{ fontWeight: 700, color: "var(--text-strong, inherit)" }}>
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith("`") && token.endsWith("`")) {
      parts.push(
        <code
          key={match.index}
          style={{
            fontFamily: "monospace",
            fontSize: "0.88em",
            padding: "1px 5px",
            borderRadius: 4,
            background: "var(--soft)",
            border: "1px solid var(--line)",
          }}
        >
          {token.slice(1, -1)}
        </code>
      );
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts.length > 0 ? parts : text;
}

function extractFinancialSummary(fullText: string): FinancialSummaryData | null {
  const currencyValPattern = `(?:[A-Za-z]{2,4}\\s*[\\d,]+(?:\\.\\d+)?|[\\$€£₹]\\s*[\\d,]+(?:\\.\\d+)?|[\\d,]+(?:\\.\\d+)?\\s*[A-Za-z]{2,4})`;
  const incomeRegex = new RegExp(`(?:Total\\s+Income|Total\\s+Inflow|Total\\s+Credits?)[^\\w\\n]*(${currencyValPattern})`, "i");
  const expenseRegex = new RegExp(`(?:Total\\s+Expenses?|Total\\s+Outflow|Total\\s+Debits?)[^\\w\\n]*(${currencyValPattern})`, "i");
  const netRegex = new RegExp(`(?:net\\s+(outflow|inflow|deficit|surplus|cash\\s*flow|balance))(?:\\s+(?:of|is|equals?))?[^\\w\\n]*(${currencyValPattern})`, "i");
  const periodRegex = /(?:for|in|month of|period:?)\s+([A-Z][a-z]+(?:\s+\d{4})?|\d{4}-\d{2})/i;

  const incomeMatch = fullText.match(incomeRegex);
  const expenseMatch = fullText.match(expenseRegex);

  if (!incomeMatch && !expenseMatch) {
    return null;
  }

  const netMatch = fullText.match(netRegex);
  const periodMatch = fullText.match(periodRegex);
  const isOutflow = netMatch ? /outflow|deficit|loss/i.test(netMatch[1]) : true;

  return {
    income: incomeMatch ? incomeMatch[1] : undefined,
    expense: expenseMatch ? expenseMatch[1] : undefined,
    net: netMatch ? netMatch[2] : undefined,
    isOutflow,
    period: periodMatch ? periodMatch[1] : undefined,
  };
}

function FinancialSummaryCard({ data }: { data: FinancialSummaryData }) {
  return (
    <div
      style={{
        margin: "8px 0 10px 0",
        padding: "12px",
        borderRadius: 12,
        background: "var(--soft)",
        border: "1px solid var(--line)",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      {data.period && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid var(--line)",
            paddingBottom: 6,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, fontWeight: 800, textTransform: "uppercase", color: "var(--text-muted)", letterSpacing: "0.06em" }}>
            <Calendar size={12} />
            <span>Bank & Activity Summary</span>
          </div>
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              color: "var(--brand)",
              background: "var(--brand-soft)",
              padding: "1px 7px",
              borderRadius: 4,
              border: "1px solid var(--brand-border)",
            }}
          >
            {data.period}
          </span>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {data.income && (
          <div
            style={{
              padding: "8px 10px",
              borderRadius: 8,
              background: "rgba(16, 185, 129, 0.08)",
              border: "1px solid rgba(16, 185, 129, 0.25)",
              display: "flex",
              flexDirection: "column",
              gap: 3,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                fontSize: 10,
                fontWeight: 700,
                color: "#10b981",
                textTransform: "uppercase",
              }}
            >
              <TrendingUp size={12} />
              <span>Total Income</span>
            </div>
            <div
              style={{
                fontSize: 13.5,
                fontWeight: 800,
                color: "#059669",
                fontFeatureSettings: "'tnum'",
              }}
            >
              {data.income}
            </div>
          </div>
        )}

        {data.expense && (
          <div
            style={{
              padding: "8px 10px",
              borderRadius: 8,
              background: "rgba(239, 68, 68, 0.08)",
              border: "1px solid rgba(239, 68, 68, 0.25)",
              display: "flex",
              flexDirection: "column",
              gap: 3,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                fontSize: 10,
                fontWeight: 700,
                color: "#ef4444",
                textTransform: "uppercase",
              }}
            >
              <TrendingDown size={12} />
              <span>Total Expenses</span>
            </div>
            <div
              style={{
                fontSize: 13.5,
                fontWeight: 800,
                color: "#dc2626",
                fontFeatureSettings: "'tnum'",
              }}
            >
              {data.expense}
            </div>
          </div>
        )}
      </div>

      {data.net && (
        <div
          style={{
            padding: "7px 10px",
            borderRadius: 8,
            background: data.isOutflow ? "rgba(239, 68, 68, 0.1)" : "rgba(16, 185, 129, 0.1)",
            border: `1px solid ${data.isOutflow ? "rgba(239, 68, 68, 0.25)" : "rgba(16, 185, 129, 0.25)"}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 11,
              fontWeight: 700,
              color: data.isOutflow ? "#ef4444" : "#10b981",
            }}
          >
            {data.isOutflow ? <TrendingDown size={13} /> : <TrendingUp size={13} />}
            <span>{data.isOutflow ? "Net Outflow" : "Net Inflow"}</span>
          </div>
          <span
            style={{
              fontSize: 13,
              fontWeight: 800,
              color: data.isOutflow ? "#dc2626" : "#059669",
              fontFeatureSettings: "'tnum'",
            }}
          >
            {data.net}
          </span>
        </div>
      )}
    </div>
  );
}

function FormattedAssistantMessage({ text }: { text: string }) {
  const financialData = extractFinancialSummary(text);

  if (financialData) {
    const lines = text.split("\n");
    const isSummaryLine = (l: string) =>
      /(?:Total\s+Income|Total\s+Inflow|Total\s+Credits?)/i.test(l) ||
      /(?:Total\s+Expenses?|Total\s+Outflow|Total\s+Debits?)/i.test(l);

    const introLines: string[] = [];
    const outroLines: string[] = [];
    let passedSummary = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (isSummaryLine(line)) {
        passedSummary = true;
        continue;
      }
      if (!passedSummary) {
        introLines.push(line);
      } else {
        if (outroLines.length === 0 && !line.trim()) continue;
        outroLines.push(line);
      }
    }

    return (
      <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
        {introLines.map((l, idx) => {
          if (!l.trim()) return <div key={idx} style={{ height: 6 }} />;
          return (
            <div key={idx} style={{ margin: "2px 0", fontSize: 12.5, lineHeight: 1.5 }}>
              {parseInlineMarkdown(l)}
            </div>
          );
        })}

        <FinancialSummaryCard data={financialData} />

        {outroLines.map((l, idx) => {
          if (!l.trim()) return <div key={idx} style={{ height: 6 }} />;
          return (
            <div key={idx} style={{ margin: "2px 0", fontSize: 12.5, lineHeight: 1.5 }}>
              {parseInlineMarkdown(l)}
            </div>
          );
        })}
      </div>
    );
  }

  // Standard formatted markdown response
  const lines = text.split("\n");
  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
      {lines.map((l, idx) => {
        const trimmed = l.trim();
        if (!trimmed) {
          return <div key={idx} style={{ height: 6 }} />;
        }

        // Bullet point
        if (trimmed.startsWith("* ") || trimmed.startsWith("- ") || trimmed.startsWith("• ")) {
          const content = trimmed.replace(/^[\*\-•]\s+/, "");
          return (
            <div
              key={idx}
              style={{
                display: "flex",
                gap: 7,
                alignItems: "flex-start",
                margin: "2px 0",
                paddingLeft: 4,
              }}
            >
              <span style={{ color: "var(--brand)", fontSize: 13, lineHeight: 1.2 }}>•</span>
              <div style={{ flex: 1, fontSize: 12.5, lineHeight: 1.45 }}>
                {parseInlineMarkdown(content)}
              </div>
            </div>
          );
        }

        // Numbered list
        const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
        if (numMatch) {
          return (
            <div
              key={idx}
              style={{
                display: "flex",
                gap: 7,
                alignItems: "flex-start",
                margin: "2px 0",
                paddingLeft: 4,
              }}
            >
              <span
                style={{
                  color: "var(--brand)",
                  fontWeight: 700,
                  fontSize: 11,
                  lineHeight: 1.4,
                  minWidth: 14,
                }}
              >
                {numMatch[1]}.
              </span>
              <div style={{ flex: 1, fontSize: 12.5, lineHeight: 1.45 }}>
                {parseInlineMarkdown(numMatch[2])}
              </div>
            </div>
          );
        }

        // Plain text paragraph
        return (
          <div key={idx} style={{ margin: "2px 0", fontSize: 12.5, lineHeight: 1.5 }}>
            {parseInlineMarkdown(l)}
          </div>
        );
      })}
    </div>
  );
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: string;
  attachmentName?: string;
  extraction?: any;
  inserted?: boolean;
}

export function AiChatAssistant({
  orgId,
  orgName,
  currency = "NPR",
}: {
  orgId: string;
  orgName: string;
  currency?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showQuickTools, setShowQuickTools] = useState(true);
  const [inputMessage, setInputMessage] = useState("");
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [insertingId, setInsertingId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "initial-welcome",
      role: "assistant",
      text: `Hello! I'm your **Kashtrix ERP Copilot** for **${orgName}**.\n\nYou can ask me questions about your ledger, bank balances, or **attach any invoice, bank statement, or bill** (paperclip icon) to auto-extract and insert it directly into the database!`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend !== undefined ? textToSend : inputMessage;
    if (!text.trim() && !attachedFile) return;

    const userMsgId = `user-${Date.now()}`;
    const newMsg: ChatMessage = {
      id: userMsgId,
      role: "user",
      text: text.trim() || (attachedFile ? `Attached: ${attachedFile.name}` : ""),
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      attachmentName: attachedFile?.name,
    };

    setMessages((prev) => [...prev, newMsg]);
    setInputMessage("");
    const fileToSend = attachedFile;
    setAttachedFile(null);
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("orgId", orgId);
      formData.append("message", text);

      // Pass simplified history for multi-turn conversation
      const simplifiedHistory = messages.slice(-5).map((m) => ({
        role: (m.role === "assistant" ? "model" : "user") as "user" | "model",
        text: m.text,
      }));
      formData.append("history", JSON.stringify(simplifiedHistory));

      if (fileToSend) {
        formData.append("file", fileToSend);
      }

      const res = await fetch("/api/ai/chat", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to reach AI Assistant");
      }

      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        text: data.reply || "I analyzed your request.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        extraction: data.extraction,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to communicate with AI");
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          text: `⚠️ **Error:** ${err.message || "Unable to process message. Please check connection."}`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveFromChat = async (msgId: string, extraction: any) => {
    setInsertingId(msgId);

    const bankTransactionsToInsert: any[] = [];
    const expensesToInsert: any[] = [];
    const invoicesToInsert: any[] = [];
    const purchasesToInsert: any[] = [];
    const incomesToInsert: any[] = [];

    if (extraction.documentType === "BANK_STATEMENT" && extraction.bankStatement) {
      (extraction.bankStatement.transactions || []).forEach((tx: any) => {
        bankTransactionsToInsert.push({
          bankAccountId: extraction.matchedBankAccountId,
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
      });
    } else if (extraction.documentType === "EXPENSE" && extraction.expense) {
      expensesToInsert.push(extraction.expense);
    } else if (extraction.documentType === "INVOICE" && extraction.invoice) {
      invoicesToInsert.push(extraction.invoice);
    } else if (extraction.documentType === "PURCHASE_ORDER" && extraction.purchase) {
      purchasesToInsert.push(extraction.purchase);
    } else if (extraction.documentType === "INCOME" && extraction.income) {
      incomesToInsert.push(extraction.income);
    }

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
        throw new Error(data.error || "Failed to commit database insertion");
      }

      toast.success(data.message || "Database updated successfully!");

      // Mark message as inserted
      setMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, inserted: true } : m))
      );
    } catch (err: any) {
      toast.error(err.message || "Failed to insert records");
    } finally {
      setInsertingId(null);
    }
  };

  return (
    <>
      {/* Floating Launcher Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Open AI Financial Copilot"
        title="Open AI Financial Copilot"
        style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          zIndex: 8888,
          height: 48,
          padding: "0 18px",
          borderRadius: 24,
          background: "linear-gradient(135deg, #4a086b 0%, #ef086f 100%)",
          color: "#ffffff",
          border: "none",
          boxShadow: "0 8px 24px -4px rgba(74, 8, 107, 0.4), 0 2px 6px rgba(0, 0, 0, 0.1)",
          display: "inline-flex",
          alignItems: "center",
          gap: 9,
          cursor: "pointer",
          fontWeight: 700,
          fontSize: 13,
          transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        <Sparkles size={17} />
        <span>AI Copilot</span>
        {attachedFile && (
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              background: "#10b981",
              border: "1.5px solid #ffffff",
            }}
          />
        )}
      </button>

      {/* Floating Chat Panel */}
      {isOpen && (
        <div
          style={{
            position: "fixed",
            bottom: 84,
            right: 24,
            zIndex: 8889,
            width: isExpanded ? 640 : 400,
            height: isExpanded ? 700 : 560,
            maxWidth: "calc(100vw - 32px)",
            maxHeight: "calc(100vh - 110px)",
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: 16,
            boxShadow: "0 20px 48px -12px rgba(0, 0, 0, 0.28)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            animation: "modalFadeIn 0.2s ease-out",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "12px 16px",
              background: "linear-gradient(135deg, #4a086b 0%, #ef086f 100%)",
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 7,
                  background: "rgba(255, 255, 255, 0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Bot size={16} />
              </div>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 700, lineHeight: 1.2 }}>Kashtrix ERP Copilot</div>
                <div style={{ fontSize: 10.5, opacity: 0.85 }}>Intelligent Financial Assistant</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <button
                type="button"
                onClick={() => setIsExpanded((prev) => !prev)}
                title={isExpanded ? "Collapse width" : "Expand width"}
                style={{
                  background: "none",
                  border: "none",
                  color: "#ffffff",
                  opacity: 0.85,
                  cursor: "pointer",
                  padding: 4,
                  display: "flex",
                }}
              >
                {isExpanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title="Close chat"
                style={{
                  background: "none",
                  border: "none",
                  color: "#ffffff",
                  opacity: 0.85,
                  cursor: "pointer",
                  padding: 4,
                  display: "flex",
                }}
              >
                <X size={17} />
              </button>
            </div>
          </div>

          {/* Messages Feed */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: 16,
              display: "flex",
              flexDirection: "column",
              gap: 12,
              background: "var(--bg)",
            }}
          >
            {messages.map((m) => {
              const isAssistant = m.role === "assistant";
              return (
                <div
                  key={m.id}
                  style={{
                    display: "flex",
                    gap: 8,
                    alignItems: "flex-start",
                    alignSelf: isAssistant ? "flex-start" : "flex-end",
                    maxWidth: "92%",
                  }}
                >
                  {isAssistant && (
                    <div
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: 6,
                        background: "var(--brand)",
                        color: "#ffffff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        marginTop: 2,
                      }}
                    >
                      <Bot size={14} />
                    </div>
                  )}

                  <div style={{ display: "flex", flexDirection: "column", alignItems: isAssistant ? "flex-start" : "flex-end", maxWidth: isAssistant ? "94%" : "85%" }}>
                    <div
                      style={{
                        padding: "10px 14px",
                        borderRadius: 14,
                        borderBottomLeftRadius: isAssistant ? 3 : 14,
                        borderBottomRightRadius: !isAssistant ? 3 : 14,
                        background: isAssistant ? "var(--surface)" : "var(--brand)",
                        color: isAssistant ? "var(--text)" : "#ffffff",
                        border: isAssistant ? "1px solid var(--line)" : "none",
                        fontSize: 12.5,
                        lineHeight: 1.5,
                        boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                        width: isAssistant ? "100%" : "auto",
                        boxSizing: "border-box",
                      }}
                    >
                      {isAssistant ? (
                        <FormattedAssistantMessage text={m.text} />
                      ) : (
                        <div style={{ whiteSpace: "pre-wrap" }}>{m.text}</div>
                      )}

                      {/* Display Document Attachment pill if uploaded */}
                      {m.attachmentName && (
                        <div
                          style={{
                            marginTop: 6,
                            padding: "4px 8px",
                            borderRadius: 6,
                            background: "rgba(0, 0, 0, 0.15)",
                            fontSize: 11,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5,
                          }}
                        >
                          <FileText size={12} />
                          <span>{m.attachmentName}</span>
                        </div>
                      )}
                    </div>

                    {/* INTERACTIVE EXTRACTION CONFIRMATION CARD (IF PRESENT) */}
                    {m.extraction && (
                      <div
                        style={{
                          marginTop: 8,
                          padding: 12,
                          borderRadius: 12,
                          background: "var(--surface)",
                          border: "1.5px solid var(--line-strong)",
                          boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                          width: "100%",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 800,
                              textTransform: "uppercase",
                              padding: "2px 6px",
                              borderRadius: 4,
                              background: "var(--brand-soft)",
                              color: "var(--brand)",
                            }}
                          >
                            {m.extraction.documentType?.replace("_", " ")}
                          </span>
                          <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>
                            {m.extraction.bankStatement?.transactions?.length || 1} records detected
                          </span>
                        </div>

                        {/* Summary preview */}
                        <div style={{ fontSize: 11.5, color: "var(--text-secondary)", marginBottom: 10 }}>
                          {m.extraction.summary}
                        </div>

                        {/* Action confirmation button */}
                        {m.inserted ? (
                          <div
                            style={{
                              padding: "6px 10px",
                              borderRadius: 6,
                              background: "var(--success-soft)",
                              color: "var(--success)",
                              fontSize: 11.5,
                              fontWeight: 700,
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            <CheckCircle2 size={13} />
                            <span>Inserted into Database Successfully!</span>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleApproveFromChat(m.id, m.extraction)}
                            disabled={insertingId === m.id}
                            style={{
                              width: "100%",
                              padding: "7px 12px",
                              borderRadius: 8,
                              border: "none",
                              background: "linear-gradient(135deg, #059669 0%, #10b981 100%)",
                              color: "#ffffff",
                              fontSize: 12,
                              fontWeight: 700,
                              cursor: insertingId === m.id ? "not-allowed" : "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: 6,
                              boxShadow: "0 2px 6px rgba(5, 150, 105, 0.25)",
                            }}
                          >
                            {insertingId === m.id ? (
                              <>
                                <Loader2 size={13} className="spin" />
                                <span>Updating Database...</span>
                              </>
                            ) : (
                              <>
                                <CheckCircle2 size={13} />
                                <span>Approve & Insert into DB →</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    )}

                    <span style={{ fontSize: 9.5, color: "var(--text-muted)", marginTop: 2, padding: "0 2px" }}>
                      {m.timestamp}
                    </span>
                  </div>

                  {!isAssistant && (
                    <div
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: 6,
                        background: "var(--brand-pink)",
                        color: "#ffffff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        marginTop: 2,
                      }}
                    >
                      <User size={14} />
                    </div>
                  )}
                </div>
              );
            })}

            {loading && (
              <div style={{ display: "flex", gap: 8, alignItems: "center", alignSelf: "flex-start" }}>
                <div
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 6,
                    background: "var(--brand)",
                    color: "#ffffff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Bot size={14} />
                </div>
                <div
                  style={{
                    padding: "8px 14px",
                    borderRadius: 14,
                    background: "var(--surface)",
                    border: "1px solid var(--line)",
                    fontSize: 12,
                    color: "var(--text-muted)",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <Loader2 size={14} className="spin" />
                  <span>Kashtrix AI is analyzing ledger & documents...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Financial Action Prompt Chips (Scroll-Free & Dismissable) */}
          {showQuickTools && (
            <div
              style={{
                padding: "6px 10px",
                background: "var(--surface)",
                borderTop: "1px solid var(--line)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 6,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 5,
                  alignItems: "center",
                  flex: 1,
                  overflow: "hidden",
                }}
              >
                {[
                  { label: "💰 Balances", prompt: "Show my liquid cash and bank balances" },
                  { label: "📊 Expenses", prompt: "Show summary of recent expenses" },
                  { label: "🧾 Invoices", prompt: "List unpaid invoices and dues" },
                  { label: "📎 Statement Help", prompt: "How do I attach and auto-extract bank statements or bills?" },
                ].map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => handleSendMessage(item.prompt)}
                    style={{
                      padding: "3px 8px",
                      borderRadius: 12,
                      border: "1px solid var(--line)",
                      background: "var(--soft)",
                      color: "var(--text-secondary)",
                      fontSize: 10.5,
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "var(--brand)";
                      e.currentTarget.style.color = "var(--brand)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "var(--line)";
                      e.currentTarget.style.color = "var(--text-secondary)";
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setShowQuickTools(false)}
                title="Hide quick tools"
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                  padding: 3,
                  borderRadius: 4,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <X size={12} />
              </button>
            </div>
          )}

          {/* Attachment Preview (if selected) */}
          {attachedFile && (
            <div
              style={{
                padding: "6px 12px",
                background: "var(--brand-soft)",
                borderTop: "1px solid var(--brand-border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                fontSize: 11.5,
                color: "var(--brand)",
                fontWeight: 600,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <FileText size={13} />
                <span>Ready to attach: {attachedFile.name} ({(attachedFile.size / 1024).toFixed(1)} KB)</span>
              </div>
              <button
                type="button"
                onClick={() => setAttachedFile(null)}
                style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer", padding: 2 }}
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* Input Box */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            style={{
              padding: "10px 12px",
              background: "var(--surface)",
              borderTop: "1px solid var(--line)",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp,.csv,.txt"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setAttachedFile(f);
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Attach statement, bill, or invoice"
              style={{
                background: attachedFile ? "var(--brand-soft)" : "var(--soft)",
                border: "1px solid var(--line)",
                borderRadius: 8,
                padding: "7px 9px",
                color: attachedFile ? "var(--brand)" : "var(--text-muted)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Paperclip size={15} />
            </button>

            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder={attachedFile ? "Add instruction or press Enter..." : "Ask ledger questions or attach statement..."}
              disabled={loading}
              style={{
                flex: 1,
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid var(--line)",
                background: "var(--soft)",
                color: "var(--text)",
                fontSize: 12.5,
                outline: "none",
              }}
            />

            <button
              type="submit"
              disabled={loading || (!inputMessage.trim() && !attachedFile)}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "none",
                background: "linear-gradient(135deg, #4a086b 0%, #ef086f 100%)",
                color: "#ffffff",
                cursor: loading || (!inputMessage.trim() && !attachedFile) ? "not-allowed" : "pointer",
                opacity: loading || (!inputMessage.trim() && !attachedFile) ? 0.5 : 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Send size={14} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
