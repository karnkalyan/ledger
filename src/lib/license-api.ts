import { db } from "@/lib/db";

export interface RemoteLicenseModule {
  code: string;
  name: string;
  description?: string | null;
}

export interface RemoteLicenseActivation {
  id: string;
  clientId: string;
  state: "ONLINE" | "OFFLINE" | "BANNED" | string;
  platform: string;
  appVersion: string;
  lastHeartbeatAt: string | null;
  connectedAt: string | null;
  lastIp: string | null;
  isSocketOnline: boolean;
}

export interface RemoteLicenseItem {
  serial: string;
  status: "ACTIVE" | "EXPIRED" | "SUSPENDED" | "REVOKED" | string;
  customerOrganization: string;
  customerContact: {
    name: string | null;
    email: string | null;
  };
  vendor: {
    id: string;
    name: string;
    code: string;
    publicId: string;
    status: string;
  };
  application: {
    id: string;
    name: string;
    code: string;
    publicId: string;
  };
  dealer?: {
    id: string;
    username: string;
    name: string;
    phone?: string | null;
    email?: string | null;
  } | null;
  seats: {
    maxActivations: number;
    activeActivations: number;
  };
  dates: {
    validFrom: string;
    expiresAt: string | null;
    createdAt: string;
    updatedAt: string;
    lastValidatedAt: string | null;
  };
  modules: RemoteLicenseModule[];
  entitlements: Record<string, boolean | number | string>;
  activations: RemoteLicenseActivation[];
}

export interface RemoteLicenseStatusResponse {
  ok: boolean;
  keyName: string;
  role: string;
  allowedDomains: string;
  expiresAt: string;
  remainingDays: number;
}

export interface LicenseApiOptions {
  baseUrl?: string;
  apiKey?: string;
  orgId?: string;
}

export async function resolveLicenseCredentials(
  options?: LicenseApiOptions
): Promise<{ baseUrl: string; apiKey: string }> {
  // 1. Direct parameters passed explicitly
  if (options?.baseUrl && options?.apiKey) {
    const rawUrl = options.baseUrl.trim();
    const baseUrl = rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`;
    return {
      baseUrl: baseUrl.replace(/\/+$/, ""),
      apiKey: options.apiKey.trim(),
    };
  }

  // 2. Resolve from database Plugin for this workspace
  if (options?.orgId) {
    const plugin = await db.plugin.findFirst({
      where: {
        organizationId: options.orgId,
        slug: "kashtrix-license-manager",
        isEnabled: true,
      },
    });

    if (plugin && plugin.apiKey) {
      const rawUrl = plugin.baseUrl || "https://license.simulcast.com.np";
      const baseUrl = rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`;
      return {
        baseUrl: baseUrl.replace(/\/+$/, ""),
        apiKey: plugin.apiKey.trim(),
      };
    }
  }

  // 3. Fallback to any connected license manager plugin in database
  const anyPlugin = await db.plugin.findFirst({
    where: {
      slug: "kashtrix-license-manager",
      status: "CONNECTED",
      isEnabled: true,
    },
  });

  if (anyPlugin && anyPlugin.apiKey) {
    const rawUrl = anyPlugin.baseUrl || "https://license.simulcast.com.np";
    const baseUrl = rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`;
    return {
      baseUrl: baseUrl.replace(/\/+$/, ""),
      apiKey: anyPlugin.apiKey.trim(),
    };
  }

  throw new Error(
    "Kashtrix License Manager plugin is not connected. Please connect with your API Key in Plugins & Connectors."
  );
}

async function licenseFetch<T>(
  endpoint: string,
  options: RequestInit = {},
  credentials?: LicenseApiOptions
): Promise<T> {
  const { baseUrl, apiKey } = await resolveLicenseCredentials(credentials);
  const url = `${baseUrl}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

  const res = await fetch(url, {
    ...options,
    headers: {
      "X-API-Key": apiKey,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    cache: "no-store",
  });

  const contentType = res.headers.get("content-type") || "";
  let data: any = null;
  if (contentType.includes("application/json")) {
    data = await res.json().catch(() => null);
  } else {
    data = await res.text().catch(() => null);
  }

  if (!res.ok) {
    const errorMsg =
      (data && typeof data === "object" && (data.error || data.message)) ||
      (typeof data === "string" ? data : `API Request failed with HTTP ${res.status}`);
    throw new Error(errorMsg);
  }

  return data as T;
}

export async function fetchRemoteLicenseStatus(
  credentials?: LicenseApiOptions
): Promise<RemoteLicenseStatusResponse | null> {
  try {
    return await licenseFetch<RemoteLicenseStatusResponse>("/api/v1/status", {}, credentials);
  } catch (err) {
    console.warn("Failed to fetch license server status:", err);
    return null;
  }
}

export async function fetchRemoteLicenses(
  params?: {
    q?: string;
    status?: string;
    application?: string;
  },
  credentials?: LicenseApiOptions
): Promise<{ total: number; licenses: RemoteLicenseItem[] }> {
  const query = new URLSearchParams();
  if (params?.q) query.set("q", params.q);
  if (params?.status) query.set("status", params.status);
  if (params?.application) query.set("application", params.application);

  const queryString = query.toString() ? `?${query.toString()}` : "";
  return await licenseFetch<{ total: number; licenses: RemoteLicenseItem[] }>(
    `/api/v1/licenses${queryString}`,
    {},
    credentials
  );
}

export async function fetchRemoteLicenseDetails(
  serial: string,
  credentials?: LicenseApiOptions
): Promise<RemoteLicenseItem> {
  return await licenseFetch<RemoteLicenseItem>(
    `/api/v1/licenses/${encodeURIComponent(serial)}`,
    {},
    credentials
  );
}

export async function extendRemoteLicense(
  serial: string,
  body: { days?: number; expiresAt?: string; customerRef?: string; reason?: string },
  credentials?: LicenseApiOptions
): Promise<any> {
  return await licenseFetch(
    `/api/v1/licenses/${encodeURIComponent(serial)}/extend`,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
    credentials
  );
}

export async function updateRemoteLicenseStatus(
  serial: string,
  body: { status: "ACTIVE" | "SUSPENDED" | "REVOKED"; reason?: string },
  credentials?: LicenseApiOptions
): Promise<any> {
  try {
    return await licenseFetch(
      `/api/v1/licenses/${encodeURIComponent(serial)}/status`,
      {
        method: "POST",
        body: JSON.stringify(body),
      },
      credentials
    );
  } catch (err: any) {
    if (body.status === "REVOKED") {
      return await licenseFetch(
        `/api/v1/licenses/${encodeURIComponent(serial)}/revoke`,
        {
          method: "POST",
          body: JSON.stringify(body),
        },
        credentials
      );
    }
    if (body.status === "ACTIVE") {
      return await licenseFetch(
        `/api/v1/licenses/${encodeURIComponent(serial)}/restore`,
        {
          method: "POST",
          body: JSON.stringify(body),
        },
        credentials
      );
    }
    throw err;
  }
}

export async function banRemoteLicenseClient(
  clientId: string,
  body: { reason: string },
  credentials?: LicenseApiOptions
): Promise<any> {
  return await licenseFetch(
    `/api/v1/clients/${encodeURIComponent(clientId)}/ban`,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
    credentials
  );
}

export async function unbanRemoteLicenseClient(
  clientId: string,
  credentials?: LicenseApiOptions
): Promise<any> {
  return await licenseFetch(
    `/api/v1/clients/${encodeURIComponent(clientId)}/unban`,
    {
      method: "POST",
      body: JSON.stringify({}),
    },
    credentials
  );
}
