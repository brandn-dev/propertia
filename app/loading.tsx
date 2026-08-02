import { Spinner } from "@/components/ui/spinner";

export default function Loading() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-6">
      <div className="flex items-center gap-3 text-left">
        <Spinner className="size-5 text-primary" label="Opening Propertia" />
        <div>
          <p className="text-sm font-medium">Opening Propertia</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Checking access and preparing your workspace.
          </p>
        </div>
      </div>
    </main>
  );
}
