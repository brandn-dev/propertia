import Image from "next/image";
import { ExternalLink, QrCode } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { generateInvoiceQrDataUrl } from "@/lib/billing/invoice-qr";
import { getPublicInvoicePath, getPublicInvoiceUrl } from "@/lib/billing/public-access";

type InvoiceQrCardProps = {
  invoiceId: string;
  invoiceNumber: string;
  publicAccessCode: string;
  tenantName: string;
  propertyName: string;
  billingPeriodStart: Date;
  billingPeriodEnd: Date;
  issueDate: Date;
  dueDate: Date;
  totalAmount: number;
  balanceDue: number;
};

export async function InvoiceQrCard(props: InvoiceQrCardProps) {
  const qrDataUrl = await generateInvoiceQrDataUrl(props);
  const invoicePath = getPublicInvoicePath(props.invoiceId);
  const invoiceUrl = getPublicInvoiceUrl(props.invoiceId);
  const visibleInvoiceLink = invoiceUrl ?? invoicePath;

  return (
    <Card className="rounded-xl border-border/60 bg-card shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <QrCode className="size-4" />
          Invoice QR
        </CardTitle>
        <CardDescription>
          Scan or click the QR to open the public invoice page directly.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <a
          href={visibleInvoiceLink}
          target="_blank"
          rel="noreferrer"
          className="flex justify-center rounded-xl border border-border/60 bg-background p-4 transition-colors hover:border-primary/40"
        >
          <Image
            src={qrDataUrl}
            alt={`QR code for invoice ${props.invoiceNumber}`}
            width={208}
            height={208}
            unoptimized
            className="size-52 rounded-lg"
          />
        </a>
        <p className="text-center text-xs leading-5 text-muted-foreground">
          Invoice {props.invoiceNumber}
        </p>
        <div className="space-y-2 rounded-lg border border-border/60 bg-background px-3 py-2.5">
          <p className="text-[0.7rem] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Invoice password
          </p>
          <p className="font-mono text-base font-semibold tracking-[0.28em] text-foreground">
            {props.publicAccessCode}
          </p>
        </div>
        <div className="space-y-2 rounded-lg border border-border/60 bg-background px-3 py-2.5">
          <p className="text-[0.7rem] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Public invoice link
          </p>
          <a
            href={visibleInvoiceLink}
            target="_blank"
            rel="noreferrer"
            className="flex items-start gap-2 text-sm text-primary hover:underline"
          >
            <ExternalLink className="mt-0.5 size-4 shrink-0" />
            <span className="min-w-0 break-all">{visibleInvoiceLink}</span>
          </a>
          {!invoiceUrl ? (
            <p className="text-xs leading-5 text-muted-foreground">
              Set <code className="rounded bg-muted px-1.5 py-0.5">APP_URL</code> to make the QR
              resolve to a full external URL when scanned from another device.
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
