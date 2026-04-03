import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { PropertiaLogo } from "@/components/propertia-logo";
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

  const needsSetup = !process.env.DATABASE_URL || !process.env.SESSION_PASSWORD;

  return (
    <main className="min-h-svh bg-[radial-gradient(circle_at_top,_rgba(67,113,191,0.12),_transparent_30%),linear-gradient(180deg,_transparent,_rgba(12,18,32,0.04))] px-5 py-8">
      <div className="mx-auto flex min-h-[calc(100svh-4rem)] max-w-md items-center">
        <Card className="w-full rounded-2xl border-border/60 bg-card shadow-sm backdrop-blur">
          <CardContent className="p-6 md:p-8">
            <div className="flex justify-center">
              <PropertiaLogo
                size="md"
                subtitle="Secure access"
                className="justify-center"
                titleClassName="text-2xl"
                subtitleClassName="tracking-[0.24em]"
              />
            </div>

            {needsSetup ? (
              <div className="mt-6 rounded-xl border border-dashed border-border/80 bg-muted/55 p-5">
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
      </div>
    </main>
  );
}
