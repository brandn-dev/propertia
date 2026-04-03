import { cookies } from "next/headers";
import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { requireUser } from "@/lib/auth/user";
import { getNotificationSummaryForUser } from "@/lib/notifications";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await requireUser();
  const [cookieStore, notificationSummary] = await Promise.all([
    cookies(),
    getNotificationSummaryForUser(user),
  ]);
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <AppSidebar user={user} />
      <SidebarInset className="min-h-svh bg-[radial-gradient(circle_at_top_left,_rgba(67,113,191,0.05),_transparent_24%),linear-gradient(180deg,_rgba(255,255,255,0.2),_transparent)] md:border md:border-border/50 md:shadow-sm dark:bg-[radial-gradient(circle_at_top_left,_rgba(67,113,191,0.08),_transparent_24%),linear-gradient(180deg,_rgba(255,255,255,0.01),_transparent)]">
        <DashboardHeader user={user} notificationSummary={notificationSummary} />
        <main className="flex-1 px-4 py-5 md:px-6 md:py-6">
          <div className="mx-auto w-full max-w-[1400px]">{children}</div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
