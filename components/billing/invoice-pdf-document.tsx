import { existsSync } from "node:fs";
import React from "react";
import {
  Document,
  Font,
  Image,
  Page,
  Path,
  Rect,
  StyleSheet,
  Svg,
  Text,
  View,
} from "@react-pdf/renderer";
import type { InvoicePresentationModel } from "@/lib/billing/invoice-presenter";
import {
  DEFAULT_INVOICE_PAPER_SIZE,
  type InvoicePaperSize,
} from "@/lib/billing/invoice-pdf-options";

const PDF_REGULAR_FONT_PATH = "/System/Library/Fonts/SFNS.ttf";
const PDF_MONO_FONT_PATH = "/System/Library/Fonts/SFNSMono.ttf";
const PDF_FONT_FAMILY = "InvoicePdfSans";
const PDF_MONO_FONT_FAMILY = "InvoicePdfMono";
const PDF_HAS_CUSTOM_FONT = existsSync(PDF_REGULAR_FONT_PATH);
const PDF_HAS_MONO_FONT = existsSync(PDF_MONO_FONT_PATH);

if (PDF_HAS_CUSTOM_FONT) {
  Font.register({
    family: PDF_FONT_FAMILY,
    fonts: [
      { src: PDF_REGULAR_FONT_PATH, fontWeight: 400 },
      { src: PDF_REGULAR_FONT_PATH, fontWeight: 500 },
      { src: PDF_REGULAR_FONT_PATH, fontWeight: 600 },
      { src: PDF_REGULAR_FONT_PATH, fontWeight: 700 },
    ],
  });
}

