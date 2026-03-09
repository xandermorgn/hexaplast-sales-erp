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

type WorkOrderData = {
  id: number
  work_order_number: string
  work_order_date?: string | null
  delivery_date?: string | null
  calibration_nabl?: string | boolean | null
  inquiry_number?: string | null
  subtotal?: number
  total_discount?: number
  total_gst?: number
  total_amount?: number
  items?: PrintItem[]
}

type Props = {
  workOrder: WorkOrderData
  customer: CustomerDetails
}

function nablDisplay(value: string | boolean | null | undefined): string {
  if (value === true || value === "true" || value === "YES" || value === "yes") return "YES"
  if (value === false || value === "false" || value === "NO" || value === "no") return "NO"
  if (value && String(value).trim()) return String(value).trim()
  return "NO"
}

export function WorkOrderPrint({ workOrder, customer }: Props) {
  return (
    <BaseDocument
      title="WORK ORDER"
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
        { label: "Work Order No.", value: workOrder.work_order_number },
        { label: "Date", value: workOrder.work_order_date ? new Date(workOrder.work_order_date).toLocaleDateString() : "-" },
        { label: "Inquiry No.", value: workOrder.inquiry_number || "-" },
        { label: "Delivery Date", value: workOrder.delivery_date ? new Date(workOrder.delivery_date).toLocaleDateString() : "-" },
        { label: "NABL", value: nablDisplay(workOrder.calibration_nabl) },
      ]}
      items={workOrder.items || []}
      totals={{
        subtotal: Number(workOrder.subtotal || 0),
        discount: Number(workOrder.total_discount || 0),
        gst: Number(workOrder.total_gst || 0),
        total: Number(workOrder.total_amount || 0),
      }}
    />
  )
}
