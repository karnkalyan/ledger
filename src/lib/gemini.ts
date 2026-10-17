/**
 * Google Gemini 2.5 Flash Multimodal Intelligence Engine
 * Handles document analysis, financial statement extraction, and conversational ledger assistance.
 */

// Decoded default production Gemini API Key
const FALLBACK_GEMINI_KEY = Buffer.from("QVEuQWI4Uk42TDRLWGpLb1UxemF6Qkl6eUY2c3NYTEp2U2pYMXdfVTF1WGktYVBCY0tmcWc=", "base64").toString("utf-8");

export function getGeminiApiKey(): string {
  const envKey = process.env.GEMINI_API_KEY?.trim();
  if (envKey && envKey.length > 5) return envKey;
  return FALLBACK_GEMINI_KEY;
}

export interface ExtractedBankTransaction {
  transactionDate: string; // YYYY-MM-DD
  valueDate?: string;
  type: "DEPOSIT" | "WITHDRAWAL";
  amount: number;
  balance?: number;
  description: string;
  reference?: string;
  chequeNumber?: string;
  category?: string;
}

export interface ExtractedInvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate?: number;
  amount: number;
}

export interface ExtractedDocumentData {
  documentType: "BANK_STATEMENT" | "INVOICE" | "PURCHASE_ORDER" | "EXPENSE" | "INCOME" | "UNKNOWN";
  confidence: number;
  summary: string;
  bankStatement?: {
    bankName: string;
    accountNumber: string;
    accountHolder?: string;
    branch?: string;
    currency?: string;
    openingBalance?: number;
    closingBalance?: number;
    startDate?: string;
    endDate?: string;
    transactions: ExtractedBankTransaction[];
  };
  invoice?: {
    customerName: string;
    customerEmail?: string;
    customerPhone?: string;
    customerPanVat?: string;
    invoiceNumber: string;
    issueDate: string;
    dueDate?: string;
    subtotal: number;
    tax: number;
    discount?: number;
    total: number;
    notes?: string;
    items: ExtractedInvoiceItem[];
  };
  purchase?: {
    vendorName: string;
    vendorEmail?: string;
    vendorPhone?: string;
    vendorPanVat?: string;
    orderNumber: string;
    orderDate: string;
    subtotal: number;
    tax?: number;
    discount?: number;
    total: number;
    notes?: string;
    items: ExtractedInvoiceItem[];
  };
  expense?: {
    title: string;
    vendor?: string;
    categoryName?: string;
    amount: number;
    occurredAt: string;
    paymentMethod?: string;
    notes?: string;
  };
  income?: {
    title: string;
    source?: string;
    amount: number;
    receivedAt: string;
    paymentMethod?: string;
    notes?: string;
  };
  suggestedAction: string;
  rawTextPreview?: string;
}

export interface MediaPart {
  mimeType: string;
  base64Data: string;
}

const GEMINI_FALLBACK_MODELS = [
  "gemini-2.5-flash",
  "gemini-flash-latest",
  "gemini-3.5-flash",
  "gemini-3.1-flash-lite",
  "gemini-3-flash-preview",
];

/**
 * Calls Gemini with multimodal parts (text, image, pdf base64)
 * Features resilient multi-model failover and retries to guard against HTTP 503 (high demand) / HTTP 429.
 */
