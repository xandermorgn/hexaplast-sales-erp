import { BaseDocument, type PrintItem } from "@/lib/print/templates/BaseDocument"

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

type QuotationData = {
  id: number
  quotation_number: string
  created_at?: string | null
  inquiry_number?: string | null
  subtotal?: number
  total_discount?: number
  total_gst?: number
  total_amount?: number
  items?: PrintItem[]
}

type Props = {
  quotation: QuotationData
  customer: CustomerDetails
}

export function QuotationPrint({ quotation, customer }: Props) {
  return (
    <BaseDocument
      title="QUOTATION"
      leftFields={[
        { label: "Customer Name", value: customer.company_name || "-" },
        { label: "Contact Person", value: customer.contact_person || "-" },
        { label: "Phone", value: customer.phone || "-" },
        { label: "Email", value: customer.email || "-" },
        { label: "GST Number", value: customer.gst_number || "-" },
      ]}
      addressFields={[
        { label: "Address", value: customer.address || "-" },
        { label: "City", value: customer.city || "-" },
        { label: "State", value: customer.state || "-" },
        { label: "Country", value: customer.country || "-" },
      ]}
      rightFields={[
        { label: "Quotation No.", value: quotation.quotation_number },
        { label: "Date", value: quotation.created_at ? new Date(quotation.created_at).toLocaleDateString() : "-" },
        { label: "Inquiry No.", value: quotation.inquiry_number || "-" },
      ]}
      items={quotation.items || []}
      totals={{
        subtotal: Number(quotation.subtotal || 0),
        discount: Number(quotation.total_discount || 0),
        gst: Number(quotation.total_gst || 0),
        total: Number(quotation.total_amount || 0),
      }}
    />
  )
}
