"use client";

import { useActionState } from "react";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { loginAction } from "@/app/(auth)/login/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, undefined);

  return (
    <form action={action} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="username">Username</Label>
        <Input
          id="username"
          name="username"
          autoComplete="username"
          placeholder="admin"
          className="h-11 border-border/70 bg-background/80"
        />
        {state?.errors?.username ? (
          <p className="text-sm text-destructive">{state.errors.username[0]}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="Enter your password"
          className="h-11 border-border/70 bg-background/80"
        />
        {state?.errors?.password ? (
          <p className="text-sm text-destructive">{state.errors.password[0]}</p>
        ) : null}
      </div>

      {state?.message ? (
        <div className="rounded-2xl border border-border/70 bg-muted/60 px-4 py-3 text-sm text-muted-foreground">
          {state.message}
        </div>
      ) : null}

      <Button
        type="submit"
        size="lg"
        className="h-11 w-full rounded-xl shadow-sm"
        disabled={pending}
      >
        {pending ? <LoaderCircle className="animate-spin" /> : <ArrowRight />}
        Sign in
      </Button>
    </form>
  );
}