export async function generateGeminiContent({
  prompt,
  systemInstruction,
  mediaParts = [],
  responseJson = false,
}: {
  prompt: string;
  systemInstruction?: string;
  mediaParts?: MediaPart[];
  responseJson?: boolean;
}): Promise<string> {
  const apiKey = getGeminiApiKey();

  const parts: Array<Record<string, unknown>> = [];

  // Add any media attachments (images, PDF)
  for (const media of mediaParts) {
    parts.push({
      inlineData: {
        mimeType: media.mimeType,
        data: media.base64Data,
      },
    });
  }

  // Add the text prompt
  parts.push({ text: prompt });

  const body: Record<string, unknown> = {
    contents: [
      {
        parts,
      },
    ],
    generationConfig: {
      temperature: responseJson ? 0.1 : 0.4,
      maxOutputTokens: 8192,
    },
  };

  if (systemInstruction) {
    body.systemInstruction = {
      parts: [{ text: systemInstruction }],
    };
  }

  if (responseJson) {
    body.generationConfig = {
      ...(body.generationConfig as Record<string, unknown>),
      responseMimeType: "application/json",
    };
  }

  let lastError: Error | null = null;

  // Try candidate models in high-availability sequence
  for (const model of GEMINI_FALLBACK_MODELS) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });

        if (res.ok) {
          const json = await res.json();
          const candidate = json?.candidates?.[0];
          const replyText = candidate?.content?.parts?.[0]?.text;
          if (replyText) {
            return replyText;
          }
        }

        const errorText = await res.text();
        const isSpikeOrRateLimit =
          res.status === 503 || res.status === 429 || res.status >= 500;

        console.warn(
          `[Gemini HA Failover] Model ${model} (attempt ${attempt}) returned HTTP ${res.status}: ${errorText.slice(0, 100)}`
        );

        lastError = new Error(
          `Gemini API error (HTTP ${res.status}): ${errorText}`
        );

        // If it's a temporary 503 spike, wait briefly before retrying or switching models
        if (isSpikeOrRateLimit && attempt === 1) {
          await new Promise((resolve) => setTimeout(resolve, 600));
          continue;
        }

        // Move to the next model in the fallback cascade
        break;
      } catch (err: any) {
        console.warn(
          `[Gemini Network Error] Model ${model} failed: ${err?.message}`
        );
        lastError = err;
        if (attempt === 1) {
          await new Promise((resolve) => setTimeout(resolve, 600));
          continue;
        }
        break;
      }
    }
  }

  throw (
    lastError ||
    new Error(
      "Kashtrix AI engine is temporarily busy. Please try your request again in a few seconds."
    )
  );
}

/**
 * Analyzes a financial document (bank statement, invoice, purchase bill, expense receipt)
 * and returns structured JSON for review and DB insertion.
 */
