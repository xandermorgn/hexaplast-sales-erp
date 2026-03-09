type PdfItem = {
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

type PdfMetaField = {
  label: string
  value?: string | number | null
}

type PdfTotals = {
  subtotal: number
  discount: number
  gst: number
  total: number
  advance_payment?: number
  due_amount?: number
}

type BuildPdfInput = {
  title: "QUOTATION" | "PROFORMA INVOICE" | "WORK ORDER"
  customerName?: string | null
  metaFields?: PdfMetaField[]
  items: PdfItem[]
  totals: PdfTotals
  showCategoryColumns?: boolean
}

function esc(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)")
}

function money(v: number | null | undefined) {
  return Number(v || 0).toFixed(2)
}

export function buildDocumentPdfBlob(input: BuildPdfInput): Blob {
  const {
    title,
    customerName,
    metaFields = [],
    items,
    totals,
    showCategoryColumns = true,
  } = input

  const columns = showCategoryColumns
    ? ["#", "Category", "Sub Category", "Product", "Model", "HSN/SAC", "Unit", "Qty", "Price", "Disc", "GST%", "Total"]
    : ["#", "Product", "Model", "HSN/SAC", "Unit", "Qty", "Price", "Disc", "GST%", "Total"]

  const lines: string[] = []
  lines.push("HEXAPLAST")
  lines.push(title)
  lines.push("")
  if (customerName) lines.push(`Customer: ${customerName}`)
  for (const f of metaFields) {
    lines.push(`${f.label}: ${f.value ?? "-"}`)
  }
  lines.push("")
  lines.push(columns.join(" | "))

  for (let i = 0; i < items.length; i += 1) {
    const item = items[i]
    const base = [
      `${i + 1}`,
      item.product_name || "-",
      item.model_number || "-",
      item.hsn_sac_code || "-",
      item.unit || "-",
      String(item.quantity ?? 0),
      money(item.price),
      money(item.discount_amount),
      money(item.gst_percent),
      money(item.total),
    ]

    if (showCategoryColumns) {
      lines.push([
        `${i + 1}`,
        item.category_name || "-",
        item.sub_category || "-",
        ...base.slice(1),
      ].join(" | "))
    } else {
      lines.push(base.join(" | "))
    }
  }

  lines.push("")
  lines.push(`Subtotal: ${money(totals.subtotal)}`)
  lines.push(`Discount: ${money(totals.discount)}`)
  lines.push(`GST: ${money(totals.gst)}`)
  lines.push(`Total Amount: ${money(totals.total)}`)
  if (totals.advance_payment !== undefined) lines.push(`Advance Payment: ${money(totals.advance_payment)}`)
  if (totals.due_amount !== undefined) lines.push(`Due Amount: ${money(totals.due_amount)}`)

  const streamParts: string[] = []
  let y = 800

  streamParts.push("1 0.451 0.086 rg")
  streamParts.push(`BT /F2 16 Tf 40 ${y} Td (${esc("HEXAPLAST")}) Tj ET`)
  y -= 24
  streamParts.push(`BT /F2 22 Tf 200 ${y} Td (${esc(title)}) Tj ET`)
  y -= 18
  streamParts.push("1 0.451 0.086 RG")
  streamParts.push(`40 ${y} m 555 ${y} l S`)
  y -= 18

  streamParts.push("0 0 0 rg")
  for (const line of lines.slice(2)) {
    if (y < 40) break
    streamParts.push(`BT /F1 9 Tf 40 ${y} Td (${esc(line)}) Tj ET`)
    y -= 12
  }

  const stream = streamParts.join("\n")

  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >> endobj",
    "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
    "5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> endobj",
    `6 0 obj << /Length ${stream.length} >> stream\n${stream}\nendstream endobj`,
  ]

  let pdf = "%PDF-1.4\n"
  const offsets: number[] = []

  for (const obj of objects) {
    offsets.push(pdf.length)
    pdf += `${obj}\n`
  }

  const xrefStart = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n`
  pdf += "0000000000 65535 f \n"

  for (const offset of offsets) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`
  }

  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`
  return new Blob([pdf], { type: "application/pdf" })
}
