import Image from "next/image";
import type { CSSProperties, ReactNode } from "react";
import { PropertiaLogo } from "@/components/propertia-logo";
import type { InvoicePresentationModel } from "@/lib/billing/invoice-presenter";
import {
  DEFAULT_INVOICE_PAPER_SIZE,
  getInvoicePaperSizePreset,
  type InvoicePaperSize,
} from "@/lib/billing/invoice-pdf-options";
import { cn } from "@/lib/utils";

type InvoiceDocumentProps = {
  model: InvoicePresentationModel;
  renderMode: "public" | "internal" | "editor-preview" | "print";
  paperSize?: InvoicePaperSize;
  layoutMode?: "responsive" | "paper";
  accessBlock?: {
    qrDataUrl: string;
    publicAccessCode: string;
  };
  frameless?: boolean;
  afterDocument?: ReactNode;
};

const PAPER_CLASS =
  "invoice-print-surface font-sans rounded-[2rem] border border-[#dbe5ef] bg-white text-[#0f172a] shadow-[0_30px_80px_-36px_rgba(15,23,42,0.28)] print:rounded-none print:border-0 print:bg-white print:shadow-none";
const LABEL_CLASS =
  "text-[0.62rem] uppercase tracking-[0.24em] text-[color:var(--invoice-label-color)]";
const DIVIDER_CLASS = "border-[#dbe5ef]";
const VALUE_CLASS = "text-[color:var(--invoice-value-color)]";
const MUTED_CLASS = "text-[color:var(--invoice-muted-color)]";
const ACCENT_CLASS = "text-[color:var(--invoice-accent-color)]";
const PANEL_CLASS =
  "rounded-[1.35rem] bg-[color:var(--invoice-panel-background)] px-4 py-4";

