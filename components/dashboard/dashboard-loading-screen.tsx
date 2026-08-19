import { PropertiaLogo } from "@/components/propertia-logo";
import { Skeleton } from "@/components/ui/skeleton";

export function DashboardSidebarSkeleton() {
  return (
    <div className="group peer hidden text-sidebar-foreground md:block">
      <div className="relative w-[16rem] bg-transparent" />
      <div className="fixed inset-y-0 left-0 z-10 hidden w-[16rem] p-2 md:flex">
        <div className="flex size-full flex-col rounded-lg border border-sidebar-border/70 bg-sidebar shadow-sm ring-1 ring-sidebar-border/60">
          <div className="border-b border-sidebar-border/70 px-4 py-5">
            <PropertiaLogo
              size="sm"
              title="Panglao Lands"
              subtitle="by Propertia"
              logoSrc="/PANGLAO%20LANDS%20LOGO%20ICON.svg"
              logoAlt="Panglao Lands"
              titleClassName="tracking-[-0.025em]"
              subtitleClassName="normal-case tracking-[0.12em]"
            />
          </div>

          <div className="flex-1 space-y-5 px-3 py-4">
            {["Workspace", "Operations"].map((section) => (
              <div key={section} className="space-y-3">
                <div className="px-2 text-[0.68rem] font-medium uppercase tracking-[0.24em] text-sidebar-foreground/55">
                  {section}
                </div>
                <div className="space-y-2">
                  {Array.from({ length: section === "Workspace" ? 3 : 5 }).map(
                    (_, index) => (
                      <div
                        key={`${section}-${index}`}
                        className="flex items-center gap-3 rounded-xl border border-sidebar-border/60 bg-sidebar-accent/30 px-3 py-2.5"
                      >
                        <Skeleton className="size-8 rounded-xl bg-sidebar-accent" />
                        <div className="min-w-0 flex-1 space-y-2">
                          <Skeleton className="h-2.5 w-4/5 rounded-full bg-sidebar-accent" />
                          <Skeleton className="h-2 w-2/5 rounded-full bg-sidebar-accent/75" />
                        </div>
                      </div>
                    ),
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-sidebar-border/70 px-4 py-4">
            <div className="flex items-center gap-3 rounded-2xl border border-sidebar-border/60 bg-sidebar-accent/30 px-3 py-3">
              <Skeleton className="size-10 rounded-full bg-sidebar-accent" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-2.5 w-3/4 rounded-full bg-sidebar-accent" />
                <Skeleton className="h-2 w-1/2 rounded-full bg-sidebar-accent/75" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function DashboardHeaderSkeleton() {
  return (
    <header className="sticky top-0 z-20 border-b border-border/60 bg-background/78 backdrop-blur-2xl">
      <div className="flex h-16 shrink-0 items-center justify-between gap-3 px-4 md:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Skeleton className="size-8 rounded-full" />
          <Skeleton className="h-4 w-px rounded-full" />
          <Skeleton className="hidden h-3 w-24 rounded-full md:block" />
          <Skeleton className="h-3 w-28 rounded-full" />
        </div>

        <div className="flex items-center gap-2">
          <Skeleton className="size-8 rounded-full" />
          <Skeleton className="hidden h-8 w-24 rounded-full md:block" />
        </div>
      </div>
    </header>
  );
}