if (PDF_HAS_MONO_FONT) {
  Font.register({
    family: PDF_MONO_FONT_FAMILY,
    src: PDF_MONO_FONT_PATH,
  });
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingRight: 36,
    paddingBottom: 36,
    paddingLeft: 36,
    backgroundColor: "#ffffff",
    color: "#0f172a",
    fontSize: 10.5,
    fontFamily: PDF_HAS_CUSTOM_FONT ? PDF_FONT_FAMILY : "Helvetica",
  },
  shell: {
    borderWidth: 1,
    borderColor: "#dbe5ef",
    borderRadius: 22,
    backgroundColor: "#ffffff",
    padding: 26,
    minHeight: 720,
  },
  header: {
    gap: 22,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 28,
  },
  brandBlock: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    gap: 10,
    minWidth: 0,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  brandLogo: {
    objectFit: "contain",
  },
  brandMark: {
    width: 40,
    height: 40,
  },
  brandTextWrap: {
    gap: 2,
    minWidth: 0,
  },
  brandTitle: {
    fontSize: 17.2,
    lineHeight: 1,
  },
  brandSubtitle: {
    fontSize: 8.4,
    letterSpacing: 2.2,
    textTransform: "uppercase",
  },
  titleStack: {
    gap: 4,
  },
  title: {
    fontSize: 11.2,
    lineHeight: 1.15,
  },
  billToLabel: {
    fontSize: 7.4,
    textTransform: "uppercase",
    letterSpacing: 1.8,
  },
  billToValue: {
    fontSize: 32,
    lineHeight: 0.98,
  },
  sideMetaWrap: {
    width: 220,
    gap: 10,
    flexShrink: 0,
  },
  sideMetaItem: {
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#dbe5ef",
    alignItems: "flex-end",
  },
  sideMetaLabel: {
    fontSize: 7.4,
    textTransform: "uppercase",
    letterSpacing: 1.8,
    width: "100%",
    textAlign: "right",
  },
  sideMetaValue: {
    marginTop: 5,
    fontSize: 9.6,
    fontWeight: 600,
    width: "100%",
    textAlign: "right",
  },
  section: {
    marginTop: 22,
  },
  dividerTop: {
    borderTopWidth: 1,
    borderTopColor: "#dbe5ef",
    paddingTop: 12,
  },
  table: {
    borderBottomWidth: 1,
    borderBottomColor: "#dbe5ef",
  },
  tableHeader: {
    flexDirection: "row",
    paddingTop: 2,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#dbe5ef",
  },
  tableRow: {
    flexDirection: "row",
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#dbe5ef",
  },
  lastTableRow: {
    borderBottomWidth: 0,
  },
  typeCol: {
    width: "16%",
    paddingRight: 10,
  },
  descriptionCol: {
    width: "42%",
    paddingRight: 10,
  },
  qtyCol: {
    width: "10%",
    paddingRight: 8,
    textAlign: "right",
  },
  unitCol: {
    width: "14%",
    paddingRight: 8,
    textAlign: "right",
  },
  amountCol: {
    width: "18%",
    textAlign: "right",
  },
  tableHeadText: {
    fontSize: 8.7,
    textTransform: "uppercase",
    letterSpacing: 1.7,
  },
  typeText: {
    fontSize: 8.8,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
  rowText: {
    fontSize: 10.1,
    lineHeight: 1.45,
  },
  rowTextStrong: {
    fontSize: 10.1,
    fontWeight: 600,
  },
  footerGrid: {
    flexDirection: "row",
    gap: 28,
    alignItems: "flex-start",
  },
  notesBlock: {
    flexGrow: 1,
    gap: 16,
    minWidth: 0,
  },
  accessBlock: {
    gap: 8,
  },
  accessRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 14,
  },
  qrBox: {
    width: 98,
    height: 98,
    borderWidth: 1,
    borderColor: "#dbe5ef",
    borderRadius: 12,
    padding: 6,
    backgroundColor: "#ffffff",
  },
  qrImage: {
    width: 86,
    height: 86,
  },
  passwordWrap: {
    gap: 4,
    paddingBottom: 2,
  },
  passwordLabel: {
    fontSize: 8.2,
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
  passwordValue: {
    fontSize: 12,
    fontWeight: 600,
    fontFamily: PDF_HAS_MONO_FONT ? PDF_MONO_FONT_FAMILY : "Courier-Bold",
    letterSpacing: 2.4,
  },
  sectionLabel: {
    fontSize: 8.8,
    textTransform: "uppercase",
    letterSpacing: 1.8,
  },
  noteText: {
    fontSize: 10.1,
    lineHeight: 1.55,
  },
  paymentsBlock: {
    gap: 10,
  },
  paymentDivider: {
    borderTopWidth: 1,
    borderTopColor: "#dbe5ef",
    paddingTop: 10,
    gap: 8,
  },
  paymentSummaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  paymentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    paddingTop: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#dbe5ef",
  },
  paymentMeta: {
    fontSize: 9.3,
    lineHeight: 1.35,
  },
  summaryPanel: {
    width: 228,
    borderRadius: 18,
    paddingTop: 16,
    paddingRight: 16,
    paddingBottom: 16,
    paddingLeft: 16,
    gap: 10,
  },
  summaryTable: {
    gap: 9,
  },
  summaryDivider: {
    borderTopWidth: 1,
    borderTopColor: "#dbe5ef",
    paddingTop: 10,
    gap: 9,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  summaryLabel: {
    fontSize: 10,
  },
  summaryValue: {
    fontSize: 10.1,
    fontWeight: 500,
  },
  summaryStrongLabel: {
    fontSize: 10.6,
    fontWeight: 600,
  },
  summaryStrongValue: {
    fontSize: 10.6,
    fontWeight: 600,
  },
  receiptFooter: {
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: "#dbe5ef",
    paddingTop: 14,
  },
  receiptGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 14,
    columnGap: 16,
  },
  footerField: {
    width: "31%",
    gap: 4,
  },
  footerLine: {
    height: 18,
    borderBottomWidth: 1,
    borderBottomColor: "#dbe5ef",
  },
  footerModeField: {
    width: "31%",
    gap: 4,
  },
  footerModeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingTop: 2,
  },
  footerModeOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  checkBox: {
    width: 10,
    height: 10,
    borderWidth: 1,
    borderColor: "#dbe5ef",
  },
  footerModeText: {
    fontSize: 8.8,
  },
  breakdownPageHeader: {
    gap: 3,
  },
  breakdownTitle: {
    fontSize: 15,
    fontWeight: 600,
    lineHeight: 1.1,
  },
  breakdownSection: {
    marginTop: 18,
    gap: 8,
  },
  breakdownTableHeader: {
    flexDirection: "row",
    paddingTop: 2,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#dbe5ef",
  },
  breakdownRow: {
    flexDirection: "row",
    paddingTop: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#dbe5ef",
  },
  breakdownText: {
    fontSize: 9.5,
    lineHeight: 1.4,
  },
});

