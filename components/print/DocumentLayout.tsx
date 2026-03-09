type CompanyDetails = {
  company_name?: string | null
  company_address?: string | null
  company_phone?: string | null
  company_email?: string | null
}

type CustomerDetails = {
  company_name?: string | null
  contact_person?: string | null
  phone?: string | null
  email?: string | null
  gst_number?: string | null
  address?: string | null
  city?: string | null
  state?: string | null
  country?: string | null
}

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

type DocumentLayoutProps = {
  title: "QUOTATION" | "PROFORMA INVOICE" | "WORK ORDER"
  company: CompanyDetails
  customer: CustomerDetails
  metaFields?: MetaField[]
  items: PrintItem[]
  totals: Totals
}

const money = (value: number | null | undefined) => (Number(value || 0)).toFixed(2)

export function DocumentLayout({ title, company, customer, metaFields = [], items, totals }: DocumentLayoutProps) {
  return (
    <div className="print-root bg-white text-black">
      <style jsx global>{`
        @page {
          size: A4;
          margin: 20mm;
        }

        @media print {
          html,
          body {
            background: #fff;
          }

          .print-root {
            width: 100%;
            margin: 0;
            padding: 0;
          }
        }
      `}</style>

      <div className="mx-auto w-full max-w-[794px] bg-white px-8 py-8 text-[12px] leading-5">
        <header className="mb-5 flex items-start justify-between border-b pb-4">
          <div className="w-44">
            <img src="/hexaplast-logo.svg" alt="Hexaplast" className="h-auto w-full" />
          </div>

          <div className="text-center">
            <h1 className="text-xl font-semibold tracking-wide">{title}</h1>
          </div>

          <div className="max-w-[230px] text-right">
            <p className="font-semibold">{company.company_name || "Hexaplast"}</p>
            <p>{company.company_address || "-"}</p>
            <p>{company.company_phone || "-"}</p>
            <p>{company.company_email || "-"}</p>
          </div>
        </header>

        {metaFields.length > 0 ? (
          <section className="mb-4 grid grid-cols-2 gap-x-8 gap-y-1 border-b pb-3">
            {metaFields.map((field) => (
              <p key={field.label}>
                <span className="font-medium">{field.label}: </span>
                <span>{field.value || "-"}</span>
              </p>
            ))}
          </section>
        ) : null}

        <section className="mb-4 border-b pb-4">
          <h2 className="mb-2 text-sm font-semibold uppercase">Customer Details</h2>
          <div className="grid grid-cols-2 gap-x-8 gap-y-1">
            <p><span className="font-medium">Company Name:</span> {customer.company_name || "-"}</p>
            <p><span className="font-medium">Contact Person:</span> {customer.contact_person || "-"}</p>
            <p><span className="font-medium">Phone Number:</span> {customer.phone || "-"}</p>
            <p><span className="font-medium">Email:</span> {customer.email || "-"}</p>
            <p><span className="font-medium">GST Number:</span> {customer.gst_number || "-"}</p>
            <p><span className="font-medium">Address:</span> {customer.address || "-"}</p>
            <p><span className="font-medium">City:</span> {customer.city || "-"}</p>
            <p><span className="font-medium">State:</span> {customer.state || "-"}</p>
            <p><span className="font-medium">Country:</span> {customer.country || "-"}</p>
          </div>
        </section>

        <section className="mb-4">
          <table className="w-full border-collapse border border-black">
            <thead>
              <tr>
                {[
                  "Sr No",
                  "Category",
                  "Sub Category",
                  "Product Name",
                  "Model Number",
                  "HSN/SAC Code",
                  "Unit",
                  "Quantity",
                  "Unit Price",
                  "Discount",
                  "GST %",
                  "Total",
                ].map((head) => (
                  <th key={head} className="border border-black px-1 py-1 text-left text-[11px] font-semibold">
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={12} className="border border-black px-2 py-2 text-center">No items</td>
                </tr>
              ) : (
                items.map((item, index) => (
                  <tr key={index}>
                    <td className="border border-black px-1 py-1 align-top">{index + 1}</td>
                    <td className="border border-black px-1 py-1 align-top">{item.category_name || "-"}</td>
                    <td className="border border-black px-1 py-1 align-top">{item.sub_category || "-"}</td>
                    <td className="border border-black px-1 py-1 align-top whitespace-pre-wrap break-words">{item.product_name || "-"}</td>
                    <td className="border border-black px-1 py-1 align-top">{item.model_number || "-"}</td>
                    <td className="border border-black px-1 py-1 align-top">{item.hsn_sac_code || "-"}</td>
                    <td className="border border-black px-1 py-1 align-top">{item.unit || "-"}</td>
                    <td className="border border-black px-1 py-1 align-top">{item.quantity ?? 0}</td>
                    <td className="border border-black px-1 py-1 align-top text-right">{money(item.price)}</td>
                    <td className="border border-black px-1 py-1 align-top text-right">{money(item.discount_amount)}</td>
                    <td className="border border-black px-1 py-1 align-top text-right">{money(item.gst_percent)}</td>
                    <td className="border border-black px-1 py-1 align-top text-right">{money(item.total)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>

        <section className="mb-6 ml-auto w-72">
          <div className="space-y-1 border border-black p-3">
            <p className="flex justify-between"><span>Subtotal</span><span>{money(totals.subtotal)}</span></p>
            <p className="flex justify-between"><span>Discount</span><span>{money(totals.discount)}</span></p>
            <p className="flex justify-between"><span>GST</span><span>{money(totals.gst)}</span></p>
            <p className="flex justify-between border-t border-black pt-1 font-semibold"><span>Total Amount</span><span>{money(totals.total)}</span></p>
            {totals.advance_payment !== undefined ? (
              <p className="flex justify-between"><span>Advance Payment</span><span>{money(totals.advance_payment)}</span></p>
            ) : null}
            {totals.due_amount !== undefined ? (
              <p className="flex justify-between font-semibold"><span>Due Amount</span><span>{money(totals.due_amount)}</span></p>
            ) : null}
          </div>
        </section>

        <section className="mb-6 grid grid-cols-3 gap-3 text-center text-[11px]">
          {["Prepared By", "Checked By", "Approved By", "Store / Purchase", "QC & Testing", "Production"].map((label) => (
            <div key={label}>
              <div className="h-16 border border-black" />
              <p className="mt-1 font-medium">{label}</p>
            </div>
          ))}
        </section>

        <footer className="flex items-end justify-between border-t pt-2 text-[11px]">
          <p>{company.company_address || "-"}</p>
          <p>Page 1 of 1</p>
        </footer>
      </div>
    </div>
  )
}

export type { CompanyDetails, CustomerDetails, PrintItem, Totals, MetaField }
