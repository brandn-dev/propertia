import { PropertiaLogo } from "@/components/propertia-logo";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type BrandedLoadingScreenProps = {
  className?: string;
  label?: string;
  description?: string;
};

export function BrandedLoadingScreen({
  className,
  label = "Preparing workspace",
  description = "Loading interface state and live operations data.",
}: BrandedLoadingScreenProps) {
  return (
    <main
      className={cn(
        "relative isolate flex min-h-svh items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(67,113,191,0.18),_transparent_28%),linear-gradient(180deg,_rgba(255,255,255,0.7),_rgba(241,245,249,0.96))] px-5 py-8 dark:bg-[radial-gradient(circle_at_top,_rgba(67,113,191,0.22),_transparent_28%),linear-gradient(180deg,_rgba(15,23,42,0.96),_rgba(8,15,28,1))]",
        className
      )}
    >
      <div className="absolute inset-0 bg-[linear-gradient(135deg,_rgba(255,255,255,0.24),_transparent_45%,_rgba(56,184,199,0.08)_100%)] dark:bg-[linear-gradient(135deg,_rgba(255,255,255,0.02),_transparent_45%,_rgba(56,184,199,0.08)_100%)]" />
      <div className="absolute left-1/2 top-1/2 size-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/12 blur-3xl dark:bg-primary/10" />

      <div className="relative w-full max-w-xl">
        <div className="rounded-[2rem] border border-border/60 bg-card/88 p-6 shadow-[0_38px_90px_-42px_rgba(15,23,42,0.42)] backdrop-blur-2xl md:p-7">
          <div className="flex items-start justify-between gap-4">
            <PropertiaLogo size="md" subtitle="Property operations suite" />
            <div className="flex items-center gap-1.5 rounded-full border border-border/60 bg-background/70 px-3 py-2">
              <span className="size-2 rounded-full bg-primary/90" />
              <span className="size-2 rounded-full bg-primary/55" />
              <span className="size-2 rounded-full bg-primary/25" />
            </div>
          </div>

          <div className="mt-8 space-y-5">
            <div className="space-y-2">
              <p className="text-[0.68rem] font-medium uppercase tracking-[0.28em] text-muted-foreground">
                System warmup
              </p>
              <h1 className="text-3xl font-semibold tracking-[-0.06em] text-foreground">
                {label}
              </h1>
              <p className="max-w-lg text-sm leading-6 text-muted-foreground">
                {description}
              </p>
            </div>

            <div className="rounded-[1.6rem] border border-border/60 bg-background/75 p-4 shadow-sm">
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
                  <Skeleton className="h-2 w-2/3 rounded-full bg-muted" />
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {["Auth", "Data", "UI"].map((item) => (
                <div
                  key={item}
                  className="rounded-[1.35rem] border border-border/60 bg-background/70 p-4"
                >
                  <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
                    {item}
                  </p>
                  <Skeleton className="mt-3 h-3 w-4/5 rounded-full bg-muted" />
                  <Skeleton className="mt-2 h-3 w-3/5 rounded-full bg-muted" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
