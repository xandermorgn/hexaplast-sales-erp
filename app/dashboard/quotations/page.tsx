"use client"

import { useEffect, useMemo, useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { Printer, Pencil, Trash2 } from "lucide-react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { DateRangeFilter } from "@/components/ui/date-range-filter"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { useCategories } from "@/hooks/use-categories"
import { apiUrl } from "@/lib/api"
import { parseNum } from "@/lib/parse-number"
import { FollowUpSection } from "@/components/follow-up-section"

type Inquiry = {
  id: number
  inquiry_number: string
  company_name: string | null
  authorized_person: string | null
  authorized_phone: string | null
  email: string | null
  address: string | null
}

type ProductOption = {
  key: string
  product_type: "machine" | "spare"
  product_id: number
  label: string
  sales_price: number
  gst_percent: number
}

type QuotationItemForm = {
  product_key: string
  product_type: "machine" | "spare" | ""
  product_id: number | null
  quantity: string
  price: string
  discount_percent: string
  discount_amount: string
  gst_percent: string
}

type QuotationSummary = {
  subtotal: number
  totalDiscount: number
  totalGst: number
  totalAmount: number
}

type QuotationRow = {
  id: number
  quotation_number: string
  inquiry_id: number
  inquiry_number: string
  company_name: string | null
  authorized_person: string | null
  subtotal: number
  total_discount: number
  total_amount: number
  status: string | null
  created_at: string
}

type QuotationDetailItem = {
  product_type: "machine" | "spare"
  product_id: number
  quantity: number
  price: number
  discount_percent: number
  discount_amount: number
  gst_percent: number
}

type QuotationDetail = {
  id: number
  quotation_number: string
  inquiry_id: number
  inquiry_number: string
  company_name: string | null
  authorized_person: string | null
  authorized_phone: string | null
  email: string | null
  address: string | null
  subtotal: number
  total_discount: number
  total_amount: number
  status: string | null
  terms_conditions: string | null
  attention: string | null
  declaration: string | null
  special_notes: string | null
  items: QuotationDetailItem[]
}

type DocumentDefaults = {
  terms_conditions: string
  attention: string
  declaration: string
  special_notes: string
}

const emptyItem = (): QuotationItemForm => ({
  product_key: "",
  product_type: "",
  product_id: null,
  quantity: "1",
  price: "0",
  discount_percent: "0",
  discount_amount: "0",
  gst_percent: "0",
})

const round2 = (value: number) => Math.round(value * 100) / 100

function escapePdfText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)")
}

