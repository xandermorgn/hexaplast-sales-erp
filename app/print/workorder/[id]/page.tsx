"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { generateDocumentPdf, toTitleCase } from "@/lib/print/generatePdf"

type WorkOrderItem = {
  category_name?: string | null
  sub_category?: string | null
  product_name?: string | null
  model_number?: string | null
  hsn_sac_code?: string | null
  unit?: string | null
  product_type?: string | null
  quantity: number
  price: number
  discount_amount: number
  gst_percent: number
  total: number
}

type WorkOrder = {
  id: number
  work_order_number: string
  inquiry_id: number
  inquiry_number?: string | null
  company_name?: string | null
  authorized_person?: string | null
  authorized_phone?: string | null
  email?: string | null
  address?: string | null
  work_order_date?: string | null
  delivery_date?: string | null
  calibration_nabl?: string | boolean | null
  subtotal?: number
  total_discount?: number
  total_gst?: number
  total_amount?: number
  items: WorkOrderItem[]
}

type Inquiry = {
  gst_number?: string | null
  city?: string | null
  state?: string | null
  country?: string | null
}

export default function WorkOrderPrintPage() {
  const params = useParams<{ id: string }>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [pdfUrl, setPdfUrl] = useState("")

  useEffect(() => {
    let nextPdfUrl = ""

    async function load() {
      try {
        setLoading(true)
        const id = params?.id
        if (!id) throw new Error("Missing work order id")

        const workOrderRes = await fetch(`/api/work-orders/${id}`, { credentials: "include" })
        if (!workOrderRes.ok) throw new Error("Failed to load work order")

        const workOrderJson = await workOrderRes.json()
        const nextWorkOrder = workOrderJson.work_order as WorkOrder
        const normalizedWorkOrder: WorkOrder = {
          ...nextWorkOrder,
          items: (nextWorkOrder.items || []).map((item) => ({
            ...item,
            sub_category: item.sub_category || item.product_type || "-",
          })),
        }

        let inquiryData: Inquiry = {}
        if (nextWorkOrder?.inquiry_id) {
          const inquiryRes = await fetch(`/api/inquiries/${nextWorkOrder.inquiry_id}`, { credentials: "include" })
          if (inquiryRes.ok) {
            const inquiryJson = await inquiryRes.json()
            inquiryData = inquiryJson.inquiry || {}
          }
        }

        const nablValue =
          normalizedWorkOrder.calibration_nabl === true ||
          normalizedWorkOrder.calibration_nabl === "true" ||
          normalizedWorkOrder.calibration_nabl === "YES"
            ? "YES"
            : "NO"

        const pdfBlob = await generateDocumentPdf({
          title: "WORK ORDER",
          customerName: normalizedWorkOrder.company_name,
          leftFields: [
            { label: "Customer Name", value: toTitleCase(normalizedWorkOrder.company_name) },
            { label: "Contact Person", value: normalizedWorkOrder.authorized_person || "-" },
            { label: "Phone", value: normalizedWorkOrder.authorized_phone || "-" },
            { label: "Email", value: normalizedWorkOrder.email || "-" },
            { label: "GST Number", value: inquiryData.gst_number || "-" },
          ],
          rightFields: [
            { label: "Work Order No.", value: normalizedWorkOrder.work_order_number },
            { label: "Date", value: normalizedWorkOrder.work_order_date ? new Date(normalizedWorkOrder.work_order_date).toLocaleDateString() : "-" },
            { label: "Inquiry No.", value: normalizedWorkOrder.inquiry_number || "-" },
            { label: "Delivery Date", value: normalizedWorkOrder.delivery_date ? new Date(normalizedWorkOrder.delivery_date).toLocaleDateString() : "-" },
            { label: "NABL", value: nablValue },
          ],
          addressFields: [
            { label: "Address", value: toTitleCase(normalizedWorkOrder.address) },
            { label: "City", value: toTitleCase(inquiryData.city) },
            { label: "State", value: toTitleCase(inquiryData.state) },
            { label: "Country", value: toTitleCase(inquiryData.country) },
          ],
          items: normalizedWorkOrder.items || [],
          showCategoryColumns: false,
          totals: {
            subtotal: Number(normalizedWorkOrder.subtotal || 0),
            discount: Number(normalizedWorkOrder.total_discount || 0),
            gst: Number(normalizedWorkOrder.total_gst || 0),
            total: Number(normalizedWorkOrder.total_amount || 0),
          },
        })

        nextPdfUrl = URL.createObjectURL(pdfBlob)
        setPdfUrl(nextPdfUrl)
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load print data")
      } finally {
        setLoading(false)
      }
    }

    load()

    return () => {
      if (nextPdfUrl) URL.revokeObjectURL(nextPdfUrl)
    }
  }, [params?.id])

  if (loading) return <div className="p-8">Loading...</div>
  if (error || !pdfUrl) return <div className="p-8 text-red-600">{error || "Unable to generate work order PDF"}</div>

  return <iframe title="Work Order PDF Preview" src={pdfUrl} className="h-screen w-full border-0" />
}
