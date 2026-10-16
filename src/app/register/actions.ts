"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function registerVendorAction(formData: FormData) {
  const companyName = String(formData.get("companyName") || "").trim();
  const ownerName = String(formData.get("ownerName") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const phone = String(formData.get("phone") || "").trim();
  const panVatNumber = String(formData.get("panVatNumber") || "").trim();
  const vendorCategory = String(formData.get("vendorCategory") || "General Commercial");
  const address = String(formData.get("address") || "").trim();
  const password = String(formData.get("password") || "");

  if (!companyName || !ownerName || !email || !password) {
    redirect("/register?error=missing_fields");
  }

  if (password.length < 6) {
    redirect("/register?error=weak_password");
  }

  // Check if email already exists
  const existingUser = await db.user.findUnique({ where: { email } });
  if (existingUser) {
    redirect("/register?error=email_exists");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  // Generate unique slug
  let slug = slugify(companyName);
  const existingOrg = await db.organization.findUnique({ where: { slug } });
  if (existingOrg) {
    slug = `${slug}-${Date.now().toString(36)}`;
  }

  // Create User with PENDING status
  const user = await db.user.create({
    data: {
      name: ownerName,
      email,
      phone,
      passwordHash,
      role: "USER",
      status: "PENDING",
    },
  });

  // Create Organization with PENDING status
  const org = await db.organization.create({
    data: {
      name: companyName,
      slug,
      kind: "COMPANY",
      status: "PENDING",
      ownerId: user.id,
      currency: "NPR",
      address: address || "Kathmandu, Nepal",
      phone,
      email,
      taxNumber: panVatNumber,
      panVatNumber,
      vendorCategory,
    },
  });

  // Create Owner membership
  await db.membership.create({
    data: {
      userId: user.id,
      organizationId: org.id,
      role: "OWNER",
    },
  });

  // Create standard default expense categories
  const defaultCategories = [
    { name: "Office Rent", icon: "building" },
    { name: "Electricity & Utilities", icon: "zap" },
    { name: "Internet & Telecom", icon: "wifi" },
    { name: "Staff Payroll & Wages", icon: "users" },
    { name: "Procurement & Raw Materials", icon: "shopping-bag" },
    { name: "Tea, Snacks & Refreshment", icon: "coffee" },
    { name: "Transportation & Freight", icon: "truck" },
    { name: "Software & Digital Tools", icon: "cpu" },
    { name: "Tax & Government Compliance", icon: "file-text" },
  ];

  for (const cat of defaultCategories) {
    await db.expenseCategory.create({
      data: {
        organizationId: org.id,
        name: cat.name,
        icon: cat.icon,
      },
    });
  }

  redirect("/pending-approval?registered=true");
}