function createSimpleQuotationPdf(quotation: QuotationDetail, summary: QuotationSummary) {
  const lines = [
    `Quotation No: ${quotation.quotation_number}`,
    `Inquiry: ${quotation.inquiry_number}`,
    `Company: ${quotation.company_name || "-"}`,
    `Attention: ${quotation.attention || quotation.authorized_person || "-"}`,
    `Email: ${quotation.email || "-"}`,
    `Phone: ${quotation.authorized_phone || "-"}`,
    "",
    "Items:",
    ...quotation.items.map((item, index) =>
      `${index + 1}. ${item.product_type.toUpperCase()} #${item.product_id} Qty:${item.quantity} Price:${item.price} Disc:${item.discount_amount} GST:${item.gst_percent}% Total:${round2((item.quantity * item.price - item.discount_amount) * (1 + item.gst_percent / 100))}`,
    ),
    "",
    `Subtotal: ${summary.subtotal.toFixed(2)}`,
    `Discount: ${summary.totalDiscount.toFixed(2)}`,
    `GST: ${summary.totalGst.toFixed(2)}`,
    `Total: ${summary.totalAmount.toFixed(2)}`,
    "",
    `Terms & Conditions: ${quotation.terms_conditions || "-"}`,
    `Declaration: ${quotation.declaration || "-"}`,
    `Special Notes: ${quotation.special_notes || "-"}`,
  ]

  const textCommands = lines
    .map((line, index) => `BT /F1 10 Tf 40 ${770 - index * 14} Td (${escapePdfText(line)}) Tj ET`)
    .join("\n")

  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj",
    "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
    `5 0 obj << /Length ${textCommands.length} >> stream\n${textCommands}\nendstream endobj`,
  ]

  let pdf = "%PDF-1.4\n"
  const offsets: number[] = []

  for (const obj of objects) {
    offsets.push(pdf.length)
    pdf += `${obj}\n`
  }

  const xrefStart = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n`
  pdf += "0000000000 65535 f \n"
  for (const offset of offsets) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`
  }

  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`
  return new Blob([pdf], { type: "application/pdf" })
}

export default function QuotationsPage() {
  const router = useRouter()
  const { user, isLoading, logout } = useAuth()
  const { toast } = useToast()
  const { categoryMap } = useCategories()

  const [activeSection, setActiveSection] = useState("quotations")
  const menuItems = [
    { id: "inquiries", label: "Customer Inquiries" },
    { id: "quotations", label: "Quotations" },
    { id: "performas", label: "Performas" },
    { id: "work-orders", label: "Work Orders" },
    { id: "products", label: "Products" },
    { id: "followups", label: "Follow Ups" },
  ]

  function handleSectionChange(section: string) {
    const routeMap: Record<string, string> = {
      inquiries: "/dashboard/inquiries",
      quotations: "/dashboard/quotations",
      performas: "/dashboard/performas",
      "work-orders": "/dashboard/work-orders",
      products: "/dashboard/products",
      followups: "/dashboard/followups",
    }

    const target = routeMap[section]
    if (target) {
      router.push(target)
      return
    }

    setActiveSection("quotations")
  }

  const [inquiries, setInquiries] = useState<Inquiry[]>([])
  const [products, setProducts] = useState<ProductOption[]>([])
  const [quotations, setQuotations] = useState<QuotationRow[]>([])
  const [showForm, setShowForm] = useState(false)
  const [filters, setFilters] = useState({ from_date: "", to_date: "" })

  const [editingId, setEditingId] = useState<number | null>(null)
  const [savedQuotation, setSavedQuotation] = useState<QuotationDetail | null>(null)

  const [inquiryId, setInquiryId] = useState("")
  const [items, setItems] = useState<QuotationItemForm[]>([emptyItem()])
  const [termsConditions, setTermsConditions] = useState("")
  const [attention, setAttention] = useState("")
  const [declaration, setDeclaration] = useState("")
  const [specialNotes, setSpecialNotes] = useState("")
  const [defaultSettings, setDefaultSettings] = useState<DocumentDefaults>({
    terms_conditions: "",
    attention: "",
    declaration: "",
    special_notes: "",
  })

  const selectedInquiry = useMemo(
    () => inquiries.find((inquiry) => String(inquiry.id) === inquiryId) || null,
    [inquiries, inquiryId],
  )

  const summary = useMemo<QuotationSummary>(() => {
    let subtotal = 0
    let totalDiscount = 0
    let totalGst = 0

    for (const item of items) {
      const qty = Math.max(1, parseNum(item.quantity) || 1)
      const price = parseNum(item.price)
      const base = qty * price

      let discPercent = parseNum(item.discount_percent)
      let discAmount = parseNum(item.discount_amount)

      if (discPercent > 0) {
        discAmount = (base * discPercent) / 100
      } else if (discAmount > 0 && base > 0) {
        discPercent = (discAmount / base) * 100
      }

      if (discAmount > base) discAmount = base

      const taxable = base - discAmount
      const gstPercent = parseNum(item.gst_percent)
      const gstAmount = (taxable * gstPercent) / 100

      subtotal += base
      totalDiscount += discAmount
      totalGst += gstAmount
    }

    return {
      subtotal: round2(subtotal),
      totalDiscount: round2(totalDiscount),
      totalGst: round2(totalGst),
      totalAmount: round2(subtotal - totalDiscount + totalGst),
    }
  }, [items])

  const filteredQuotations = useMemo(() => {
    return quotations.filter((quotation) => {
      const created = new Date(quotation.created_at)
      if (Number.isNaN(created.getTime())) return true

      if (filters.from_date) {
        const fromDate = new Date(`${filters.from_date}T00:00:00`)
        if (created < fromDate) return false
      }

      if (filters.to_date) {
        const toDate = new Date(`${filters.to_date}T23:59:59`)
        if (created > toDate) return false
      }

      return true
    })
  }, [quotations, filters.from_date, filters.to_date])

  async function fetchInquiries() {
    const response = await fetch(apiUrl("/api/inquiries"), { credentials: "include" })
    if (!response.ok) throw new Error("Failed to fetch inquiries")
    const data = await response.json()
    setInquiries(data.inquiries || [])
  }

  async function fetchProducts() {
    const [machinesRes, sparesRes] = await Promise.all([
      fetch(apiUrl("/api/products/machines"), { credentials: "include" }),
      fetch(apiUrl("/api/products/spares"), { credentials: "include" }),
    ])

    if (!machinesRes.ok || !sparesRes.ok) {
      throw new Error("Failed to fetch products")
    }

    const machinesData = await machinesRes.json()
    const sparesData = await sparesRes.json()

    const machineOptions: ProductOption[] = (machinesData.products || []).map((product: any) => ({
      key: `machine-${product.id}`,
      product_type: "machine",
      product_id: product.id,
      label: `${categoryMap.get(Number(product.category_id)) || product.category_name || "Uncategorized"} — ${product.product_name || "-"} (${product.product_code || "-"})`,
      sales_price: Number(product.sales_price) || 0,
      gst_percent: Number(product.gst_percent) || 0,
    }))

    const spareOptions: ProductOption[] = (sparesData.products || []).map((product: any) => ({
      key: `spare-${product.id}`,
      product_type: "spare",
      product_id: product.id,
      label: `${categoryMap.get(Number(product.category_id)) || product.category_name || "Uncategorized"} — ${product.product_name || "-"} (${product.product_code || "-"})`,
      sales_price: Number(product.sales_price) || 0,
      gst_percent: Number(product.gst_percent) || 0,
    }))

    setProducts([...machineOptions, ...spareOptions])
  }

  async function fetchQuotations() {
    const response = await fetch(apiUrl("/api/quotations"), { credentials: "include" })
    if (!response.ok) throw new Error("Failed to fetch quotations")
    const data = await response.json()
    setQuotations(data.quotations || [])
  }

  async function fetchDocumentDefaults(applyToForm = false) {
    const response = await fetch(apiUrl("/api/system-settings/document-defaults"), { credentials: "include" })
    if (!response.ok) throw new Error("Failed to fetch default document settings")
    const data = await response.json()

    const defaults: DocumentDefaults = {
      terms_conditions: data?.defaults?.terms_conditions || "",
      attention: data?.defaults?.attention || "",
      declaration: data?.defaults?.declaration || "",
      special_notes: data?.defaults?.special_notes || "",
    }

    setDefaultSettings(defaults)

    if (applyToForm) {
      setTermsConditions(defaults.terms_conditions)
      setAttention(defaults.attention)
      setDeclaration(defaults.declaration)
      setSpecialNotes(defaults.special_notes)
    }
  }

  async function loadAll() {
    try {
      await Promise.all([fetchInquiries(), fetchProducts(), fetchQuotations(), fetchDocumentDefaults(true)])
    } catch {
      toast({ title: "Error", description: "Failed to load quotation module data", variant: "destructive" })
    }
  }

  useEffect(() => {
    loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function resetForm() {
    setEditingId(null)
    setSavedQuotation(null)
    setInquiryId("")
    setItems([emptyItem()])
    setTermsConditions(defaultSettings.terms_conditions)
    setAttention(defaultSettings.attention)
    setDeclaration(defaultSettings.declaration)
    setSpecialNotes(defaultSettings.special_notes)
  }

  function openCreateForm() {
    resetForm()
    setShowForm(true)
  }

  function updateItem(index: number, partial: Partial<QuotationItemForm>) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...partial } : item)))
  }

  function onSelectProduct(index: number, productKey: string) {
    const product = products.find((entry) => entry.key === productKey)
    if (!product) {
      updateItem(index, {
        product_key: "",
        product_type: "",
        product_id: null,
      })
      return
    }

    updateItem(index, {
      product_key: product.key,
      product_type: product.product_type,
      product_id: product.product_id,
      price: String(product.sales_price),
      gst_percent: String(product.gst_percent),
    })
  }

  async function submitQuotation(event: FormEvent) {
    event.preventDefault()

    if (!inquiryId) {
      toast({ title: "Validation", description: "Please choose inquiry", variant: "destructive" })
      return
    }

    const sanitizedItems = items
      .filter((item) => item.product_type && item.product_id)
      .map((item) => ({
        product_type: item.product_type,
        product_id: item.product_id,
        quantity: parseNum(item.quantity) || 1,
        price: parseNum(item.price),
        discount_percent: parseNum(item.discount_percent),
        discount_amount: parseNum(item.discount_amount),
        gst_percent: parseNum(item.gst_percent),
      }))

    if (sanitizedItems.length === 0) {
      toast({ title: "Validation", description: "Please add at least one product", variant: "destructive" })
      return
    }

    try {
      const payload = {
        inquiry_id: parseNum(inquiryId),
        terms_conditions: termsConditions,
        attention,
        declaration,
        special_notes: specialNotes,
        items: sanitizedItems,
      }

      const isUpdate = Boolean(editingId)
      const endpoint = isUpdate ? `/api/quotations/${editingId}` : "/api/quotations"
      const response = await fetch(apiUrl(endpoint), {
        method: isUpdate ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.message || "Failed to save quotation")
      }

      const detail = data.quotation as QuotationDetail
      setSavedQuotation(detail)
      setEditingId(detail.id)

      toast({ title: "Success", description: isUpdate ? "Quotation updated" : "Quotation saved" })
      await fetchQuotations()
      setShowForm(false)
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save quotation",
        variant: "destructive",
      })
    }
  }

  async function editQuotation(id: number) {
    try {
      const response = await fetch(apiUrl(`/api/quotations/${id}`), { credentials: "include" })
      if (!response.ok) throw new Error("Failed to fetch quotation")

      const data = await response.json()
      const quotation = data.quotation as QuotationDetail

      setEditingId(quotation.id)
      setSavedQuotation(quotation)
      setInquiryId(String(quotation.inquiry_id))
      setTermsConditions(quotation.terms_conditions || "")
      setAttention(quotation.attention || "")
      setDeclaration(quotation.declaration || "")
      setSpecialNotes(quotation.special_notes || "")
      setShowForm(true)

      setItems(
        (quotation.items || []).map((item) => ({
          product_key: `${item.product_type}-${item.product_id}`,
          product_type: item.product_type,
          product_id: item.product_id,
          quantity: String(item.quantity),
          price: String(item.price),
          discount_percent: String(item.discount_percent),
          discount_amount: String(item.discount_amount),
          gst_percent: String(item.gst_percent),
        })),
      )
    } catch (error) {
      toast({ title: "Error", description: "Failed to load quotation", variant: "destructive" })
    }
  }

  async function deleteQuotation(id: number) {
    if (!confirm("Are you sure you want to delete this quotation?")) return

    try {
      const response = await fetch(apiUrl(`/api/quotations/${id}`), {
        method: "DELETE",
        credentials: "include",
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data?.message || "Failed to delete quotation")
      }

      toast({ title: "Success", description: "Quotation deleted" })
      await fetchQuotations()
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete quotation",
        variant: "destructive",
      })
    }
  }

  function printQuotation(id: number) {
    window.open(`/print/quotation/${id}`, "_blank", "noopener,noreferrer")
  }

  function previewAndDownloadPdf() {
    if (!savedQuotation) return

    const pdfBlob = createSimpleQuotationPdf(savedQuotation, summary)
    const objectUrl = URL.createObjectURL(pdfBlob)

    const a = document.createElement("a")
    a.href = objectUrl
    a.download = `${savedQuotation.quotation_number || "quotation"}.pdf`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)

    window.open(objectUrl, "_blank", "noopener,noreferrer")

    setTimeout(() => {
      URL.revokeObjectURL(objectUrl)
    }, 10000)
  }

  if (isLoading) {
    return (
      <DashboardLayout
        title="Sales"
        menuItems={menuItems}
        activeSection={activeSection}
        onSectionChange={handleSectionChange}
        loginId={user?.loginId || ""}
        onLogout={logout}
      >
        <div className="p-6">Loading...</div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout
      title="Sales"
      menuItems={menuItems}
      activeSection={activeSection}
      onSectionChange={handleSectionChange}
      loginId={user?.loginId || ""}
      onLogout={logout}
    >
      <div className="space-y-5">
        <div>
          <div>
            <h1 className="text-2xl font-semibold text-gray-800">Quotations</h1>
            <p className="text-sm text-gray-500">Create and manage machine quotations.</p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div />
          <div className="ml-auto flex items-center gap-2">
            {!showForm ? (
              <>
                <DateRangeFilter value={filters} onChange={setFilters} />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-10 w-10"
                  onClick={() => setFilters({ from_date: "", to_date: "" })}
                  aria-label="Reset date range"
                  title="Reset date range"
                >
                  ⟲
                </Button>
              </>
            ) : null}
            {showForm ? (
              <Button variant="outline" onClick={() => setShowForm(false)}>
                Back to List
              </Button>
            ) : null}
            <Button className="h-10 px-6 text-base" onClick={openCreateForm}>
              + New
            </Button>
            {showForm && savedQuotation ? <Button onClick={previewAndDownloadPdf}>Preview</Button> : null}
          </div>
        </div>

        {showForm && (
        <>
        <form onSubmit={submitQuotation} className="rounded-lg border border-gray-200 bg-white p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Company Name - Inquiry Number</Label>
              <select
                className="w-full border border-gray-300 rounded-md h-10 px-3"
                value={inquiryId}
                onChange={(e) => setInquiryId(e.target.value)}
                required
              >
                <option value="">Select inquiry</option>
                {inquiries.map((inquiry) => (
                  <option key={inquiry.id} value={inquiry.id}>
                    {(inquiry.company_name || "-") + " - " + inquiry.inquiry_number}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="rounded border border-gray-100 p-3 bg-gray-50 text-sm grid grid-cols-1 md:grid-cols-2 gap-2">
            <p><span className="font-medium">Contact:</span> {selectedInquiry?.authorized_person || "-"}</p>
            <p><span className="font-medium">Phone:</span> {selectedInquiry?.authorized_phone || "-"}</p>
            <p><span className="font-medium">Email:</span> {selectedInquiry?.email || "-"}</p>
            <p><span className="font-medium">Address:</span> {selectedInquiry?.address || "-"}</p>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="font-medium text-gray-800">Quotation Items</h3>
              <Button type="button" variant="outline" onClick={() => setItems((prev) => [...prev, emptyItem()])}>Add Item</Button>
            </div>

            <div className="overflow-x-auto rounded border border-gray-200">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-gray-700">
                  <tr>
                    <th className="px-2 py-2 text-left">Product</th>
                    <th className="px-2 py-2 text-left">Qty</th>
                    <th className="px-2 py-2 text-left">Price</th>
                    <th className="px-2 py-2 text-left">Disc %</th>
                    <th className="px-2 py-2 text-left">Disc Amt</th>
                    <th className="px-2 py-2 text-left">GST %</th>
                    <th className="px-2 py-2 text-left">Line Total</th>
                    <th className="px-2 py-2 text-left">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => {
                    const qty = Math.max(1, parseNum(item.quantity) || 1)
                    const price = parseNum(item.price)
                    const base = qty * price
                    const discPercent = parseNum(item.discount_percent)
                    const discAmount = discPercent > 0 ? (base * discPercent) / 100 : parseNum(item.discount_amount)
                    const taxable = Math.max(0, base - Math.min(base, discAmount))
                    const gstPercent = parseNum(item.gst_percent)
                    const total = taxable + (taxable * gstPercent) / 100

                    return (
                      <tr key={index} className="border-t">
                        <td className="px-2 py-2 min-w-[280px]">
                          <select
                            className="w-full border border-gray-300 rounded-md h-9 px-2"
                            value={item.product_key}
                            onChange={(e) => onSelectProduct(index, e.target.value)}
                          >
                            <option value="">Select product</option>
                            {products.map((product) => (
                              <option key={product.key} value={product.key}>{product.label}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-2"><Input value={item.quantity} onChange={(e) => updateItem(index, { quantity: e.target.value })} /></td>
                        <td className="px-2 py-2"><Input value={item.price} onChange={(e) => updateItem(index, { price: e.target.value })} /></td>
                        <td className="px-2 py-2"><Input value={item.discount_percent} onChange={(e) => updateItem(index, { discount_percent: e.target.value })} /></td>
                        <td className="px-2 py-2"><Input value={item.discount_amount} onChange={(e) => updateItem(index, { discount_amount: e.target.value })} /></td>
                        <td className="px-2 py-2"><Input value={item.gst_percent} onChange={(e) => updateItem(index, { gst_percent: e.target.value })} /></td>
                        <td className="px-2 py-2 font-medium">{round2(total).toFixed(2)}</td>
                        <td className="px-2 py-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setItems((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev))}
                          >
                            Remove
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Terms & Conditions</Label>
              <Textarea rows={3} value={termsConditions} onChange={(e) => setTermsConditions(e.target.value)} />
            </div>
            <div>
              <Label>Attention</Label>
              <Textarea rows={3} value={attention} onChange={(e) => setAttention(e.target.value)} />
            </div>
            <div>
              <Label>Declaration</Label>
              <Textarea rows={3} value={declaration} onChange={(e) => setDeclaration(e.target.value)} />
            </div>
            <div>
              <Label>Special Notes</Label>
              <Textarea rows={3} value={specialNotes} onChange={(e) => setSpecialNotes(e.target.value)} />
            </div>
          </div>

          <div className="rounded border border-gray-200 bg-gray-50 p-4 grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
            <div><span className="font-medium">Subtotal:</span> {summary.subtotal.toFixed(2)}</div>
            <div><span className="font-medium">Discount:</span> {summary.totalDiscount.toFixed(2)}</div>
            <div><span className="font-medium">GST:</span> {summary.totalGst.toFixed(2)}</div>
            <div><span className="font-medium">Total:</span> {summary.totalAmount.toFixed(2)}</div>
          </div>

          <div className="flex justify-end">
            <Button type="submit">{editingId ? "Update Quotation" : "Save Quotation"}</Button>
          </div>
        </form>

        {editingId && (
          <FollowUpSection entityType="quotation" entityId={editingId} />
        )}
        </>
        )}

        {!showForm && (
        <div className="rounded-lg border border-gray-200 bg-white overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-700">
              <tr>
                <th className="px-3 py-2 text-left">Quotation No</th>
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-left">Inquiry No</th>
                <th className="px-3 py-2 text-left">Company Name</th>
                <th className="px-3 py-2 text-left">Attention</th>
                <th className="px-3 py-2 text-left">Subtotal</th>
                <th className="px-3 py-2 text-left">Discount</th>
                <th className="px-3 py-2 text-left">Total</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredQuotations.length === 0 ? (
                <tr>
                  <td className="px-3 py-3" colSpan={10}>No quotations found.</td>
                </tr>
              ) : (
                filteredQuotations.map((quotation) => (
                  <tr key={quotation.id} className="border-t">
                    <td className="px-3 py-2 font-medium">{quotation.quotation_number}</td>
                    <td className="px-3 py-2">{new Date(quotation.created_at).toLocaleDateString()}</td>
                    <td className="px-3 py-2">{quotation.inquiry_number}</td>
                    <td className="px-3 py-2">{quotation.company_name || "-"}</td>
                    <td className="px-3 py-2">{quotation.authorized_person || "-"}</td>
                    <td className="px-3 py-2">{round2(Number(quotation.subtotal || 0)).toFixed(2)}</td>
                    <td className="px-3 py-2">{round2(Number(quotation.total_discount || 0)).toFixed(2)}</td>
                    <td className="px-3 py-2">{round2(Number(quotation.total_amount || 0)).toFixed(2)}</td>
                    <td className="px-3 py-2">{quotation.status || "draft"}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <Button size="icon" variant="ghost" className="h-8 w-8" title="Print" onClick={() => printQuotation(quotation.id)}>
                          <Printer className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8" title="Edit" onClick={() => editQuotation(quotation.id)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600 hover:text-red-700" title="Delete" onClick={() => deleteQuotation(quotation.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        )}
      </div>
    </DashboardLayout>
  )
}
