"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { generateDocumentPdf, toTitleCase } from "@/lib/print/generatePdf"
import type { MachinePageData } from "@/lib/print/generatePdf"

type QuotationItem = {
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
  show_image?: number | boolean
  specifications?: string | null
  image_path?: string | null
}

type Quotation = {
  id: number
  quotation_number: string
  created_at?: string | null
  inquiry_id: number
  inquiry_number?: string | null
  company_name?: string | null
  authorized_person?: string | null
  authorized_phone?: string | null
  email?: string | null
  address?: string | null
  subtotal?: number
  total_discount?: number
  total_gst?: number
  total_amount?: number
  items: QuotationItem[]
}

type Inquiry = {
  gst_number?: string | null
  city?: string | null
  state?: string | null
  country?: string | null
}

export default function QuotationPrintPage() {
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
        if (!id) throw new Error("Missing quotation id")

        const quotationRes = await fetch(`/api/quotations/${id}`, { credentials: "include" })
        if (!quotationRes.ok) throw new Error("Failed to load quotation")

        const quotationJson = await quotationRes.json()
        const nextQuotation = quotationJson.quotation as Quotation
        const normalizedQuotation: Quotation = {
          ...nextQuotation,
          items: (nextQuotation.items || []).map((item) => ({
            ...item,
            sub_category: item.sub_category || item.product_type || "-",
          })),
        }

        let inquiryData: Inquiry = {}
        if (nextQuotation?.inquiry_id) {
          const inquiryRes = await fetch(`/api/inquiries/${nextQuotation.inquiry_id}`, { credentials: "include" })
          if (inquiryRes.ok) {
            const inquiryJson = await inquiryRes.json()
            inquiryData = inquiryJson.inquiry || {}
          }
        }

        // Fetch document defaults for terms
        let defaults = { terms_conditions: "", attention: "", declaration: "", special_notes: "" }
        try {
          const defRes = await fetch(`/api/system-settings/document-defaults`, { credentials: "include" })
          if (defRes.ok) {
            const defJson = await defRes.json()
            defaults = { ...defaults, ...(defJson.defaults || {}) }
          }
        } catch { /* ignore */ }

        // Build machine detail pages for ALL items (do NOT skip partial data)
        const origin = typeof window !== "undefined" ? window.location.origin : ""
        const allItems = normalizedQuotation.items || []
        console.log("QUOTATION ITEMS FOR MACHINE PAGES:", allItems)

        const machinePages: MachinePageData[] = allItems.map((item, idx) => {
          let imageUrl: string | null = null
          if (item.image_path) {
            if (item.image_path.startsWith("http")) {
              imageUrl = item.image_path
            } else {
              // image_path from DB is like "/uploads/product_images/file.jpg"
              // serve-upload API expects path relative to server/uploads/
              // so strip leading "/uploads/" and build /api/serve-upload/...
              const relative = item.image_path.replace(/^\/?uploads\//, "")
              imageUrl = `${origin}/api/serve-upload/${relative}`
            }
          }
          return {
            index: idx + 1,
            machineName: item.product_name || "Unknown Product",
            modelNumber: item.model_number || null,
            imageUrl,
            showImage: item.show_image !== 0 && item.show_image !== false,
            specifications: item.specifications || "No specifications provided",
          }
        })

        console.log("MACHINE PAGES:", machinePages)

        const pdfBlob = await generateDocumentPdf({
          title: "QUOTATION",
          customerName: normalizedQuotation.company_name,
          leftFields: [
            { label: "Customer Name", value: toTitleCase(normalizedQuotation.company_name) },
            { label: "Contact Person", value: normalizedQuotation.authorized_person || "-" },
            { label: "Phone", value: normalizedQuotation.authorized_phone || "-" },
            { label: "Email", value: normalizedQuotation.email || "-" },
            { label: "GST Number", value: inquiryData.gst_number || "-" },
          ],
          rightFields: [
            { label: "Quotation No.", value: normalizedQuotation.quotation_number },
            { label: "Date", value: normalizedQuotation.created_at ? new Date(normalizedQuotation.created_at).toLocaleDateString() : "-" },
            { label: "Inquiry No.", value: normalizedQuotation.inquiry_number || "-" },
          ],
          addressFields: [
            { label: "Address", value: toTitleCase(normalizedQuotation.address) },
            { label: "City", value: toTitleCase(inquiryData.city) },
            { label: "State", value: toTitleCase(inquiryData.state) },
            { label: "Country", value: toTitleCase(inquiryData.country) },
          ],
          items: normalizedQuotation.items || [],
          totals: {
            subtotal: Number(normalizedQuotation.subtotal || 0),
            discount: Number(normalizedQuotation.total_discount || 0),
            gst: Number(normalizedQuotation.total_gst || 0),
            total: Number(normalizedQuotation.total_amount || 0),
          },
          termsConditions: defaults.terms_conditions || null,
          attention: defaults.attention || null,
          declaration: defaults.declaration || null,
          specialNotes: defaults.special_notes || null,
          currency: (normalizedQuotation as any).currency || "INR",
          machinePages,
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
  if (error || !pdfUrl) return <div className="p-8 text-red-600">{error || "Unable to generate quotation PDF"}</div>

  return <iframe title="Quotation PDF Preview" src={pdfUrl} className="h-screen w-full border-0" />
}
