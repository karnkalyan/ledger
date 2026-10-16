"use server";
import { redirect } from "next/navigation";
import { createIncomeAction, createContactAction, createLeadAction, createStockMovementAction, createProductAction, createEmployeeAction, createPayrollAction, createLeaveAction, createTaskAction, createLicenseAction, createReminderAction, createExpenseAction, createRecurringExpenseAction, createCommerceDocumentAction, createBankAccountAction, recordBankTransactionAction, createLoanAction } from "@/app/(dashboard)/actions";

export async function saveLoanAction(formData: FormData) {
  await createLoanAction(formData);
}

export async function saveBankAccountAction(formData: FormData) {
  await createBankAccountAction(formData);
  redirect("/" + String(formData.get("orgId")) + "/banking");
}

export async function saveBankTransactionAction(formData: FormData) {
  await recordBankTransactionAction(formData);
  redirect("/" + String(formData.get("orgId")) + "/banking");
}

export async function saveIncomeAction(formData: FormData) {
 await createIncomeAction(formData);
 redirect("/" + String(formData.get("orgId")) + "/income");
}

export async function saveContactAction(formData: FormData) {
 await createContactAction(formData);
 redirect("/" + String(formData.get("orgId")) + "/crm");
}

export async function saveLeadAction(formData: FormData) {
 await createLeadAction(formData);
 redirect("/" + String(formData.get("orgId")) + "/leads");
}

export async function saveStockMovementAction(formData: FormData) {
 await createStockMovementAction(formData);
 redirect("/" + String(formData.get("orgId")) + "/stock");
}

export async function saveProductAction(formData: FormData) {
 await createProductAction(formData);
 redirect("/" + String(formData.get("orgId")) + "/stock");
}

export async function saveEmployeeAction(formData: FormData) {
 await createEmployeeAction(formData);
 redirect("/" + String(formData.get("orgId")) + "/staff");
}

export async function savePayrollAction(formData: FormData) {
 await createPayrollAction(formData);
 redirect("/" + String(formData.get("orgId")) + "/payroll");
}

export async function saveLeaveAction(formData: FormData) {
 await createLeaveAction(formData);
 redirect("/" + String(formData.get("orgId")) + "/leaves");
}

export async function saveTaskAction(formData: FormData) {
 await createTaskAction(formData);
 redirect("/" + String(formData.get("orgId")) + "/tasks");
}

export async function saveLicenseAction(formData: FormData) {
 await createLicenseAction(formData);
 redirect("/" + String(formData.get("orgId")) + "/licenses");
}

export async function saveReminderAction(formData: FormData) {
 await createReminderAction(formData);
 redirect("/" + String(formData.get("orgId")) + "/reminders");
}

export async function saveExpenseAction(formData: FormData) {
 await createExpenseAction(formData);
 redirect("/" + String(formData.get("orgId")) + "/expenses");
}

export async function saveRecurringExpenseAction(formData: FormData) {
 await createRecurringExpenseAction(formData);
 redirect("/" + String(formData.get("orgId")) + "/expenses");
}

export async function saveCommerceDocumentAction(formData: FormData) {
 await createCommerceDocumentAction(formData);
 const modules: Record<string,string> = { INVOICE: "invoices", QUOTE: "quotes", SALES_ORDER: "sales", PURCHASE_ORDER: "purchase" };
 redirect("/" + String(formData.get("orgId")) + "/" + (modules[String(formData.get("kind"))] || "invoices"));
}
