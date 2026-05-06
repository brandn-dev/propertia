import { cookies } from "next/headers";
import { Suspense } from "react";
import { AppSidebarShell } from "@/components/dashboard/app-sidebar-shell";
import { DashboardHeaderShell } from "@/components/dashboard/dashboard-header-shell";
import {
  DashboardHeaderSkeleton,
  DashboardSidebarSkeleton,
} from "@/components/dashboard/dashboard-loading-screen";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { parseSidebarOpenState, SIDEBAR_COOKIE_NAME } from "@/lib/sidebar-state";

export const unstable_instant = false;

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const sidebarOpen = parseSidebarOpenState(
    cookieStore.get(SIDEBAR_COOKIE_NAME)?.value,
    true
  );

  return (
    <SidebarProvider defaultOpen={sidebarOpen}>
      <Suspense fallback={<DashboardSidebarSkeleton />}>
        <AppSidebarShell />
      </Suspense>
      <SidebarInset className="min-h-svh bg-[radial-gradient(circle_at_top_left,_rgba(67,113,191,0.05),_transparent_24%),linear-gradient(180deg,_rgba(255,255,255,0.2),_transparent)] md:border md:border-border/50 md:shadow-sm dark:bg-[radial-gradient(circle_at_top_left,_rgba(67,113,191,0.08),_transparent_24%),linear-gradient(180deg,_rgba(255,255,255,0.01),_transparent)]">
        <Suspense fallback={<DashboardHeaderSkeleton />}>
          <DashboardHeaderShell />
        </Suspense>
        <main className="flex-1 px-4 py-5 md:px-6 md:py-6">
          <div className="mx-auto w-full max-w-[1400px]">{children}</div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