export async function analyzeFinancialDocument({
  filename,
  mimeType,
  base64Data,
  textContent,
  knownContext,
}: {
  filename?: string;
  mimeType?: string;
  base64Data?: string;
  textContent?: string;
  knownContext?: {
    organizationName?: string;
    currency?: string;
    bankAccounts?: Array<{ id: string; bankName: string; accountNumber: string }>;
    expenseCategories?: string[];
    contacts?: string[];
  };
}): Promise<ExtractedDocumentData> {
  const contextDescription = knownContext
    ? `
Current Organization Context:
- Currency: ${knownContext.currency || "NPR"}
- Known Bank Accounts: ${JSON.stringify(knownContext.bankAccounts || [])}
- Known Expense Categories: ${JSON.stringify(knownContext.expenseCategories || [])}
- Known Customers / Vendors: ${JSON.stringify(knownContext.contacts || [])}
`
    : "";

  const systemInstruction = `
You are an expert Chief Financial Auditor and automated accounting AI parser for Nepal and international business accounting systems.
Your job is to read any document (Bank Statement, Customer Invoice, Vendor Purchase Order/Bill, Expense Receipt, Milk/Electricity bill, or Income slip) and accurately extract structured accounting data to update a database.

IMPORTANT EXTRACTION RULES:
1. Identify the documentType:
   - "BANK_STATEMENT": A bank account transaction statement or ledger with debits, credits, balances.
   - "INVOICE": A sales bill issued to a customer for goods/services delivered.
   - "PURCHASE_ORDER": A vendor purchase bill or order for supplies/services bought.
   - "EXPENSE": A payment receipt, slip, petrol/fuel bill, restaurant receipt, or petty cash voucher.
   - "INCOME": A receipt voucher or proof of payment received.
2. In Bank Statements:
   - Extract bankName (e.g. Siddhartha Bank, Nabil Bank, Global IME Bank, NIC Asia, Everest Bank, Standard Chartered, etc.)
   - Extract accountNumber, accountHolder, branch, openingBalance, closingBalance, startDate, endDate.
   - Extract ALL individual transactions accurately! For each transaction:
     - transactionDate (YYYY-MM-DD format; if in BS Nepali date, convert or estimate corresponding AD date or keep readable)
     - type: "DEPOSIT" (credit/inflow) or "WITHDRAWAL" (debit/outflow)
     - amount: positive numeric value
     - balance: running balance if present
     - description: payee, narration, or transaction remark
     - reference: cheque number, Fonepay/UPI trace ID, or reference number
     - category: best guess category (e.g., "Office Expense", "Client Deposit", "Staff Salary", "Transfer", "Bank Charges")
3. In Invoices or Purchase Orders:
   - Extract customer/vendor name, PAN/VAT number if present, phone, email, invoice/bill number, date.
   - Extract each item: description, quantity (default 1), unitPrice, taxRate (e.g., 13% VAT in Nepal), amount.
   - Extract subtotal, tax, discount, total.
4. In Expense Receipts:
   - Extract title, vendor, amount, occurredAt date, paymentMethod (CASH, BANK, Fonepay), notes.
5. You MUST return ONLY valid JSON matching the exact schema specified.
`;

  const prompt = `
Analyze the attached document${filename ? ` named "${filename}"` : ""}.
${contextDescription}

${textContent ? `Text Content extracted from document:\n${textContent}\n` : ""}

Return a JSON object with this exact structure:
{
  "documentType": "BANK_STATEMENT" | "INVOICE" | "PURCHASE_ORDER" | "EXPENSE" | "INCOME" | "UNKNOWN",
  "confidence": 0.95,
  "summary": "Brief 1-sentence summary of what this document is and what was found",
  "bankStatement": {
    "bankName": "Bank Name",
    "accountNumber": "Account Number",
    "accountHolder": "Account Holder Name",
    "branch": "Branch Name",
    "currency": "NPR",
    "openingBalance": 0,
    "closingBalance": 0,
    "startDate": "YYYY-MM-DD",
    "endDate": "YYYY-MM-DD",
    "transactions": [
      {
        "transactionDate": "YYYY-MM-DD",
        "valueDate": "YYYY-MM-DD",
        "type": "DEPOSIT" | "WITHDRAWAL",
        "amount": 1000.00,
        "balance": 50000.00,
        "description": "Narration text",
        "reference": "REF123",
        "chequeNumber": "CHQ123",
        "category": "Estimated category"
      }
    ]
  },
  "invoice": {
    "customerName": "Customer Name",
    "customerEmail": "email@example.com",
    "customerPhone": "9800000000",
    "customerPanVat": "123456789",
    "invoiceNumber": "INV-001",
    "issueDate": "YYYY-MM-DD",
    "dueDate": "YYYY-MM-DD",
    "subtotal": 1000.00,
    "tax": 130.00,
    "discount": 0,
    "total": 1130.00,
    "notes": "Payment terms",
    "items": [
      {
        "description": "Item description",
        "quantity": 1,
        "unitPrice": 1000.00,
        "taxRate": 13,
        "amount": 1000.00
      }
    ]
  },
  "purchase": {
    "vendorName": "Vendor Name",
    "vendorEmail": "vendor@example.com",
    "vendorPhone": "9800000000",
    "vendorPanVat": "123456789",
    "orderNumber": "PO-001",
    "orderDate": "YYYY-MM-DD",
    "subtotal": 500.00,
    "tax": 65.00,
    "discount": 0,
    "total": 565.00,
    "notes": "Delivery note",
    "items": [
      {
        "description": "Supplies description",
        "quantity": 1,
        "unitPrice": 500.00,
        "amount": 500.00
      }
    ]
  },
  "expense": {
    "title": "Expense Title",
    "vendor": "Vendor Name",
    "categoryName": "Category",
    "amount": 450.00,
    "occurredAt": "YYYY-MM-DD",
    "paymentMethod": "CASH | BANK | Fonepay",
    "notes": "Memo"
  },
  "income": {
    "title": "Income Title",
    "source": "Client / Source",
    "amount": 25000.00,
    "receivedAt": "YYYY-MM-DD",
    "paymentMethod": "BANK | CASH",
    "notes": "Memo"
  },
  "suggestedAction": "e.g. Insert 15 bank transactions into Siddhartha Bank account"
}
`;

  const mediaParts: MediaPart[] = [];
  if (base64Data && mimeType) {
    mediaParts.push({
      mimeType,
      base64Data,
    });
  }

  const rawJson = await generateGeminiContent({
    prompt,
    systemInstruction,
    mediaParts,
    responseJson: true,
  });

  try {
    const parsed = JSON.parse(rawJson) as ExtractedDocumentData;
    return parsed;
  } catch {
    // If wrapping in markdown code block
    const cleaned = rawJson.replace(/```json\n?|\n?```/g, "").trim();
    return JSON.parse(cleaned) as ExtractedDocumentData;
  }
}

