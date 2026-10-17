import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { analyzeFinancialDocument, type ExtractedDocumentData } from "@/lib/gemini";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const contentType = request.headers.get("content-type") || "";
    let orgId = "";
    let targetBankAccountId = "";
    const filesToProcess: Array<{
      filename: string;
      mimeType: string;
      base64Data?: string;
      textContent?: string;
    }> = [];

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      orgId = String(formData.get("orgId") || "");
      targetBankAccountId = String(formData.get("bankAccountId") || "");

      const files = formData.getAll("files") as File[];
      const singleFile = formData.get("file") as File | null;
      const allFiles = [...(singleFile ? [singleFile] : []), ...files].filter(Boolean);

      for (const file of allFiles) {
        if (!(file instanceof File) || file.size === 0) continue;
        const arrayBuf = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuf);
        const mimeType = file.type || "application/octet-stream";
        const filename = file.name || "uploaded-document";

        if (mimeType.includes("text") || mimeType.includes("csv") || mimeType.includes("json")) {
          filesToProcess.push({
            filename,
            mimeType,
            textContent: buffer.toString("utf-8"),
          });
        } else {
          filesToProcess.push({
            filename,
            mimeType,
            base64Data: buffer.toString("base64"),
          });
        }
      }

      // If text/raw content was also passed
      const textParam = formData.get("text");
      if (textParam && typeof textParam === "string" && textParam.trim().length > 0) {
        filesToProcess.push({
          filename: "manual-input.txt",
          mimeType: "text/plain",
          textContent: textParam,
        });
      }
    } else {
      const body = await request.json().catch(() => ({}));
      orgId = String(body.orgId || "");
      targetBankAccountId = String(body.bankAccountId || "");

      if (body.files && Array.isArray(body.files)) {
        for (const f of body.files) {
          filesToProcess.push({
            filename: f.filename || "document",
            mimeType: f.mimeType || "image/jpeg",
            base64Data: f.base64Data,
            textContent: f.textContent,
          });
        }
      } else if (body.base64Data || body.textContent) {
        filesToProcess.push({
          filename: body.filename || "document",
          mimeType: body.mimeType || "image/jpeg",
          base64Data: body.base64Data,
          textContent: body.textContent,
        });
      }
    }

    if (!orgId) {
      // Lookup default user membership org
      const membership = await db.membership.findFirst({
        where: { userId: user.id },
        select: { organizationId: true },
      });
      if (membership) orgId = membership.organizationId;
    }

    if (!orgId) {
      return NextResponse.json({ error: "Missing organizationId" }, { status: 400 });
    }

    if (filesToProcess.length === 0) {
      return NextResponse.json({ error: "No files or text provided for analysis" }, { status: 400 });
    }

    // Load organization context to guide AI matching
    const [organization, bankAccounts, categories, contacts] = await Promise.all([
      db.organization.findUnique({
        where: { id: orgId },
        select: { name: true, currency: true },
      }),
      db.bankAccount.findMany({
        where: { organizationId: orgId },
        select: { id: true, bankName: true, accountNumber: true },
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

    const results: Array<{
      filename: string;
      extracted: ExtractedDocumentData;
      matchedBankAccountId?: string;
      matchedCategoryId?: string;
      matchedContactId?: string;
    }> = [];

    for (const item of filesToProcess) {
      const extracted = await analyzeFinancialDocument({
        filename: item.filename,
        mimeType: item.mimeType,
        base64Data: item.base64Data,
        textContent: item.textContent,
        knownContext: {
          organizationName: organization?.name,
          currency: organization?.currency || "NPR",
          bankAccounts: bankAccounts.map((b) => ({ id: b.id, bankName: b.bankName, accountNumber: b.accountNumber })),
          expenseCategories: categories.map((c) => c.name),
          contacts: contacts.map((c) => c.name),
        },
      });

      // Match Bank Account
      let matchedBankAccountId = targetBankAccountId || undefined;
      if (!matchedBankAccountId && extracted.bankStatement) {
        const stmtBank = (extracted.bankStatement.bankName || "").toLowerCase();
        const stmtAcc = (extracted.bankStatement.accountNumber || "").replace(/[^0-9]/g, "");

        const exactMatch = bankAccounts.find(
          (b) =>
            (stmtAcc && b.accountNumber.replace(/[^0-9]/g, "").includes(stmtAcc)) ||
            (stmtBank && b.bankName.toLowerCase().includes(stmtBank))
        );
        if (exactMatch) matchedBankAccountId = exactMatch.id;
      }

      // Match Expense Category
      let matchedCategoryId: string | undefined;
      if (extracted.expense?.categoryName) {
        const cat = categories.find((c) =>
          c.name.toLowerCase().includes((extracted.expense?.categoryName || "").toLowerCase())
        );
        if (cat) matchedCategoryId = cat.id;
      }

      // Match Contact
      let matchedContactId: string | undefined;
      const targetName =
        extracted.invoice?.customerName ||
        extracted.purchase?.vendorName ||
        extracted.income?.source;

      if (targetName) {
        const contact = contacts.find((c) =>
          c.name.toLowerCase().includes(targetName.toLowerCase())
        );
        if (contact) matchedContactId = contact.id;
      }

      results.push({
        filename: item.filename,
        extracted,
        matchedBankAccountId,
        matchedCategoryId,
        matchedContactId,
      });
    }

    return NextResponse.json({
      success: true,
      orgId,
      currency: organization?.currency || "NPR",
      results,
      bankAccounts,
      categories,
      contacts,
    });
  } catch (error: any) {
    console.error("[Document Analysis Error]:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to analyze document with AI" },
      { status: 500 }
    );
  }
}
