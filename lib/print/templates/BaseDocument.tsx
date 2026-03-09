type PrintItem = {
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

type Totals = {
  subtotal: number
  discount: number
  gst: number
  total: number
  advance_payment?: number
  due_amount?: number
}

type MetaField = {
  label: string
  value?: string | number | null
}

type BaseDocumentProps = {
  title: "QUOTATION" | "PROFORMA INVOICE" | "WORK ORDER"
  leftFields?: MetaField[]
  rightFields?: MetaField[]
  addressFields?: MetaField[]
  items: PrintItem[]
  totals: Totals
}

const fmt = (value: number | null | undefined) =>
  Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const money = fmt

const moneyFull = (value: number | null | undefined) => `INR ${fmt(value)}`

const SIGNATURE_LABELS = ["Prepared By", "Checked By", "Approved By"]

const FOOTER_LINE_1 = "Plot No. L-4126/1, Phase IV, B/h. New Nirma, Nr. Nikatube Cross Road, GIDC Vatva,"
const FOOTER_LINE_2 = "Ahmedabad - 382445, Gujarat, India"
const FOOTER_LINE_3 = "M : 98250 31377 / 97140 38333 / 98250 88726"
const FOOTER_LINE_4 = "E : info@hexaplastindia.com / exports@hexaplastindia.com / hexaplastindia@gmail.com"

const PRINT_CSS = `

@page {
  size: A4;
  margin: 20mm;

  @bottom-right {
    content: "Page " counter(page) " of " counter(pages);
    font-family: Arial, Helvetica, sans-serif;
    font-size: 8px;
    color: #6b7280;
  }
}

* { box-sizing: border-box; }

html, body {
  margin: 0;
  padding: 0;
  background: #fff;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

.print-root {
  font-family: Arial, Helvetica, sans-serif;
  font-size: 13px;
  line-height: 1.45;
  color: #111827;
  background: #fff;
}

.print-page {
  width: 100%;
  max-width: 794px;
  margin: 0 auto;
  padding: 0;
}

/* ── Header ─────────────────────────────────────── */
.print-header {
  margin-bottom: 6px;
}

.print-logo {
  height: 55px;
  width: auto;
  display: block;
  margin-bottom: 10px;
  margin-left: 0;
}

.print-title {
  font-family: Arial, Helvetica, sans-serif;
  font-weight: 700;
  font-size: 28px;
  color: #f97316;
  text-align: center;
  margin: 0 0 6px 0;
  letter-spacing: 1px;
}

.print-title-divider {
  border: none;
  border-bottom: 2px solid #f97316;
  margin: 6px 0 14px 0;
}

/* ── 2-column info grid ─────────────────────────── */
.print-info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 40px;
  margin-bottom: 4px;
  font-size: 13px;
}

.print-info-col {}

.print-info-row {
  display: flex;
  margin-bottom: 8px;
}

.print-info-label {
  width: 120px;
  min-width: 120px;
  font-weight: 700;
  font-family: Arial, Helvetica, sans-serif;
  color: #111827;
}

.print-info-value {
  color: #374151;
  word-break: normal;
  overflow-wrap: break-word;
}

/* ── Address section ───────────────────────────── */
.print-address-section {
  margin-bottom: 14px;
  font-size: 13px;
}

.print-address-row {
  display: flex;
  margin-bottom: 4px;
}

.print-address-label {
  width: 120px;
  min-width: 120px;
  font-weight: 700;
  font-family: Arial, Helvetica, sans-serif;
  color: #111827;
}

.print-address-value {
  color: #374151;
  word-break: normal;
  overflow-wrap: break-word;
}

/* ── Table ──────────────────────────────────────── */
.print-table-wrap {
  margin-bottom: 12px;
  page-break-inside: avoid;
}

.print-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.print-table th,
.print-table td {
  padding: 6px;
  border: 1px solid #e5e7eb;
  text-align: left;
  vertical-align: top;
}

.print-table th {
  font-weight: 600;
  background: #f3f4f6;
  color: #111827;
}

.print-table td.text-right,
.print-table th.text-right { text-align: right; }

.print-table td.text-center,
.print-table th.text-center { text-align: center; }

/* ── Totals ─────────────────────────────────────── */
.print-totals-wrap {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 16px;
  page-break-inside: avoid;
}

.print-totals {
  width: 250px;
  border: 1px solid #d1d5db;
  padding: 10px;
}

.print-totals-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 3px;
  font-size: 12px;
}

.print-totals-row.total-row {
  border-top: 1px solid #d1d5db;
  padding-top: 5px;
  margin-top: 4px;
  font-weight: 700;
}

/* ── Signatures ─────────────────────────────────── */
.print-signatures {
  display: flex;
  gap: 16px;
  margin: 24px 0 10px 0;
  page-break-inside: avoid;
}

.print-sig-col {
  flex: 1;
  text-align: center;
}

.print-sig-line {
  height: 40px;
  border-bottom: 1px solid #d1d5db;
  margin: 0 8px;
}

.print-sig-label {
  font-size: 9px;
  margin-top: 4px;
  font-weight: 600;
  color: #6b7280;
}

/* ── Footer ─────────────────────────────────────── */
.print-footer {
  text-align: center;
  font-size: 10px;
  color: #6b7280;
  margin-top: 16px;
  padding-top: 8px;
  border-top: 1px solid #f97316;
  page-break-inside: avoid;
  line-height: 1.6;
}

.print-footer p { margin: 0; }

@media print {
  .print-root { width: 100%; margin: 0; padding: 0; }
  .print-page { max-width: 100%; padding: 0; }
  .print-table-wrap,
  .print-totals-wrap,
  .print-signatures,
  .print-footer { page-break-inside: avoid; }
}
`

export function BaseDocument({
  title,
  leftFields = [],
  rightFields = [],
  addressFields = [],
  items,
  totals,
}: BaseDocumentProps) {
  return (
    <div className="print-root">
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />

      <div className="print-page">
        {/* HEADER — logo on own line, title centered below */}
        <header className="print-header">
          <img src="/hexaplast-logo.svg" alt="Hexaplast" className="print-logo" />
          <h1 className="print-title">{title}</h1>
          <div className="print-title-divider" />
        </header>

        {/* 2-COLUMN INFO GRID */}
        <section className="print-info-grid">
          <div className="print-info-col">
            {leftFields.map((field) => (
              <div key={field.label} className="print-info-row">
                <span className="print-info-label">{field.label}:</span>
                <span className="print-info-value">{field.value ?? "-"}</span>
              </div>
            ))}
          </div>
          <div className="print-info-col">
            {rightFields.map((field) => (
              <div key={field.label} className="print-info-row">
                <span className="print-info-label">{field.label}:</span>
                <span className="print-info-value">{field.value ?? "-"}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ADDRESS FIELDS */}
        {addressFields.length > 0 && (
          <section className="print-address-section">
            {addressFields.map((field) => (
              <div key={field.label} className="print-address-row">
                <span className="print-address-label">{field.label}:</span>
                <span className="print-address-value">{field.value ?? "-"}</span>
              </div>
            ))}
          </section>
        )}

        {/* ITEMS TABLE */}
        <section className="print-table-wrap">
          <table className="print-table">
            <thead>
              <tr>
                <th className="text-center">#</th>
                <th>Product</th>
                <th>Model</th>
                <th>HSN/SAC</th>
                <th className="text-center">Unit</th>
                <th className="text-right">Qty</th>
                <th className="text-right">Price</th>
                <th className="text-right">Discount</th>
                <th className="text-right">GST %</th>
                <th className="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center">No items</td>
                </tr>
              ) : (
                items.map((item, index) => (
                  <tr key={index}>
                    <td className="text-center">{index + 1}</td>
                    <td style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{item.product_name || "-"}</td>
                    <td>{item.model_number || "-"}</td>
                    <td>{item.hsn_sac_code || "-"}</td>
                    <td className="text-center">{item.unit || "-"}</td>
                    <td className="text-right">{item.quantity ?? 0}</td>
                    <td className="text-right">{fmt(item.price)}</td>
                    <td className="text-right">{fmt(item.discount_amount)}</td>
                    <td className="text-right">{Number(item.gst_percent ?? 0).toFixed(1)}</td>
                    <td className="text-right">{fmt(item.total)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>

        {/* TOTALS BOX */}
        <section className="print-totals-wrap">
          <div className="print-totals">
            <div className="print-totals-row">
              <span>Subtotal</span>
              <span>{money(totals.subtotal)}</span>
            </div>
            <div className="print-totals-row">
              <span>Discount</span>
              <span>{money(totals.discount)}</span>
            </div>
            <div className="print-totals-row">
              <span>GST</span>
              <span>{money(totals.gst)}</span>
            </div>
            <div className="print-totals-row total-row">
              <span>Total Amount</span>
              <span>{moneyFull(totals.total)}</span>
            </div>
            {totals.advance_payment !== undefined && (
              <div className="print-totals-row">
                <span>Advance Payment</span>
                <span>{money(totals.advance_payment)}</span>
              </div>
            )}
            {totals.due_amount !== undefined && (
              <div className="print-totals-row total-row">
                <span>Due Amount</span>
                <span>{moneyFull(totals.due_amount)}</span>
              </div>
            )}
          </div>
        </section>

        {/* SIGNATURE BLOCKS */}
        <section className="print-signatures">
          {SIGNATURE_LABELS.map((label) => (
            <div key={label} className="print-sig-col">
              <div className="print-sig-line" />
              <div className="print-sig-label">{label}</div>
            </div>
          ))}
        </section>

        {/* FOOTER */}
        <footer className="print-footer">
          <p>{FOOTER_LINE_1}</p>
          <p>{FOOTER_LINE_2}</p>
          <p style={{ marginTop: 2 }}>{FOOTER_LINE_3}</p>
          <p>{FOOTER_LINE_4}</p>
        </footer>
      </div>
    </div>
  )
}

export type { PrintItem, Totals, MetaField }
