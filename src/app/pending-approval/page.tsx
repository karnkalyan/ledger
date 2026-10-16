import Link from "next/link";
import { Clock, ShieldCheck, Mail, ArrowRight } from "lucide-react";

export default async function PendingApprovalPage({
  searchParams,
}: {
  searchParams: Promise<{ registered?: string }>;
}) {
  const { registered } = await searchParams;

  return (
    <main className="login-shell">
      <div className="pending-approval-card">
        <div className="pending-icon-wrap">
          <Clock size={42} className="pending-clock-icon" />
        </div>
        <h1>{registered ? "Registration Submitted!" : "Account Pending Verification"}</h1>
        <p className="pending-desc">
          Thank you for registering with Kashtrix Multi-Vendor Enterprise Suite. Your account is currently queued for administrative review.
        </p>

        <div className="pending-status-box">
          <div className="status-row">
            <span className="status-label">Application Status:</span>
            <span className="badge warning">PENDING APPROVAL</span>
          </div>
          <p className="status-info">
            Once approved by the system administrator, you will receive full access to your business ledger, invoices, staff directory, and Nepali calendar expense tracking.
          </p>
        </div>

        <div className="pending-actions">
          <Link href="/login" className="primary-btn">
            Return to Sign In
            <ArrowRight size={14} style={{ marginLeft: 6 }} />
          </Link>
          <div className="admin-contact-note">
            <Mail size={13} style={{ verticalAlign: "middle", marginRight: 4 }} />
            Need expedited approval? Contact administration at <strong>admin@kashtrix.com</strong>
          </div>
        </div>
      </div>
    </main>
  );
}
