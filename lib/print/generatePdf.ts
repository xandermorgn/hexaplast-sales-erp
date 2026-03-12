"use client"

import React from "react"
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  pdf,
} from "@react-pdf/renderer"

/* ------------------------------------------------------------------ */
/*  NO custom font registration — use built-in Helvetica               */
/*  This prevents encoding issues with currency symbols etc.           */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type PdfItem = {
  category_name?: string | null
  sub_category?: string | null
  product_name?: string | null
  model_number?: string | null
  hsn_sac_code?: string | null
  unit?: string | null
  quantity?: number
  price?: number
  discount_amount?: number
  gst_percent?: number
  total?: number
}

export type PdfMetaField = {
  label: string
  value?: string | number | null
}

export type PdfTotals = {
  subtotal: number
  discount: number
  gst: number
  total: number
  advance_payment?: number
  due_amount?: number
}

export type GeneratePdfInput = {
  title: "QUOTATION" | "PROFORMA INVOICE" | "WORK ORDER" | "PURCHASE ORDER"
  customerName?: string | null
  leftFields?: PdfMetaField[]
  rightFields?: PdfMetaField[]
  addressFields?: PdfMetaField[]
  metaFields?: PdfMetaField[]
  items: PdfItem[]
  totals: PdfTotals
  showCategoryColumns?: boolean
  currency?: string
  customColumns?: { header: string; width: number; align?: "right" | "center" | "left"; key: string }[]
  termsConditions?: string | null
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const ORANGE = "#f97316"
const BORDER = "#e5e7eb"
const HEADER_BG = "#f3f4f6"
const DARK = "#111827"
const GRAY = "#6b7280"

const FOOTER_LINE_1 = "Plot No. L-4126/1, Phase IV, B/h. New Nirma, Nr. Nikatube Cross Road, GIDC Vatva,"
const FOOTER_LINE_2 = "Ahmedabad - 382445, Gujarat, India"
const FOOTER_LINE_3 = "M : 98250 31377 / 97140 38333 / 98250 88726"
const FOOTER_LINE_4 = "E : info@hexaplastindia.com / exports@hexaplastindia.com / hexaplastindia@gmail.com"

const SIGNATURE_LABELS = ["Prepared By", "Checked By", "Approved By"]

const CURRENCY_PREFIX: Record<string, string> = {
  INR: "INR",
  USD: "USD",
  EUR: "EUR",
  GBP: "GBP",
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function toTitleCase(str: string | null | undefined): string {
  if (!str || str === "-") return str || "-"
  return str.replace(/\b\w+/g, (word) =>
    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
  )
}

/**
 * Strip HTML tags from rich text content and split into lines.
 * Treats <li>, <p>, <br> as line breaks. Returns non-empty trimmed lines.
 */
function stripHtmlToLines(html: string): string[] {
  if (!html) return []
  // Replace block-level tags with newlines
  let text = html
    .replace(/<\/?(li|p|br|div|h[1-6])[^>]*\/?>/gi, "\n")
    .replace(/<\/?(ol|ul)[^>]*>/gi, "")
    .replace(/<[^>]+>/g, "")        // strip remaining tags
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
  return text.split("\n").map((l: string) => l.trim()).filter((l: string) => l.length > 0)
}

function makeMoney(currencyCode: string) {
  const prefix = CURRENCY_PREFIX[currencyCode] || "INR"
  const fmt = (v: number | null | undefined): string =>
    Number(v || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return {
    plain: fmt,
    full: (v: number | null | undefined) => `${prefix} ${fmt(v)}`,
  }
}

/* ------------------------------------------------------------------ */
/*  Styles — using Helvetica (built-in, no encoding issues)            */
/* ------------------------------------------------------------------ */

const s = StyleSheet.create({
  page: {
    paddingTop: 50,
    paddingBottom: 90,
    paddingHorizontal: 50,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: DARK,
  },

  /* header — logo left-aligned, title centered below */
  logoWrap: {
    alignItems: "flex-start",
    marginBottom: 8,
  },
  logoImg: {
    height: 55,
    width: 200,
    objectFit: "contain" as const,
    alignSelf: "flex-start" as const,
    marginLeft: -8,
  },
  docTitle: {
    fontSize: 24,
    fontFamily: "Helvetica-Bold",
    color: ORANGE,
    textAlign: "center",
    letterSpacing: 1,
    marginBottom: 6,
  },
  titleDivider: {
    height: 2,
    backgroundColor: ORANGE,
    marginBottom: 14,
  },

  /* 2-column info grid */
  infoGrid: {
    flexDirection: "row",
    marginBottom: 4,
  },
  infoColLeft: {
    width: "55%",
  },
  infoColRight: {
    width: "45%",
    paddingLeft: 40,
  },
  infoRow: {
    flexDirection: "row",
    marginBottom: 6,
  },
  infoLabel: {
    width: 100,
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    color: DARK,
  },
  infoValue: {
    flex: 1,
    fontSize: 9,
    color: "#374151",
  },

  /* address section below grid */
  addressSection: {
    marginBottom: 14,
  },
  addressRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  addressLabel: {
    width: 100,
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    color: DARK,
  },
  addressValue: {
    flex: 1,
    fontSize: 9,
    color: "#374151",
  },

  /* table */
  table: {
    marginBottom: 12,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: HEADER_BG,
    borderWidth: 1,
    borderColor: BORDER,
    paddingVertical: 5,
    paddingHorizontal: 4,
  },
  tableHeaderText: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    color: DARK,
  },
  tableRow: {
    flexDirection: "row",
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: BORDER,
    paddingVertical: 5,
    paddingHorizontal: 4,
  },
  tableCell: {
    fontSize: 8,
    color: "#374151",
  },

  /* totals */
  totalsWrap: {
    alignItems: "flex-end",
    marginBottom: 16,
  },
  totalsBox: {
    width: 240,
    borderWidth: 1,
    borderColor: "#d1d5db",
    padding: 10,
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 3,
    fontSize: 10,
  },
  totalsLabel: {
    color: DARK,
    fontFamily: "Helvetica",
  },
  totalsValue: {
    textAlign: "right",
    fontFamily: "Helvetica",
  },
  totalsFinalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#d1d5db",
    paddingTop: 5,
    marginTop: 3,
  },
  totalsFinalLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
    color: DARK,
  },
  totalsFinalValue: {
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
    color: DARK,
    textAlign: "right",
  },

  /* signatures */
  sigSection: {
    flexDirection: "row",
    marginTop: 24,
    marginBottom: 8,
    gap: 16,
  },
  sigCol: {
    flex: 1,
    alignItems: "center",
  },
  sigLine: {
    width: "90%",
    borderBottomWidth: 1,
    borderBottomColor: "#d1d5db",
    marginBottom: 4,
    height: 40,
  },
  sigLabel: {
    fontSize: 8.5,
    fontFamily: "Helvetica",
    color: GRAY,
  },

  /* footer (fixed bottom) */
  footerWrap: {
    position: "absolute",
    bottom: 20,
    left: 50,
    right: 50,
  },
  footerDivider: {
    height: 1,
    backgroundColor: ORANGE,
    marginBottom: 6,
  },
  footerText: {
    fontSize: 7.5,
    color: GRAY,
    textAlign: "center",
    lineHeight: 1.5,
    fontFamily: "Helvetica",
  },
  pageNumber: {
    position: "absolute",
    bottom: 20,
    right: 50,
    fontSize: 8,
    color: GRAY,
    fontFamily: "Helvetica",
  },
})

