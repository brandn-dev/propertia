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
  "invoice-print-surface font-sans rounded-[1.2rem] border border-[color:var(--invoice-paper-border)] bg-[color:var(--invoice-paper-background)] text-[color:var(--invoice-paper-foreground)] shadow-[0_30px_80px_-36px_rgba(15,23,42,0.28)] print:rounded-none print:border-0 print:bg-white print:shadow-none";
const LABEL_CLASS =
  "text-[0.62rem] uppercase tracking-[0.24em] text-[color:var(--invoice-label-color)]";
const DIVIDER_CLASS = "border-[color:var(--invoice-paper-border)]";
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
  const responsiveLayout = !paperLayout;
  const mobileReceiptLayout = responsiveLayout;
  const hasBreakdownPage = model.breakdowns.hasSecondPage;
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
    minHeight: paperLayout ? paperPreset.previewMinHeight : undefined,
    "--invoice-preview-min-height": paperPreset.previewMinHeight,
    "--invoice-paper-background": paperLayout ? "#ffffff" : "var(--card)",
    "--invoice-paper-foreground": paperLayout ? "#0f172a" : "var(--card-foreground)",
    "--invoice-paper-border": paperLayout ? "#dbe5ef" : "var(--border)",
    "--invoice-accent-color": paperLayout
      ? model.branding.accentColor
      : "var(--card-foreground)",
    "--invoice-label-color": paperLayout
      ? model.branding.labelColor
      : "var(--muted-foreground)",
    "--invoice-value-color": paperLayout
      ? model.branding.valueColor
      : "var(--card-foreground)",
    "--invoice-muted-color": paperLayout
      ? model.branding.mutedColor
      : "var(--muted-foreground)",
    "--invoice-panel-background": paperLayout
      ? model.branding.panelBackground
      : "var(--background)",
  } as CSSProperties;
  const contentInsetClass = paperLayout
    ? "pl-3 pr-8"
    : "px-4 sm:px-5 md:pl-3 md:pr-8";
  const sectionStackClass = paperLayout ? "space-y-4" : "space-y-4 md:space-y-5";
  const headerSectionClass = paperLayout
    ? "space-y-5 pb-3"
    : "space-y-3 pb-1.5 md:space-y-3 md:pb-1.5";
  const headerBrandStackClass = paperLayout ? "space-y-2.5" : "space-y-1 md:space-y-1.25";
  const headerTitleStackClass = "space-y-1";
  const headerDividerClass = paperLayout ? "border-t pt-2" : "border-t pt-1.5 md:pt-2";
  const brandNameBaseSize = 1.15;
  const brandSubtitleBaseSize = 0.72;
  const tenantNameBaseSize = compactPaper ? 1.82 : 2.08;
  const articleClassName = cn(
    PAPER_CLASS,
    paperLayout ? `invoice-paper--${paperPreset.value}` : "",
    frameless
      ? "rounded-none border-0 bg-[color:var(--invoice-paper-background)] shadow-none"
      : "",
    responsiveLayout
      ? "px-0 py-4 sm:px-0 sm:py-5 md:min-h-[var(--invoice-preview-min-height)] md:px-8 md:py-8"
      : compactPaper
        ? "px-5 py-5 md:px-6 md:py-6"
        : "px-6 py-6 md:px-8 md:py-8"
  );

  return (
    <div
      className={cn(
        "mx-auto w-full",
        renderMode === "editor-preview" ? "min-w-[720px]" : "",
        responsiveLayout ? "max-w-5xl" : ""
      )}
      style={shellStyle}
    >
      <article
        className={articleClassName}
        style={articleStyle}
      >
        <div className={sectionStackClass}>
          <section
            className={cn(
              headerSectionClass,
              contentInsetClass
            )}
          >
            <div
              className={cn(
                paperLayout
                  ? renderMode === "editor-preview"
                    ? compactPaper
                      ? "grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-8 items-end"
                      : "grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-10 items-end"
                    : compactPaper
                      ? "grid grid-cols-[minmax(0,1fr)_17rem] gap-8 items-end"
                      : "grid grid-cols-[minmax(0,1fr)_20rem] gap-10 items-end"
                  : "grid gap-5 md:grid-cols-[minmax(0,1fr)_20rem] md:items-end md:gap-8"
              )}
            >
                <div className={cn("min-w-0", headerBrandStackClass)}>
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

                <div className={cn("min-w-0", headerTitleStackClass)}>
                  <p className={cn("text-[0.72rem] font-medium tracking-[0.08em]", MUTED_CLASS)}>
                    {model.title}
                  </p>

                  <p className={LABEL_CLASS}>Bill to</p>

                  <p
                    className={cn(
                      "break-words leading-none tracking-[-0.055em] text-[color:var(--invoice-value-color)]",
                      compactPaper ? "text-[1.5rem] md:text-[1.82rem]" : "text-[1.6rem] md:text-[2.08rem]"
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
              </div>

              <div
                className={cn(
                  "min-w-0 gap-3",
                  paperLayout
                    ? cn(
                        "flex flex-col items-end",
                        renderMode !== "editor-preview" ? "pr-8" : ""
                      )
                    : "grid grid-cols-2 gap-3 md:flex md:flex-col md:items-end"
                )}
                style={
                  paperLayout
                    ? renderMode === "editor-preview"
                      ? undefined
                      : { minWidth: paperPreset.metaMinWidth }
                    : undefined
                }
              >
                {headerMetaItems.map((item) => (
                  <div
                    key={item.label}
                    className={cn(
                      "w-full pb-2.5 last:pb-0",
                      paperLayout
                        ? "text-right"
                        : "px-0 py-1.5 text-left last:col-span-2 md:w-full md:px-0 md:py-0 md:text-right",
                    )}
                  >
                    <p className={LABEL_CLASS}>{item.label}</p>
                    <p
                      className={cn(
                        "mt-1 break-words text-[0.93rem] font-[560] leading-tight tracking-[-0.03em] md:text-sm",
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

          <section className={cn("space-y-4", contentInsetClass, mobileReceiptLayout ? "pt-1" : "")}>
            <div className={cn(headerDividerClass, DIVIDER_CLASS)}>
              {paperLayout ? (
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
                        <th className={cn("py-2.5 pr-4 font-medium", LABEL_CLASS)}>Type</th>
                        <th className={cn("py-2.5 pr-4 font-medium", LABEL_CLASS)}>Description</th>
                        <th className={cn("py-2.5 pr-4 text-right font-medium", LABEL_CLASS)}>Usage / Qty</th>
                        <th className={cn("py-2.5 pr-4 text-right font-medium", LABEL_CLASS)}>Unit</th>
                        <th className={cn("py-2.5 text-right font-medium", LABEL_CLASS)}>Amount</th>
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
                              "py-2.5 pr-4 align-top text-[0.72rem] font-semibold uppercase tracking-[0.22em]",
                              ACCENT_CLASS
                            )}
                          >
                            {item.typeLabel}
                          </td>
                          <td
                              className={cn(
                                  "py-2.5 pr-4 align-top break-words font-[430]",
                                  item.itemType === "UTILITY_READING" || item.itemType === "COSA"
                                ? "text-[0.88rem] leading-[1.35]"
                                : "text-[0.92rem] leading-[1.45]",
                              VALUE_CLASS
                            )}
                          >
                            {item.description}
                          </td>
                          <td
                            className={cn(
                              "py-2.5 pr-4 text-right align-top whitespace-nowrap",
                              item.itemType === "UTILITY_READING" || item.itemType === "COSA"
                                ? "text-[0.88rem]"
                                : "text-sm",
                              MUTED_CLASS
                            )}
                          >
                            {item.quantityDisplay ?? item.quantity.toFixed(2)}
                          </td>
                          <td
                            className={cn(
                              "py-2.5 pr-4 text-right align-top",
                              item.itemType === "UTILITY_READING" || item.itemType === "COSA"
                                ? "text-[0.88rem]"
                                : "text-sm",
                              MUTED_CLASS
                            )}
                          >
                            {formatInvoiceMoney(item.unitPrice)}
                          </td>
                          <td
                            className={cn(
                              "py-2.5 text-right align-top font-semibold",
                              item.itemType === "UTILITY_READING" || item.itemType === "COSA"
                                ? "text-[0.9rem]"
                                : "text-sm",
                              VALUE_CLASS
                            )}
                          >
                            {formatInvoiceMoney(item.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="space-y-3 md:space-y-0">
                  <div className="hidden md:block">
                    <div className="overflow-x-auto">
                      <table className="w-full table-fixed border-collapse">
                        <colgroup>
                          <col style={{ width: "16%" }} />
                          <col style={{ width: "42%" }} />
                          <col style={{ width: "10%" }} />
                          <col style={{ width: "14%" }} />
                          <col style={{ width: "18%" }} />
                        </colgroup>
                        <thead>
                          <tr className={cn("border-b text-left", DIVIDER_CLASS)}>
                            <th className={cn("py-2.5 pr-4 font-medium", LABEL_CLASS)}>Type</th>
                            <th className={cn("py-2.5 pr-4 font-medium", LABEL_CLASS)}>Description</th>
                            <th className={cn("py-2.5 pr-4 text-right font-medium", LABEL_CLASS)}>Usage / Qty</th>
                            <th className={cn("py-2.5 pr-4 text-right font-medium", LABEL_CLASS)}>Unit</th>
                            <th className={cn("py-2.5 text-right font-medium", LABEL_CLASS)}>Amount</th>
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
                                  "py-2.5 pr-4 align-top text-[0.72rem] font-semibold uppercase tracking-[0.22em]",
                                  ACCENT_CLASS
                                )}
                              >
                                {item.typeLabel}
                              </td>
                              <td
                                className={cn(
                                  "py-2.5 pr-4 align-top break-words font-[430]",
                                  item.itemType === "UTILITY_READING" || item.itemType === "COSA"
                                    ? "text-[0.88rem] leading-[1.35]"
                                    : "text-[0.92rem] leading-[1.45]",
                                  VALUE_CLASS
                                )}
                              >
                                {item.description}
                              </td>
                              <td
                                className={cn(
                                  "py-2.5 pr-4 text-right align-top whitespace-nowrap",
                                  item.itemType === "UTILITY_READING" || item.itemType === "COSA"
                                    ? "text-[0.88rem]"
                                    : "text-sm",
                                  MUTED_CLASS
                                )}
                              >
                                {item.quantityDisplay ?? item.quantity.toFixed(2)}
                              </td>
                              <td
                                className={cn(
                                  "py-2.5 pr-4 text-right align-top",
                                  item.itemType === "UTILITY_READING" || item.itemType === "COSA"
                                    ? "text-[0.88rem]"
                                    : "text-sm",
                                  MUTED_CLASS
                                )}
                              >
                                {formatInvoiceMoney(item.unitPrice)}
                              </td>
                              <td
                                className={cn(
                                  "py-2.5 text-right align-top font-semibold",
                                  item.itemType === "UTILITY_READING" || item.itemType === "COSA"
                                    ? "text-[0.9rem]"
                                    : "text-sm",
                                  VALUE_CLASS
                                )}
                              >
                                {formatInvoiceMoney(item.amount)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="space-y-2.5 md:hidden">
                    {model.items.map((item) => (
                      <article
                        key={item.id}
                        className={cn("border-b border-border/60 pb-3 last:border-b-0 last:pb-0")}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <p
                            className={cn(
                              "text-[0.68rem] font-semibold uppercase tracking-[0.22em]",
                              ACCENT_CLASS
                            )}
                          >
                            {item.typeLabel}
                          </p>
                          <p className={cn("text-[0.95rem] font-semibold text-right", VALUE_CLASS)}>
                            {formatInvoiceMoney(item.amount)}
                          </p>
                        </div>
                        <p
                          className={cn(
                            "mt-2 break-words font-[430]",
                            item.itemType === "UTILITY_READING" || item.itemType === "COSA"
                              ? "text-[0.9rem] leading-[1.45]"
                              : "text-[0.93rem] leading-6",
                            VALUE_CLASS
                          )}
                        >
                          {item.description}
                        </p>
                        <div className="mt-3 grid grid-cols-2 gap-3">
                          <MetricStack
                            label={item.itemType === "UTILITY_READING" ? "Usage" : "Qty"}
                            value={item.quantityDisplay ?? item.quantity.toFixed(2)}
                          />
                          <MetricStack label="Unit" value={formatInvoiceMoney(item.unitPrice)} align="right" />
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className={cn("space-y-4 border-t pt-3", DIVIDER_CLASS)}>
              <div
                className={cn(
                  "gap-4",
                  paperLayout
                    ? "grid grid-cols-[minmax(0,1fr)_18rem] items-start"
                    : "space-y-4 md:grid md:grid-cols-[minmax(0,1fr)_18rem] md:items-start md:space-y-0"
                )}
              >
                <div className="min-w-0 space-y-4">
                  {model.notes ? (
                    <section className="space-y-2.5">
                      <p className={LABEL_CLASS}>Notes</p>
                      <p
                        className={cn(
                          "max-w-3xl whitespace-pre-wrap break-words text-[0.93rem] leading-6 font-[430]",
                          MUTED_CLASS
                        )}
                      >
                        {model.notes}
                      </p>
                    </section>
                  ) : null}
                </div>

                <div className="min-w-0">
                  <InvoiceTotalsPanel model={model} />
                </div>
              </div>

              {paymentSummaryVisible ? (
                <section className="space-y-3 pt-1">
                  <p className={LABEL_CLASS}>Payment history</p>
                  <PaymentSummary model={model} />
                </section>
              ) : null}
            </div>

            <InvoiceReceiptFooter
              paperLayout={paperLayout}
              renderMode={renderMode}
              invoiceNumber={model.invoiceNumber}
              accessBlock={accessBlock}
            />
          </section>
        </div>
      </article>

      {hasBreakdownPage ? (
        <article
          className={cn(articleClassName, "mt-6 print:mt-0")}
          style={
            paperLayout
              ? ({
                  ...articleStyle,
                  breakBefore: "page",
                  pageBreakBefore: "always",
                } as CSSProperties)
              : articleStyle
          }
        >
          <div className={paperLayout ? "space-y-4" : "space-y-4"}>
            <section className={cn("space-y-4", contentInsetClass)}>
              <div className="space-y-1">
                <p className={LABEL_CLASS}>Page 2</p>
                <h2 className={cn("text-[1.05rem] font-semibold tracking-[-0.04em]", VALUE_CLASS)}>
                  Breakdown details
                </h2>
              </div>

              {model.breakdowns.utilityReadings.length > 0 ? (
                <UtilityBreakdownSection model={model} paperLayout={paperLayout} />
              ) : null}

              {model.breakdowns.cosaAllocations.length > 0 ? (
                <CosaBreakdownSection model={model} paperLayout={paperLayout} />
              ) : null}
            </section>
          </div>
        </article>
      ) : null}

      {afterDocument ? <div className="mt-6">{afterDocument}</div> : null}
    </div>
  );
}

function PaymentSummary({ model }: { model: InvoicePresentationModel }) {
  return (
    <div className="space-y-4">
      <div className={cn("space-y-2 border-b pb-3", DIVIDER_CLASS)}>
        <div className="flex items-center justify-between gap-4">
          <span className={cn("text-sm", MUTED_CLASS)}>Collected</span>
          <span className={cn("font-semibold", VALUE_CLASS)}>
            {formatInvoiceMoney(model.totals.collectedAmount)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className={cn("text-sm", MUTED_CLASS)}>Balance</span>
          <span
            className={cn(
              "font-semibold",
              model.totals.balanceDue > 0 ? ACCENT_CLASS : VALUE_CLASS
            )}
          >
            {formatInvoiceMoney(model.totals.balanceDue)}
          </span>
        </div>
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
            <span className={cn("font-medium", VALUE_CLASS)}>{payment.paymentDateLabel}</span>
            <span className={cn("text-xs uppercase tracking-[0.18em] md:hidden", MUTED_CLASS)}>
              {payment.statusLabel}
            </span>
          </div>
          <div className={cn("text-sm md:text-right", MUTED_CLASS)}>
            {formatInvoiceMoney(payment.amountPaid)}
          </div>
          <div className={cn("flex items-center justify-between gap-3 text-xs md:justify-end", MUTED_CLASS)}>
            <span>{payment.statusLabel}</span>
            <span>{payment.referenceNumber ?? "No reference"}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function InvoiceTotalsPanel({
  model,
}: {
  model: InvoicePresentationModel;
}) {
  return (
    <section
      className={cn(
        "min-w-0 self-start space-y-3 rounded-[1.1rem]",
        PANEL_CLASS,
        "h-auto"
      )}
    >
      <p className={LABEL_CLASS}>Invoice summary</p>
      <div className="space-y-2.5 pt-1 text-[0.95rem]">
        <SummaryRow
          label="Grand total"
          value={formatInvoiceMoney(model.totals.totalAmount)}
          strong
        />
        {model.totals.balanceDue !== model.totals.totalAmount ? (
          <SummaryRow
            label="Balance due"
            value={formatInvoiceMoney(model.totals.balanceDue)}
            strong
            valueClassName={model.totals.balanceDue > 0 ? ACCENT_CLASS : undefined}
          />
        ) : null}
      </div>
    </section>
  );
}

function InvoiceReceiptFooter({
  paperLayout,
  renderMode,
  invoiceNumber,
  accessBlock,
}: {
  paperLayout: boolean;
  renderMode: InvoiceDocumentProps["renderMode"];
  invoiceNumber: string;
  accessBlock?: InvoiceDocumentProps["accessBlock"];
}) {
  const showAccessBlock =
    Boolean(accessBlock) && (renderMode === "internal" || renderMode === "print");

  return (
    <footer className={cn("space-y-3 border-t pt-4", DIVIDER_CLASS)}>
      <div
        className={cn(
          "gap-4",
          showAccessBlock
            ? paperLayout
              ? "grid grid-cols-[max-content_minmax(0,1fr)] items-start"
              : "space-y-4 md:grid md:grid-cols-[max-content_minmax(0,1fr)] md:items-start md:space-y-0"
            : "space-y-3"
        )}
      >
        {showAccessBlock && accessBlock ? (
          <InvoiceAccessFooterBlock
            accessBlock={accessBlock}
            invoiceNumber={invoiceNumber}
          />
        ) : null}

        <div
          className={cn(
            "grid gap-x-6 gap-y-3 text-[0.72rem]",
            MUTED_CLASS,
            paperLayout ? "grid-cols-3" : "sm:grid-cols-2 lg:grid-cols-3"
          )}
        >
          <FooterField label="Received by" />
          <FooterField label="Received date" />
          <FooterField label="Signature" />
          <FooterField label="Paid amount" />
          <FooterField label="Paid date" />
          <FooterModeField />
        </div>
      </div>
    </footer>
  );
}

function InvoiceAccessFooterBlock({
  accessBlock,
  invoiceNumber,
}: {
  accessBlock: NonNullable<InvoiceDocumentProps["accessBlock"]>;
  invoiceNumber: string;
}) {
  return (
    <section className="flex w-fit flex-col items-start gap-1.5">
      <Image
        src={accessBlock.qrDataUrl}
        alt={`QR code for invoice ${invoiceNumber}`}
        width={76}
        height={76}
        unoptimized
        className="size-[76px] shrink-0 rounded-[0.7rem] border border-[color:var(--invoice-paper-border)] bg-white p-1"
      />
      <p
        className={cn(
          "font-mono text-[0.7rem] font-medium",
          VALUE_CLASS
        )}
      >
        {accessBlock.publicAccessCode}
      </p>
    </section>
  );
}

function UtilityBreakdownSection({
  model,
  paperLayout,
}: {
  model: InvoicePresentationModel;
  paperLayout: boolean;
}) {
  return (
    <section className="space-y-3">
      <div className="space-y-0.5">
        <p className={LABEL_CLASS}>Utility breakdown</p>
      </div>

      <div className={cn("border-t pt-2", DIVIDER_CLASS)}>
        <div className={cn(paperLayout ? "block overflow-x-auto" : "hidden overflow-x-auto md:block")}>
          <table className="w-full table-fixed border-collapse">
            <colgroup>
              <col style={{ width: "20%" }} />
              <col style={{ width: "14%" }} />
              <col style={{ width: "14%" }} />
              <col style={{ width: "17%" }} />
              <col style={{ width: "17%" }} />
              <col style={{ width: "18%" }} />
            </colgroup>
            <thead>
              <tr className={cn("border-b text-left", DIVIDER_CLASS)}>
                <th className={cn("py-2 pr-2 font-medium", LABEL_CLASS)}>Utility</th>
                <th className={cn("py-2 pr-2 text-right font-medium", LABEL_CLASS)}>Previous</th>
                <th className={cn("py-2 pr-2 text-right font-medium", LABEL_CLASS)}>Current</th>
                <th className={cn("py-2 pr-2 text-right font-medium", LABEL_CLASS)}>Consumption</th>
                <th className={cn("py-2 pr-2 text-right font-medium", LABEL_CLASS)}>Rate</th>
                <th className={cn("py-2 text-right font-medium", LABEL_CLASS)}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {model.breakdowns.utilityReadings.map((row, index) => (
                <tr
                  key={row.itemId}
                  className={index < model.breakdowns.utilityReadings.length - 1 ? cn("border-b", DIVIDER_CLASS) : ""}
                >
                  <td className={cn("py-2.5 pr-2 text-[0.72rem] font-semibold uppercase tracking-[0.18em]", ACCENT_CLASS)}>
                    {row.utilityTypeLabel}
                  </td>
                  <td className={cn("py-2.5 pr-2 text-right text-sm", MUTED_CLASS)}>{formatBreakdownNumber(row.previousReading)}</td>
                  <td className={cn("py-2.5 pr-2 text-right text-sm", MUTED_CLASS)}>{formatBreakdownNumber(row.currentReading)}</td>
                  <td className={cn("py-2.5 pr-2 text-right text-sm", MUTED_CLASS)}>{row.consumptionLabel}</td>
                  <td className={cn("py-2.5 pr-2 text-right text-sm", MUTED_CLASS)}>{row.rateLabel}</td>
                  <td className={cn("py-2.5 text-right text-sm font-semibold", VALUE_CLASS)}>{formatInvoiceMoney(row.totalAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className={cn("space-y-2.5", paperLayout ? "hidden" : "md:hidden")}>
          {model.breakdowns.utilityReadings.map((row) => (
            <article key={row.itemId} className={cn("border-b pb-2.5 last:border-b-0 last:pb-0", DIVIDER_CLASS)}>
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <p className={cn("text-[0.68rem] font-semibold uppercase tracking-[0.18em]", ACCENT_CLASS)}>
                    {row.utilityTypeLabel}
                  </p>
                </div>
                <p className={cn("text-sm font-semibold text-right", VALUE_CLASS)}>
                  {formatInvoiceMoney(row.totalAmount)}
                </p>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2.5">
                <MetricStack label="Previous" value={formatBreakdownNumber(row.previousReading)} />
                <MetricStack label="Current" value={formatBreakdownNumber(row.currentReading)} align="right" />
                <MetricStack label="Consumption" value={row.consumptionLabel} />
                <MetricStack label="Rate" value={row.rateLabel} align="right" />
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function CosaBreakdownSection({
  model,
  paperLayout,
}: {
  model: InvoicePresentationModel;
  paperLayout: boolean;
}) {
  return (
    <section className="space-y-3">
      <div className="space-y-0.5">
        <p className={LABEL_CLASS}>COSA breakdown</p>
      </div>

      <div className={cn(paperLayout ? "block overflow-x-auto" : "hidden overflow-x-auto md:block")}>
        <table className="w-full table-fixed border-collapse">
          <colgroup>
            <col style={{ width: "28%" }} />
            <col style={{ width: "14%" }} />
            <col style={{ width: "22%" }} />
            <col style={{ width: "18%" }} />
            <col style={{ width: "18%" }} />
          </colgroup>
          <thead>
            <tr className={cn("border-b text-left", DIVIDER_CLASS)}>
              <th className={cn("py-2 pr-3 font-medium", LABEL_CLASS)}>Description</th>
              <th className={cn("py-2 pr-3 font-medium", LABEL_CLASS)}>Billing date</th>
              <th className={cn("py-2 pr-3 font-medium", LABEL_CLASS)}>Source</th>
              <th className={cn("py-2 pr-3 text-right font-medium", LABEL_CLASS)}>Share</th>
              <th className={cn("py-2 text-right font-medium", LABEL_CLASS)}>Allocated</th>
            </tr>
          </thead>
          <tbody>
            {model.breakdowns.cosaAllocations.map((row, index) => (
              <tr
                key={row.itemId}
                className={index < model.breakdowns.cosaAllocations.length - 1 ? cn("border-b", DIVIDER_CLASS) : ""}
              >
                <td className={cn("py-2.5 pr-3 text-sm font-medium", VALUE_CLASS)}>{row.description}</td>
                <td className={cn("py-2.5 pr-3 text-sm", MUTED_CLASS)}>{row.billingDateLabel}</td>
                <td className={cn("py-2.5 pr-3 text-sm", MUTED_CLASS)}>
                  <div className="space-y-0.5">
                    {formatCosaSourceLabel(row) ? (
                      <p className="text-xs">
                        {formatCosaSourceLabel(row)}
                      </p>
                    ) : null}
                  </div>
                </td>
                <td className={cn("py-2.5 pr-3 text-right text-sm", MUTED_CLASS)}>{formatCosaShare(row)}</td>
                <td className={cn("py-2.5 text-right text-sm font-semibold", VALUE_CLASS)}>
                  {formatInvoiceMoney(row.allocatedAmount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={cn("space-y-2.5", paperLayout ? "hidden" : "md:hidden")}>
        {model.breakdowns.cosaAllocations.map((row) => (
          <article key={row.itemId} className={cn("border-b pb-2.5 last:border-b-0 last:pb-0", DIVIDER_CLASS)}>
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <p className={cn("text-sm font-semibold", VALUE_CLASS)}>{row.description}</p>
                <p className={cn("text-xs", MUTED_CLASS)}>{row.billingDateLabel}</p>
              </div>
              <p className={cn("text-sm font-semibold text-right", VALUE_CLASS)}>
                {formatInvoiceMoney(row.allocatedAmount)}
              </p>
            </div>
            <div className="mt-2 grid grid-cols-1 gap-2.5">
              <MetricStack label="Share" value={formatCosaShare(row)} />
              {formatCosaSourceLabel(row) ? (
                <MetricStack label="Source" value={formatCosaSourceLabel(row)} />
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function FooterField({ label }: { label: string }) {
  return (
    <div className="grid gap-1">
      <p className={LABEL_CLASS}>{label}</p>
      <div className={cn("h-6 border-b", DIVIDER_CLASS)} />
    </div>
  );
}

function CheckBox() {
  return <span className={cn("inline-block size-3 border", DIVIDER_CLASS)} aria-hidden="true" />;
}

function FooterModeField() {
  return (
    <div className="grid gap-1">
      <p className={LABEL_CLASS}>Mode</p>
      <div className={cn("flex flex-wrap items-center gap-5 pt-1 text-[0.68rem]", MUTED_CLASS)}>
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

function MetricStack({
  label,
  value,
  align = "left",
}: {
  label: string;
  value: string;
  align?: "left" | "right";
}) {
  return (
    <div className={cn("space-y-1", align === "right" ? "text-right" : "")}>
      <p className={LABEL_CLASS}>{label}</p>
      <p className={cn("text-sm font-medium", VALUE_CLASS)}>{value}</p>
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
      <span className={cn(MUTED_CLASS, strong ? "font-medium" : "")}>
        {label}
      </span>
      <span
        className={cn(
          "shrink-0",
          strong ? cn("font-semibold", VALUE_CLASS) : cn("font-medium", VALUE_CLASS),
          valueClassName
        )}
      >
        {value}
      </span>
    </div>
  );
}

function formatBreakdownNumber(value: number) {
  return new Intl.NumberFormat("en-PH", {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatCosaShare(
  row: InvoicePresentationModel["breakdowns"]["cosaAllocations"][number]
) {
  if (row.unitCount != null) {
    return `${row.unitCount} unit${row.unitCount === 1 ? "" : "s"}`;
  }

  if (row.percentage != null) {
    return `${formatBreakdownNumber(row.percentage)}%`;
  }

  return "Allocated";
}

function formatCosaSourceLabel(
  row: InvoicePresentationModel["breakdowns"]["cosaAllocations"][number]
) {
  const parts = [
    row.sourcePreviousReadingLabel
      ? `Previous ${row.sourcePreviousReadingLabel}`
      : null,
    row.sourceCurrentReadingLabel
      ? `Present ${row.sourceCurrentReadingLabel}`
      : null,
    row.sourceConsumptionLabel
      ? `Consumption ${row.sourceConsumptionLabel}`
      : null,
    row.sourceRateLabel ? `Rate ${row.sourceRateLabel}` : null,
  ].filter(Boolean);
  return parts.join(" · ");
}

function scaleRem(baseRem: number, percent: number) {
  return `${(baseRem * percent) / 100}rem`;
}
