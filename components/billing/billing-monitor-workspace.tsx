"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Building2,
  CircleDollarSign,
  Eye,
  FilePenLine,
  Store,
  Trash2,
} from "lucide-react";
import { recordPaymentAction } from "@/app/(dashboard)/billing/actions";
import { deleteInvoiceAction } from "@/app/(dashboard)/billing/[invoiceId]/actions";
import { RecordPaymentSheet } from "@/components/billing/record-payment-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatBillingCycleMonthLabel } from "@/lib/billing/cycles";
import { INVOICE_ORIGIN_LABELS } from "@/lib/form-options";
import {
  formatCurrency,
  formatDate,
  getDatePartsInAppTimeZone,
  toDateInputValue,
} from "@/lib/format";
import { cn } from "@/lib/utils";

type BillingInvoice = {
  id: string;
  tenantId: string;
  invoiceNumber: string;
  issueDate: Date;
  dueDate: Date;
  billingPeriodStart: Date;
  billingPeriodEnd: Date;
  totalAmount: number;
  balanceDue: number;
  origin: "GENERATED" | "BACKLOG";
  status: string;
  tenant: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    businessName: string | null;
  };
  contract: {
    id: string;
    property: {
      id: string;
      name: string;
      propertyCode: string;
      parent?: {
        id: string;
        name: string;
        propertyCode: string;
      } | null;
    };
  };
  _count: {
    items: number;
    payments: number;
  };
  items: {
    id: string;
    itemType:
      | "RENT"
      | "RECURRING_CHARGE"
      | "UTILITY_READING"
      | "COSA"
      | "ADJUSTMENT"
      | "ARREARS";
    description: string;
    amount: number;
    allocations: {
      amountAllocated: number;
    }[];
  }[];
};

type BillingMonitorWorkspaceProps = {
  invoices: BillingInvoice[];
};

type BuildingGroup = {
  id: string;
  label: string;
  meta: string;
  invoices: BillingInvoice[];
};

type TenantGroup = {
  id: string;
  label: string;
  invoices: BillingInvoice[];
};

