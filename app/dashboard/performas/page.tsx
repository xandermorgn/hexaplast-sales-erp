"use client"

import { useEffect, useMemo, useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { Printer, Pencil, Trash2, FileOutput } from "lucide-react"
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
  category_name: string
  sub_category: string
  product_name: string
  model_number: string
  hsn_sac_code: string
  unit: string
}

type PerformaItemForm = {
  product_key: string
  product_type: "machine" | "spare" | ""
  product_id: number | null
  category_name: string
  sub_category: string
  product_name: string
  model_number: string
  hsn_sac_code: string
  unit: string
  quantity: string
  price: string
  discount_percent: string
  discount_amount: string
  gst_percent: string
}

type PerformaRow = {
  id: number
  performa_number: string
  created_at?: string | null
  quotation_id: number | null
  quotation_number?: string | null
  inquiry_id: number
  inquiry_number: string
  company_name: string | null
  subtotal: number
  total_discount: number
  total_gst: number
  total_amount: number
  status: string | null
}

type PerformaDetail = {
  id: number
  performa_number: string
  quotation_id: number | null
  inquiry_id: number
  inquiry_number: string
  company_name: string | null
  authorized_person: string | null
  authorized_phone: string | null
  email: string | null
  address: string | null
  subtotal: number
  total_discount: number
  total_gst: number
  total_amount: number
  status: string | null
  terms_conditions: string | null
  attention: string | null
  declaration: string | null
  special_notes: string | null
  items: {
    product_type: "machine" | "spare"
    product_id: number
    category_name?: string | null
    sub_category?: string | null
    product_name?: string | null
    model_number?: string | null
    hsn_sac_code?: string | null
    unit?: string | null
    quantity: number
    price: number
    discount_percent: number
    discount_amount: number
    gst_percent: number
    total: number
  }[]
}

type DocumentDefaults = {
  terms_conditions: string
  attention: string
  declaration: string
  special_notes: string
}

const emptyItem = (): PerformaItemForm => ({
  product_key: "",
  product_type: "",
  product_id: null,
  category_name: "",
  sub_category: "",
  product_name: "",
  model_number: "",
  hsn_sac_code: "",
  unit: "",
  quantity: "1",
  price: "0",
  discount_percent: "0",
  discount_amount: "0",
  gst_percent: "0",
})

const round2 = (value: number) => Math.round(value * 100) / 100