export function InvoicePdfDocument({
  model,
  variant,
  paperSize = DEFAULT_INVOICE_PAPER_SIZE,
  accessBlock,
}: {
  model: InvoicePresentationModel;
  variant: "internal" | "public";
  paperSize?: InvoicePaperSize;
  accessBlock?: {
    qrDataUrl: string;
    publicAccessCode: string;
  };
}) {
  const brandSubtitle =
    model.branding.brandSubtitle ||
    (variant === "public" ? "Public invoice" : "Operations invoice");
  const brandNameStyle = {
    color: model.branding.valueColor,
    fontSize: scalePdfValue(17.2, model.branding.brandNameSizePercent),
    fontWeight: clampPdfWeight(model.branding.brandNameWeight),
  } as const;
  const brandSubtitleStyle = {
    color: model.branding.labelColor,
    fontSize: scalePdfValue(8.4, model.branding.brandSubtitleSizePercent),
  } as const;
  const invoiceTitleStyle = {
    color: model.branding.mutedColor,
    fontWeight: clampPdfWeight(Math.min(model.branding.titleWeight, 600)),
    fontSize: scalePdfValue(11.2, model.branding.titleSizePercent),
  } as const;
  const billToStyle = {
    color: model.branding.valueColor,
    fontWeight: clampPdfWeight(model.branding.tenantNameWeight),
    fontSize: scalePdfValue(32, model.branding.tenantNameSizePercent),
  } as const;
  const labelTextStyle = { color: model.branding.labelColor } as const;
  const valueTextStyle = { color: model.branding.valueColor } as const;
  const mutedTextStyle = { color: model.branding.mutedColor } as const;
  const accentTextStyle = { color: model.branding.accentColor } as const;
  const summaryPanelStyle = {
    backgroundColor: model.branding.panelBackground,
  } as const;
  const logoSize = scalePdfValue(40, model.branding.logoScalePercent);

  return (
    <Document
      title={model.title}
      author={model.branding.brandName}
      subject={model.invoiceNumber}
      creator={model.branding.brandName}
      producer={model.branding.brandName}
    >
      <Page size={resolvePdfPageSize(paperSize)} style={styles.page}>
        <InvoicePrimaryPage
          accessBlock={accessBlock}
          accentTextStyle={accentTextStyle}
          billToStyle={billToStyle}
          brandNameStyle={brandNameStyle}
          brandSubtitle={brandSubtitle}
          brandSubtitleStyle={brandSubtitleStyle}
          invoiceTitleStyle={invoiceTitleStyle}
          labelTextStyle={labelTextStyle}
          logoSize={logoSize}
          model={model}
          mutedTextStyle={mutedTextStyle}
          summaryPanelStyle={summaryPanelStyle}
          valueTextStyle={valueTextStyle}
        />
      </Page>

      {model.breakdowns.hasSecondPage ? (
        <Page size={resolvePdfPageSize(paperSize)} style={styles.page}>
          <InvoiceBreakdownPage
            accentTextStyle={accentTextStyle}
            labelTextStyle={labelTextStyle}
            model={model}
            mutedTextStyle={mutedTextStyle}
            valueTextStyle={valueTextStyle}
          />
        </Page>
      ) : null}
    </Document>
  );
}