/* ------------------------------------------------------------------ */
/*  Column definitions (per spec widths)                               */
/* ------------------------------------------------------------------ */

type Col = { header: string; width: number; align?: "right" | "center" | "left"; key: string }

function getColumns(): Col[] {
  return [
    { header: "#", width: 22, align: "center", key: "idx" },
    { header: "Product", width: 120, key: "product_name" },
    { header: "Model", width: 70, key: "model_number" },
    { header: "HSN/SAC", width: 58, key: "hsn_sac_code" },
    { header: "Unit", width: 36, align: "center", key: "unit" },
    { header: "Qty", width: 36, align: "right", key: "quantity" },
    { header: "Price", width: 72, align: "right", key: "price" },
    { header: "Disc.", width: 56, align: "right", key: "discount_amount" },
    { header: "GST %", width: 40, align: "right", key: "gst_percent" },
    { header: "Total", width: 80, align: "right", key: "total" },
  ]
}

function cellValue(item: PdfItem, key: string, idx: number, plain: (v: number | null | undefined) => string): string {
  if (key === "idx") return String(idx + 1)
  if (key === "quantity") return String(item.quantity ?? 0)
  if (key === "price" || key === "unit_price") return plain((item as Record<string, unknown>)[key] as number ?? item.price)
  if (key === "discount_amount") return plain(item.discount_amount)
  if (key === "gst_percent") return String(Number(item.gst_percent ?? 0).toFixed(1))
  if (key === "total" || key === "total_price") return plain((item as Record<string, unknown>)[key] as number ?? item.total)
  return String((item as Record<string, unknown>)[key] ?? "-")
}

