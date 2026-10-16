import Link from "next/link";
import { requireUser } from "@/lib/session";
import { createWorkspaceAction } from "../actions";
export default async function NewWorkspacePage() {
 await requireUser();
 return <main className="page-wrap entry-page"><div className="page-header"><div><Link href="/workspaces" className="topbar-kicker">? Back to workspaces</Link><h1>Create workspace</h1><p>Add a company, household or personal profile.</p></div></div><section className="entry-form-card"><form action={createWorkspaceAction}>
              <label className="field">Workspace name<input name="name" placeholder="e.g. Simulcast Technologies Pvt Ltd" required /></label>
              <label className="field">Type<select name="kind" defaultValue="COMPANY"><option value="COMPANY">Company / Office</option><option value="HOUSEHOLD">House / Household</option><option value="PERSONAL">Personal</option></select></label>
              <div className="form-grid"><label className="field">Currency<input name="currency" defaultValue="NPR" /></label><label className="field">Address<input name="address" placeholder="Kathmandu, Nepal" /></label></div>
              <div className="form-actions"><Link href="/workspaces" className="ghost-btn">Cancel</Link><button className="primary-btn">Create workspace</button></div>
            </form></section></main>;
}
