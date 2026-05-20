import Link from "next/link";
import { notFound } from "next/navigation";
import {
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
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import { requireCapability } from "@/lib/auth/user";
import { formatContractEndDate } from "@/lib/contracts/term";
import { getTenantProfile } from "@/lib/data/admin";
import {
  formatCompactNumber,
  formatCurrency,
  formatDate,
  toNumber,
} from "@/lib/format";
import { formatUtilityQuantity } from "@/lib/utility-units";
import { DashboardEmptyState } from "@/components/dashboard/empty-state";
import { PaginatedStack } from "@/components/tenants/paginated-stack";
import { PaginatedTable } from "@/components/tenants/paginated-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

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

function formatLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getStatusBadgeClasses(status: string) {
  switch (status) {
    case "ACTIVE":
    case "PAID":
    case "SETTLED":
      return "border-chart-3/35 bg-chart-3/12 text-chart-3";
    case "DRAFT":
    case "ISSUED":
    case "PENDING":
    case "PARTIALLY_PAID":
      return "border-chart-4/40 bg-chart-4/12 text-chart-4";
    case "OVERDUE":
    case "TERMINATED":
      return "border-chart-5/35 bg-chart-5/10 text-chart-5";
    case "ENDED":
    case "EXPIRED":
    case "VOID":
      return "border-border/70 bg-muted/35 text-muted-foreground";
    default:
      return "border-border/70 bg-background text-foreground";
  }
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

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant="outline"
      className={cn("h-6 rounded-full px-2.5", getStatusBadgeClasses(status))}
    >
      {formatLabel(status)}
    </Badge>
  );
}

