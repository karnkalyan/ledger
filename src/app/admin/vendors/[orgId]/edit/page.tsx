import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { updateVendorCredentialsAction } from "@/app/admin/actions";
export default async function EditVendorPage({params}: {params: Promise<{orgId:string}>}) {
 const user = await getSessionUser();
 if (!user) redirect("/login");
 const fullUser = await db.user.findUnique({where:{id:user.id}});
 if (fullUser?.role !== "SUPER_ADMIN") redirect("/workspaces");
 const {orgId} = await params;
 const org = await db.organization.findUnique({where:{id:orgId},include:{owner:true}});
 if (!org) notFound();
 async function saveCredentials(formData:FormData) {
  "use server";
  await updateVendorCredentialsAction(formData);
  redirect("/admin");
 }
 return <main className="page-wrap entry-page"><div className="page-header"><div><Link href="/admin" className="topbar-kicker">? Back to vendors</Link><h1>Manage Vendor Credentials</h1><p>Update profile and credentials for {org.name}.</p></div><Link href="/admin" className="secondary-btn">Cancel</Link></div><section className="entry-form-card"><form action={saveCredentials}>
                              <input type="hidden" name="userId" value={org.ownerId} />
                              <input type="hidden" name="orgId" value={org.id} />
                              <div className="form-grid">
                                <label className="field full">
                                  <span>Enterprise / Company Name</span>
                                  <input name="orgName" defaultValue={org.name} required />
                                </label>
                                <label className="field">
                                  <span>Owner Name</span>
                                  <input name="name" defaultValue={org.owner.name} required />
                                </label>
                                <label className="field">
                                  <span>Owner Email</span>
                                  <input name="email" type="email" defaultValue={org.owner.email} required />
                                </label>
                                <label className="field">
                                  <span>Phone Number</span>
                                  <input name="phone" defaultValue={org.phone || org.owner.phone || ""} />
                                </label>
                                <label className="field">
                                  <span>PAN / VAT Registration</span>
                                  <input name="panVatNumber" defaultValue={org.panVatNumber || org.taxNumber || ""} />
                                </label>
                                <label className="field full">
                                  <span>Reset Password (Leave blank to keep current)</span>
                                  <input
                                    name="newPassword"
                                    type="password"
                                    placeholder="Enter new password if resetting"
                                    minLength={6}
                                  />
                                </label>
                              </div>
                              <div className="form-actions">
                                <button type="submit" className="primary-btn">
                                  Save Vendor Credentials
                                </button>
                              </div>
                            </form></section></main>;
}