function InvoicePrimaryPage({
  accessBlock,
  accentTextStyle,
  billToStyle,
  brandNameStyle,
  brandSubtitle,
  brandSubtitleStyle,
  invoiceTitleStyle,
  labelTextStyle,
  logoSize,
  model,
  mutedTextStyle,
  summaryPanelStyle,
  valueTextStyle,
}: {
  accessBlock?: {
    qrDataUrl: string;
    publicAccessCode: string;
  };
  accentTextStyle: { color: string };
  billToStyle: { color: string; fontWeight: number; fontSize: number };
  brandNameStyle: { color: string; fontSize: number; fontWeight: number };
  brandSubtitle: string;
  brandSubtitleStyle: { color: string; fontSize: number };
  invoiceTitleStyle: { color: string; fontWeight: number; fontSize: number };
  labelTextStyle: { color: string };
  logoSize: number;
  model: InvoicePresentationModel;
  mutedTextStyle: { color: string };
  summaryPanelStyle: { backgroundColor: string };
  valueTextStyle: { color: string };
}) {
  return (
    <View style={styles.shell}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.brandBlock}>
            <View style={styles.brandRow}>
              <BrandMarkOrLogo
                accentColor={model.branding.accentColor}
                logoSize={logoSize}
                logoUrl={model.branding.logoUrl}
              />
              <View style={styles.brandTextWrap}>
                {model.branding.showBrandName ? (
                  <Text style={[styles.brandTitle, brandNameStyle]}>
                    {model.branding.brandName}
                  </Text>
                ) : null}
                {model.branding.showBrandSubtitle ? (
                  <Text style={[styles.brandSubtitle, brandSubtitleStyle]}>
                    {brandSubtitle}
                  </Text>
                ) : null}
              </View>
            </View>

            <View style={styles.titleStack}>
              <Text style={[styles.title, invoiceTitleStyle]}>{model.title}</Text>
              <Text style={[styles.billToLabel, labelTextStyle]}>Bill to</Text>
              <Text style={[styles.billToValue, billToStyle]}>{model.tenantName}</Text>
            </View>
          </View>

          <View style={styles.sideMetaWrap}>
            <SideMetaItem
              label="Issued"
              labelTextStyle={labelTextStyle}
              value={model.issueDateLabel}
              valueTextStyle={valueTextStyle}
            />
            <SideMetaItem
              label="Billing period"
              labelTextStyle={labelTextStyle}
              value={model.billingPeriodLabel}
              valueTextStyle={valueTextStyle}
            />
            <SideMetaItem
              label="Inv no."
              labelTextStyle={labelTextStyle}
              value={model.invoiceNumber}
              valueTextStyle={valueTextStyle}
            />
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.dividerTop}>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.typeCol, styles.tableHeadText, labelTextStyle]}>
                Type
              </Text>
              <Text
                style={[styles.descriptionCol, styles.tableHeadText, labelTextStyle]}
              >
                Description
              </Text>
              <Text style={[styles.qtyCol, styles.tableHeadText, labelTextStyle]}>
                Usage / Qty
              </Text>
              <Text style={[styles.unitCol, styles.tableHeadText, labelTextStyle]}>
                Unit
              </Text>
              <Text style={[styles.amountCol, styles.tableHeadText, labelTextStyle]}>
                Amount
              </Text>
            </View>

            {model.items.map((item, index) => (
              <View
                key={item.id}
                style={
                  index === model.items.length - 1
                    ? [styles.tableRow, styles.lastTableRow]
                    : styles.tableRow
                }
                wrap={false}
              >
                <Text style={[styles.typeCol, styles.typeText, accentTextStyle]}>
                  {item.typeLabel}
                </Text>
                <Text style={[styles.descriptionCol, styles.rowText, valueTextStyle]}>
                  {item.description}
                </Text>
                <Text style={[styles.qtyCol, styles.rowText, mutedTextStyle]}>
                  {item.quantityDisplay ?? item.quantity.toFixed(2)}
                </Text>
                <Text style={[styles.unitCol, styles.rowText, mutedTextStyle]}>
                  {formatInvoiceMoney(item.unitPrice)}
                </Text>
                <Text style={[styles.amountCol, styles.rowTextStrong, valueTextStyle]}>
                  {formatInvoiceMoney(item.amount)}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      <View style={[styles.section, styles.dividerTop, styles.footerGrid]}>
        <View style={styles.notesBlock}>
          {accessBlock ? (
            <View style={styles.accessBlock}>
              <Text style={[styles.sectionLabel, labelTextStyle]}>Invoice access</Text>
              <View style={styles.accessRow}>
                <View style={styles.qrBox}>
                  <Image src={accessBlock.qrDataUrl} style={styles.qrImage} />
                </View>
                <View style={styles.passwordWrap}>
                  <Text style={[styles.passwordLabel, labelTextStyle]}>
                    Invoice password
                  </Text>
                  <Text style={[styles.passwordValue, mutedTextStyle]}>
                    {accessBlock.publicAccessCode}
                  </Text>
                </View>
              </View>
            </View>
          ) : null}

          {model.notes ? (
            <View style={styles.accessBlock}>
              <Text style={[styles.sectionLabel, labelTextStyle]}>Notes</Text>
              <Text style={[styles.noteText, mutedTextStyle]}>{model.notes}</Text>
            </View>
          ) : null}

          {model.payments.length > 0 ? (
            <View style={styles.paymentsBlock}>
              <Text style={[styles.sectionLabel, labelTextStyle]}>Payment history</Text>
              <View style={styles.paymentDivider}>
                <View style={styles.paymentSummaryRow}>
                  <Text style={[styles.paymentMeta, mutedTextStyle]}>Collected</Text>
                  <Text style={[styles.rowTextStrong, valueTextStyle]}>
                    {formatInvoiceMoney(model.totals.collectedAmount)}
                  </Text>
                </View>
                <View style={styles.paymentSummaryRow}>
                  <Text style={[styles.paymentMeta, mutedTextStyle]}>Balance</Text>
                  <Text
                    style={[
                      styles.rowTextStrong,
                      model.totals.balanceDue > 0 ? accentTextStyle : valueTextStyle,
                    ]}
                  >
                    {formatInvoiceMoney(model.totals.balanceDue)}
                  </Text>
                </View>
              </View>

              {model.payments.map((payment) => (
                <View key={payment.id} style={styles.paymentRow}>
                  <View>
                    <Text style={[styles.rowTextStrong, valueTextStyle]}>
                      {payment.paymentDateLabel}
                    </Text>
                    <Text style={[styles.paymentMeta, mutedTextStyle]}>
                      {payment.statusLabel}
                    </Text>
                  </View>
                  <View>
                    <Text style={[styles.rowTextStrong, valueTextStyle]}>
                      {formatInvoiceMoney(payment.amountPaid)}
                    </Text>
                    <Text style={[styles.paymentMeta, mutedTextStyle]}>
                      {payment.referenceNumber ?? "No reference"}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        <View style={[styles.summaryPanel, summaryPanelStyle]}>
          <Text style={[styles.sectionLabel, labelTextStyle]}>Invoice summary</Text>
          <View style={styles.summaryTable}>
            <SummaryRow
              label="Grand total"
              labelTextStyle={valueTextStyle}
              strong
              value={formatInvoiceMoney(model.totals.totalAmount)}
              valueTextStyle={valueTextStyle}
            />
          </View>
          {model.totals.balanceDue !== model.totals.totalAmount ? (
            <View style={styles.summaryDivider}>
              <SummaryRow
                label="Balance due"
                labelTextStyle={valueTextStyle}
                strong
                value={formatInvoiceMoney(model.totals.balanceDue)}
                valueTextStyle={
                  model.totals.balanceDue > 0 ? accentTextStyle : valueTextStyle
                }
              />
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.receiptFooter}>
        <View style={styles.receiptGrid}>
          <FooterField label="Received by" labelTextStyle={labelTextStyle} />
          <FooterField label="Received Date" labelTextStyle={labelTextStyle} />
          <FooterField label="Signature" labelTextStyle={labelTextStyle} />
          <FooterField label="Paid Amount" labelTextStyle={labelTextStyle} />
          <FooterField label="Paid Date" labelTextStyle={labelTextStyle} />
          <FooterModeField
            labelTextStyle={labelTextStyle}
            mutedTextStyle={mutedTextStyle}
          />
        </View>
      </View>
    </View>
  );
}

function InvoiceBreakdownPage({
  accentTextStyle,
  labelTextStyle,
  model,
  mutedTextStyle,
  valueTextStyle,
}: {
  accentTextStyle: { color: string };
  labelTextStyle: { color: string };
  model: InvoicePresentationModel;
  mutedTextStyle: { color: string };
  valueTextStyle: { color: string };
}) {
  return (
    <View style={styles.shell}>
      <View style={styles.breakdownPageHeader}>
        <Text style={[styles.sectionLabel, labelTextStyle]}>Page 2</Text>
        <Text style={[styles.breakdownTitle, valueTextStyle]}>Breakdown details</Text>
      </View>

      {model.breakdowns.utilityReadings.length > 0 ? (
        <View style={styles.breakdownSection}>
          <Text style={[styles.sectionLabel, labelTextStyle]}>Utility breakdown</Text>
          <View style={styles.dividerTop}>
            <View style={styles.breakdownTableHeader}>
              <Text style={[{ width: "20%" }, styles.tableHeadText, labelTextStyle]}>
                Utility
              </Text>
              <Text
                style={[
                  { width: "14%", paddingRight: 6, textAlign: "right" },
                  styles.tableHeadText,
                  labelTextStyle,
                ]}
              >
                Previous
              </Text>
              <Text
                style={[
                  { width: "14%", paddingRight: 6, textAlign: "right" },
                  styles.tableHeadText,
                  labelTextStyle,
                ]}
              >
                Current
              </Text>
              <Text
                style={[
                  { width: "17%", paddingRight: 6, textAlign: "right" },
                  styles.tableHeadText,
                  labelTextStyle,
                ]}
              >
                Consumption
              </Text>
              <Text
                style={[
                  { width: "17%", paddingRight: 6, textAlign: "right" },
                  styles.tableHeadText,
                  labelTextStyle,
                ]}
              >
                Rate
              </Text>
              <Text
                style={[
                  { width: "18%", textAlign: "right" },
                  styles.tableHeadText,
                  labelTextStyle,
                ]}
              >
                Amount
              </Text>
            </View>

            {model.breakdowns.utilityReadings.map((row, index) => (
              <View
                key={row.itemId}
                style={
                  index === model.breakdowns.utilityReadings.length - 1
                    ? [styles.breakdownRow, styles.lastTableRow]
                    : styles.breakdownRow
                }
                wrap={false}
              >
                <Text style={[{ width: "20%" }, styles.typeText, accentTextStyle]}>
                  {row.utilityTypeLabel}
                </Text>
                <Text
                  style={[
                    { width: "14%", paddingRight: 6, textAlign: "right" },
                    styles.breakdownText,
                    mutedTextStyle,
                  ]}
                >
                  {formatBreakdownNumber(row.previousReading)}
                </Text>
                <Text
                  style={[
                    { width: "14%", paddingRight: 6, textAlign: "right" },
                    styles.breakdownText,
                    mutedTextStyle,
                  ]}
                >
                  {formatBreakdownNumber(row.currentReading)}
                </Text>
                <Text
                  style={[
                    { width: "17%", paddingRight: 6, textAlign: "right" },
                    styles.breakdownText,
                    mutedTextStyle,
                  ]}
                >
                  {row.consumptionLabel}
                </Text>
                <Text
                  style={[
                    { width: "17%", paddingRight: 6, textAlign: "right" },
                    styles.breakdownText,
                    mutedTextStyle,
                  ]}
                >
                  {row.rateLabel}
                </Text>
                <Text
                  style={[
                    { width: "18%", textAlign: "right" },
                    styles.breakdownText,
                    styles.rowTextStrong,
                    valueTextStyle,
                  ]}
                >
                  {formatInvoiceMoney(row.totalAmount)}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {model.breakdowns.cosaAllocations.length > 0 ? (
        <View style={styles.breakdownSection}>
          <Text style={[styles.sectionLabel, labelTextStyle]}>COSA breakdown</Text>
          <View style={styles.dividerTop}>
            <View style={styles.breakdownTableHeader}>
              <Text style={[{ width: "28%", paddingRight: 8 }, styles.tableHeadText, labelTextStyle]}>
                Description
              </Text>
              <Text style={[{ width: "14%", paddingRight: 8 }, styles.tableHeadText, labelTextStyle]}>
                Billing date
              </Text>
              <Text style={[{ width: "22%", paddingRight: 8 }, styles.tableHeadText, labelTextStyle]}>
                Source
              </Text>
              <Text
                style={[
                  { width: "18%", paddingRight: 8, textAlign: "right" },
                  styles.tableHeadText,
                  labelTextStyle,
                ]}
              >
                Share
              </Text>
              <Text
                style={[
                  { width: "18%", textAlign: "right" },
                  styles.tableHeadText,
                  labelTextStyle,
                ]}
              >
                Allocated
              </Text>
            </View>

            {model.breakdowns.cosaAllocations.map((row, index) => (
              <View
                key={row.itemId}
                style={
                  index === model.breakdowns.cosaAllocations.length - 1
                    ? [styles.breakdownRow, styles.lastTableRow]
                    : styles.breakdownRow
                }
                wrap={false}
              >
                <Text
                  style={[
                    { width: "28%", paddingRight: 8 },
                    styles.breakdownText,
                    styles.rowTextStrong,
                    valueTextStyle,
                  ]}
                >
                  {row.description}
                </Text>
                <Text
                  style={[
                    { width: "14%", paddingRight: 8 },
                    styles.breakdownText,
                    mutedTextStyle,
                  ]}
                >
                  {row.billingDateLabel}
                </Text>
                <View style={{ width: "22%", paddingRight: 8 }}>
                  {formatCosaSourceLabel(row) ? (
                    <Text style={[styles.paymentMeta, mutedTextStyle]}>
                      {formatCosaSourceLabel(row)}
                    </Text>
                  ) : null}
                </View>
                <Text
                  style={[
                    { width: "18%", paddingRight: 8, textAlign: "right" },
                    styles.breakdownText,
                    mutedTextStyle,
                  ]}
                >
                  {formatCosaShare(row)}
                </Text>
                <Text
                  style={[
                    { width: "18%", textAlign: "right" },
                    styles.breakdownText,
                    styles.rowTextStrong,
                    valueTextStyle,
                  ]}
                >
                  {formatInvoiceMoney(row.allocatedAmount)}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

function BrandMarkOrLogo({
  accentColor,
  logoSize,
  logoUrl,
}: {
  accentColor: string;
  logoSize: number;
  logoUrl: string | null;
}) {
  if (logoUrl) {
    return (
      <Image
        src={logoUrl}
        style={[styles.brandLogo, { width: logoSize, height: logoSize }]}
      />
    );
  }

  return <PdfPropertiaMark accentColor={accentColor} />;
}

function resolvePdfPageSize(paperSize: InvoicePaperSize) {
  switch (paperSize) {
    case "a4":
      return "A4";
    case "legal":
      return "LEGAL";
    default:
      return "LETTER";
  }
}

function SideMetaItem({
  label,
  labelTextStyle,
  value,
  valueTextStyle,
}: {
  label: string;
  labelTextStyle: { color: string };
  value: string;
  valueTextStyle: { color: string };
}) {
  return (
    <View style={styles.sideMetaItem}>
      <Text style={[styles.sideMetaLabel, labelTextStyle]}>{label}</Text>
      <Text style={[styles.sideMetaValue, valueTextStyle]}>{value}</Text>
    </View>
  );
}

function FooterField({
  label,
  labelTextStyle,
}: {
  label: string;
  labelTextStyle: { color: string };
}) {
  return (
    <View style={styles.footerField}>
      <Text style={[styles.billToLabel, labelTextStyle]}>{label}</Text>
      <View style={styles.footerLine} />
    </View>
  );
}

function FooterModeField({
  labelTextStyle,
  mutedTextStyle,
}: {
  labelTextStyle: { color: string };
  mutedTextStyle: { color: string };
}) {
  return (
    <View style={styles.footerModeField}>
      <Text style={[styles.billToLabel, labelTextStyle]}>Mode</Text>
      <View style={styles.footerModeRow}>
        <View style={styles.footerModeOption}>
          <View style={styles.checkBox} />
          <Text style={[styles.footerModeText, mutedTextStyle]}>Cash</Text>
        </View>
        <View style={styles.footerModeOption}>
          <View style={styles.checkBox} />
          <Text style={[styles.footerModeText, mutedTextStyle]}>Cheque</Text>
        </View>
      </View>
    </View>
  );
}

function PdfPropertiaMark({ accentColor }: { accentColor: string }) {
  return (
    <Svg viewBox="0 0 48 48" style={styles.brandMark}>
      <Rect x="0" y="0" width="48" height="48" rx="14" fill={accentColor} />
      <Path
        d="M0 0h48v18c-5.6-4.2-13.6-6.4-24-6.4S5.6 13.8 0 18V0Z"
        fill="#ffffff"
        opacity="0.18"
      />
      <Path
        d="M19 25h10M19 17h10M29 42v-6a5 5 0 0 0-10 0v6M10 21H7a5 5 0 0 0-5 5v16a5 5 0 0 0 5 5h34a5 5 0 0 0 5-5V18a5 5 0 0 0-5-5h-5M10 42V11a5 5 0 0 1 5-5h18a5 5 0 0 1 5 5v31"
        stroke="#ffffff"
        strokeWidth="3.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

function formatInvoiceMoney(value: number) {
  const absolute = Math.abs(value);
  const formatted = new Intl.NumberFormat("en-PH", {
    minimumFractionDigits: Number.isInteger(absolute) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(absolute);

  const currencyPrefix = PDF_HAS_CUSTOM_FONT ? "₱" : "PHP ";
  return `${value < 0 ? "-" : ""}${currencyPrefix}${formatted}`;
}

function SummaryRow({
  label,
  labelTextStyle,
  strong = false,
  value,
  valueTextStyle,
}: {
  label: string;
  labelTextStyle: { color: string };
  strong?: boolean;
  value: string;
  valueTextStyle: { color: string };
}) {
  return (
    <View style={styles.summaryRow}>
      <Text style={strong ? [styles.summaryStrongLabel, labelTextStyle] : [styles.summaryLabel, labelTextStyle]}>
        {label}
      </Text>
      <Text style={strong ? [styles.summaryStrongValue, valueTextStyle] : [styles.summaryValue, valueTextStyle]}>
        {value}
      </Text>
    </View>
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
    return `${row.percentage}%`;
  }

  return "Allocated share";
}

function formatCosaSourceLabel(
  row: InvoicePresentationModel["breakdowns"]["cosaAllocations"][number]
) {
  return [
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
  ]
    .filter(Boolean)
    .join(" · ");
}

function scalePdfValue(base: number, percent: number) {
  return Number(((base * percent) / 100).toFixed(2));
}

function clampPdfWeight(value: number) {
  return Math.max(400, Math.min(900, value));
}
