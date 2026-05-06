import { Spinner } from "@/components/ui/spinner";

export default function Loading() {
  return (
    <div className="flex min-h-[calc(100svh-8.25rem)] items-center justify-center rounded-[2rem] border border-border/60 bg-card/70 px-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <Spinner className="size-9 text-primary" label="Loading dashboard" />
        <div className="space-y-1">
          <p className="text-lg font-semibold tracking-[-0.04em]">Loading dashboard</p>
          <p className="text-sm text-muted-foreground">
            Syncing billing, contracts, and utility data.
          </p>
        </div>
      </div>
    </div>
  );
}