export function InvoiceDocument({
  model,
  renderMode,
  paperSize = DEFAULT_INVOICE_PAPER_SIZE,
  layoutMode = "responsive",
  accessBlock,
  frameless = false,
  afterDocument,
}: InvoiceDocumentProps) {
  const paperPreset = getInvoicePaperSizePreset(paperSize);
  const compactPaper = paperPreset.compact;
  const paperLayout = layoutMode === "paper";
  const paymentSummaryVisible = model.payments.length > 0;
  const headerMetaItems = [
    { label: "Issued", value: model.issueDateLabel },
    { label: "Billing period", value: model.billingPeriodLabel },
    { label: "Inv no.", value: model.invoiceNumber },
  ] as const;
  const shellStyle = {
    maxWidth: paperPreset.previewWidth,
  } satisfies CSSProperties;
  const articleStyle = {
    minHeight: paperPreset.previewMinHeight,
    "--invoice-accent-color": model.branding.accentColor,
    "--invoice-label-color": model.branding.labelColor,
    "--invoice-value-color": model.branding.valueColor,
    "--invoice-muted-color": model.branding.mutedColor,
    "--invoice-panel-background": model.branding.panelBackground,
  } as CSSProperties;
  const titleScaleClass = paperLayout
    ? model.branding.titleScale === "COMPACT"
      ? compactPaper
        ? "whitespace-nowrap text-[1.72rem]"
        : "whitespace-nowrap text-[1.92rem]"
      : model.branding.titleScale === "PROMINENT"
        ? compactPaper
          ? "whitespace-nowrap text-[2.04rem]"
          : "whitespace-nowrap text-[2.28rem]"
        : compactPaper
          ? "whitespace-nowrap text-[1.9rem]"
          : "whitespace-nowrap text-[2.12rem]"
    : model.branding.titleScale === "COMPACT"
      ? compactPaper
        ? "max-w-2xl break-words text-[1.8rem] md:text-[1.92rem]"
        : "max-w-2xl break-words text-[1.9rem] md:text-[2rem]"
      : model.branding.titleScale === "PROMINENT"
        ? compactPaper
          ? "max-w-2xl break-words text-[2rem] md:text-[2.12rem]"
          : "max-w-2xl break-words text-[2.12rem] md:text-[2.28rem]"
        : compactPaper
          ? "max-w-2xl break-words text-[1.9rem] md:text-[2.02rem]"
          : "max-w-2xl break-words text-[2rem] md:text-[2.12rem]";
  const contentInsetClass = paperLayout ? "pl-3 pr-8" : "px-3";
  const brandNameBaseSize = 1.15;
  const brandSubtitleBaseSize = 0.72;
  const tenantNameBaseSize = compactPaper ? 1.82 : 2.08;
  const titleBaseSize = paperLayout
    ? model.branding.titleScale === "COMPACT"
      ? compactPaper
        ? 1.72
        : 1.92
      : model.branding.titleScale === "PROMINENT"
        ? compactPaper
          ? 2.04
          : 2.28
        : compactPaper
          ? 1.9
          : 2.12
    : model.branding.titleScale === "COMPACT"
      ? compactPaper
        ? 1.92
        : 2
      : model.branding.titleScale === "PROMINENT"
        ? compactPaper
          ? 2.12
          : 2.28
        : compactPaper
          ? 2.02
          : 2.12;

  return (
    <div
      className={cn("mx-auto w-full", renderMode === "editor-preview" ? "min-w-[720px]" : "")}
      style={shellStyle}
    >
      <article
        className={cn(
          PAPER_CLASS,
          `invoice-paper--${paperPreset.value}`,
          frameless ? "rounded-none border-0 bg-white shadow-none" : "",
          compactPaper ? "px-5 py-5 md:px-6 md:py-6" : "px-6 py-6 md:px-8 md:py-8"
        )}
        style={articleStyle}
      >
        <div className="space-y-5">
          <section className={cn("space-y-5 pb-3", contentInsetClass)}>
            <div
              className={cn(
                paperLayout
                  ? renderMode === "editor-preview"
                    ? compactPaper
                      ? "grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-8 items-start"
                      : "grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-10 items-start"
                    : compactPaper
                      ? "grid grid-cols-[minmax(0,1fr)_17rem] gap-8 items-start"
                      : "grid grid-cols-[minmax(0,1fr)_20rem] gap-10 items-start"
                  : "flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between"
              )}
            >
              <div className="min-w-0 space-y-4">
                <PropertiaLogo
                  size="md"
                  showWordmark
                  plainMark
                  title={model.branding.brandName}
                  logoSrc={model.branding.logoUrl ?? undefined}
                  logoAlt={`${model.propertyName} logo`}
                  logoScale={model.branding.logoScalePercent}
                  subtitle={model.branding.brandSubtitle}
                  subtitleClassName="tracking-[0.26em] text-[color:var(--invoice-label-color)]"
                  titleClassName="text-[color:var(--invoice-value-color)]"
                  titleStyle={{
                    fontWeight: model.branding.brandNameWeight,
                    fontSize: scaleRem(
                      brandNameBaseSize,
                      model.branding.brandNameSizePercent
                    ),
                  }}
                  subtitleStyle={{
                    fontSize: scaleRem(
                      brandSubtitleBaseSize,
                      model.branding.brandSubtitleSizePercent
                    ),
                  }}
                />

                <div className="min-w-0 space-y-1.5">
                  <div className="space-y-0.5">
                    <p className={LABEL_CLASS}>Bill to</p>
                    <p
                      className={cn(
                        "break-words leading-none tracking-[-0.055em] text-[color:var(--invoice-value-color)]",
                        compactPaper ? "text-[1.6rem] md:text-[1.82rem]" : "text-[1.88rem] md:text-[2.08rem]"
                      )}
                      style={{
                        fontWeight: model.branding.tenantNameWeight,
                        fontSize: scaleRem(
                          tenantNameBaseSize,
                          model.branding.tenantNameSizePercent
                        ),
                      }}
                    >
                      {model.tenantName}
                    </p>
                  </div>

                  <h1
                    className={cn(
                      "leading-[0.97] tracking-[-0.075em] text-[color:var(--invoice-value-color)]",
                      titleScaleClass
                    )}
                    style={{
                      fontWeight: model.branding.titleWeight,
                      fontSize: scaleRem(
                        titleBaseSize,
                        model.branding.titleSizePercent
                      ),
                    }}
                  >
                    {model.title}
                  </h1>
                </div>
              </div>

              <div
                className={cn(
                  "flex min-w-0 flex-col gap-3",
                  paperLayout && renderMode !== "editor-preview" ? "pr-8" : "",
                  paperLayout ? "items-end" : "lg:items-end"
                )}
                style={
                  paperLayout && renderMode === "editor-preview"
                    ? undefined
                    : { minWidth: paperPreset.metaMinWidth }
                }
              >
                {headerMetaItems.map((item) => (
                  <div
                    key={item.label}
                    className={cn(
                      "w-full pb-2.5 last:pb-0",
                      paperLayout ? "text-right" : "lg:text-right",
                    )}
                  >
                    <p className={LABEL_CLASS}>{item.label}</p>
                    <p
                      className={cn(
                        "mt-1.5 break-words text-xs font-semibold leading-tight tracking-[-0.03em] md:text-sm",
                        VALUE_CLASS
                      )}
                    >
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className={cn("space-y-4", contentInsetClass)}>
            <div className={cn("border-t pt-2", DIVIDER_CLASS)}>
              <div className="overflow-x-auto">
              <table className="w-full table-fixed border-collapse">
                <colgroup>
                  <col style={{ width: compactPaper ? "18%" : "16%" }} />
                  <col style={{ width: compactPaper ? "38%" : "42%" }} />
                  <col style={{ width: "10%" }} />
                  <col style={{ width: "14%" }} />
                  <col style={{ width: compactPaper ? "20%" : "18%" }} />
                </colgroup>
                <thead>
                  <tr className={cn("border-b text-left", DIVIDER_CLASS)}>
                    <th className={cn("py-4 pr-4 font-medium", LABEL_CLASS)}>Type</th>
                    <th className={cn("py-4 pr-4 font-medium", LABEL_CLASS)}>Description</th>
                    <th className={cn("py-4 pr-4 text-right font-medium", LABEL_CLASS)}>Qty</th>
                    <th className={cn("py-4 pr-4 text-right font-medium", LABEL_CLASS)}>Unit</th>
                    <th className={cn("py-4 text-right font-medium", LABEL_CLASS)}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {model.items.map((item, index) => (
                    <tr
                      key={item.id}
                      className={index < model.items.length - 1 ? cn("border-b", DIVIDER_CLASS) : ""}
                    >
                      <td
                        className={cn(
                          "py-4 pr-4 align-top text-[0.72rem] font-semibold uppercase tracking-[0.22em]",
                          ACCENT_CLASS
                        )}
                      >
                        {item.typeLabel}
                      </td>
                      <td className="py-4 pr-4 align-top break-words text-sm leading-[1.45] font-medium text-[#0f172a]">
                      
                        {item.description}
                      </td>
                      <td className={cn("py-4 pr-4 text-right align-top text-sm", MUTED_CLASS)}>
                        {item.quantity.toFixed(2)}
                      </td>
                      <td className={cn("py-4 pr-4 text-right align-top text-sm", MUTED_CLASS)}>
                        {formatInvoiceMoney(item.unitPrice)}
                      </td>
                      <td className={cn("py-4 text-right align-top text-sm font-semibold", VALUE_CLASS)}>
                        {formatInvoiceMoney(item.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>

            <div
              className={cn(
                "grid items-stretch gap-6 border-t pt-3",
                paperLayout
                  ? "grid-cols-2"
                  : "xl:grid-cols-[minmax(0,1fr)_19rem]",
                DIVIDER_CLASS,
              )}
            >
              <div className="min-w-0 space-y-8">
                {accessBlock &&
                (renderMode === "internal" || renderMode === "print") ? (
                  <section className={cn("h-full space-y-2", PANEL_CLASS)}>
                    <p className={LABEL_CLASS}>Invoice access</p>
                    <div className="flex flex-col items-start gap-2">
                      <Image
                        src={accessBlock.qrDataUrl}
                        alt={`QR code for invoice ${model.invoiceNumber}`}
                        width={112}
                        height={112}
                        unoptimized
                        className="size-[112px]"
                      />
                      <div className="space-y-0.5">
                        <p className="text-[0.56rem] uppercase tracking-[0.2em] text-[#94a3b8]">
                          Invoice password
                        </p>
                        <p className="break-all font-mono text-[0.7rem] font-medium tracking-[0.2em] text-[#64748b]">
                          {accessBlock.publicAccessCode}
                        </p>
                      </div>
                    </div>
                  </section>
                ) : null}

                {model.notes ? (
                  <section className="space-y-3">
                    <p className={LABEL_CLASS}>Notes</p>
                    <p className={cn("max-w-3xl whitespace-pre-wrap break-words text-sm leading-7", MUTED_CLASS)}>
                      {model.notes}
                    </p>
                  </section>
                ) : null}

                {paymentSummaryVisible ? (
                  <section className="space-y-4 pt-2">
                    <p className={LABEL_CLASS}>Payment history</p>
                    <PaymentSummary model={model} />
                  </section>
                ) : null}
              </div>

              <InvoiceTotalsPanel model={model} />
            </div>

            <InvoiceReceiptFooter paperLayout={paperLayout} />
          </section>
        </div>
      </article>

      {afterDocument ? <div className="mt-6">{afterDocument}</div> : null}
    </div>
  );
}

function PaymentSummary({ model }: { model: InvoicePresentationModel }) {
  return (
    <div className="space-y-4">
      <div className={cn("flex items-center justify-between gap-4 border-b pb-3", DIVIDER_CLASS)}>
        <span className="text-sm text-[#64748b]">Collected</span>
        <span className="font-semibold text-[#020617]">
          {formatInvoiceMoney(model.totals.collectedAmount)}
        </span>
      </div>

      {model.payments.map((payment) => (
        <div
          key={payment.id}
          className={cn(
            "grid gap-2 border-b pb-4 last:border-b-0 last:pb-0 md:grid-cols-[minmax(0,1fr)_9rem_10rem] md:items-start",
            DIVIDER_CLASS
          )}
        >
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="font-medium text-[#020617]">{payment.paymentDateLabel}</span>
            <span className="text-xs uppercase tracking-[0.18em] text-[#64748b] md:hidden">
              {payment.statusLabel}
            </span>
          </div>
          <div className="text-sm text-[#475569] md:text-right">
            {formatInvoiceMoney(payment.amountPaid)}
          </div>
          <div className="flex items-center justify-between gap-3 text-xs text-[#64748b] md:justify-end">
            <span>{payment.statusLabel}</span>
            <span>{payment.referenceNumber ?? "No reference"}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function InvoiceTotalsPanel({ model }: { model: InvoicePresentationModel }) {
  return (
    <section className={cn("h-full min-w-0 space-y-4", PANEL_CLASS)}>
      <p className={LABEL_CLASS}>Invoice summary</p>
      <div className="space-y-3 pt-1 text-sm">
        <SummaryRow label="Issue date" value={model.issueDateLabel} />
        <SummaryRow label="Rent subtotal" value={formatInvoiceMoney(model.totals.subtotal)} />
        <SummaryRow
          label="Additional charges"
          value={formatInvoiceMoney(model.totals.additionalCharges)}
        />
        <SummaryRow label="Discount" value={formatInvoiceMoney(model.totals.discount)} />
        <div className={cn("border-t pt-3", DIVIDER_CLASS)}>
          <SummaryRow
            label="Grand total"
            value={formatInvoiceMoney(model.totals.totalAmount)}
            strong
          />
        </div>
      </div>
    </section>
  );
}

function InvoiceReceiptFooter({ paperLayout }: { paperLayout: boolean }) {
  return (
    <footer className={cn("space-y-3 border-t pt-4", DIVIDER_CLASS)}>
      <div
        className={cn(
          "grid gap-x-6 gap-y-3 text-[0.72rem] text-[#475569]",
          paperLayout ? "grid-cols-3" : "md:grid-cols-3"
        )}
      >
        <FooterField label="Received by" />
        <FooterField label="Received Date" />
        <FooterField label="Signature" />
        <FooterField label="Paid Amount" />
        <FooterField label="Paid Date" />
        <FooterModeField />
      </div>
    </footer>
  );
}

function FooterField({ label }: { label: string }) {
  return (
    <div className="grid gap-1">
      <p className="text-[0.62rem] uppercase tracking-[0.2em] text-[#64748b]">{label}</p>
      <div className={cn("h-5 border-b", DIVIDER_CLASS)} />
    </div>
  );
}

function CheckBox() {
  return <span className={cn("inline-block size-3 border", DIVIDER_CLASS)} aria-hidden="true" />;
}

function FooterModeField() {
  return (
    <div className="grid gap-1">
      <p className="text-[0.62rem] uppercase tracking-[0.2em] text-[#64748b]">Mode</p>
      <div className="flex flex-wrap items-center gap-5 pt-1 text-[0.68rem] text-[#475569]">
        <div className="flex items-center gap-2">
          <CheckBox />
          <span>Cash</span>
        </div>
        <div className="flex items-center gap-2">
          <CheckBox />
          <span>Cheque</span>
        </div>
      </div>
    </div>
  );
}

function formatInvoiceMoney(value: number) {
  const absolute = Math.abs(value);
  const formatted = new Intl.NumberFormat("en-PH", {
    minimumFractionDigits: Number.isInteger(absolute) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(absolute);

  return `${value < 0 ? "-" : ""}₱${formatted}`;
}

function SummaryRow({
  label,
  value,
  strong = false,
  valueClassName,
}: {
  label: string;
  value: string;
  strong?: boolean;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className={cn("text-[#64748b]", strong ? "font-medium text-[#334155]" : "")}>
        {label}
      </span>
      <span
        className={cn(
          "shrink-0",
          strong ? "font-semibold text-[#020617]" : "font-medium text-[#334155]",
          valueClassName
        )}
      >
        {value}
      </span>
    </div>
  );
}

function scaleRem(baseRem: number, percent: number) {
  return `${(baseRem * percent) / 100}rem`;
}
