"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { generateDocumentPdf } from "@/lib/print/generatePdf"

type WorkOrderItem = {
  product_name?: string | null
  model_number?: string | null
  unit?: string | null
  quantity: number
  [key: string]: unknown
}

type WorkOrder = {
  id: number
  work_order_number: string
  work_order_date?: string | null
  delivery_date?: string | null
  calibration_nabl?: string | boolean | null
  items: WorkOrderItem[]
  [key: string]: unknown
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
        const wo = workOrderJson.work_order as WorkOrder

        const nablValue =
          wo.calibration_nabl === true ||
          wo.calibration_nabl === "true" ||
          wo.calibration_nabl === "YES"
            ? "YES"
            : "NO"

        // Work Orders are internal-only — no customer data, no terms
        const pdfBlob = await generateDocumentPdf({
          title: "WORK ORDER",
          leftFields: [
            { label: "Work Order No.", value: wo.work_order_number },
            { label: "Date", value: wo.work_order_date ? new Date(wo.work_order_date).toLocaleDateString() : "-" },
            { label: "Calibration (NABL)", value: nablValue },
            { label: "Delivery Date", value: wo.delivery_date ? new Date(wo.delivery_date).toLocaleDateString() : "-" },
          ],
          items: (wo.items || []).map((item) => ({
            ...item,
            price: 0,
            discount_amount: 0,
            gst_percent: 0,
            total: 0,
          })),
          customColumns: [
            { header: "#", width: 30, align: "center", key: "idx" },
            { header: "Product Name", width: 220, key: "product_name" },
            { header: "Model Number", width: 140, key: "model_number" },
            { header: "Qty", width: 60, align: "right", key: "quantity" },
            { header: "Unit", width: 60, align: "center", key: "unit" },
          ],
          totals: { subtotal: 0, discount: 0, gst: 0, total: 0 },
          hideTotals: true,
          currency: (wo as any).currency || "INR",
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
