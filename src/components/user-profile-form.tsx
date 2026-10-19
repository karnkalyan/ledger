"use client";

import { useState } from "react";
import { User, Mail, Phone, Lock, Image as ImageIcon, ShieldCheck, CheckCircle2, Sparkles, Building2, Upload } from "lucide-react";
import { FormPendingFeedback } from "@/components/form-pending-feedback";
import { updateUserProfileAction, changeUserPasswordAction } from "@/app/(dashboard)/actions";
import toast from "react-hot-toast";

const PRESET_AVATARS = [
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=256&q=80",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=256&q=80",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=256&q=80",
  "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=256&q=80",
  "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=256&q=80",
];

interface UserProfileFormProps {
  user: {
    id: string;
    name: string;
    email: string;
    phone?: string | null;
    avatarUrl?: string | null;
    role: string;
    status: string;
  };
  orgId: string;
  orgName: string;
  memberships: Array<{
    role: string;
    organization: {
      id: string;
      name: string;
      kind: string;
    };
  }>;
}

export function UserProfileForm({ user, orgId, orgName, memberships }: UserProfileFormProps) {
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl || "");
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [phone, setPhone] = useState(user.phone || "");

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image file must be less than 2MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        setAvatarUrl(result);
        toast.success("Profile image loaded");
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* 1. Profile Overview & Avatar Banner */}
      <div
        className="table-card"
        style={{
          padding: "24px",
          background: "linear-gradient(135deg, rgba(74, 8, 107, 0.05) 0%, rgba(239, 8, 111, 0.05) 100%), var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: "var(--radius-md, 12px)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 20,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: "50%",
              overflow: "hidden",
              border: "3px solid var(--brand)",
              boxShadow: "0 6px 16px rgba(74, 8, 107, 0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "var(--brand-soft)",
              color: "var(--brand)",
              fontSize: 28,
              fontWeight: 800,
              flexShrink: 0,
            }}
          >
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              name.slice(0, 1).toUpperCase()
            )}
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <h2 style={{ margin: 0, fontSize: 20, color: "var(--text)" }}>{name}</h2>
              <span className="badge purple" style={{ fontSize: 10, fontWeight: 700 }}>
                {user.role}
              </span>
              <span className="badge green" style={{ fontSize: 10, fontWeight: 700 }}>
                {user.status}
              </span>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>{email}</p>
            <p style={{ margin: "2px 0 0", fontSize: 11.5, color: "var(--text-dim)" }}>
              Active in <strong>{orgName}</strong> · Connected to {memberships.length} workspace{memberships.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <label
            className="secondary-btn"
            style={{
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              padding: "7px 14px",
            }}
          >
            <Upload size={14} />
            <span>Upload New Photo</span>
            <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: "none" }} />
          </label>
          {avatarUrl && (
            <button
              type="button"
              className="ghost-btn"
              onClick={() => setAvatarUrl("")}
              style={{ fontSize: 12, padding: "7px 12px" }}
            >
              Remove Photo
            </button>
          )}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 24 }}>
        {/* 2. Personal Information Form */}
        <section className="table-card" style={{ padding: "22px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <User size={18} style={{ color: "var(--brand)" }} />
            <h3 style={{ margin: 0, fontSize: 16 }}>Personal Details</h3>
          </div>
          <form action={updateUserProfileAction}>
            <FormPendingFeedback processingMessage="Updating profile details..." successMessage="Profile updated successfully!" />
            <input type="hidden" name="orgId" value={orgId} />
            <input type="hidden" name="avatarUrl" value={avatarUrl} />

            <div className="form-grid" style={{ gridTemplateColumns: "1fr", gap: 14 }}>
              <label className="field">
                <span className="field-label">Full Name</span>
                <input
                  name="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="Your full legal name"
                />
              </label>

              <label className="field">
                <span className="field-label">Email Address</span>
                <input
                  name="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="name@company.com"
                />
              </label>

              <label className="field">
                <span className="field-label">Phone / Mobile</span>
                <input
                  name="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+977-98XXXXXXXX"
                />
              </label>

              <label className="field">
                <span className="field-label">Profile Image / Avatar URL</span>
                <input
                  type="text"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="https://... or choose preset below"
                />
              </label>

              <div>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>
                  Or Choose a Preset Avatar:
                </span>
                <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                  {PRESET_AVATARS.map((url, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setAvatarUrl(url)}
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: "50%",
                        padding: 0,
                        border: avatarUrl === url ? "2.5px solid var(--brand)" : "1.5px solid var(--line)",
                        overflow: "hidden",
                        cursor: "pointer",
                        background: "none",
                        transform: avatarUrl === url ? "scale(1.1)" : "scale(1)",
                        transition: "all 0.15s ease",
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt={`Preset ${idx + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="form-actions" style={{ marginTop: 20 }}>
              <button className="primary-btn" type="submit">
                Save Profile Changes
              </button>
            </div>
          </form>
        </section>

        {/* 3. Security & Password Form */}
        <section className="table-card" style={{ padding: "22px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <Lock size={18} style={{ color: "var(--brand)" }} />
            <h3 style={{ margin: 0, fontSize: 16 }}>Change Password</h3>
          </div>
          <form action={changeUserPasswordAction}>
            <FormPendingFeedback processingMessage="Updating password..." successMessage="Password changed successfully!" />
            <input type="hidden" name="orgId" value={orgId} />

            <div className="form-grid" style={{ gridTemplateColumns: "1fr", gap: 14 }}>
              <label className="field">
                <span className="field-label">Current Password</span>
                <input
                  name="currentPassword"
                  type="password"
                  required
                  placeholder="Enter your current password"
                />
              </label>

              <label className="field">
                <span className="field-label">New Password</span>
                <input
                  name="newPassword"
                  type="password"
                  required
                  minLength={6}
                  placeholder="Minimum 6 characters"
                />
              </label>

              <label className="field">
                <span className="field-label">Confirm New Password</span>
                <input
                  name="confirmPassword"
                  type="password"
                  required
                  minLength={6}
                  placeholder="Re-type new password"
                />
              </label>
            </div>

            <div style={{ marginTop: 14, fontSize: 11.5, color: "var(--text-muted)" }}>
              Ensure your new password contains uppercase, lowercase, numbers or symbols for enterprise security.
            </div>

            <div className="form-actions" style={{ marginTop: 20 }}>
              <button className="primary-btn" type="submit">
                Update Password
              </button>
            </div>
          </form>
        </section>
      </div>

      {/* 4. Connected Workspaces & Role Details */}
      <section className="table-card" style={{ padding: "22px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <Building2 size={18} style={{ color: "var(--brand)" }} />
          <h3 style={{ margin: 0, fontSize: 16 }}>Workspace Permissions &amp; Roles</h3>
        </div>
        <p style={{ margin: "0 0 16px", fontSize: 12.5, color: "var(--text-muted)" }}>
          Organizations and company workspaces where your account has verified access.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
          {memberships.map((m) => (
            <div
              key={m.organization.id}
              style={{
                padding: "14px 16px",
                borderRadius: "var(--radius-sm, 8px)",
                border: m.organization.id === orgId ? "1.5px solid var(--brand)" : "1px solid var(--line)",
                background: m.organization.id === orgId ? "var(--brand-soft)" : "var(--soft)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <strong style={{ fontSize: 13.5, color: "var(--text)" }}>{m.organization.name}</strong>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                  Type: {m.organization.kind} {m.organization.id === orgId && "· (Current active workspace)"}
                </div>
              </div>
              <span className="badge purple" style={{ fontSize: 10, fontWeight: 700 }}>
                {m.role}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