export default function PerformasPage() {
  const router = useRouter()
  const { user, isLoading, logout } = useAuth()
  const { toast } = useToast()
  const { categoryMap } = useCategories()

  const [activeSection, setActiveSection] = useState("performas")
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

    setActiveSection("performas")
  }

  const [inquiries, setInquiries] = useState<Inquiry[]>([])
  const [products, setProducts] = useState<ProductOption[]>([])
  const [performas, setPerformas] = useState<PerformaRow[]>([])
  const [showForm, setShowForm] = useState(false)
  const [filters, setFilters] = useState({ from_date: "", to_date: "" })
  const [formError, setFormError] = useState("")

  const [editingId, setEditingId] = useState<number | null>(null)
  const [inquiryId, setInquiryId] = useState("")
  const [items, setItems] = useState<PerformaItemForm[]>([emptyItem()])

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
    () => inquiries.find((inq) => String(inq.id) === inquiryId) || null,
    [inquiries, inquiryId],
  )

  const summary = useMemo(() => {
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

  const filteredPerformas = useMemo(() => {
    return performas.filter((performa) => {
      if (!performa.created_at) return true

      const created = new Date(performa.created_at)
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
  }, [performas, filters.from_date, filters.to_date])

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
      product_type: "machine" as const,
      product_id: product.id,
      label: `${categoryMap.get(Number(product.category_id)) || product.category_name || "Uncategorized"} — ${product.product_name || "-"} (${product.product_code || "-"})`,
      sales_price: Number(product.sales_price) || 0,
      gst_percent: Number(product.gst_percent) || 0,
      category_name: categoryMap.get(Number(product.category_id)) || product.category_name || "",
      sub_category: categoryMap.get(Number(product.category_id)) || product.category_name || "",
      product_name: product.product_name || "",
      model_number: product.model_number || "",
      hsn_sac_code: product.hsn_sac_code || "",
      unit: product.unit || "Nos",
    }))

    const spareOptions: ProductOption[] = (sparesData.products || []).map((product: any) => ({
      key: `spare-${product.id}`,
      product_type: "spare" as const,
      product_id: product.id,
      label: `${categoryMap.get(Number(product.category_id)) || product.category_name || "Uncategorized"} — ${product.product_name || "-"} (${product.product_code || "-"})`,
      sales_price: Number(product.sales_price) || 0,
      gst_percent: Number(product.gst_percent) || 0,
      category_name: categoryMap.get(Number(product.category_id)) || product.category_name || "",
      sub_category: categoryMap.get(Number(product.category_id)) || product.category_name || "",
      product_name: product.product_name || "",
      model_number: product.model_number || "",
      hsn_sac_code: product.hsn_sac_code || "",
      unit: product.unit || "Nos",
    }))

    setProducts([...machineOptions, ...spareOptions])
  }

  async function fetchPerformas() {
    const response = await fetch(apiUrl("/api/performas"), { credentials: "include" })
    if (!response.ok) throw new Error("Failed to fetch performas")
    const data = await response.json()
    setPerformas(data.performas || [])
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
      await Promise.all([fetchInquiries(), fetchProducts(), fetchPerformas(), fetchDocumentDefaults(true)])
    } catch {
      toast({ title: "Error", description: "Failed to load performa module data", variant: "destructive" })
    }
  }

  useEffect(() => {
    loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function resetForm() {
    setEditingId(null)
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

  function updateItem(index: number, partial: Partial<PerformaItemForm>) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...partial } : item)))
  }

  function onSelectProduct(index: number, productKey: string) {
    const product = products.find((entry) => entry.key === productKey)
    if (!product) {
      updateItem(index, { product_key: "", product_type: "", product_id: null })
      return
    }

    updateItem(index, {
      product_key: product.key,
      product_type: product.product_type,
      product_id: product.product_id,
      price: String(product.sales_price),
      gst_percent: String(product.gst_percent),
      category_name: product.category_name,
      sub_category: product.sub_category,
      product_name: product.product_name,
      model_number: product.model_number,
      hsn_sac_code: product.hsn_sac_code,
      unit: product.unit,
    })
  }

  async function submitPerforma(event: FormEvent) {
    event.preventDefault()
    setFormError("")

    if (!inquiryId) {
      setFormError("Please choose an inquiry before saving.")
      return
    }

    const sanitizedItems = items
      .filter((item) => item.product_type && item.product_id)
      .map((item) => ({
        product_type: item.product_type,
        product_id: item.product_id,
        category_name: item.category_name,
        sub_category: item.sub_category,
        product_name: item.product_name,
        model_number: item.model_number,
        hsn_sac_code: item.hsn_sac_code,
        unit: item.unit,
        quantity: parseNum(item.quantity) || 1,
        price: parseNum(item.price),
        discount_percent: parseNum(item.discount_percent),
        discount_amount: parseNum(item.discount_amount),
        gst_percent: parseNum(item.gst_percent),
      }))

    if (sanitizedItems.length === 0) {
      setFormError("Please add at least one product.")
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
      const endpoint = isUpdate ? `/api/performas/${editingId}` : "/api/performas"
      const response = await fetch(apiUrl(endpoint), {
        method: isUpdate ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      })

      const data = await response.json()
      if (!response.ok) {
        setFormError(data?.message || "Failed to save performa")
        return
      }

      toast({ title: "Success", description: isUpdate ? "Performa updated" : "Performa saved" })
      await fetchPerformas()
      setShowForm(false)
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Failed to save performa")
    }
  }

  async function editPerforma(id: number) {
    try {
      const response = await fetch(apiUrl(`/api/performas/${id}`), { credentials: "include" })
      if (!response.ok) throw new Error("Failed to fetch performa")

      const data = await response.json()
      const performa = data.performa as PerformaDetail

      setEditingId(performa.id)
      setInquiryId(String(performa.inquiry_id))
      setTermsConditions(performa.terms_conditions || "")
      setAttention(performa.attention || "")
      setDeclaration(performa.declaration || "")
      setSpecialNotes(performa.special_notes || "")
      setShowForm(true)

      setItems(
        (performa.items || []).map((item) => ({
          product_key: `${item.product_type}-${item.product_id}`,
          product_type: item.product_type,
          product_id: item.product_id,
          category_name: item.category_name || "",
          sub_category: item.sub_category || "",
          product_name: item.product_name || "",
          model_number: item.model_number || "",
          hsn_sac_code: item.hsn_sac_code || "",
          unit: item.unit || "",
          quantity: String(item.quantity),
          price: String(item.price),
          discount_percent: String(item.discount_percent),
          discount_amount: String(item.discount_amount),
          gst_percent: String(item.gst_percent),
        })),
      )
    } catch {
      toast({ title: "Error", description: "Failed to load performa", variant: "destructive" })
    }
  }

  async function deletePerforma(id: number) {
    if (!confirm("Are you sure you want to delete this performa?")) return

    try {
      const response = await fetch(apiUrl(`/api/performas/${id}`), {
        method: "DELETE",
        credentials: "include",
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data?.message || "Failed to delete performa")
      }

      toast({ title: "Success", description: "Performa deleted" })
      await fetchPerformas()
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete performa",
        variant: "destructive",
      })
    }
  }

  async function createWorkOrderFromPerforma(performaId: number) {
    try {
      const response = await fetch(apiUrl(`/api/work-orders/from-performa/${performaId}`), {
        method: "POST",
        credentials: "include",
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data?.message || "Failed to create work order")

      toast({ title: "Success", description: "Work order created from performa" })
      router.push("/dashboard/work-orders")
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create work order",
        variant: "destructive",
      })
    }
  }

  function printPerforma(id: number) {
    window.open(`/print/proforma/${id}`, "_blank", "noopener,noreferrer")
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
          <h1 className="text-2xl font-semibold text-gray-800">Performa Invoice</h1>
          <p className="text-sm text-gray-500">Create and manage performa invoices from customer inquiries.</p>
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
          </div>
        </div>

        {showForm && (
        <>
        <form onSubmit={submitPerforma} className="rounded-lg border border-gray-200 bg-white p-5 space-y-4">
          {formError && (
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {formError}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Customer Inquiry</Label>
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
              <h3 className="font-medium text-gray-800">Performa Items</h3>
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
            <Button type="submit">{editingId ? "Update Performa" : "Save Performa"}</Button>
          </div>
        </form>

        {editingId && (
          <FollowUpSection entityType="performa" entityId={editingId} />
        )}
        </>
        )}

        {!showForm && (
        <div className="rounded-lg border border-gray-200 bg-white overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-700">
              <tr>
                <th className="px-3 py-2 text-left">Performa No</th>
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-left">Inquiry</th>
                <th className="px-3 py-2 text-left">Company</th>
                <th className="px-3 py-2 text-left">Total</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPerformas.length === 0 ? (
                <tr>
                  <td className="px-3 py-3" colSpan={7}>No performa invoices found.</td>
                </tr>
              ) : (
                filteredPerformas.map((performa) => (
                  <tr key={performa.id} className="border-t">
                    <td className="px-3 py-2 font-medium">{performa.performa_number}</td>
                    <td className="px-3 py-2">{performa.created_at ? new Date(performa.created_at).toLocaleDateString() : "-"}</td>
                    <td className="px-3 py-2">{performa.inquiry_number}</td>
                    <td className="px-3 py-2">{performa.company_name || "-"}</td>
                    <td className="px-3 py-2">{round2(Number(performa.total_amount || 0)).toFixed(2)}</td>
                    <td className="px-3 py-2">{performa.status || "draft"}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <Button size="icon" variant="ghost" className="h-8 w-8" title="Print" onClick={() => printPerforma(performa.id)}>
                          <Printer className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8" title="Edit" onClick={() => editPerforma(performa.id)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600 hover:text-red-700" title="Delete" onClick={() => deletePerforma(performa.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-blue-600 hover:text-blue-700" title="Create Work Order" onClick={() => createWorkOrderFromPerforma(performa.id)}>
                          <FileOutput className="h-4 w-4" />
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
