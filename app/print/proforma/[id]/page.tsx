"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { generateDocumentPdf, toTitleCase } from "@/lib/print/generatePdf"

type ProformaItem = {
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

type Proforma = {
  id: number
  performa_number: string
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
  advance_amount?: number
  items: ProformaItem[]
}

type Inquiry = {
  gst_number?: string | null
  city?: string | null
  state?: string | null
  country?: string | null
}

export default function ProformaPrintPage() {
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
        if (!id) throw new Error("Missing performa id")

        const performaRes = await fetch(`/api/performas/${id}`, { credentials: "include" })
        if (!performaRes.ok) throw new Error("Failed to load proforma")

        const performaJson = await performaRes.json()
        const nextPerforma = performaJson.performa as Proforma
        const normalizedPerforma: Proforma = {
          ...nextPerforma,
          items: (nextPerforma.items || []).map((item) => ({
            ...item,
            sub_category: item.sub_category || item.product_type || "-",
          })),
        }

        let inquiryData: Inquiry = {}
        if (nextPerforma?.inquiry_id) {
          const inquiryRes = await fetch(`/api/inquiries/${nextPerforma.inquiry_id}`, { credentials: "include" })
          if (inquiryRes.ok) {
            const inquiryJson = await inquiryRes.json()
            inquiryData = inquiryJson.inquiry || {}
          }
        }

        const advance = Number(normalizedPerforma.advance_amount || 0)
        const total = Number(normalizedPerforma.total_amount || 0)

        const pdfBlob = await generateDocumentPdf({
          title: "PROFORMA INVOICE",
          customerName: normalizedPerforma.company_name,
          leftFields: [
            { label: "Customer Name", value: toTitleCase(normalizedPerforma.company_name) },
            { label: "Contact Person", value: normalizedPerforma.authorized_person || "-" },
            { label: "Phone", value: normalizedPerforma.authorized_phone || "-" },
            { label: "Email", value: normalizedPerforma.email || "-" },
            { label: "GST Number", value: inquiryData.gst_number || "-" },
          ],
          rightFields: [
            { label: "Proforma No.", value: normalizedPerforma.performa_number },
            { label: "Date", value: normalizedPerforma.created_at ? new Date(normalizedPerforma.created_at).toLocaleDateString() : "-" },
            { label: "Inquiry No.", value: normalizedPerforma.inquiry_number || "-" },
          ],
          addressFields: [
            { label: "Address", value: toTitleCase(normalizedPerforma.address) },
            { label: "City", value: toTitleCase(inquiryData.city) },
            { label: "State", value: toTitleCase(inquiryData.state) },
            { label: "Country", value: toTitleCase(inquiryData.country) },
          ],
          items: normalizedPerforma.items || [],
          totals: {
            subtotal: Number(normalizedPerforma.subtotal || 0),
            discount: Number(normalizedPerforma.total_discount || 0),
            gst: Number(normalizedPerforma.total_gst || 0),
            total,
            advance_payment: advance,
            due_amount: total - advance,
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
  if (error || !pdfUrl) return <div className="p-8 text-red-600">{error || "Unable to generate proforma PDF"}</div>

  return <iframe title="Proforma PDF Preview" src={pdfUrl} className="h-screen w-full border-0" />
}
