import { notFound } from "next/navigation";
import { unlockPublicInvoiceAction } from "@/app/invoice/[invoiceId]/actions";
import { InvoiceDocument } from "@/components/billing/invoice-document";
import { InvoicePdfLauncher } from "@/components/billing/invoice-pdf-launcher";
import { PublicInvoiceAccessForm } from "@/components/billing/public-invoice-access-form";
import { PropertiaLogo } from "@/components/propertia-logo";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/user";
import { buildInvoicePresentationModel } from "@/lib/billing/invoice-presenter";
import { hasGrantedInvoiceAccess } from "@/lib/billing/public-access";
import { getInvoiceForPublicView } from "@/lib/data/billing";
import { formatDate } from "@/lib/format";

type PublicInvoicePageProps = {
  params: Promise<{
    invoiceId: string;
  }>;
};

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
        <div className="flex justify-end print:hidden">
          <div className="flex flex-wrap justify-end gap-2">
            <InvoicePdfLauncher
              action={`/invoice/${invoice.id}/pdf/file`}
              theme="inverse"
            />
          </div>
        </div>
        <InvoiceDocument
          model={buildInvoicePresentationModel(invoice)}
          renderMode="public"
        />
      </div>
    </main>
  );
}
