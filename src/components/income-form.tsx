"use client";

import { useState } from "react";
import { NepaliDatePicker } from "@/components/nepali-date-picker";

type Contact = {
  id: string;
  name: string;
  companyName: string | null;
  taxNumber: string | null;
  type: string;
};

export function IncomeForm({
  orgId,
  currency,
  contacts,
  action,
}: {
  orgId: string;
  currency: string;
  contacts: Contact[];
  action: (formData: FormData) => Promise<void>;
}) {
  const [source, setSource] = useState("");
  const [selectedContactId, setSelectedContactId] = useState("");

  const handleContactSelect = (contactId: string) => {
    setSelectedContactId(contactId);
    if (!contactId) return;
    const c = contacts.find((item) => item.id === contactId);
    if (c) {
      setSource(c.companyName || c.name);
    }
  };

  return (
    <form action={action}>
      <input type="hidden" name="orgId" value={orgId} />
      <div className="form-grid">
        <label className="field full">
          Title
          <input
            name="title"
            required
            placeholder="Project milestone / Salary / Client Remittance"
          />
        </label>

        <label className="field">
          Select Existing Vendor / Customer (CRM)
          <select
            name="contactId"
            value={selectedContactId}
            onChange={(e) => handleContactSelect(e.target.value)}
          >
            <option value="">-- Choose from CRM (Vendor / Customer) or Custom --</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.companyName || c.name} {c.taxNumber ? `(PAN: ${c.taxNumber})` : ""} · {c.type}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          Source / Payer Name (Or Custom)
          <input
            id="income-source-input"
            name="source"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            list="payer-suggestions"
            placeholder="Client, Vendor, Employer, or Custom"
            required
          />
          <datalist id="payer-suggestions">
            {contacts.map((c) => (
              <option key={c.id} value={c.companyName || c.name} />
            ))}
          </datalist>
        </label>

        <label className="field">
          Amount ({currency})
          <input
            name="amount"
            type="number"
            min="0"
            step="0.01"
            required
            placeholder="0.00"
          />
        </label>

        <div className="field">
          <NepaliDatePicker name="receivedAt" label="Received Date (BS / AD)" required />
        </div>

        <label className="field full">
          Notes
          <textarea
            name="notes"
            placeholder="Optional transaction notes, payment method, cheque ref..."
          />
        </label>
      </div>

      <div className="form-actions">
        <button className="success-btn" type="submit">
          Save Income
        </button>
      </div>
    </form>
  );
}
