export interface PrintableOrganization {
  name: string;
  logoUrl?: string | null;
  taxNumber?: string | null;
  panVatNumber?: string | null;
  address?: string | null;
  email?: string | null;
  phone?: string | null;
}

export function CompanyPrintLogo({
  organization,
  compact = false,
}: {
  organization: PrintableOrganization;
  compact?: boolean;
}) {
  const initials = organization.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  if (organization.logoUrl) {
    return (
      <img
        src={organization.logoUrl}
        alt={`${organization.name} logo`}
        className={`company-print-logo${compact ? " compact" : ""}`}
      />
    );
  }

  return (
    <span
      className={`company-print-logo-fallback${compact ? " compact" : ""}`}
      aria-label={`${organization.name} logo`}
    >
      {initials || "CO"}
    </span>
  );
}

export function CompanyPrintBanner({
  organization,
  title,
  subtitle,
}: {
  organization: PrintableOrganization;
  title: string;
  subtitle?: string;
}) {
  const taxNumber = organization.taxNumber || organization.panVatNumber;

  return (
    <div className="table-print-header-banner">
      <div className="print-company-header-left">
        <CompanyPrintLogo organization={organization} compact />
        <div>
          <h2 style={{ margin: 0, fontSize: "15pt", fontWeight: 800 }}>{organization.name}</h2>
          <div style={{ fontSize: "8.5pt", color: "#475569", marginTop: 2 }}>
            {organization.address || "Nepal"}
            {organization.email ? ` · ${organization.email}` : ""}
            {organization.phone ? ` · ${organization.phone}` : ""}
          </div>
          {taxNumber && (
            <div style={{ fontSize: "8.5pt", color: "#475569", marginTop: 2 }}>
              PAN / VAT: {taxNumber}
            </div>
          )}
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: "11pt", fontWeight: 800, color: "#0f172a", textTransform: "uppercase" }}>
          {title}
        </div>
        {subtitle && <div style={{ fontSize: "8pt", color: "#475569", marginTop: 2 }}>{subtitle}</div>}
      </div>
    </div>
  );
}
