import Link from "next/link";
import {
  Building2,
  BriefcaseBusiness,
  Eye,
  FileText,
  Mail,
  PencilLine,
  Phone,
  Plus,
  ShieldCheck,
  Users2,
} from "lucide-react";
import { requireRole } from "@/lib/auth/user";
import { getTenantsOverview } from "@/lib/data/dashboard";
import { DashboardEmptyState } from "@/components/dashboard/empty-state";
import { DashboardMetricCard } from "@/components/dashboard/metric-card";
import { DashboardPageHero } from "@/components/dashboard/page-hero";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function formatTenantName(tenant: {
  firstName: string | null;
  lastName: string | null;
  businessName: string | null;
}) {
  return tenant.businessName || [tenant.firstName, tenant.lastName].filter(Boolean).join(" ") || "Unnamed tenant";
}

function getPeopleCount(tenant: {
  firstName: string | null;
  lastName: string | null;
  _count: {
    tenantPeople: number;
    representatives: number;
  };
}) {
  if (tenant._count.tenantPeople > 0) {
    return tenant._count.tenantPeople;
  }

  if (tenant._count.representatives > 0) {
    return tenant._count.representatives;
  }

  return tenant.firstName || tenant.lastName ? 1 : 0;
}

export default async function TenantsPage() {
  await requireRole("ADMIN");
  const tenants = await getTenantsOverview();
  const businessTenants = tenants.filter((tenant) => tenant.type === "BUSINESS").length;
  const totalPeople = tenants.reduce(
    (sum, tenant) => sum + getPeopleCount(tenant),
    0
  );
  const totalContracts = tenants.reduce((sum, tenant) => sum + tenant._count.contracts, 0);
  const totalInvoices = tenants.reduce((sum, tenant) => sum + tenant._count.invoices, 0);

  return (
    <div className="space-y-6">
      <DashboardPageHero
        eyebrow="Workspace / Tenants"
        title="Tenant registry"
        description="Individual and business tenants stay as reusable account records, while linked people are stored separately and can be reused across future workflows."
        icon={Users2}
        badges={["Reusable profiles", "Individual + Business", "People-linked"]}
        action={
          <div className="flex flex-wrap gap-2">
            <Button
              render={<Link href="/properties" />}
              variant="outline"
              className="button-blank rounded-full"
            >
              <Building2 />
              Property boards
            </Button>
            <Button render={<Link href="/tenants/new" />} className="rounded-full">
              <Plus />
              New tenant
            </Button>
          </div>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <DashboardMetricCard
          label="Visible tenants"
          value={String(tenants.length)}
          detail="Tenant records currently shown in the registry."
          icon={Users2}
        />
        <DashboardMetricCard
          label="Business accounts"
          value={String(businessTenants)}
          detail="Tenant entities registered as business profiles."
          icon={BriefcaseBusiness}
        />
        <DashboardMetricCard
          label="People"
          value={String(totalPeople)}
          detail="Linked reusable people currently attached to tenant accounts."
          icon={ShieldCheck}
        />
        <DashboardMetricCard
          label="Contract links"
          value={String(totalContracts)}
          detail="Existing contract relationships on visible tenants."
          icon={FileText}
        />
        <DashboardMetricCard
          label="Invoice links"
          value={String(totalInvoices)}
          detail="Invoice history currently attached to shown tenants."
          icon={Mail}
        />
      </section>

      <Card className="rounded-xl border-border/60 bg-card shadow-sm">
        <CardHeader>
          <CardTitle>Tenant table</CardTitle>
          <CardDescription>
            Tenant identity, contact channels, and current operational linkages.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {tenants.length === 0 ? (
            <DashboardEmptyState
              icon={Users2}
              title="No tenants yet"
              description="Add tenant records here before attaching them to contracts, invoices, or payment history."
              action={
                <Button render={<Link href="/tenants/new" />} className="rounded-full">
                  <Plus />
                  Create first tenant
                </Button>
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>People</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-right">Contracts</TableHead>
                  <TableHead className="text-right">Invoices</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenants.map((tenant) => (
                  <TableRow key={tenant.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/tenants/${tenant.id}`}
                        className="hover:text-primary hover:underline"
                      >
                        {formatTenantName(tenant)}
                      </Link>
                      {getPeopleCount(tenant) > 0 ? (
                        <p className="text-xs text-muted-foreground">
                          {getPeopleCount(tenant)} people linked
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell>{tenant.type}</TableCell>
                    <TableCell>{getPeopleCount(tenant)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Phone className="size-3.5 text-muted-foreground" />
                        <span>{tenant.contactNumber ?? "Not set"}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Mail className="size-3.5 text-muted-foreground" />
                        <span>{tenant.email ?? "Not set"}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{tenant._count.contracts}</TableCell>
                    <TableCell className="text-right">{tenant._count.invoices}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          render={<Link href={`/tenants/${tenant.id}`} />}
                          variant="outline"
                          size="sm"
                          className="button-blank rounded-full"
                        >
                          <Eye />
                          View
                        </Button>
                        <Button
                          render={<Link href={`/tenants/${tenant.id}/edit`} />}
                          variant="outline"
                          size="sm"
                          className="button-blank rounded-full"
                        >
                          <PencilLine />
                          Edit
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
