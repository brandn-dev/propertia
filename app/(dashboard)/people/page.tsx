import Link from "next/link";
import {
  Eye,
  Mail,
  Phone,
  Plus,
  ShieldCheck,
  Users2,
  type LucideIcon,
} from "lucide-react";
import { requireCapability } from "@/lib/auth/user";
import { getPeopleOverview } from "@/lib/data/dashboard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function formatPersonName(person: {
  firstName: string;
  middleName: string | null;
  lastName: string;
}) {
  return [person.firstName, person.middleName, person.lastName]
    .filter(Boolean)
    .join(" ");
}

function formatTenantName(tenant: {
  firstName: string | null;
  lastName: string | null;
  businessName: string | null;
}) {
  return (
    tenant.businessName ||
    [tenant.firstName, tenant.lastName].filter(Boolean).join(" ") ||
    "Unnamed tenant"
  );
}

function MetricPill({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card px-4 py-3 shadow-sm">
      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <div className="mt-2 flex items-center gap-2">
        <div className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="size-4" />
        </div>
        <span className="text-xl font-semibold tracking-[-0.04em]">{value}</span>
      </div>
    </div>
  );
}

export default async function PeoplePage() {
  await requireCapability("MANAGE_PEOPLE");

  const people = await getPeopleOverview();
  const primaryPeople = people.filter((person) =>
    person.tenantLinks.some((link) => link.isPrimary)
  ).length;
  const linkedTenants = people.reduce(
    (sum, person) => sum + person._count.tenantLinks,
    0
  );
  const peopleWithEmail = people.filter((person) => person.email).length;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-[-0.05em] sm:text-[2rem]">
          People registry
        </h1>
        <div className="flex flex-wrap gap-2">
          <Button
            render={<Link href="/tenants" />}
            variant="outline"
            className="rounded-full"
          >
            <Users2 />
            Tenants
          </Button>
          <Button render={<Link href="/tenants/new" />} className="rounded-full">
            <Plus />
            New tenant
          </Button>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricPill label="Records" value={String(people.length)} icon={Users2} />
        <MetricPill label="Primary" value={String(primaryPeople)} icon={ShieldCheck} />
        <MetricPill label="Tenant Links" value={String(linkedTenants)} icon={Users2} />
        <MetricPill label="Email" value={String(peopleWithEmail)} icon={Mail} />
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3 px-1">
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Registry
          </h2>
          <Badge variant="outline" className="rounded-full">
            {people.length} people
          </Badge>
        </div>

        <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
          {people.length === 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-4 p-6">
              <p className="text-sm text-muted-foreground">No reusable people yet.</p>
              <Button render={<Link href="/tenants/new" />} className="rounded-full">
                <Plus />
                Create first tenant
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border/60">
                  <TableHead className="h-9 px-3 text-xs uppercase tracking-[0.12em] text-muted-foreground">
                    Person
                  </TableHead>
                  <TableHead className="h-9 min-w-[220px] px-3 text-xs uppercase tracking-[0.12em] text-muted-foreground">
                    Tenant
                  </TableHead>
                  <TableHead className="h-9 px-3 text-xs uppercase tracking-[0.12em] text-muted-foreground">
                    Role
                  </TableHead>
                  <TableHead className="h-9 px-3 text-xs uppercase tracking-[0.12em] text-muted-foreground">
                    Contact
                  </TableHead>
                  <TableHead className="h-9 px-3 text-xs uppercase tracking-[0.12em] text-muted-foreground">
                    Email
                  </TableHead>
                  <TableHead className="h-9 px-3 text-right text-xs uppercase tracking-[0.12em] text-muted-foreground">
                    Links
                  </TableHead>
                  <TableHead className="h-9 px-3 text-right text-xs uppercase tracking-[0.12em] text-muted-foreground">
                    Action
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {people.map((person) => {
                  const primaryLink =
                    person.tenantLinks.find((link) => link.isPrimary) ??
                    person.tenantLinks[0] ??
                    null;

                  return (
                    <TableRow key={person.id} className="border-border/60">
                      <TableCell className="px-3 py-3 align-top">
                        <p className="font-medium">{formatPersonName(person)}</p>
                      </TableCell>
                      <TableCell className="px-3 py-3 align-top">
                        {primaryLink ? (
                          <div className="space-y-0.5">
                            <Link
                              href={`/tenants/${primaryLink.tenant.id}`}
                              className="font-medium hover:text-primary hover:underline"
                            >
                              {formatTenantName(primaryLink.tenant)}
                            </Link>
                            {person.tenantLinks.length > 1 ? (
                              <p className="text-xs text-muted-foreground">
                                +{person.tenantLinks.length - 1} more link
                                {person.tenantLinks.length > 2 ? "s" : ""}
                              </p>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Not linked</span>
                        )}
                      </TableCell>
                      <TableCell className="px-3 py-3 align-top">
                        {primaryLink?.positionTitle ?? "Not set"}
                      </TableCell>
                      <TableCell className="px-3 py-3 align-top">
                        <div className="flex items-start gap-2 text-muted-foreground">
                          <Phone className="mt-0.5 size-3.5 shrink-0" />
                          <span className="leading-5 text-foreground">
                            {person.contactNumber ?? "Not set"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="px-3 py-3 align-top">
                        <div className="flex items-start gap-2 text-muted-foreground">
                          <Mail className="mt-0.5 size-3.5 shrink-0" />
                          <span className="leading-5 text-foreground">
                            {person.email ?? "Not set"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="px-3 py-3 text-right align-top tabular-nums">
                        {person._count.tenantLinks}
                      </TableCell>
                      <TableCell className="px-3 py-3 text-right align-top">
                        {primaryLink ? (
                          <Button
                            render={<Link href={`/tenants/${primaryLink.tenant.id}`} />}
                            variant="outline"
                            size="icon-sm"
                            className="rounded-full"
                            aria-label="View tenant"
                            title="View tenant"
                          >
                            <Eye />
                          </Button>
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </section>
    </div>
  );
}
