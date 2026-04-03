import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { requireUser } from "@/lib/auth/user";

export async function AppSidebarShell() {
  const user = await requireUser();

  return <AppSidebar user={user} />;
}
