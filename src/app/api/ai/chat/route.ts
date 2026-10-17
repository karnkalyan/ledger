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
          select: { id: true, bankName: true, accountNumber: true, currentBalance: true },
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
        organizationName: org?.name || "Flowledger Suite",
        kind: org?.kind || "COMPANY",
        currency: org?.currency || "NPR",
        liquidCash,
        bankAccounts: bankAccounts.map((b) => ({
          name: b.bankName,
          number: b.accountNumber,
          balance: Number(b.currentBalance || 0),
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
    return NextResponse.json(
      { error: error?.message || "Failed to process chat message" },
      { status: 500 }
    );
  }
}
