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
    borderColor: "#dbe3ef",
    borderRadius: 24,
    backgroundColor: "#ffffff",
    padding: 24,
    minHeight: 720,
  },
  section: {
    marginTop: 24,
  },
  header: {
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    gap: 26,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 26,
  },
  brandBlock: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    paddingRight: 12,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  brandMark: {
    width: 34,
    height: 34,
  },
  brandTitle: {
    fontSize: 17.2,
    fontWeight: 600,
  },
  brandSubtitle: {
    marginTop: 1,
    color: "#64748b",
    fontSize: 8.6,
    letterSpacing: 2.2,
    textTransform: "uppercase",
  },
  title: {
    marginTop: 8,
    fontSize: 25,
    fontWeight: 600,
    lineHeight: 0.98,
  },
  sideMetaWrap: {
    width: 224,
    gap: 10,
  },
  sideMetaItem: {
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    alignItems: "flex-end",
  },
  sideMetaLabel: {
    color: "#64748b",
    fontSize: 7.4,
    textTransform: "uppercase",
    letterSpacing: 1.8,
    width: "100%",
    textAlign: "right",
  },
  sideMetaValue: {
    marginTop: 5,
    fontSize: 9.3,
    fontWeight: 600,
    color: "#0f172a",
    width: "100%",
    textAlign: "right",
  },
  billToBlock: {
    marginTop: 20,
    gap: 4,
  },
  billToLabel: {
    color: "#64748b",
    fontSize: 7.4,
    textTransform: "uppercase",
    letterSpacing: 1.8,
  },
  billToValue: {
    fontSize: 23,
    fontWeight: 500,
    lineHeight: 1,
  },
  table: {
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  tableHeader: {
    flexDirection: "row",
    paddingTop: 12.5,
    paddingBottom: 12.5,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  tableRow: {
    flexDirection: "row",
    paddingTop: 14.5,
    paddingBottom: 14.5,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  lastTableRow: {
    borderBottomWidth: 0,
  },
  typeCol: {
    width: "15%",
    paddingRight: 10,
  },
  descriptionCol: {
    width: "39%",
    paddingRight: 10,
  },
  qtyCol: {
    width: "10%",
    paddingRight: 8,
    textAlign: "right",
  },
  unitCol: {
    width: "17%",
    paddingRight: 8,
    textAlign: "right",
  },
  amountCol: {
    width: "19%",
    textAlign: "right",
  },
  tableHeadText: {
    color: "#64748b",
    fontSize: 8.7,
    textTransform: "uppercase",
    letterSpacing: 1.7,
  },
  typeText: {
    color: "#0284c7",
    fontSize: 9.4,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
  rowText: {
    fontSize: 10.2,
    lineHeight: 1.45,
  },
  rowTextStrong: {
    fontSize: 10.2,
    fontWeight: 600,
  },
  footerGrid: {
    flexDirection: "row",
    gap: 28,
    alignItems: "flex-start",
  },
  accessBlock: {
    gap: 10,
  },
  accessRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 14,
  },
  qrBox: {
    width: 92,
    height: 92,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 6,
    backgroundColor: "#ffffff",
  },
  qrImage: {
    width: 80,
    height: 80,
  },
  passwordWrap: {
    gap: 6,
    paddingBottom: 2,
  },
  passwordLabel: {
    color: "#64748b",
    fontSize: 8.2,
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
  passwordValue: {
    color: "#0f172a",
    fontSize: 14,
    fontWeight: 600,
    fontFamily: PDF_HAS_MONO_FONT ? PDF_MONO_FONT_FAMILY : "Courier-Bold",
    letterSpacing: 2.4,
  },
  notesBlock: {
    flexGrow: 1,
    gap: 10,
  },
  summaryBlock: {
    width: 204,
    gap: 10,
  },
  sectionLabel: {
    color: "#64748b",
    fontSize: 8.8,
    textTransform: "uppercase",
    letterSpacing: 1.8,
  },
  noteText: {
    color: "#475569",
    fontSize: 10.2,
    lineHeight: 1.6,
  },
  summaryTable: {
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingTop: 12,
    gap: 10,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  summaryLabel: {
    color: "#64748b",
    fontSize: 10,
  },
  summaryValue: {
    fontSize: 10.2,
    fontWeight: 600,
  },
  summaryStrongLabel: {
    fontSize: 10.8,
    fontWeight: 700,
    color: "#0f172a",
  },
  summaryStrongValue: {
    fontSize: 10.8,
    fontWeight: 700,
    color: "#0284c7",
  },
  paymentsBlock: {
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    gap: 10,
  },
  paymentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  paymentMeta: {
    color: "#64748b",
    fontSize: 9.5,
  },
});

export function InvoicePdfDocument({
  model,
  variant,
  accessBlock,
}: {
  model: InvoicePresentationModel;
  variant: "internal" | "public";
  accessBlock?: {
    qrDataUrl: string;
    publicAccessCode: string;
  };
}) {
  return (
    <Document
      title={model.title}
      author="Propertia"
      subject={model.invoiceNumber}
      creator="Propertia"
      producer="Propertia"
    >
      <Page size="LETTER" style={styles.page}>
        <View style={styles.shell}>
          <View style={styles.header}>
            <View style={styles.headerTop}>
              <View style={styles.brandBlock}>
                <View style={styles.brandRow}>
                  <PdfPropertiaMark />
                  <View>
                    <Text style={styles.brandTitle}>Propertia</Text>
                    <Text style={styles.brandSubtitle}>
                      {variant === "public" ? "Public invoice" : "Operations invoice"}
                    </Text>
                  </View>
                </View>

                <View style={styles.billToBlock}>
                  <Text style={styles.billToLabel}>Bill to</Text>
                  <Text style={styles.billToValue}>{model.tenantName}</Text>
                </View>

                <Text style={styles.title}>{model.title}</Text>
              </View>

              <View style={styles.sideMetaWrap}>
                <SideMetaItem label="Issued" value={model.issueDateLabel} />
                <SideMetaItem label="Billing per." value={model.billingPeriodLabel} />
                <SideMetaItem label="Inv no." value={model.invoiceNumber} />
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.typeCol, styles.tableHeadText]}>Type</Text>
                <Text style={[styles.descriptionCol, styles.tableHeadText]}>
                  Description
                </Text>
                <Text style={[styles.qtyCol, styles.tableHeadText]}>Qty</Text>
                <Text style={[styles.unitCol, styles.tableHeadText]}>Unit</Text>
                <Text style={[styles.amountCol, styles.tableHeadText]}>Amount</Text>
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
                  <Text style={[styles.typeCol, styles.typeText]}>{item.typeLabel}</Text>
                  <Text style={[styles.descriptionCol, styles.rowText]}>
                    {item.description}
                  </Text>
                  <Text style={[styles.qtyCol, styles.rowText]}>
                    {item.quantity.toFixed(2)}
                  </Text>
                  <Text style={[styles.unitCol, styles.rowText]}>
                    {formatInvoiceMoney(item.unitPrice)}
                  </Text>
                  <Text style={[styles.amountCol, styles.rowTextStrong]}>
                    {formatInvoiceMoney(item.amount)}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          <View style={[styles.section, styles.footerGrid]}>
            <View style={styles.notesBlock}>
              {accessBlock ? (
                <View style={styles.accessBlock}>
                  <Text style={styles.sectionLabel}>Invoice access</Text>
                  <View style={styles.accessRow}>
                    <View style={styles.qrBox}>
                      <Image src={accessBlock.qrDataUrl} style={styles.qrImage} />
                    </View>
                    <View style={styles.passwordWrap}>
                      <Text style={styles.passwordLabel}>Invoice password</Text>
                      <Text style={styles.passwordValue}>
                        {accessBlock.publicAccessCode}
                      </Text>
                    </View>
                  </View>
                </View>
              ) : null}

              {model.notes ? (
                <>
                  <Text style={styles.sectionLabel}>Notes</Text>
                  <Text style={styles.noteText}>{model.notes}</Text>
                </>
              ) : null}

              {model.payments.length > 0 ? (
                <View style={styles.paymentsBlock}>
                  <Text style={styles.sectionLabel}>Payment history</Text>
                  {model.payments.map((payment) => (
                    <View key={payment.id} style={styles.paymentRow}>
                      <View>
                        <Text style={styles.rowTextStrong}>
                          {payment.paymentDateLabel}
                        </Text>
                        <Text style={styles.paymentMeta}>
                          {payment.referenceNumber ?? "No reference"}
                        </Text>
                      </View>
                      <View>
                        <Text style={styles.rowTextStrong}>
                          {formatInvoiceMoney(payment.amountPaid)}
                        </Text>
                        <Text style={styles.paymentMeta}>{payment.statusLabel}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>

            <View style={styles.summaryBlock}>
              <Text style={styles.sectionLabel}>Invoice summary</Text>
              <View style={styles.summaryTable}>
                <SummaryRow label="Issue date" value={model.issueDateLabel} />
                <SummaryRow
                  label="Rent subtotal"
                  value={formatInvoiceMoney(model.totals.subtotal)}
                />
                <SummaryRow
                  label="Additional charges"
                  value={formatInvoiceMoney(model.totals.additionalCharges)}
                />
                <SummaryRow
                  label="Discount"
                  value={formatInvoiceMoney(model.totals.discount)}
                />
              </View>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
}

function SideMetaItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.sideMetaItem}>
      <Text style={styles.sideMetaLabel}>{label}</Text>
      <Text style={styles.sideMetaValue}>{value}</Text>
    </View>
  );
}

function PdfPropertiaMark() {
  return (
    <Svg viewBox="0 0 48 48" style={styles.brandMark}>
      <Rect x="0" y="0" width="48" height="48" rx="14" fill="#1a8ac0" />
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
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <View style={styles.summaryRow}>
      <Text style={strong ? styles.summaryStrongLabel : styles.summaryLabel}>
        {label}
      </Text>
      <Text style={strong ? styles.summaryStrongValue : styles.summaryValue}>
        {value}
      </Text>
    </View>
  );
}
