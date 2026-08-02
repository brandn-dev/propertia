import { Spinner } from "@/components/ui/spinner";

export default function Loading() {
  return (
    <div className="flex min-h-[calc(100svh-8.25rem)] items-center justify-center px-6">
      <div className="flex items-center gap-3 text-left">
        <Spinner className="size-5 text-primary" label="Loading dashboard" />
        <div>
          <p className="text-sm font-medium">Loading workspace</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Syncing billing, contracts, and utility data.
          </p>
        </div>
      </div>
    </div>
  );
}
