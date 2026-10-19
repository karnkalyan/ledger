# Kashtrix ERP — ChatGPT Plugin & Actions Setup Guide

This guide provides the exact configuration details to connect **Kashtrix ERP** with ChatGPT using either **OAuth 2.0 (Plugins / Apps SDK)** or **API Key / Bearer (Custom GPT Actions)**.

## Current ChatGPT Plugins setup (recommended)

When ChatGPT asks for a **custom MCP server URL**, enter this exact endpoint:

```text
https://ledger.simulcast.com.np/api/mcp
```

Select **OAuth** authentication and let ChatGPT discover the authorization server. Do not enter the site root, `/api/mcp/sse`, `/.well-known/ai-plugin.json`, or the OpenAPI URL in the MCP server field; those endpoints serve different or legacy connection modes.

After deployment, use **Refresh tools / Scan tools** in the plugin settings. ChatGPT keeps a snapshot of discovered tools, so an existing plugin will not automatically receive new or corrected definitions. The MCP scan should show every Kashtrix tool, including `list_invoices`, `list_bank_transactions`, and `list_financial_transactions`.

---

## ⚡ Method 1: ChatGPT Plugin with OAuth 2.0 (Developer Mode)

Use this if you are developing or managing an app under **OpenAI Developer Plugins / Apps SDK**.

### 1. Connection URLs & Manifest
* **Plugin Domain / Server URL**:
  ```
  https://ledger.simulcast.com.np
  ```
* **Plugin Manifest URL**:
  ```
  https://ledger.simulcast.com.np/.well-known/ai-plugin.json
  ```
* **OpenAPI Specification URL**:
  ```
  https://ledger.simulcast.com.np/api/mcp/openapi.json
  ```

### 2. OAuth 2.0 Credentials
* **Authentication Type**: `OAuth`
* **Authorization URL**:
  ```
  https://ledger.simulcast.com.np/api/oauth/authorize
  ```
* **Token URL**:
  ```
  https://ledger.simulcast.com.np/api/oauth/token
  ```
* **Client ID**:
  ```
  kashtrix-chatgpt-client
  ```
  *(Any non-empty string is accepted by the server)*
* **Client Secret**:
  ```
  xC19T5q1-MrjBY4VmMNkYtwLfsKK7n4MZbO3B3oShy14Nt2iXzTwaQos2wVj-r6N
  ```
* **Scope**:
  ```
  mcp:all mcp:read mcp:write admin
  ```
* **Authorization Content Type**:
  ```
  application/x-www-form-urlencoded
  ```

### 3. Login & Consent Screen
When prompted to authorize your Kashtrix account:
* **Email**: `admin@simulcast.local`
* **Password**: `admin123` (or your existing admin login password)
* **Master Key Bypass** (optional): `simulcast-admin`

---

## 🛡️ Method 2: Custom GPT Action with Bearer Token (Recommended — 100% Stable)

> **Why choose this?**  
> Custom GPT Actions with a Bearer Token **never expire**, never ask you to re-login, and never disconnect due to OAuth session drops.

### 1. Create / Configure Custom GPT
1. In ChatGPT, click your profile → **My GPTs** → **Create a GPT** (or edit **Kashtrix ERP**).
2. Go to the **Configure** tab.
3. Scroll down and click **Create new action** (or edit existing Action).

### 2. Import Schema
1. Click **Import from URL**.
2. Paste:
   ```
   https://ledger.simulcast.com.np/api/mcp/openapi.json
   ```
3. Click **Import**. All 20+ operations will populate automatically.

### 3. Set Authentication
1. Click the gear icon ⚙️ next to **Authentication**.
2. Select **API Key**.
3. Set **Auth Type**: `Bearer`.
4. Paste the **3-Year Master Token**:
   ```
   eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiJtYXN0ZXItYWRtaW4iLCJzdWIiOiJtYXN0ZXItYWRtaW4iLCJuYW1lIjoiS2FzaHRyaXggTWFzdGVyIEFkbWluIiwiZW1haWwiOiJhZG1pbkBrYXNodHJpeC5jb20iLCJyb2xlIjoiU1VQRVJfQURNSU4iLCJzY29wZXMiOlsibWNwOmFsbCIsIm1jcDpyZWFkIiwibWNwOndyaXRlIiwiYWRtaW4iXSwiaWF0IjoxNzkyMjY4OTUzLCJleHAiOjE4ODY5NDE3NTN9.-nm2iKPmACO6TM5ajG8Km0D6kY-DvI4kCDwlYi3Upkg
   ```
5. Click **Save**.

---

## 🔄 How to Refresh Tools When You Make Code Changes

OpenAI caches action schemas. When new tools or endpoints are deployed:
1. In your ChatGPT conversation / Settings, open your **Kashtrix ERP** plugin settings.
2. Click **Refresh tools**.
3. If it does not immediately update, click **Delete app** and re-add `https://ledger.simulcast.com.np`.

---

## 💬 Verified Chat Prompts to Test Live Connection

Once connected, test these exact prompts in ChatGPT:

1. **Balance Sheet**:
   ```
   @Kashtrix ERP hello total balancesheet
   ```
   *Returns real Current Assets, Liquid Cash, Accounts Receivable, Inventory, Liabilities, and Equity for FY 2083/84 BS.*

2. **Company Profiles & Live Bank Balances**:
   ```
   @Kashtrix ERP get all companies details
   ```
   *Returns Simulcast Technologies Pvt Ltd (PAN: 609670271), My House, and live Siddhartha Bank balances.*

3. **Bank Transactions (Ashoj / Monthly statements)**:
   ```
   @Kashtrix ERP show company transactions for month ashoj
   ```
   *Returns statement entries, deposits, withdrawals, and net cashflow.*

4. **Expenses**:
   ```
   @Kashtrix ERP list recent expenses
   ```