/**
 * Conversational Financial AI Assistant answering user ledger queries.
 */
export async function chatWithFinancialAI({
  userMessage,
  history = [],
  organizationContext,
  mediaParts = [],
}: {
  userMessage: string;
  history?: Array<{ role: "user" | "model"; text: string }>;
  organizationContext: {
    organizationName: string;
    kind: string;
    currency: string;
    currentFiscalYear?: string;
    liquidCash?: number;
    bankAccounts?: Array<{ name: string; number: string; balance: number }>;
    recentExpenses?: Array<{ title: string; amount: number; category?: string; date: string }>;
    recentIncomes?: Array<{ title: string; amount: number; source?: string; date: string }>;
    pendingInvoices?: Array<{ number: string; customer?: string; total: number; due: string }>;
  };
  mediaParts?: MediaPart[];
}): Promise<string> {
  const contextPrompt = `
You are "Kashtrix ERP Copilot", the intelligent financial copilot for "${organizationContext.organizationName}".
The organization currency is ${organizationContext.currency}. Workspace type: ${organizationContext.kind}.

LIVE FINANCIAL SNAPSHOT:
- Total Liquid Cash in Banks: ${organizationContext.currency} ${(organizationContext.liquidCash || 0).toLocaleString()}
- Registered Bank Accounts:
${(organizationContext.bankAccounts || []).map((b) => `  * ${b.name} (${b.number}): ${organizationContext.currency} ${b.balance.toLocaleString()}`).join("\n") || "  None"}
- Recent Expenses (last records):
${(organizationContext.recentExpenses || []).map((e) => `  * ${e.date}: ${e.title} (${e.category || "General"}) - ${organizationContext.currency} ${e.amount.toLocaleString()}`).join("\n") || "  None"}
- Recent Incomes:
${(organizationContext.recentIncomes || []).map((i) => `  * ${i.date}: ${i.title} (${i.source || "Direct"}) - ${organizationContext.currency} ${i.amount.toLocaleString()}`).join("\n") || "  None"}
- Pending / Unpaid Invoices:
${(organizationContext.pendingInvoices || []).map((inv) => `  * #${inv.number} (${inv.customer || "Client"}): ${organizationContext.currency} ${inv.total.toLocaleString()} [Due: ${inv.due}]`).join("\n") || "  None"}

INSTRUCTIONS:
1. Provide concise, direct, helpful, and professional answers with neat Markdown formatting.
2. If the user asks about bank balances, cash flow, outstanding bills, or taxes, reference the live data above.
3. If the user uploads or asks to analyze a document, explain what you observe and guide them on confirming database insertion.
4. Be polite, precise, and supportive.
5. When providing monthly or period bank/ledger activity summaries, clearly highlight:
   * **Total Income:** [Currency] [Amount]
   * **Total Expenses:** [Currency] [Amount]
   And clearly specify the net outcome (e.g. "This results in a net outflow of **[Currency] [Amount]**" or net inflow).
`;

  // Build conversation transcript
  let conversationText = "";
  for (const msg of history.slice(-6)) {
    conversationText += `${msg.role === "user" ? "User" : "Assistant"}: ${msg.text}\n`;
  }
  conversationText += `User: ${userMessage}\nAssistant:`;

  return generateGeminiContent({
    prompt: conversationText,
    systemInstruction: contextPrompt,
    mediaParts,
  });
}
