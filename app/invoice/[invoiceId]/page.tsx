import { notFound } from "next/navigation";
import {
  CalendarClock,
  CircleDollarSign,
  FileText,
  ShieldCheck,
} from "lucide-react";
import { unlockPublicInvoiceAction } from "@/app/invoice/[invoiceId]/actions";
import { PublicInvoiceAccessForm } from "@/components/billing/public-invoice-access-form";
import { PropertiaLogo } from "@/components/propertia-logo";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getCurrentUser } from "@/lib/auth/user";
import { formatBillingCycleMonthLabel } from "@/lib/billing/cycles";
import { hasGrantedInvoiceAccess } from "@/lib/billing/public-access";
import { getInvoiceForPublicView } from "@/lib/data/billing";
import { formatCurrency, formatDate, toNumber } from "@/lib/format";

type PublicInvoicePageProps = {
  params: Promise<{
    invoiceId: string;
  }>;
};

const ITEM_TYPE_LABELS = {
  RENT: "Rent",
  RECURRING_CHARGE: "Recurring charge",
  UTILITY_READING: "Utility reading",
  COSA: "COSA",
  ADJUSTMENT: "Adjustment",
  ARREARS: "Arrears",
} as const;

function formatTenantName(tenant: {
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

export default async function PublicInvoicePage({
  params,
}: PublicInvoicePageProps) {
  const { invoiceId } = await params;
  const invoice = await getInvoiceForPublicView(invoiceId);

  if (!invoice) {
    notFound();
  }

  const user = await getCurrentUser();
  const hasAccess = user ? true : await hasGrantedInvoiceAccess(invoice.id);

  if (!hasAccess) {
    const action = unlockPublicInvoiceAction.bind(null, invoice.id);

    return (
      <main className="min-h-svh bg-[radial-gradient(circle_at_top,_rgba(67,113,191,0.12),_transparent_30%),linear-gradient(180deg,_transparent,_rgba(12,18,32,0.04))] px-5 py-8">
        <div className="mx-auto flex min-h-[calc(100svh-4rem)] max-w-md items-center">
          <Card className="w-full rounded-2xl border-border/60 bg-card shadow-sm backdrop-blur">
            <CardContent className="p-6 md:p-8">
              <div className="flex justify-center">
                <PropertiaLogo
                  size="md"
                  subtitle="Public invoice access"
                  className="justify-center"
                  titleClassName="text-2xl"
                  subtitleClassName="tracking-[0.24em]"
                />
              </div>

              <div className="mt-6 rounded-xl border border-border/60 bg-muted/45 px-4 py-4 text-center">
                <p className="text-sm font-medium text-foreground">{invoice.invoiceNumber}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatTenantName(invoice.tenant)} · {invoice.contract.property.name}
                </p>
                <p className="mt-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  Due {formatDate(invoice.dueDate)}
                </p>
              </div>

              <div className="mt-8">
                <PublicInvoiceAccessForm
                  invoiceNumber={invoice.invoiceNumber}
                  action={action}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-svh bg-[radial-gradient(circle_at_top,_rgba(67,113,191,0.1),_transparent_26%),linear-gradient(180deg,_transparent,_rgba(12,18,32,0.03))] px-5 py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <Card className="rounded-2xl border-border/60 bg-card shadow-sm">
          <CardContent className="flex flex-col gap-5 p-6 md:flex-row md:items-start md:justify-between md:p-8">
            <div className="space-y-4">
              <PropertiaLogo
                size="md"
                subtitle="Public invoice"
                titleClassName="text-2xl"
                subtitleClassName="tracking-[0.24em]"
              />
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{invoice.status.replaceAll("_", " ")}</Badge>
                  <Badge variant="outline">{invoice.contract.property.propertyCode}</Badge>
                  <Badge variant="outline">{formatDate(invoice.dueDate)}</Badge>
                </div>
                <h1 className="text-3xl font-semibold tracking-[-0.04em] text-foreground">
                  Invoice for {formatBillingCycleMonthLabel(invoice.billingPeriodStart)}
                </h1>
                <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                  {invoice.invoiceNumber} covers the current billed rent, recurring charges,
                  COSA, and utility readings for {formatTenantName(invoice.tenant)} at{" "}
                  {invoice.contract.property.name}.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 md:w-[28rem]">
              <div className="rounded-xl border border-border/60 bg-background px-4 py-3">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  <CircleDollarSign className="size-3.5" />
                  Total
                </div>
                <p className="mt-2 text-lg font-semibold text-foreground">
                  {formatCurrency(toNumber(invoice.totalAmount))}
                </p>
              </div>
              <div className="rounded-xl border border-border/60 bg-background px-4 py-3">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  <CalendarClock className="size-3.5" />
                  Due date
                </div>
                <p className="mt-2 text-lg font-semibold text-foreground">
                  {formatDate(invoice.dueDate)}
                </p>
              </div>
              <div className="rounded-xl border border-border/60 bg-background px-4 py-3">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  <ShieldCheck className="size-3.5" />
                  Balance
                </div>
                <p className="mt-2 text-lg font-semibold text-foreground">
                  {formatCurrency(toNumber(invoice.balanceDue))}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <section className="grid gap-4 xl:grid-cols-[1.12fr_0.88fr]">
          <Card className="rounded-xl border-border/60 bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="size-4" />
                Invoice items
              </CardTitle>
              <CardDescription>
                Charges captured in this invoice cycle.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead className="text-right">Unit price</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoice.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Badge variant="outline">{ITEM_TYPE_LABELS[item.itemType]}</Badge>
                      </TableCell>
                      <TableCell className="font-medium">{item.description}</TableCell>
                      <TableCell className="text-right">
                        {toNumber(item.quantity).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(toNumber(item.unitPrice))}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(toNumber(item.amount))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card className="rounded-xl border-border/60 bg-card shadow-sm">
              <CardHeader>
                <CardTitle>Invoice summary</CardTitle>
                <CardDescription>
                  Core billing information for this invoice.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">Tenant</span>
                  <span className="font-medium">{formatTenantName(invoice.tenant)}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">Property</span>
                  <span className="font-medium">{invoice.contract.property.name}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">Billing period</span>
                  <span className="font-medium">
                    {formatDate(invoice.billingPeriodStart)} to{" "}
                    {formatDate(invoice.billingPeriodEnd)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">Issue date</span>
                  <span className="font-medium">{formatDate(invoice.issueDate)}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">Due date</span>
                  <span className="font-medium">{formatDate(invoice.dueDate)}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">Billing anchor</span>
                  <span className="font-medium">
                    {formatDate(invoice.contract.paymentStartDate)}
                  </span>
                </div>
                <div className="h-px bg-border/70" />
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">Rent subtotal</span>
                  <span className="font-medium">
                    {formatCurrency(toNumber(invoice.subtotal))}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">Additional charges</span>
                  <span className="font-medium">
                    {formatCurrency(toNumber(invoice.additionalCharges))}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">Discount</span>
                  <span className="font-medium">
                    {formatCurrency(toNumber(invoice.discount))}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4 text-base">
                  <span className="font-medium">Total</span>
                  <span className="font-semibold">
                    {formatCurrency(toNumber(invoice.totalAmount))}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4 text-base">
                  <span className="font-medium">Balance due</span>
                  <span className="font-semibold">
                    {formatCurrency(toNumber(invoice.balanceDue))}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </main>
  );
}
