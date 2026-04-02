import { cookies } from "next/headers";
import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { requireUser } from "@/lib/auth/user";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [user, cookieStore] = await Promise.all([requireUser(), cookies()]);
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <AppSidebar user={user} />
      <SidebarInset className="min-h-svh bg-[radial-gradient(circle_at_top_left,_rgba(67,113,191,0.09),_transparent_28%),linear-gradient(180deg,_rgba(255,255,255,0.42),_transparent)] md:border md:border-white/50 md:shadow-[0_30px_80px_-55px_rgba(15,23,42,0.28)] dark:bg-[radial-gradient(circle_at_top_left,_rgba(67,113,191,0.16),_transparent_26%),linear-gradient(180deg,_rgba(255,255,255,0.02),_transparent)] dark:md:border-white/5">
        <DashboardHeader user={user} />
        <main className="flex-1 px-4 py-5 md:px-6 md:py-6">
          <div className="mx-auto w-full max-w-[1400px]">{children}</div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
