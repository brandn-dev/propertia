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
      <SidebarInset className="app-surface min-h-svh md:border md:border-border/60 md:shadow-sm">
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
