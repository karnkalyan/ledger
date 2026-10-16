import { getSessionUser } from "@/lib/session";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const user = await getSessionUser();
  redirect(user ? "/workspaces" : "/login");
}
