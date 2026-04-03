import Link from "next/link";
import { notFound } from "next/navigation";
import {
  BadgeCheck,
  Bolt,
  Building2,
  CalendarClock,
  CircleDollarSign,
  Eye,
  FileText,
  Gauge,
  Mail,
  PencilLine,
  Phone,
  Plus,
  ReceiptText,
  ShieldCheck,
  Users2,
  WalletCards,
} from "lucide-react";
import { requireRole } from "@/lib/auth/user";
import { getTenantProfile } from "@/lib/data/admin";
import {
  formatCompactNumber,
  formatCurrency,
  formatDate,
  toNumber,
} from "@/lib/format";
import { formatUtilityQuantity } from "@/lib/utility-units";
import { DashboardEmptyState } from "@/components/dashboard/empty-state";
import { DashboardMetricCard } from "@/components/dashboard/metric-card";
import { DashboardPageHero } from "@/components/dashboard/page-hero";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type TenantProfilePageProps = {
  params: Promise<{
    tenantId: string;
  }>;
};

function formatTenantLabel(tenant: {
  firstName: string | null;
  lastName: string | null;
  businessName: string | null;
}) {
  return (
    tenant.businessName ||
    [tenant.firstName, tenant.lastName].filter(Boolean).join(" ") ||
    "Tenant"
  );
}

function formatStatusLabel(value: string) {
  return value.replaceAll("_", " ");
}

