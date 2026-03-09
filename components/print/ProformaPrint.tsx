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

type ProformaData = {
  id: number
  performa_number: string
  created_at?: string | null
  inquiry_number?: string | null
  subtotal?: number
  total_discount?: number
  total_gst?: number
  total_amount?: number
  advance_amount?: number
  items?: PrintItem[]
}

type Props = {
  performa: ProformaData
  customer: CustomerDetails
}

export function ProformaPrint({ performa, customer }: Props) {
  const advance = Number(performa.advance_amount || 0)
  const total = Number(performa.total_amount || 0)

  return (
    <BaseDocument
      title="PROFORMA INVOICE"
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
        { label: "Proforma No.", value: performa.performa_number },
        { label: "Date", value: performa.created_at ? new Date(performa.created_at).toLocaleDateString() : "-" },
        { label: "Inquiry No.", value: performa.inquiry_number || "-" },
      ]}
      items={performa.items || []}
      totals={{
        subtotal: Number(performa.subtotal || 0),
        discount: Number(performa.total_discount || 0),
        gst: Number(performa.total_gst || 0),
        total,
        advance_payment: advance,
        due_amount: total - advance,
      }}
    />
  )
}
