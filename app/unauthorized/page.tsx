import Link from "next/link";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function UnauthorizedPage() {
  return (
    <main className="flex min-h-svh items-center justify-center px-4 py-10">
      <Card className="w-full max-w-xl rounded-2xl border-border/60">
        <CardContent className="p-8 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
            <ShieldAlert className="size-7" />
          </div>
          <h1 className="mt-6 text-3xl font-semibold">Access restricted</h1>
          <p className="mt-3 text-base leading-7 text-muted-foreground">
            Your current role does not have permission to open this section.
          </p>
          <div className="mt-8">
            <Button
              render={<Link href="/dashboard" />}
              size="lg"
              className="button-blank rounded-full"
              variant="outline"
            >
              <ArrowLeft />
              Back to dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