export default async function TenantProfilePage({
  params,
}: TenantProfilePageProps) {
  await requireRole("ADMIN");
  const { tenantId } = await params;
  const tenant = await getTenantProfile(tenantId);

  if (!tenant) {
    notFound();
  }

  const tenantLabel = formatTenantLabel(tenant);
  const activeContracts = tenant.contracts.filter(
    (contract) => contract.status === "ACTIVE"
  ).length;

  const recentActivity = [
    ...tenant.contracts.map((contract) => ({
      id: `contract-${contract.id}`,
      date: contract.startDate,
      title: `Contract ${formatStatusLabel(contract.status).toLowerCase()}`,
      detail: `${contract.property.name} · ${formatCurrency(toNumber(contract.monthlyRent))} monthly rent`,
      href: `/contracts/${contract.id}/edit`,
      icon: FileText,
      badge: formatStatusLabel(contract.status),
    })),
    ...tenant.invoices.map((invoice) => ({
      id: `invoice-${invoice.id}`,
      date: invoice.issueDate,
      title: `Invoice ${invoice.invoiceNumber}`,
      detail: `${invoice.contract.property.name} · ${formatCurrency(toNumber(invoice.totalAmount))} total · due ${formatDate(invoice.dueDate)}`,
      href: `/billing/${invoice.id}`,
      icon: ReceiptText,
      badge: formatStatusLabel(invoice.status),
    })),
    ...tenant.recentPayments.map((payment) => ({
      id: `payment-${payment.id}`,
      date: payment.paymentDate ?? payment.createdAt,
      title: `Payment ${formatCurrency(toNumber(payment.amountPaid))}`,
      detail: `${payment.invoice.invoiceNumber} · ${payment.contract.property.name}`,
      href: `/billing/${payment.invoice.id}`,
      icon: CircleDollarSign,
      badge: formatStatusLabel(payment.status),
    })),
    ...tenant.recentReadings.map((reading) => ({
      id: `reading-${reading.id}`,
      date: reading.readingDate,
      title: `${formatStatusLabel(reading.meter.utilityType)} reading`,
      detail: `${reading.meter.meterCode} · ${formatUtilityQuantity(reading.meter.utilityType, formatCompactNumber(toNumber(reading.consumption)))} · ${formatCurrency(toNumber(reading.totalAmount))}`,
      href: reading.invoiceItem?.invoice.id
        ? `/billing/${reading.invoiceItem.invoice.id}`
        : "/utilities/readings",
      icon: Gauge,
      badge: reading.invoiceItem?.invoice.invoiceNumber ?? "Unbilled",
    })),
  ]
    .sort((left, right) => right.date.getTime() - left.date.getTime())
    .slice(0, 12);

  return (
    <div className="space-y-6">
      <DashboardPageHero
        eyebrow="Workspace / Tenants"
        title={tenantLabel}
        description="This is the tenant activity view across contracts, invoices, payments, and utility readings. Use it as the operating profile for account history and current exposure."
        icon={Users2}
        badges={[
          tenant.type,
          `${tenant._count.contracts} contracts`,
          `${tenant._count.invoices} invoices`,
          `${tenant._count.utilityMeters} meters`,
        ]}
        action={
          <Button
            render={<Link href={`/tenants/${tenant.id}/edit`} />}
            className="rounded-full"
          >
            <PencilLine />
            Edit tenant
          </Button>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <DashboardMetricCard
          label="Active contracts"
          value={String(activeContracts)}
          detail="Contracts currently active for this tenant."
          icon={FileText}
        />
        <DashboardMetricCard
          label="Open invoices"
          value={String(tenant.metrics.openInvoiceCount)}
          detail="Issued, partially paid, or overdue invoices still open."
          icon={ReceiptText}
        />
        <DashboardMetricCard
          label="Outstanding"
          value={formatCurrency(toNumber(tenant.metrics.outstandingBalance))}
          detail="Current receivable exposure on this tenant."
          icon={WalletCards}
        />
        <DashboardMetricCard
          label="Payments settled"
          value={formatCurrency(toNumber(tenant.metrics.settledPaymentsTotal))}
          detail={`${tenant.metrics.settledPaymentsCount} settled payment record(s).`}
          icon={CircleDollarSign}
        />
        <DashboardMetricCard
          label="Utility charges"
          value={formatCurrency(toNumber(tenant.metrics.utilityChargesTotal))}
          detail={`${tenant.metrics.readingCount} tenant-tagged readings logged.`}
          icon={Bolt}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-4">
          <Card className="rounded-xl border-border/60 bg-card shadow-sm">
            <CardHeader>
              <CardTitle>Tenant profile</CardTitle>
              <CardDescription>
                Contact data, identity fields, and account metadata.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Tenant type</span>
                <Badge variant="outline">{tenant.type}</Badge>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Business name</span>
                <span className="font-medium">{tenant.businessName}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Primary contact</span>
                <span className="font-medium">
                  {tenant.contactNumber ?? "Not set"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Email</span>
                <span className="font-medium">{tenant.email ?? "Not set"}</span>
              </div>
              <div className="flex items-start justify-between gap-4">
                <span className="text-muted-foreground">Address</span>
                <span className="max-w-[22rem] text-right font-medium">
                  {tenant.address ?? "Not set"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Valid ID</span>
                <span className="font-medium">
                  {tenant.validIdType && tenant.validIdNumber
                    ? `${tenant.validIdType} · ${tenant.validIdNumber}`
                    : "Not set"}
                </span>
              </div>
              <div className="h-px bg-border/70" />
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Created</span>
                <span className="font-medium">{formatDate(tenant.createdAt)}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Updated</span>
                <span className="font-medium">{formatDate(tenant.updatedAt)}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl border-border/60 bg-card shadow-sm">
            <CardHeader>
              <CardTitle>People</CardTitle>
              <CardDescription>
                Reusable people linked to this tenant account for notices, sign-off, and coordination.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {tenant.people.length === 0 ? (
                <DashboardEmptyState
                  icon={ShieldCheck}
                  title="No people attached"
                  description="This tenant currently has no linked people on file."
                />
              ) : (
                <div className="space-y-3">
                  {tenant.people.map((person) => (
                    <div
                      key={person.id}
                      className="rounded-xl border border-border/60 bg-background px-4 py-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">
                            {person.firstName} {person.lastName}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {person.positionTitle ??
                              (tenant.type === "BUSINESS"
                                ? "Linked person"
                                : "Primary tenant")}
                          </p>
                        </div>
                        {person.isPrimary ? (
                          <Badge variant="outline">Primary</Badge>
                        ) : null}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-4 text-sm text-muted-foreground">
                        <span className="inline-flex items-center gap-2">
                          <Phone className="size-3.5" />
                          {person.contactNumber ?? "No phone"}
                        </span>
                        <span className="inline-flex items-center gap-2">
                          <Mail className="size-3.5" />
                          {person.email ?? "No email"}
                        </span>
                        {person.validIdType || person.validIdNumber ? (
                          <span className="inline-flex items-center gap-2">
                            <BadgeCheck className="size-3.5" />
                            {[person.validIdType, person.validIdNumber]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        ) : null}
                      </div>
                      {person.address || person.notes ? (
                        <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                          {person.address ? <p>{person.address}</p> : null}
                          {person.notes ? <p>{person.notes}</p> : null}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-xl border-border/60 bg-card shadow-sm">
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>
              Contracts, invoices, payments, and utility readings in one chronological feed.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {recentActivity.length === 0 ? (
              <DashboardEmptyState
                icon={CalendarClock}
                title="No tenant activity yet"
                description="Once this tenant starts receiving contracts, invoices, payments, or readings, the activity feed will appear here."
              />
            ) : (
              <div className="space-y-3">
                {recentActivity.map((activity) => {
                  const ActivityIcon = activity.icon;

                  return (
                    <div
                      key={activity.id}
                      className="flex items-start gap-3 rounded-xl border border-border/60 bg-background px-4 py-3"
                    >
                      <div className="mt-0.5 rounded-lg bg-muted p-2 text-muted-foreground">
                        <ActivityIcon className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-foreground">
                            {activity.title}
                          </p>
                          <Badge variant="outline">{activity.badge}</Badge>
                        </div>
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">
                          {activity.detail}
                        </p>
                        <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                          <span>{formatDate(activity.date)}</span>
                          <Link
                            href={activity.href}
                            className="inline-flex items-center gap-1 text-primary hover:underline"
                          >
                            Open
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <Card className="rounded-xl border-border/60 bg-card shadow-sm">
        <CardHeader>
          <CardTitle>Contract history</CardTitle>
          <CardDescription>
            Properties, rent terms, and invoice-bearing contracts linked to this tenant.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {tenant.contracts.length === 0 ? (
            <DashboardEmptyState
              icon={FileText}
              title="No contracts attached"
              description="This tenant does not have a contract yet."
              action={
                <Button render={<Link href="/contracts/new" />} className="rounded-full">
                  <Plus />
                  Create contract
                </Button>
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Property</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Term</TableHead>
                  <TableHead>Billing anchor</TableHead>
                  <TableHead className="text-right">Rent</TableHead>
                  <TableHead className="text-right">Invoices</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenant.contracts.map((contract) => (
                  <TableRow key={contract.id}>
                    <TableCell className="font-medium">
                      {contract.property.name}
                      <p className="text-xs text-muted-foreground">
                        {contract.property.propertyCode}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {formatStatusLabel(contract.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {formatDate(contract.startDate)}
                      <p className="text-xs text-muted-foreground">
                        to {formatDate(contract.endDate)}
                      </p>
                    </TableCell>
                    <TableCell>{formatDate(contract.paymentStartDate)}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(toNumber(contract.monthlyRent))}
                    </TableCell>
                    <TableCell className="text-right">{contract._count.invoices}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        render={<Link href={`/contracts/${contract.id}/edit`} />}
                        variant="outline"
                        size="sm"
                        className="button-blank rounded-full"
                      >
                        <PencilLine />
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-xl border-border/60 bg-card shadow-sm">
        <CardHeader>
          <CardTitle>Invoice history</CardTitle>
          <CardDescription>
            Latest billing records and collection state for this tenant.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {tenant.invoices.length === 0 ? (
            <DashboardEmptyState
              icon={ReceiptText}
              title="No invoices yet"
              description="Once billing is generated for this tenant, invoice history will appear here."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Property</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Due date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Payments</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenant.invoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-medium">
                      {invoice.invoiceNumber}
                      <p className="text-xs text-muted-foreground">
                        {invoice._count.items} items
                      </p>
                    </TableCell>
                    <TableCell>
                      {invoice.contract.property.name}
                      <p className="text-xs text-muted-foreground">
                        {invoice.contract.property.propertyCode}
                      </p>
                    </TableCell>
                    <TableCell>
                      {formatDate(invoice.billingPeriodStart)}
                      <p className="text-xs text-muted-foreground">
                        to {formatDate(invoice.billingPeriodEnd)}
                      </p>
                    </TableCell>
                    <TableCell>{formatDate(invoice.dueDate)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {formatStatusLabel(invoice.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {invoice._count.payments}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(toNumber(invoice.balanceDue))}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          render={<Link href={`/billing/${invoice.id}`} />}
                          variant="outline"
                          size="sm"
                          className="button-blank rounded-full"
                        >
                          <Eye />
                          View
                        </Button>
                        {toNumber(invoice.balanceDue) > 0 ? (
                          <Button
                            render={<Link href={`/billing/${invoice.id}/payment`} />}
                            size="sm"
                            className="rounded-full"
                          >
                            <CircleDollarSign />
                            Pay
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card className="rounded-xl border-border/60 bg-card shadow-sm">
          <CardHeader>
            <CardTitle>Payment activity</CardTitle>
            <CardDescription>
              Latest settled and pending payment records linked to this tenant’s invoices.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {tenant.recentPayments.length === 0 ? (
              <DashboardEmptyState
                icon={CircleDollarSign}
                title="No payments recorded"
                description="Payment activity will show up here once invoices start getting allocations."
              />
            ) : (
              <div className="space-y-3">
                {tenant.recentPayments.map((payment) => (
                  <div
                    key={payment.id}
                    className="rounded-xl border border-border/60 bg-background px-4 py-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">
                          {formatCurrency(toNumber(payment.amountPaid))}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {payment.invoice.invoiceNumber} · {payment.contract.property.name}
                        </p>
                      </div>
                      <Badge variant="outline">
                        {formatStatusLabel(payment.status)}
                      </Badge>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-4 text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-2">
                        <CalendarClock className="size-3.5" />
                        {payment.paymentDate
                          ? formatDate(payment.paymentDate)
                          : `Due ${formatDate(payment.dueDate)}`}
                      </span>
                      <span className="inline-flex items-center gap-2">
                        <BadgeCheck className="size-3.5" />
                        {payment.referenceNumber ?? "No reference"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="rounded-xl border-border/60 bg-card shadow-sm">
            <CardHeader>
              <CardTitle>Utility meters</CardTitle>
              <CardDescription>
                Meters currently assigned directly to this tenant.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {tenant.utilityMeters.length === 0 ? (
                <DashboardEmptyState
                  icon={Building2}
                  title="No tenant meters"
                  description="Assign dedicated meters to this tenant and they will appear here."
                  action={
                    <Button
                      render={<Link href="/utilities/meters/new" />}
                      className="rounded-full"
                    >
                      <Plus />
                      Add meter
                    </Button>
                  }
                />
              ) : (
                <div className="space-y-3">
                  {tenant.utilityMeters.map((meter) => (
                    <div
                      key={meter.id}
                      className="rounded-xl border border-border/60 bg-background px-4 py-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">
                            {meter.meterCode}
                            <span className="ml-2 text-sm text-muted-foreground">
                              {formatStatusLabel(meter.utilityType)}
                            </span>
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {meter.property.name} · {meter.property.propertyCode}
                          </p>
                        </div>
                        <Badge variant="outline">
                          {meter._count.readings} readings
                        </Badge>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-4 text-sm text-muted-foreground">
                        <span className="inline-flex items-center gap-2">
                          <CalendarClock className="size-3.5" />
                          Added {formatDate(meter.createdAt)}
                        </span>
                        <span className="inline-flex items-center gap-2">
                          <Gauge className="size-3.5" />
                          {meter.readings[0]
                            ? `Last reading ${formatDate(meter.readings[0].readingDate)}`
                            : "No readings yet"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-xl border-border/60 bg-card shadow-sm">
            <CardHeader>
              <CardTitle>Recent utility readings</CardTitle>
              <CardDescription>
                Latest tenant-tagged meter readings and whether they have already been billed.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {tenant.recentReadings.length === 0 ? (
                <DashboardEmptyState
                  icon={Gauge}
                  title="No readings yet"
                  description="Once a dedicated meter is read for this tenant, the activity will appear here."
                />
              ) : (
                <div className="space-y-3">
                  {tenant.recentReadings.map((reading) => (
                    <div
                      key={reading.id}
                      className="rounded-xl border border-border/60 bg-background px-4 py-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">
                            {reading.meter.meterCode}
                            <span className="ml-2 text-sm text-muted-foreground">
                              {formatStatusLabel(reading.meter.utilityType)}
                            </span>
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {reading.meter.property.name}
                          </p>
                        </div>
                        <Badge variant="outline">
                          {reading.invoiceItem?.invoice.invoiceNumber ?? "Unbilled"}
                        </Badge>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-4 text-sm text-muted-foreground">
                        <span className="inline-flex items-center gap-2">
                          <CalendarClock className="size-3.5" />
                          {formatDate(reading.readingDate)}
                        </span>
                        <span className="inline-flex items-center gap-2">
                          <Gauge className="size-3.5" />
                          {formatUtilityQuantity(
                            reading.meter.utilityType,
                            formatCompactNumber(toNumber(reading.consumption))
                          )}
                        </span>
                        <span className="inline-flex items-center gap-2">
                          <CircleDollarSign className="size-3.5" />
                          {formatCurrency(toNumber(reading.totalAmount))}
                        </span>
                        <span className="inline-flex items-center gap-2">
                          <Users2 className="size-3.5" />
                          {reading.recordedBy?.displayName ?? "System"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
