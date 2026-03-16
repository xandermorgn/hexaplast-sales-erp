"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { generateDocumentPdf } from "@/lib/print/generatePdf"

type POItem = {
  id: number
  part_name: string
  specification: string | null
  unit: string
  quantity: number
  unit_price: number
  total_price: number
}

type PurchaseOrder = {
  id: number
  po_number: string
  vendor_name: string
  vendor_phone: string | null
  vendor_email: string | null
  vendor_gst: string | null
  work_order_number: string | null
  total_amount: number
  gst_amount: number | null
  terms_conditions: string | null
  created_at: string | null
}

export default function PurchaseOrderPrintPage() {
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
        if (!id) throw new Error("Missing purchase order id")

        const res = await fetch(`/api/purchase/orders/${id}`, { credentials: "include" })
        if (!res.ok) throw new Error("Failed to load purchase order")

        const json = await res.json()
        const po = json.purchase_order as PurchaseOrder
        const items = (json.items || []) as POItem[]

        if (!po) throw new Error("Purchase order not found")

        // Fetch document defaults for terms
        let defaults = { terms_conditions: "", attention: "", declaration: "", special_notes: "" }
        try {
          const defRes = await fetch(`/api/system-settings/document-defaults`, { credentials: "include" })
          if (defRes.ok) {
            const defJson = await defRes.json()
            defaults = { ...defaults, ...(defJson.defaults || {}) }
          }
        } catch { /* ignore */ }

        // Calculate totals
        const subtotal = items.reduce((sum, item) => sum + Number(item.total_price || 0), 0)
        const gstAmount = Number(po.gst_amount || 0)
        const totalAmount = Number(po.total_amount || (subtotal + gstAmount))

        // Map items to PdfItem format using custom column keys
        const pdfItems = items.map((item) => ({
          part_name: item.part_name || "-",
          specification: item.specification || "-",
          unit: item.unit || "Nos",
          quantity: item.quantity || 0,
          unit_price: item.unit_price || 0,
          total_price: item.total_price || 0,
        }))

        const pdfBlob = await generateDocumentPdf({
          title: "PURCHASE ORDER",
          leftFields: [
            { label: "PO Number", value: po.po_number },
            { label: "Work Order", value: po.work_order_number || "-" },
            { label: "PO Date", value: po.created_at ? new Date(po.created_at).toLocaleDateString() : "-" },
          ],
          rightFields: [
            { label: "Vendor Name", value: po.vendor_name || "-" },
            { label: "Phone", value: po.vendor_phone || "-" },
            { label: "Email", value: po.vendor_email || "-" },
            { label: "GST", value: po.vendor_gst || "-" },
          ],
          items: pdfItems,
          totals: {
            subtotal,
            discount: 0,
            gst: gstAmount,
            total: totalAmount,
          },
          termsConditions: po.terms_conditions || defaults.terms_conditions || null,
          attention: defaults.attention || null,
          declaration: defaults.declaration || null,
          specialNotes: defaults.special_notes || null,
          customColumns: [
            { header: "Sr No", width: 30, align: "center", key: "idx" },
            { header: "Material Name", width: 140, key: "part_name" },
            { header: "Specification", width: 120, key: "specification" },
            { header: "Unit", width: 40, align: "center", key: "unit" },
            { header: "Quantity", width: 50, align: "right", key: "quantity" },
            { header: "Price", width: 70, align: "right", key: "unit_price" },
            { header: "Total", width: 80, align: "right", key: "total_price" },
          ],
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
  if (error || !pdfUrl) return <div className="p-8 text-red-600">{error || "Unable to generate purchase order PDF"}</div>

  return <iframe title="Purchase Order PDF Preview" src={pdfUrl} className="h-screen w-full border-0" />
}
