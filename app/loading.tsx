import { Spinner } from "@/components/ui/spinner";

export default function Loading() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <Spinner className="size-10 text-primary" label="Opening Propertia" />
        <div className="space-y-1">
          <p className="text-lg font-semibold tracking-[-0.04em]">Opening Propertia</p>
          <p className="text-sm text-muted-foreground">
            Checking access and preparing your workspace.
          </p>
        </div>
      </div>
    </main>
  );
}
