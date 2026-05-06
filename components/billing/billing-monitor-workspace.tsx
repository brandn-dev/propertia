"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ChevronDown,
  CircleDollarSign,
  Eye,
  FilePenLine,
  Trash2,
} from "lucide-react";
import { deleteInvoiceAction } from "@/app/(dashboard)/billing/[invoiceId]/actions";
import { formatBillingCycleMonthLabel } from "@/lib/billing/cycles";
import { INVOICE_ORIGIN_LABELS } from "@/lib/form-options";
import { formatCurrency, formatDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
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
    };
  };
  _count: {
    items: number;
    payments: number;
  };
};

type BillingMonitorWorkspaceProps = {
  invoices: BillingInvoice[];
};

function formatTenantName(tenant: BillingInvoice["tenant"]) {
  return (
    tenant.businessName ||
    [tenant.firstName, tenant.lastName].filter(Boolean).join(" ") ||
    "Unassigned"
  );
}

function InvoiceActions({ invoice }: { invoice: BillingInvoice }) {
  const canEditBacklogInvoice =
    invoice.origin === "BACKLOG" && invoice._count.payments === 0;
  const canDeleteInvoice = invoice._count.payments === 0;
  const deleteInvoice = deleteInvoiceAction.bind(null, invoice.id);

  return (
    <div className="flex justify-end gap-2">
      {canEditBacklogInvoice ? (
        <Button
          render={<Link href={`/billing/${invoice.id}/edit`} />}
          variant="outline"
          size="icon-sm"
          className="button-blank rounded-full"
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
        className="button-blank rounded-full"
        aria-label="View invoice"
        title="View invoice"
      >
        <Eye />
      </Button>
      {invoice.balanceDue > 0 ? (
        <Button
          render={<Link href={`/billing/${invoice.id}/payment`} />}
          size="icon-sm"
          className="rounded-full"
          aria-label="Record payment"
          title="Record payment"
        >
          <CircleDollarSign />
        </Button>
      ) : null}
    </div>
  );
}

function InvoiceTable({ invoices }: { invoices: BillingInvoice[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Invoice</TableHead>
          <TableHead>Property</TableHead>
          <TableHead>Tenant</TableHead>
          <TableHead>Period</TableHead>
          <TableHead>Due date</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Payments</TableHead>
          <TableHead className="text-right">Balance</TableHead>
          <TableHead className="text-right">Action</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {invoices.map((invoice) => (
          <TableRow key={invoice.id}>
            <TableCell className="font-medium">
              {`Invoice for ${formatBillingCycleMonthLabel(invoice.billingPeriodStart)}`}
              <p className="text-xs text-muted-foreground">
                {invoice.invoiceNumber} · {invoice._count.items} items ·{" "}
                {INVOICE_ORIGIN_LABELS[invoice.origin]}
              </p>
            </TableCell>
            <TableCell>
              {invoice.contract.property.name}
              <p className="text-xs text-muted-foreground">
                {invoice.contract.property.propertyCode}
              </p>
            </TableCell>
            <TableCell>{formatTenantName(invoice.tenant)}</TableCell>
            <TableCell>
              {formatDate(invoice.billingPeriodStart)}
              <p className="text-xs text-muted-foreground">
                to {formatDate(invoice.billingPeriodEnd)}
              </p>
            </TableCell>
            <TableCell>{formatDate(invoice.dueDate)}</TableCell>
            <TableCell>
              <Badge variant="outline">{invoice.status.replaceAll("_", " ")}</Badge>
            </TableCell>
            <TableCell className="text-right">{invoice._count.payments}</TableCell>
            <TableCell className="text-right">
              {formatCurrency(invoice.balanceDue)}
            </TableCell>
            <TableCell className="text-right">
              <InvoiceActions invoice={invoice} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function BillingMonitorWorkspace({
  invoices,
}: BillingMonitorWorkspaceProps) {
  const [view, setView] = useState<"grouped" | "flat">("grouped");
  const [collapsedGroupIds, setCollapsedGroupIds] = useState<string[]>([]);
  const groups = useMemo(() => {
    const grouped = new Map<
      string,
      {
        id: string;
        label: string;
        invoices: BillingInvoice[];
      }
    >();

    for (const invoice of invoices) {
      const label = formatTenantName(invoice.tenant);
      const existing = grouped.get(invoice.tenantId);

      if (existing) {
        existing.invoices.push(invoice);
        continue;
      }

      grouped.set(invoice.tenantId, {
        id: invoice.tenantId,
        label,
        invoices: [invoice],
      });
    }

    return [...grouped.values()].sort((left, right) =>
      left.label.localeCompare(right.label)
    );
  }, [invoices]);

  function toggleGroup(groupId: string) {
    setCollapsedGroupIds((current) =>
      current.includes(groupId)
        ? current.filter((id) => id !== groupId)
        : [...current, groupId]
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant={view === "grouped" ? "default" : "outline"}
          className={view === "grouped" ? "rounded-full" : "button-blank rounded-full"}
          onClick={() => setView("grouped")}
        >
          Grouped by business
        </Button>
        <Button
          type="button"
          variant={view === "flat" ? "default" : "outline"}
          className={view === "flat" ? "rounded-full" : "button-blank rounded-full"}
          onClick={() => setView("flat")}
        >
          Flat table
        </Button>
      </div>

      {view === "flat" ? (
        <InvoiceTable invoices={invoices} />
      ) : (
        <div className="space-y-4">
          {groups.map((group) => {
            const openInvoices = group.invoices.filter((invoice) =>
              ["ISSUED", "PARTIALLY_PAID", "OVERDUE"].includes(invoice.status)
            ).length;
            const totalBalance = group.invoices.reduce(
              (sum, invoice) => sum + invoice.balanceDue,
              0
            );
            const isCollapsed = collapsedGroupIds.includes(group.id);

            return (
              <Card
                key={group.id}
                className="rounded-xl border-border/60 bg-card shadow-sm"
              >
                <CardHeader>
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.id)}
                    className="flex w-full flex-col gap-3 text-left lg:flex-row lg:items-start lg:justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <ChevronDown
                          className={`size-4 transition-transform ${
                            isCollapsed ? "-rotate-90" : "rotate-0"
                          }`}
                        />
                        <CardTitle>{group.label}</CardTitle>
                      </div>
                      <CardDescription>
                        {group.invoices.length} invoice(s) in this business queue.
                      </CardDescription>
                    </div>
                    <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                      <Badge variant="outline">{group.invoices.length} invoices</Badge>
                      <Badge variant="outline">{openInvoices} open</Badge>
                      <Badge variant="outline">
                        {formatCurrency(totalBalance)} due
                      </Badge>
                    </div>
                  </button>
                </CardHeader>
                {isCollapsed ? null : (
                  <CardContent>
                    <InvoiceTable invoices={group.invoices} />
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
