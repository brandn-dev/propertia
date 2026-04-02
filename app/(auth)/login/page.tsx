import { Layers3, LockKeyhole, Zap } from "lucide-react";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { PropertiaLogo } from "@/components/propertia-logo";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/user";

const SETUP_ITEMS = [
  "Create a Neon Postgres database and copy the DATABASE_URL connection string.",
  "Set a SESSION_PASSWORD with at least 32 random characters.",
  "Run migrations and seed the two starting users.",
];

export default async function LoginPage() {
  const user = await getCurrentUser();

  if (user) {
    redirect("/dashboard");
  }

  const needsSetup =
    !process.env.DATABASE_URL || !process.env.SESSION_PASSWORD;

  return (
    <main className="min-h-svh bg-[radial-gradient(circle_at_top,_rgba(67,113,191,0.14),_transparent_34%),linear-gradient(180deg,_transparent,_rgba(12,18,32,0.04))] px-5 py-8">
      <div className="mx-auto grid min-h-[calc(100svh-4rem)] max-w-6xl gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="relative overflow-hidden rounded-[2rem] border border-border/70 bg-card/85 p-6 shadow-sm backdrop-blur md:p-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(67,113,191,0.12),_transparent_30%),radial-gradient(circle_at_bottom_left,_rgba(80,171,197,0.12),_transparent_35%)]" />
          <div className="relative flex h-full flex-col justify-between">
            <div>
              <PropertiaLogo size="lg" subtitle="Property operations suite" />
              <Badge variant="secondary" className="rounded-full px-3">
                Next 16 + Prisma + iron-session
              </Badge>
              <h1 className="mt-6 max-w-2xl text-4xl font-semibold tracking-[-0.05em] md:text-5xl">
                Built for contracts, billing, and utility readings in one clear workspace.
              </h1>
              <p className="mt-4 max-w-xl text-base leading-7 text-muted-foreground md:text-lg">
                Propertia now has the right foundation: relational data,
                protected roles, a proper dashboard shell, and a dedicated
                utility-reading lane for your meter-reader account.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <Card className="rounded-[1.5rem] border-border/70 bg-background/75 shadow-none">
                <CardContent className="space-y-3 p-5">
                  <Layers3 className="size-5 text-primary" />
                  <p className="font-medium">Portfolio hierarchy</p>
                  <p className="text-sm leading-6 text-muted-foreground">
                    Buildings, units, contracts, invoices, and shared charges in
                    one relational model.
                  </p>
                </CardContent>
              </Card>

              <Card className="rounded-[1.5rem] border-border/70 bg-background/75 shadow-none">
                <CardContent className="space-y-3 p-5">
                  <Zap className="size-5 text-primary" />
                  <p className="font-medium">Utility workflow</p>
                  <p className="text-sm leading-6 text-muted-foreground">
                    A separate meter-reader role can focus on readings without
                    access to billing administration.
                  </p>
                </CardContent>
              </Card>

              <Card className="rounded-[1.5rem] border-border/70 bg-background/75 shadow-none">
                <CardContent className="space-y-3 p-5">
                  <LockKeyhole className="size-5 text-primary" />
                  <p className="font-medium">Cookie sessions</p>
                  <p className="text-sm leading-6 text-muted-foreground">
                    Passwords are hashed with scrypt and sessions are sealed with
                    iron-session.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section className="flex items-center">
          <Card className="w-full rounded-[2rem] border-border/70 bg-card/92 shadow-sm backdrop-blur">
            <CardContent className="p-6 md:p-8">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <PropertiaLogo
                  size="md"
                  subtitle="Secure access"
                  titleClassName="text-2xl"
                  subtitleClassName="tracking-[0.24em]"
                />
                <Badge
                  variant="outline"
                  className="rounded-full border-border/70 bg-background/70 px-3"
                >
                  Two-role auth
                </Badge>
              </div>

              {needsSetup ? (
                <div className="mt-6 rounded-[1.5rem] border border-dashed border-border/80 bg-muted/55 p-5">
                  <p className="text-sm font-medium">Setup still needed</p>
                  <ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
                    {SETUP_ITEMS.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="mt-8">
                <LoginForm />
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