export default async function TenantProfilePage({
  params,
}: TenantProfilePageProps) {
  await requireCapability("MANAGE_TENANTS");
  const { tenantId } = await params;
  const tenant = await getTenantProfile(tenantId);

  if (!tenant) {
    notFound();
  }

  const tenantLabel = formatTenantLabel(tenant);
  const activeContracts = tenant.contracts.filter(
    (contract) => contract.status === "ACTIVE"
  );
  const openInvoices = tenant.invoices.filter((invoice) =>
    ["ISSUED", "PARTIALLY_PAID", "OVERDUE"].includes(invoice.status)
  );

  const recentActivity = [
    ...tenant.contracts.map((contract) => ({
      id: `contract-${contract.id}`,
      date: contract.startDate,
      title: `Contract ${formatLabel(contract.status).toLowerCase()}`,
      detail: `${contract.property.name} · ${formatCurrency(toNumber(contract.monthlyRent))}`,
      href: `/contracts/${contract.id}/edit`,
      icon: FileText,
      badge: formatLabel(contract.status),
    })),
    ...tenant.invoices.map((invoice) => ({
      id: `invoice-${invoice.id}`,
      date: invoice.issueDate,
      title: `Invoice ${invoice.invoiceNumber}`,
      detail: `${invoice.contract.property.name} · ${formatCurrency(toNumber(invoice.totalAmount))}`,
      href: `/billing/${invoice.id}`,
      icon: ReceiptText,
      badge: formatLabel(invoice.status),
    })),
    ...tenant.recentPayments.map((payment) => ({
      id: `payment-${payment.id}`,
      date: payment.paymentDate ?? payment.createdAt,
      title: `Payment ${formatCurrency(toNumber(payment.amountPaid))}`,
      detail: `${payment.invoice.invoiceNumber} · ${payment.contract.property.name}`,
      href: `/billing/${payment.invoice.id}`,
      icon: CircleDollarSign,
      badge: formatLabel(payment.status),
    })),
    ...tenant.recentReadings.map((reading) => ({
      id: `reading-${reading.id}`,
      date: reading.readingDate,
      title: `${formatLabel(reading.meter.utilityType)} reading`,
      detail: `${reading.meter.meterCode} · ${formatUtilityQuantity(reading.meter.utilityType, formatCompactNumber(toNumber(reading.consumption)))}`,
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
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.05em] sm:text-[2rem]">
            {tenantLabel}
          </h1>
        </div>

        <Button
          render={<Link href={`/tenants/${tenant.id}/edit`} />}
          className="rounded-full"
        >
          <PencilLine />
          Edit tenant
        </Button>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricPill
          label="Active Contracts"
          value={String(activeContracts.length)}
          icon={FileText}
        />
        <MetricPill
          label="Open Invoices"
          value={String(tenant.metrics.openInvoiceCount)}
          icon={ReceiptText}
        />
        <MetricPill
          label="Outstanding"
          value={formatCurrency(toNumber(tenant.metrics.outstandingBalance))}
          icon={WalletCards}
        />
        <MetricPill
          label="Utility Charges"
          value={formatCurrency(toNumber(tenant.metrics.utilityChargesTotal))}
          icon={Bolt}
        />
      </section>

      <section id="overview" className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="rounded-xl border-border/60 bg-card shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle>Profile</CardTitle>
            <Badge variant="outline" className="rounded-full">
              {formatLabel(tenant.type)}
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-border/60 bg-background px-4 py-3">
                <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                  Business Name
                </p>
                <p className="mt-2 font-medium">{tenant.businessName}</p>
              </div>
              <div className="rounded-xl border border-border/60 bg-background px-4 py-3">
                <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                  Primary Contact
                </p>
                <p className="mt-2 font-medium">{tenant.contactNumber ?? "Not set"}</p>
              </div>
              <div className="rounded-xl border border-border/60 bg-background px-4 py-3">
                <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                  Email
                </p>
                <p className="mt-2 font-medium">{tenant.email ?? "Not set"}</p>
              </div>
              <div className="rounded-xl border border-border/60 bg-background px-4 py-3">
                <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                  Valid ID
                </p>
                <p className="mt-2 font-medium">
                  {tenant.validIdType && tenant.validIdNumber
                    ? `${tenant.validIdType} · ${tenant.validIdNumber}`
                    : "Not set"}
                </p>
              </div>
              <div className="rounded-xl border border-border/60 bg-background px-4 py-3 sm:col-span-2">
                <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                  Address
                </p>
                <p className="mt-2 font-medium">{tenant.address ?? "Not set"}</p>
              </div>
              <div className="rounded-xl border border-border/60 bg-background px-4 py-3">
                <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                  Created
                </p>
                <p className="mt-2 font-medium">{formatDate(tenant.createdAt)}</p>
              </div>
              <div className="rounded-xl border border-border/60 bg-background px-4 py-3">
                <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                  Updated
                </p>
                <p className="mt-2 font-medium">{formatDate(tenant.updatedAt)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-border/60 bg-card shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle>People</CardTitle>
            <Badge variant="outline" className="rounded-full">
              {tenant.people.length}
            </Badge>
          </CardHeader>
          <CardContent>
            {tenant.people.length === 0 ? (
              <DashboardEmptyState
                icon={ShieldCheck}
                title="No people attached"
                description="No linked people yet."
              />
            ) : (
              <PaginatedStack pageSize={4}>
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
                        <Badge variant="outline" className="rounded-full">
                          Primary
                        </Badge>
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
                    </div>
                  </div>
                ))}
              </PaginatedStack>
            )}
          </CardContent>
        </Card>
      </section>

      <section id="operations" className="grid gap-4 xl:grid-cols-2">
        <Card className="rounded-xl border-border/60 bg-card shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle>Current Contracts</CardTitle>
            <Badge variant="outline" className="rounded-full">
              {activeContracts.length}
            </Badge>
          </CardHeader>
          <CardContent>
            {activeContracts.length === 0 ? (
              <DashboardEmptyState
                icon={FileText}
                title="No active contracts"
                description="Current contract coverage will show here."
                action={
                  <Button render={<Link href="/contracts/new" />} className="rounded-full">
                    <Plus />
                    Create contract
                  </Button>
                }
              />
            ) : (
              <PaginatedStack pageSize={3}>
                {activeContracts.map((contract) => (
                  <div
                    key={contract.id}
                    className="rounded-xl border border-border/60 bg-background px-4 py-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{contract.property.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {contract.property.propertyCode}
                        </p>
                      </div>
                      <StatusBadge status={contract.status} />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-4 text-sm text-muted-foreground">
                      <span>{formatCurrency(toNumber(contract.monthlyRent))}</span>
                      <span>{formatDate(contract.startDate)}</span>
                      <span>to {formatContractEndDate(contract.endDate)}</span>
                    </div>
                  </div>
                ))}
              </PaginatedStack>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-xl border-border/60 bg-card shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle>Open Billing</CardTitle>
            <Badge variant="outline" className="rounded-full">
              {openInvoices.length}
            </Badge>
          </CardHeader>
          <CardContent>
            {openInvoices.length === 0 ? (
              <DashboardEmptyState
                icon={ReceiptText}
                title="No open invoices"
                description="Current billing exposure will show here."
              />
            ) : (
              <PaginatedStack pageSize={4}>
                {openInvoices.map((invoice) => (
                  <div
                    key={invoice.id}
                    className="rounded-xl border border-border/60 bg-background px-4 py-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{invoice.invoiceNumber}</p>
                        <p className="text-sm text-muted-foreground">
                          {invoice.contract.property.name}
                        </p>
                      </div>
                      <StatusBadge status={invoice.status} />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-4 text-sm text-muted-foreground">
                      <span>{formatCurrency(toNumber(invoice.balanceDue))} balance</span>
                      <span>Due {formatDate(invoice.dueDate)}</span>
                    </div>
                  </div>
                ))}
              </PaginatedStack>
            )}
          </CardContent>
        </Card>
      </section>

      <section id="utilities" className="grid gap-4 xl:grid-cols-2">
        <Card className="rounded-xl border-border/60 bg-card shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle>Utility Meters</CardTitle>
            <Badge variant="outline" className="rounded-full">
              {tenant.utilityMeters.length}
            </Badge>
          </CardHeader>
          <CardContent>
            {tenant.utilityMeters.length === 0 ? (
              <DashboardEmptyState
                icon={Building2}
                title="No tenant meters"
                description="Assigned meters will show here."
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
              <PaginatedStack pageSize={4}>
                {tenant.utilityMeters.map((meter) => (
                  <div
                    key={meter.id}
                    className="rounded-xl border border-border/60 bg-background px-4 py-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{meter.meterCode}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatLabel(meter.utilityType)} · {meter.property.name}
                        </p>
                      </div>
                      <Badge variant="outline" className="rounded-full">
                        {meter._count.readings} readings
                      </Badge>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-4 text-sm text-muted-foreground">
                      <span>Added {formatDate(meter.createdAt)}</span>
                      <span>
                        {meter.readings[0]
                          ? `Last ${formatDate(meter.readings[0].readingDate)}`
                          : "No readings yet"}
                      </span>
                    </div>
                  </div>
                ))}
              </PaginatedStack>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-xl border-border/60 bg-card shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle>Recent Readings</CardTitle>
            <Badge variant="outline" className="rounded-full">
              {tenant.recentReadings.length}
            </Badge>
          </CardHeader>
          <CardContent>
            {tenant.recentReadings.length === 0 ? (
              <DashboardEmptyState
                icon={Gauge}
                title="No readings yet"
                description="Meter activity will show here."
              />
            ) : (
              <PaginatedStack pageSize={4}>
                {tenant.recentReadings.map((reading) => (
                  <div
                    key={reading.id}
                    className="rounded-xl border border-border/60 bg-background px-4 py-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{reading.meter.meterCode}</p>
                        <p className="text-sm text-muted-foreground">
                          {reading.meter.property.name}
                        </p>
                      </div>
                      <Badge variant="outline" className="rounded-full">
                        {reading.invoiceItem?.invoice.invoiceNumber ?? "Unbilled"}
                      </Badge>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-4 text-sm text-muted-foreground">
                      <span>{formatDate(reading.readingDate)}</span>
                      <span>
                        {formatUtilityQuantity(
                          reading.meter.utilityType,
                          formatCompactNumber(toNumber(reading.consumption))
                        )}
                      </span>
                      <span>{formatCurrency(toNumber(reading.totalAmount))}</span>
                    </div>
                  </div>
                ))}
              </PaginatedStack>
            )}
          </CardContent>
        </Card>
      </section>

      <section id="history" className="space-y-4">
        <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
          <Card className="rounded-xl border-border/60 bg-card shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <CardTitle>Activity</CardTitle>
              <Badge variant="outline" className="rounded-full">
                {recentActivity.length}
              </Badge>
            </CardHeader>
            <CardContent>
              {recentActivity.length === 0 ? (
                <DashboardEmptyState
                  icon={CalendarClock}
                  title="No tenant activity yet"
                  description="Activity will appear here."
                />
              ) : (
                <PaginatedStack pageSize={5}>
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
                            <Badge variant="outline" className="rounded-full">
                              {activity.badge}
                            </Badge>
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
                </PaginatedStack>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-xl border-border/60 bg-card shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <CardTitle>Payment Activity</CardTitle>
              <Badge variant="outline" className="rounded-full">
                {tenant.recentPayments.length}
              </Badge>
            </CardHeader>
            <CardContent>
              {tenant.recentPayments.length === 0 ? (
                <DashboardEmptyState
                  icon={CircleDollarSign}
                  title="No payments recorded"
                  description="Payment activity will show here."
                />
              ) : (
                <PaginatedStack pageSize={4}>
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
                        <StatusBadge status={payment.status} />
                      </div>
                      <div className="mt-3 flex flex-wrap gap-4 text-sm text-muted-foreground">
                        <span>
                          {payment.paymentDate
                            ? formatDate(payment.paymentDate)
                            : `Due ${formatDate(payment.dueDate)}`}
                        </span>
                        <span>{payment.referenceNumber ?? "No reference"}</span>
                      </div>
                    </div>
                  ))}
                </PaginatedStack>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-xl border-border/60 bg-card shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle>Contract History</CardTitle>
            <Badge variant="outline" className="rounded-full">
              {tenant.contracts.length}
            </Badge>
          </CardHeader>
          <CardContent>
            {tenant.contracts.length === 0 ? (
              <DashboardEmptyState
                icon={FileText}
                title="No contracts attached"
                description="Contract history will show here."
                action={
                  <Button render={<Link href="/contracts/new" />} className="rounded-full">
                    <Plus />
                    Create contract
                  </Button>
                }
              />
            ) : (
              <PaginatedTable
                pageSize={6}
                header={
                  <TableHeader>
                    <TableRow className="border-border/60">
                      <TableHead>Property</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Term</TableHead>
                      <TableHead>Billing Anchor</TableHead>
                      <TableHead className="text-right">Rent</TableHead>
                      <TableHead className="text-right">Invoices</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                }
              >
                {tenant.contracts.map((contract) => (
                    <TableRow key={contract.id} className="border-border/60">
                      <TableCell className="font-medium">
                        {contract.property.name}
                        <p className="text-xs text-muted-foreground">
                          {contract.property.propertyCode}
                        </p>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={contract.status} />
                      </TableCell>
                      <TableCell>
                        {formatDate(contract.startDate)}
                        <p className="text-xs text-muted-foreground">
                          to {formatContractEndDate(contract.endDate)}
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
                          className="rounded-full"
                        >
                          <PencilLine />
                          Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
              </PaginatedTable>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-xl border-border/60 bg-card shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle>Invoice History</CardTitle>
            <Badge variant="outline" className="rounded-full">
              {tenant.invoices.length}
            </Badge>
          </CardHeader>
          <CardContent>
            {tenant.invoices.length === 0 ? (
              <DashboardEmptyState
                icon={ReceiptText}
                title="No invoices yet"
                description="Invoice history will show here."
              />
            ) : (
              <PaginatedTable
                pageSize={6}
                header={
                  <TableHeader>
                    <TableRow className="border-border/60">
                      <TableHead>Invoice</TableHead>
                      <TableHead>Property</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Payments</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                }
              >
                {tenant.invoices.map((invoice) => (
                    <TableRow key={invoice.id} className="border-border/60">
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
                        <StatusBadge status={invoice.status} />
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
                            size="icon-sm"
                            className="rounded-full"
                            aria-label="View invoice"
                            title="View invoice"
                          >
                            <Eye />
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
              </PaginatedTable>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
