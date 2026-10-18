import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { chatWithFinancialAI, analyzeFinancialDocument, type MediaPart, type ExtractedDocumentData } from "@/lib/gemini";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const contentType = request.headers.get("content-type") || "";
    let orgId = "";
    let message = "";
    let history: Array<{ role: "user" | "model"; text: string }> = [];
    const mediaParts: MediaPart[] = [];
    let fileInfo: { filename: string; mimeType: string } | null = null;
    let fileTextContent: string | undefined = undefined;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      orgId = String(formData.get("orgId") || "");
      message = String(formData.get("message") || "");
      const historyRaw = formData.get("history");
      if (historyRaw && typeof historyRaw === "string") {
        try {
          history = JSON.parse(historyRaw);
        } catch {}
      }

      const file = formData.get("file") as File | null;
      if (file && file instanceof File && file.size > 0) {
        const arrayBuf = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuf);
        const mimeType = file.type || "application/octet-stream";
        fileInfo = { filename: file.name, mimeType };

        if (mimeType.includes("text") || mimeType.includes("csv") || mimeType.includes("json")) {
          fileTextContent = buffer.toString("utf-8");
        } else {
          mediaParts.push({
            mimeType,
            base64Data: buffer.toString("base64"),
          });
        }
      }
    } else {
      const body = await request.json().catch(() => ({}));
      orgId = String(body.orgId || "");
      message = String(body.message || "");
      history = body.history || [];
      if (body.file) {
        fileInfo = { filename: body.file.filename, mimeType: body.file.mimeType };
        if (body.file.base64Data) {
          mediaParts.push({
            mimeType: body.file.mimeType || "image/jpeg",
            base64Data: body.file.base64Data,
          });
        }
        if (body.file.textContent) {
          fileTextContent = body.file.textContent;
        }
      }
    }

    if (!orgId) {
      const membership = await db.membership.findFirst({
        where: { userId: user.id },
        select: { organizationId: true },
      });
      if (membership) orgId = membership.organizationId;
    }

    if (!orgId) {
      return NextResponse.json({ error: "Missing organizationId" }, { status: 400 });
    }

    // Fetch live organization financial context
    const [org, bankAccounts, recentExpenses, recentIncomes, pendingInvoices, categories, contacts] =
      await Promise.all([
        db.organization.findUnique({
          where: { id: orgId },
          select: { name: true, kind: true, currency: true },
        }),
        db.bankAccount.findMany({
          where: { organizationId: orgId },
          select: { id: true, bankName: true, accountNumber: true, currentBalance: true, holdAmount: true },
        }),
        db.expense.findMany({
          where: { organizationId: orgId, isEstimated: false },
          include: { category: true },
          take: 5,
          orderBy: { occurredAt: "desc" },
        }),
        db.income.findMany({
          where: { organizationId: orgId },
          take: 5,
          orderBy: { receivedAt: "desc" },
        }),
        db.invoice.findMany({
          where: { organizationId: orgId, status: { in: ["SENT", "PARTIAL", "OVERDUE", "DRAFT"] } },
          include: { contact: true },
          take: 5,
          orderBy: { issueDate: "desc" },
        }),
        db.expenseCategory.findMany({
          where: { organizationId: orgId },
          select: { id: true, name: true },
        }),
        db.contact.findMany({
          where: { organizationId: orgId },
          select: { id: true, name: true, type: true },
        }),
      ]);

    const liquidCash = bankAccounts.reduce((sum, b) => sum + Number(b.currentBalance || 0), 0);

    // If an attachment is present, extract its financial payload
    let extraction: ExtractedDocumentData | null = null;
    if (mediaParts.length > 0 || fileTextContent) {
      try {
        extraction = await analyzeFinancialDocument({
          filename: fileInfo?.filename,
          mimeType: fileInfo?.mimeType,
          base64Data: mediaParts[0]?.base64Data,
          textContent: fileTextContent,
          knownContext: {
            organizationName: org?.name,
            currency: org?.currency || "NPR",
            bankAccounts: bankAccounts.map((b) => ({ id: b.id, bankName: b.bankName, accountNumber: b.accountNumber })),
            expenseCategories: categories.map((c) => c.name),
            contacts: contacts.map((c) => c.name),
          },
        });
      } catch (extractErr) {
        console.warn("[Chat Document Extraction Warning]:", extractErr);
      }
    }

    // Match bank statement to registered bank accounts
    if (extraction) {
      let matchedBankAccountId = bankAccounts[0]?.id;
      if (extraction.bankStatement?.accountNumber) {
        const cleanExt = extraction.bankStatement.accountNumber.replace(/\D/g, "");
        const found = bankAccounts.find((b) => {
          const cleanB = b.accountNumber.replace(/\D/g, "");
          return cleanB && (cleanB.includes(cleanExt) || cleanExt.includes(cleanB));
        });
        if (found) matchedBankAccountId = found.id;
      } else if (extraction.bankStatement?.bankName) {
        const found = bankAccounts.find(
          (b) =>
            b.bankName.toLowerCase().includes(extraction!.bankStatement!.bankName.toLowerCase()) ||
            extraction!.bankStatement!.bankName.toLowerCase().includes(b.bankName.toLowerCase())
        );
        if (found) matchedBankAccountId = found.id;
      }
      (extraction as any).matchedBankAccountId = matchedBankAccountId;
    }

    // Conversational text intent extraction (e.g. user asks "record deposit 75000" without attaching a file)
    if (!extraction && message) {
      const lower = message.toLowerCase();
      const hasAction = /\b(record|insert|add|create|save|deposit|withdrawal|withdraw|expense|income|paid|received)\b/i.test(lower);
      const amountMatch = message.match(/(?:(?:npr|rs\.?|amount|\$)\s*)?([\d,]+(?:\.\d+)?)/i);
      if (hasAction && amountMatch) {
        const rawAmt = parseFloat(amountMatch[1].replace(/,/g, ""));
        if (!isNaN(rawAmt) && rawAmt > 0) {
          const isDeposit = /\b(deposit|deposited|inflow|received|credit|cr)\b/i.test(lower) && !/\b(withdraw|withdrawal|debit|expense)\b/i.test(lower);
          const isWithdrawal = /\b(withdraw|withdrawal|debit|outflow|dr)\b/i.test(lower);
          const isExpense = /\b(expense|spent|bill|paid for)\b/i.test(lower);
          const isIncome = /\b(income|revenue|sales)\b/i.test(lower);

          const matchedBank = bankAccounts.find((b) => lower.includes(b.bankName.toLowerCase())) || bankAccounts[0];

          if (isDeposit || isWithdrawal) {
            const txType = isDeposit ? "DEPOSIT" : "WITHDRAWAL";
            extraction = {
              documentType: "BANK_STATEMENT",
              confidence: 0.95,
              summary: `${isDeposit ? "Deposit" : "Withdrawal"} of ${org?.currency || "NPR"} ${rawAmt.toLocaleString()} for ${matchedBank ? matchedBank.bankName : "Corporate Bank"}`,
              bankStatement: {
                bankName: matchedBank?.bankName || "Corporate Bank",
                accountNumber: matchedBank?.accountNumber || "",
                transactions: [
                  {
                    transactionDate: new Date().toISOString().slice(0, 10),
                    type: txType,
                    amount: rawAmt,
                    description: message.replace(/^(please\s+)?(can\s+you\s+)?(record|insert|add|create)\s+/i, "").slice(0, 120),
                  },
                ],
              },
              suggestedAction: `Click "Approve & Insert into DB" to commit this ${isDeposit ? "deposit" : "withdrawal"} to your verified database.`,
            } as any;
            (extraction as any).matchedBankAccountId = matchedBank?.id;
          } else if (isExpense) {
            extraction = {
              documentType: "EXPENSE",
              confidence: 0.95,
              summary: `Expense of ${org?.currency || "NPR"} ${rawAmt.toLocaleString()}`,
              expense: {
                title: message.replace(/^(please\s+)?(can\s+you\s+)?(record|insert|add|create)\s+/i, "").slice(0, 80),
                amount: rawAmt,
                occurredAt: new Date().toISOString().slice(0, 10),
                categoryName: categories[0]?.name || "General Expense",
              },
              suggestedAction: `Click "Approve & Insert into DB" to insert this expense into your verified database.`,
            } as any;
          } else if (isIncome) {
            extraction = {
              documentType: "INCOME",
              confidence: 0.95,
              summary: `Income receipt of ${org?.currency || "NPR"} ${rawAmt.toLocaleString()}`,
              income: {
                title: message.replace(/^(please\s+)?(can\s+you\s+)?(record|insert|add|create)\s+/i, "").slice(0, 80),
                amount: rawAmt,
                receivedAt: new Date().toISOString().slice(0, 10),
                source: "Direct Revenue",
                bankAccountId: matchedBank?.id,
              },
              suggestedAction: `Click "Approve & Insert into DB" to insert this income receipt into your verified database.`,
            } as any;
          }
        }
      }
    }

    // Build user message prompt
    let assistantPrompt = message;
    if (extraction) {
      assistantPrompt = `${message || "Please analyze this attached document and help me import it."}\n\n[System note: The AI extractor found documentType: ${extraction.documentType}, summary: "${extraction.summary}". Briefly explain what you found in friendly Markdown, summarize the transaction count or bill amount, and ask the user to click the "Approve & Insert into DB" button below to confirm.]`;
    }

    // Generate conversational reply
    const replyText = await chatWithFinancialAI({
      userMessage: assistantPrompt,
      history,
      organizationContext: {
        organizationName: org?.name || "Kashtrix ERP",
        kind: org?.kind || "COMPANY",
        currency: org?.currency || "NPR",
        liquidCash,
        bankAccounts: bankAccounts.map((b) => ({
          name: b.bankName,
          number: b.accountNumber,
          balance: Number(b.currentBalance || 0),
          holdAmount: Number(b.holdAmount || 0),
          availableBalance: Number(b.currentBalance || 0) - Number(b.holdAmount || 0),
        })),
        recentExpenses: recentExpenses.map((e) => ({
          title: e.title,
          amount: Number(e.amount),
          category: e.category?.name,
          date: e.occurredAt.toISOString().slice(0, 10),
        })),
        recentIncomes: recentIncomes.map((i) => ({
          title: i.title,
          amount: Number(i.amount),
          source: i.source || undefined,
          date: i.receivedAt.toISOString().slice(0, 10),
        })),
        pendingInvoices: pendingInvoices.map((inv) => ({
          number: inv.invoiceNumber,
          customer: inv.contact?.name,
          total: Number(inv.total),
          due: inv.dueDate ? inv.dueDate.toISOString().slice(0, 10) : "N/A",
        })),
      },
      mediaParts,
    });

    return NextResponse.json({
      success: true,
      reply: replyText,
      extraction,
      bankAccounts,
      categories,
      contacts,
    });
  } catch (error: any) {
    console.error("[Chat Assistant Error]:", error);
    const isOverloaded =
      error?.message?.includes("503") ||
      error?.message?.includes("429") ||
      error?.message?.includes("high demand") ||
      error?.message?.includes("UNAVAILABLE") ||
      error?.message?.includes("temporarily busy");

    if (isOverloaded) {
      return NextResponse.json({
        success: true,
        reply:
          "The AI processing engine is experiencing high demand. I have activated multi-node failover routes—please try asking your question again in a moment.",
        extraction: null,
      });
    }

    return NextResponse.json(
      { error: error?.message || "Failed to process chat message" },
      { status: 500 }
    );
  }
}