/* ------------------------------------------------------------------ */
/*  React-pdf helper: h()                                              */
/* ------------------------------------------------------------------ */

const h = React.createElement

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function InfoField({ label, value }: { label: string; value: string }) {
  return h(View, { style: s.infoRow },
    h(Text, { style: s.infoLabel }, label),
    h(Text, { style: s.infoValue }, value),
  )
}

function AddressField({ label, value }: { label: string; value: string }) {
  return h(View, { style: s.addressRow },
    h(Text, { style: s.addressLabel }, label),
    h(Text, { style: s.addressValue }, value),
  )
}

function TotalsRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  if (bold) {
    return h(View, { style: s.totalsFinalRow },
      h(Text, { style: s.totalsFinalLabel }, label),
      h(Text, { style: s.totalsFinalValue }, value),
    )
  }
  return h(View, { style: s.totalsRow },
    h(Text, { style: s.totalsLabel }, label),
    h(Text, { style: s.totalsValue }, value),
  )
}

/* ------------------------------------------------------------------ */
/*  Document component                                                 */
/* ------------------------------------------------------------------ */

function HexaplastDocument(props: GeneratePdfInput) {
  const {
    title,
    leftFields = [],
    rightFields = [],
    addressFields = [],
    metaFields = [],
    items,
    totals,
    currency = "INR",
  } = props

  const { plain, full } = makeMoney(currency)

  const leftInfo = leftFields.length > 0 ? leftFields : metaFields
  const rightInfo = rightFields

  const cols = props.customColumns || getColumns()

  const logoSrc = typeof window !== "undefined"
    ? `${window.location.origin}/hexaplast-logo.png`
    : "/hexaplast-logo.png"

  return h(Document, null,
    h(Page, { size: "A4", style: s.page, wrap: true },

      /* ── HEADER: logo on own line, title centered below ── */
      h(View, { style: s.logoWrap },
        h(Image, { src: logoSrc, style: s.logoImg }),
      ),
      h(Text, { style: s.docTitle }, title),
      h(View, { style: s.titleDivider }),

      /* ── 2-COLUMN INFO GRID ─────────────────────────── */
      h(View, { style: s.infoGrid },
        h(View, { style: s.infoColLeft },
          ...leftInfo.map((f, i) =>
            h(InfoField, { key: `l${i}`, label: `${f.label}:`, value: String(f.value ?? "-") }),
          ),
        ),
        rightInfo.length > 0
          ? h(View, { style: s.infoColRight },
              ...rightInfo.map((f, i) =>
                h(InfoField, { key: `r${i}`, label: `${f.label}:`, value: String(f.value ?? "-") }),
              ),
            )
          : null,
      ),

      /* ── ADDRESS FIELDS (below grid) ───────────────── */
      addressFields.length > 0
        ? h(View, { style: s.addressSection },
            ...addressFields.map((f, i) =>
              h(AddressField, { key: `a${i}`, label: `${f.label}:`, value: String(f.value ?? "-") }),
            ),
          )
        : null,

      /* ── PRODUCT TABLE ──────────────────────────────── */
      h(View, { style: s.table },
        h(View, { style: s.tableHeader },
          ...cols.map((col) =>
            h(Text, {
              key: col.key,
              style: { ...s.tableHeaderText, width: col.width, textAlign: col.align || "left" },
            }, col.header),
          ),
        ),
        ...items.map((item, idx) =>
          h(View, {
            key: String(idx),
            style: s.tableRow,
            wrap: false,
          },
            ...cols.map((col) =>
              h(Text, {
                key: col.key,
                style: { ...s.tableCell, width: col.width, textAlign: col.align || "left" },
              }, cellValue(item, col.key, idx, plain)),
            ),
          ),
        ),
      ),

      /* ── TOTALS BOX ─────────────────────────────────── */
      h(View, { style: s.totalsWrap },
        h(View, { style: s.totalsBox },
          h(TotalsRow, { label: "Subtotal", value: plain(totals.subtotal) }),
          h(TotalsRow, { label: "Discount", value: plain(totals.discount) }),
          h(TotalsRow, { label: "GST", value: plain(totals.gst) }),
          h(TotalsRow, { label: "Total Amount", value: full(totals.total), bold: true }),
          totals.advance_payment !== undefined
            ? h(TotalsRow, { label: "Advance Payment", value: plain(totals.advance_payment) })
            : null,
          totals.due_amount !== undefined
            ? h(TotalsRow, { label: "Due Amount", value: full(totals.due_amount), bold: true })
            : null,
        ),
      ),

      /* ── TERMS & CONDITIONS ─────────────────────────── */
      props.termsConditions
        ? h(View, { style: { marginBottom: 12, marginTop: 4 } },
            h(Text, { style: { fontFamily: "Helvetica-Bold", fontSize: 10, color: DARK, marginBottom: 6 } }, "Terms & Conditions:"),
            ...stripHtmlToLines(props.termsConditions).map((line, i) =>
              h(View, { key: `tc${i}`, style: { flexDirection: "row" as const, marginBottom: 3, paddingLeft: 4 } },
                h(Text, { style: { fontSize: 8.5, color: DARK, width: 16 } }, `${i + 1}.`),
                h(Text, { style: { fontSize: 8.5, color: "#374151", flex: 1, lineHeight: 1.5 } }, line),
              ),
            ),
          )
        : null,

      /* ── SIGNATURE BLOCKS ───────────────────────────── */
      h(View, { style: s.sigSection },
        ...SIGNATURE_LABELS.map((label) =>
          h(View, { key: label, style: s.sigCol },
            h(View, { style: s.sigLine }),
            h(Text, { style: s.sigLabel }, label),
          ),
        ),
      ),

      /* ── FOOTER (every page) ────────────────────────── */
      h(View, { style: s.footerWrap, fixed: true },
        h(View, { style: s.footerDivider }),
        h(Text, { style: s.footerText }, FOOTER_LINE_1),
        h(Text, { style: s.footerText }, FOOTER_LINE_2),
        h(Text, { style: { ...s.footerText, marginTop: 2 } }, FOOTER_LINE_3),
        h(Text, { style: s.footerText }, FOOTER_LINE_4),
      ),

      /* ── PAGE NUMBERS ───────────────────────────────── */
      h(Text, {
        style: s.pageNumber,
        fixed: true,
        render: ({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) =>
          `Page ${pageNumber} of ${totalPages}`,
      }),
    ),
  )
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

export { toTitleCase }

export async function generateDocumentPdf(input: GeneratePdfInput): Promise<Blob> {
  const doc = h(HexaplastDocument, input)
  const blob = await pdf(doc).toBlob()
  return blob
}
