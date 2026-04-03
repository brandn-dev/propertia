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
              subtitle="Loading workspace"
              subtitleClassName="tracking-[0.22em]"
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
                    )
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

export function DashboardContentLoadingScreen() {
  return (
    <div className="relative isolate min-h-[calc(100svh-8.25rem)] overflow-hidden rounded-[2rem] border border-border/60 bg-[radial-gradient(circle_at_top_left,_rgba(67,113,191,0.12),_transparent_26%),linear-gradient(180deg,_rgba(255,255,255,0.52),_rgba(255,255,255,0.84))] p-5 shadow-sm dark:bg-[radial-gradient(circle_at_top_left,_rgba(67,113,191,0.18),_transparent_26%),linear-gradient(180deg,_rgba(255,255,255,0.02),_rgba(8,15,28,0.2))] md:p-6">
      <div className="absolute inset-0 bg-[linear-gradient(135deg,_rgba(255,255,255,0.22),_transparent_42%,_rgba(56,184,199,0.07)_100%)] dark:bg-[linear-gradient(135deg,_rgba(255,255,255,0.02),_transparent_42%,_rgba(56,184,199,0.08)_100%)]" />
      <div className="absolute -right-20 top-8 size-64 rounded-full bg-primary/10 blur-3xl dark:bg-primary/12" />

      <div className="relative space-y-6">
        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(300px,0.8fr)]">
          <div className="rounded-[1.8rem] border border-border/60 bg-card/82 p-5 shadow-sm backdrop-blur md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <PropertiaLogo size="md" subtitle="Streaming route" />
              <div className="rounded-full border border-border/60 bg-background/70 px-3 py-2 text-[0.68rem] font-medium uppercase tracking-[0.24em] text-muted-foreground">
                Fast navigation
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <p className="text-[0.68rem] font-medium uppercase tracking-[0.28em] text-muted-foreground">
                Workspace sync
              </p>
              <h1 className="text-3xl font-semibold tracking-[-0.06em] text-foreground sm:text-4xl">
                Loading your next view
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">
                Preparing billing, property, and utility data without freezing
                the rest of the dashboard shell.
              </p>
            </div>

            <div className="mt-6 rounded-[1.45rem] border border-border/60 bg-background/75 p-4">
              <div className="flex items-center gap-4">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <div className="grid gap-1">
                    <span className="block h-1.5 w-5 rounded-full bg-primary/80" />
                    <span className="block h-1.5 w-3 rounded-full bg-primary/55" />
                    <span className="block h-1.5 w-4 rounded-full bg-primary/35" />
                  </div>
                </div>
                <div className="min-w-0 flex-1 space-y-2.5">
                  <Skeleton className="h-2.5 w-full rounded-full bg-primary/15" />
                  <Skeleton className="h-2 w-3/5 rounded-full" />
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
            {["Portfolio state", "Operations queue"].map((card) => (
              <div
                key={card}
                className="rounded-[1.45rem] border border-border/60 bg-card/82 p-5 shadow-sm"
              >
                <p className="text-sm font-medium text-muted-foreground">{card}</p>
                <Skeleton className="mt-4 h-8 w-28 rounded-full" />
                <Skeleton className="mt-3 h-3 w-full rounded-full" />
                <Skeleton className="mt-2 h-3 w-2/3 rounded-full" />
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={`metric-${index}`}
              className="rounded-[1.35rem] border border-border/60 bg-card/84 p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-3">
                  <Skeleton className="h-3 w-24 rounded-full" />
                  <Skeleton className="h-8 w-20 rounded-full" />
                </div>
                <Skeleton className="size-10 rounded-2xl bg-primary/12" />
              </div>
              <Skeleton className="mt-4 h-3 w-3/4 rounded-full" />
            </div>
          ))}
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          {Array.from({ length: 2 }).map((_, panelIndex) => (
            <div
              key={`panel-${panelIndex}`}
              className="rounded-[1.5rem] border border-border/60 bg-card/84 p-5 shadow-sm"
            >
              <Skeleton className="h-5 w-40 rounded-full" />
              <Skeleton className="mt-3 h-3 w-3/5 rounded-full" />

              <div className="mt-5 space-y-3">
                {Array.from({ length: panelIndex === 0 ? 5 : 4 }).map(
                  (_, rowIndex) => (
                    <div
                      key={`row-${panelIndex}-${rowIndex}`}
                      className="flex items-center justify-between gap-4 rounded-2xl border border-border/60 bg-background/70 px-4 py-3"
                    >
                      <div className="min-w-0 flex-1 space-y-2">
                        <Skeleton className="h-3 w-3/5 rounded-full" />
                        <Skeleton className="h-2.5 w-2/5 rounded-full" />
                      </div>
                      <div className="w-24 space-y-2">
                        <Skeleton className="h-3 w-full rounded-full" />
                        <Skeleton className="ml-auto h-2.5 w-3/4 rounded-full" />
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