const MONTH_OPTIONS = [
  { value: "01", label: "January" },
  { value: "02", label: "February" },
  { value: "03", label: "March" },
  { value: "04", label: "April" },
  { value: "05", label: "May" },
  { value: "06", label: "June" },
  { value: "07", label: "July" },
  { value: "08", label: "August" },
  { value: "09", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
] as const;

type MonthValue = (typeof MONTH_OPTIONS)[number]["value"];

function isMonthValue(value: string): value is MonthValue {
  return MONTH_OPTIONS.some((option) => option.value === value);
}

function formatTenantName(tenant: BillingInvoice["tenant"]) {
  return (
    tenant.businessName ||
    [tenant.firstName, tenant.lastName].filter(Boolean).join(" ") ||
    "Unassigned"
  );
}

function formatStatusLabel(status: string) {
  return status
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getPayableItems(invoice: BillingInvoice) {
  return invoice.items
    .map((item) => {
      const allocatedAmount = item.allocations.reduce(
        (sum, allocation) => sum + allocation.amountAllocated,
        0
      );
      const remainingAmount = Math.max(0, item.amount - allocatedAmount);

      return {
        id: item.id,
        itemType: item.itemType,
        description: item.description,
        amount: item.amount,
        allocatedAmount,
        remainingAmount,
      };
    })
    .filter((item) => item.remainingAmount > 0);
}

function getInvoiceFilterParts(invoice: BillingInvoice) {
  return getDatePartsInAppTimeZone(invoice.billingPeriodStart);
}

function InvoiceActions({
  invoice,
  align = "end",
}: {
  invoice: BillingInvoice;
  align?: "start" | "end";
}) {
  const canEditBacklogInvoice =
    invoice.origin === "BACKLOG" && invoice._count.payments === 0;
  const canDeleteInvoice = invoice._count.payments === 0;
  const deleteInvoice = deleteInvoiceAction.bind(null, invoice.id);
  const payableItems = getPayableItems(invoice);
  const canRecordPayment = invoice.balanceDue > 0 && payableItems.length > 0;
  const paymentAction = recordPaymentAction.bind(null, invoice.id);

  return (
    <div
      className={`flex flex-wrap gap-2 ${
        align === "start" ? "justify-start" : "justify-end"
      }`}
    >
      {canEditBacklogInvoice ? (
        <Button
          render={<Link href={`/billing/${invoice.id}/edit`} />}
          variant="outline"
          size="icon-sm"
          className="rounded-full"
          aria-label="Edit invoice"
          title="Edit invoice"
        >
          <FilePenLine />
        </Button>
      ) : null}
      {canDeleteInvoice ? (
        <form action={deleteInvoice}>
          <Button
            type="submit"
            variant="destructive"
            size="icon-sm"
            className="rounded-full"
            aria-label="Delete invoice"
            title="Delete invoice"
          >
            <Trash2 />
          </Button>
        </form>
      ) : null}
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
      {canRecordPayment ? (
        <RecordPaymentSheet
          formAction={paymentAction}
          cycleLabel={formatBillingCycleMonthLabel(invoice.billingPeriodStart)}
          tenantLabel={formatTenantName(invoice.tenant)}
          propertyLabel={invoice.contract.property.name}
          invoiceNumber={invoice.invoiceNumber}
          invoiceBalance={invoice.balanceDue}
          dueDateLabel={formatDate(invoice.dueDate)}
          initialValues={{
            paymentDate: toDateInputValue(new Date()),
            referenceNumber: "",
            notes: "",
          }}
          triggerLabel={null}
          triggerAriaLabel="Record payment"
          triggerTitle="Record payment"
          triggerSize="icon-sm"
          triggerClassName="rounded-full"
          triggerIcon={<CircleDollarSign />}
          items={payableItems}
        />
      ) : null}
    </div>
  );
}

function InvoiceCards({ invoices }: { invoices: BillingInvoice[] }) {
  return (
    <div className="space-y-3 md:hidden">
      {invoices.map((invoice) => (
        <div
          key={invoice.id}
          className="rounded-[1.4rem] border border-border/60 bg-background/60 p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium">
                {`Invoice for ${formatBillingCycleMonthLabel(invoice.billingPeriodStart)}`}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {invoice.invoiceNumber} · {INVOICE_ORIGIN_LABELS[invoice.origin]}
              </p>
            </div>
            <Badge variant="outline" className="shrink-0 rounded-full">
              {formatStatusLabel(invoice.status)}
            </Badge>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Business
              </p>
              <p className="mt-1 text-sm">{formatTenantName(invoice.tenant)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Space
              </p>
              <p className="mt-1 text-sm">{invoice.contract.property.name}</p>
              <p className="text-xs text-muted-foreground">
                {invoice.contract.property.propertyCode}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Issued / Balance
              </p>
              <p className="mt-1 text-sm">{formatDate(invoice.issueDate)}</p>
              <p className="text-xs text-muted-foreground">
                {formatCurrency(invoice.balanceDue)}
              </p>
            </div>
          </div>

          <div className="mt-4 border-t border-border/60 pt-4">
            <InvoiceActions invoice={invoice} align="start" />
          </div>
        </div>
      ))}
    </div>
  );
}

function InvoiceTable({ invoices }: { invoices: BillingInvoice[] }) {
  return (
    <>
      <InvoiceCards invoices={invoices} />

      <div className="hidden w-full md:block">
        <Table className="w-full table-fixed">
          <TableHeader>
            <TableRow className="border-border/60">
              <TableHead className="w-[22%]">Invoice</TableHead>
              <TableHead className="w-[14%]">Business</TableHead>
              <TableHead className="w-[15%]">Space</TableHead>
              <TableHead className="w-[10%]">Issued Date</TableHead>
              <TableHead className="w-[8%]">Status</TableHead>
              <TableHead className="w-[6%] text-right">Payments</TableHead>
              <TableHead className="w-[8%] text-right">Balance</TableHead>
              <TableHead className="w-[9%] text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((invoice) => (
              <TableRow key={invoice.id} className="border-border/60">
                <TableCell className="align-top font-medium">
                  <p className="truncate">
                    {`Invoice for ${formatBillingCycleMonthLabel(invoice.billingPeriodStart)}`}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {invoice.invoiceNumber} · {invoice._count.items} items
                  </p>
                </TableCell>
                <TableCell className="align-top">
                  <p className="truncate">{formatTenantName(invoice.tenant)}</p>
                </TableCell>
                <TableCell className="align-top">
                  <p className="truncate">{invoice.contract.property.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {invoice.contract.property.propertyCode}
                  </p>
                </TableCell>
                <TableCell className="align-top">{formatDate(invoice.issueDate)}</TableCell>
                <TableCell className="align-top">
                  <Badge variant="outline" className="rounded-full">
                    {formatStatusLabel(invoice.status)}
                  </Badge>
                </TableCell>
                <TableCell className="align-top text-right">{invoice._count.payments}</TableCell>
                <TableCell className="align-top text-right whitespace-nowrap">
                  {formatCurrency(invoice.balanceDue)}
                </TableCell>
                <TableCell className="align-top text-right">
                  <InvoiceActions invoice={invoice} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

export function BillingMonitorWorkspace({
  invoices,
}: BillingMonitorWorkspaceProps) {
  const [selectedBuildingId, setSelectedBuildingId] = useState("all");
  const [selectedTenantId, setSelectedTenantId] = useState("all");
  const [selectedYear, setSelectedYear] = useState("all");
  const [selectedMonth, setSelectedMonth] = useState<MonthValue | "all">("all");
  const [page, setPage] = useState(1);
  const pageSize = 8;

  const sortedInvoices = useMemo(
    () =>
      [...invoices].sort((left, right) => {
        const billingDelta =
          right.billingPeriodStart.getTime() - left.billingPeriodStart.getTime();

        if (billingDelta !== 0) {
          return billingDelta;
        }

        const issueDelta = right.issueDate.getTime() - left.issueDate.getTime();

        if (issueDelta !== 0) {
          return issueDelta;
        }

        return right.invoiceNumber.localeCompare(left.invoiceNumber, undefined, {
          numeric: true,
        });
      }),
    [invoices]
  );

  const buildingGroups = useMemo<BuildingGroup[]>(() => {
    const grouped = new Map<string, BuildingGroup>();

    for (const invoice of sortedInvoices) {
      const building = invoice.contract.property.parent ?? invoice.contract.property;
      const existing = grouped.get(building.id);

      if (existing) {
        existing.invoices.push(invoice);
        continue;
      }

      grouped.set(building.id, {
        id: building.id,
        label: building.name,
        meta: building.propertyCode,
        invoices: [invoice],
      });
    }

    return [...grouped.values()].sort((left, right) =>
      left.label.localeCompare(right.label, undefined, { numeric: true })
    );
  }, [sortedInvoices]);

  const buildingInvoices = useMemo(
    () =>
      selectedBuildingId === "all"
        ? sortedInvoices
        : buildingGroups.find((group) => group.id === selectedBuildingId)?.invoices ?? [],
    [buildingGroups, selectedBuildingId, sortedInvoices]
  );

  const tenantGroups = useMemo<TenantGroup[]>(() => {
    const grouped = new Map<string, TenantGroup>();

    for (const invoice of buildingInvoices) {
      const existing = grouped.get(invoice.tenantId);

      if (existing) {
        existing.invoices.push(invoice);
        continue;
      }

      grouped.set(invoice.tenantId, {
        id: invoice.tenantId,
        label: formatTenantName(invoice.tenant),
        invoices: [invoice],
      });
    }

    return [...grouped.values()].sort((left, right) =>
      left.label.localeCompare(right.label, undefined, { numeric: true })
    );
  }, [buildingInvoices]);

  const effectiveTenantId =
    selectedTenantId === "all" || tenantGroups.some((group) => group.id === selectedTenantId)
      ? selectedTenantId
      : "all";

  const tenantScopedInvoices = useMemo(
    () =>
      effectiveTenantId === "all"
        ? buildingInvoices
        : tenantGroups.find((group) => group.id === effectiveTenantId)?.invoices ?? [],
    [buildingInvoices, effectiveTenantId, tenantGroups]
  );

  const yearOptions = useMemo(
    () =>
      [...new Set(
        tenantScopedInvoices
          .map((invoice) => getInvoiceFilterParts(invoice)?.year ?? null)
          .filter((value): value is string => value !== null)
      )].sort((left, right) => Number(right) - Number(left)),
    [tenantScopedInvoices]
  );

  const effectiveYear =
    selectedYear === "all" || yearOptions.includes(selectedYear) ? selectedYear : "all";

  const monthOptions = useMemo(
    () =>
      MONTH_OPTIONS.filter(({ value }) =>
        tenantScopedInvoices.some((invoice) => {
          const parts = getInvoiceFilterParts(invoice);

          if (!parts) {
            return false;
          }

          if (effectiveYear !== "all" && parts.year !== effectiveYear) {
            return false;
          }

          return parts.month === value;
        })
      ),
    [effectiveYear, tenantScopedInvoices]
  );

  const monthOptionValues = monthOptions.map((option) => option.value);
  const effectiveMonth =
    selectedMonth === "all" ||
    (isMonthValue(selectedMonth) && monthOptionValues.includes(selectedMonth))
      ? selectedMonth
      : "all";

  const filteredInvoices = tenantScopedInvoices.filter((invoice) => {
    const parts = getInvoiceFilterParts(invoice);

    if (!parts) {
      return effectiveYear === "all" && effectiveMonth === "all";
    }

    if (effectiveYear !== "all" && parts.year !== effectiveYear) {
      return false;
    }

    if (effectiveMonth !== "all" && parts.month !== effectiveMonth) {
      return false;
    }

    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredInvoices.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * pageSize;
  const pagedInvoices = filteredInvoices.slice(pageStart, pageStart + pageSize);
  const selectedBalance = filteredInvoices.reduce(
    (sum, invoice) => sum + invoice.balanceDue,
    0
  );

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="pb-1">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setSelectedBuildingId("all");
                setSelectedTenantId("all");
                setPage(1);
              }}
              className={cn(
                "inline-flex h-9 items-center gap-2 rounded-full border px-3 text-xs transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                selectedBuildingId === "all"
                  ? "border-chart-4/40 bg-chart-4/12 text-chart-4"
                  : "border-border/60 bg-background/70 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              )}
            >
              <Building2 className="size-3.5" />
              <span className="font-medium">All</span>
              <Badge variant="outline" className="h-5 rounded-full px-1.5">
                {invoices.length}
              </Badge>
            </button>

            {buildingGroups.map((group) => (
              <button
                key={group.id}
                type="button"
                onClick={() => {
                  setSelectedBuildingId(group.id);
                  setSelectedTenantId("all");
                  setPage(1);
                }}
                className={cn(
                  "inline-flex h-9 items-center gap-2 rounded-full border px-3 text-xs transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  selectedBuildingId === group.id
                    ? "border-chart-4/40 bg-chart-4/12 text-chart-4"
                    : "border-border/60 bg-background/70 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                )}
              >
                <Building2 className="size-3.5" />
                <span className="font-medium">{group.label}</span>
                <Badge variant="outline" className="h-5 rounded-full px-1.5">
                  {group.invoices.length}
                </Badge>
              </button>
            ))}
          </div>
        </div>

        <div className="pb-1">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setSelectedTenantId("all");
                setPage(1);
              }}
              className={cn(
                "inline-flex h-9 items-center gap-2 rounded-full border px-3 text-xs transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                effectiveTenantId === "all"
                  ? "border-primary/35 bg-primary/12 text-primary"
                  : "border-border/60 bg-background/70 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              )}
            >
              <Store className="size-3.5" />
              <span className="font-medium">All businesses</span>
              <Badge variant="outline" className="h-5 rounded-full px-1.5">
                {buildingInvoices.length}
              </Badge>
            </button>

            {tenantGroups.map((group) => (
              <button
                key={group.id}
                type="button"
                onClick={() => {
                  setSelectedTenantId(group.id);
                  setPage(1);
                }}
                className={cn(
                  "inline-flex h-9 items-center gap-2 rounded-full border px-3 text-xs transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  effectiveTenantId === group.id
                    ? "border-primary/35 bg-primary/12 text-primary"
                    : "border-border/60 bg-background/70 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                )}
              >
                <Store className="size-3.5" />
                <span className="font-medium">{group.label}</span>
                <Badge variant="outline" className="h-5 rounded-full px-1.5">
                  {group.invoices.length}
                </Badge>
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 pb-1 sm:grid-cols-2">
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Year
            </p>
            <select
              value={effectiveYear}
              onChange={(event) => {
                setSelectedYear(event.target.value);
                setSelectedMonth("all");
                setPage(1);
              }}
              className="select-blank"
            >
              <option value="all">All years</option>
              {yearOptions.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Month
            </p>
            <select
              value={effectiveMonth}
              onChange={(event) => {
                const nextMonth = event.target.value;
                setSelectedMonth(nextMonth === "all" || isMonthValue(nextMonth) ? nextMonth : "all");
                setPage(1);
              }}
              className="select-blank"
            >
              <option value="all">All months</option>
              {monthOptions.map((month) => (
                <option key={month.value} value={month.value}>
                  {month.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <Card className="rounded-2xl border border-border/60 bg-card shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between gap-3 pb-2">
          <div className="min-w-0">
            <CardTitle className="text-sm font-medium">
              {selectedBuildingId === "all"
                ? "All buildings"
                : buildingGroups.find((group) => group.id === selectedBuildingId)?.label}
            </CardTitle>
            <p className="mt-1 text-xs uppercase tracking-[0.12em] text-muted-foreground">
              {filteredInvoices.length} invoice{filteredInvoices.length === 1 ? "" : "s"} ·{" "}
              {formatCurrency(selectedBalance)} due
            </p>
          </div>
          <Badge variant="outline" className="rounded-full">
            Page {currentPage} of {totalPages}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-2 pt-0">
          {filteredInvoices.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/60 bg-muted/15 px-4 py-6 text-sm text-muted-foreground">
              No invoices in this filter.
            </div>
          ) : (
            <>
              <InvoiceTable invoices={pagedInvoices} />

              <div className="flex items-center justify-between gap-3 pt-2">
                <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                  Showing {pageStart + 1}-{Math.min(filteredInvoices.length, pageStart + pageSize)} of{" "}
                  {filteredInvoices.length}
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    onClick={() =>
                      setPage((currentPage) => Math.min(totalPages, currentPage + 1))
                    }
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
