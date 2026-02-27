"use client"

import { useEffect, useMemo, useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { DateRangeFilter } from "@/components/ui/date-range-filter"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { apiUrl } from "@/lib/api"

type QuotationOption = {
  id: number
  quotation_number: string
  inquiry_number: string
  company_name: string | null
}

type Item = {
  product_type: "machine" | "spare"
  product_id: number
  product_name?: string | null
  quantity: number
  price: number
  discount_percent: number
  discount_amount: number
  gst_percent: number
  total: number
}

type Performa = {
  id: number
  performa_number: string
  created_at?: string | null
  quotation_id: number | null
  quotation_number?: string | null
  inquiry_id: number
  inquiry_number: string
  company_name: string | null
  attention: string | null
  subtotal: number
  total_discount: number
  total_gst: number
  total_amount: number
  status: string | null
  terms_conditions: string | null
  declaration: string | null
  special_notes: string | null
  items: Item[]
}

type DocumentDefaults = {
  terms_conditions: string
  attention: string
  declaration: string
  special_notes: string
}

export default function PerformasPage() {
  const router = useRouter()
  const { user, isLoading, logout } = useAuth()
  const { toast } = useToast()

  const [activeSection, setActiveSection] = useState("performas")
  const menuItems = [
    { id: "inquiries", label: "Customer Inquiries" },
    { id: "quotations", label: "Quotations" },
    { id: "performas", label: "Performas" },
    { id: "work-orders", label: "Work Orders" },
    { id: "products", label: "Products" },
  ]

  function handleSectionChange(section: string) {
    const routeMap: Record<string, string> = {
      inquiries: "/dashboard/inquiries",
      quotations: "/dashboard/quotations",
      performas: "/dashboard/performas",
      "work-orders": "/dashboard/work-orders",
      products: "/dashboard/products",
    }

    const target = routeMap[section]
    if (target) {
      router.push(target)
      return
    }

    setActiveSection("performas")
  }

  const [quotations, setQuotations] = useState<QuotationOption[]>([])
  const [performas, setPerformas] = useState<Performa[]>([])
  const [showForm, setShowForm] = useState(false)
  const [filters, setFilters] = useState({ from_date: "", to_date: "" })
  const [selectedQuotationId, setSelectedQuotationId] = useState("")
  const [editingId, setEditingId] = useState<number | null>(null)

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

  const [items, setItems] = useState<Item[]>([])
  const [totals, setTotals] = useState({ subtotal: 0, total_discount: 0, total_gst: 0, total_amount: 0 })

  const selectedQuotation = useMemo(
    () => quotations.find((q) => String(q.id) === selectedQuotationId) || null,
    [quotations, selectedQuotationId],
  )

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

  async function fetchQuotations() {
    const response = await fetch(apiUrl("/api/quotations"), { credentials: "include" })
    if (!response.ok) throw new Error("Failed to fetch quotations")
    const data = await response.json()
    setQuotations(data.quotations || [])
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
      await Promise.all([fetchQuotations(), fetchPerformas(), fetchDocumentDefaults(true)])
    } catch {
      toast({ title: "Error", description: "Failed to load performa module data", variant: "destructive" })
    }
  }

  useEffect(() => {
    loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function createFromQuotation() {
    if (!selectedQuotationId) {
      toast({ title: "Validation", description: "Select quotation first", variant: "destructive" })
      return
    }

    try {
      const response = await fetch(apiUrl(`/api/performas/from-quotation/${selectedQuotationId}`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          terms_conditions: termsConditions,
          attention,
          declaration,
          special_notes: specialNotes,
        }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data?.message || "Failed to create performa")

      const performa = data.performa as Performa
      setEditingId(performa.id)
      setItems(performa.items || [])
      setTotals(data.totals || {
        subtotal: performa.subtotal || 0,
        total_discount: performa.total_discount || 0,
        total_gst: performa.total_gst || 0,
        total_amount: performa.total_amount || 0,
      })

      toast({ title: "Success", description: "Performa created from quotation" })
      await fetchPerformas()
      setShowForm(false)
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create performa",
        variant: "destructive",
      })
    }
  }

  async function loadPerforma(id: number) {
    try {
      const response = await fetch(apiUrl(`/api/performas/${id}`), { credentials: "include" })
      if (!response.ok) throw new Error("Failed to fetch performa")
      const data = await response.json()
      const performa = data.performa as Performa

      setEditingId(performa.id)
      setSelectedQuotationId(performa.quotation_id ? String(performa.quotation_id) : "")
      setTermsConditions(performa.terms_conditions || "")
      setAttention(performa.attention || "")
      setDeclaration(performa.declaration || "")
      setSpecialNotes(performa.special_notes || "")
      setItems(performa.items || [])
      setShowForm(true)
      setTotals({
        subtotal: Number(performa.subtotal || 0),
        total_discount: Number(performa.total_discount || 0),
        total_gst: Number(performa.total_gst || 0),
        total_amount: Number(performa.total_amount || 0),
      })
    } catch {
      toast({ title: "Error", description: "Failed to load performa", variant: "destructive" })
    }
  }

  async function updatePerforma(event: FormEvent) {
    event.preventDefault()

    if (!editingId) {
      toast({ title: "Validation", description: "Create or open a performa first", variant: "destructive" })
      return
    }

    try {
      const response = await fetch(apiUrl(`/api/performas/${editingId}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          terms_conditions: termsConditions,
          attention,
          declaration,
          special_notes: specialNotes,
        }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data?.message || "Failed to update performa")

      const performa = data.performa as Performa
      setItems(performa.items || items)
      setTotals(data.totals || totals)

      toast({ title: "Success", description: "Performa updated" })
      await fetchPerformas()
      setShowForm(false)
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update performa",
        variant: "destructive",
      })
    }
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
            <h1 className="text-2xl font-semibold text-gray-800">Performa Invoice</h1>
            <p className="text-sm text-gray-500">Structure mirrors quotation and supports create-from-quotation.</p>
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
            <Button
              className="h-10 px-6 text-base"
              onClick={() => {
                setEditingId(null)
                setSelectedQuotationId("")
                setTermsConditions(defaultSettings.terms_conditions)
                setAttention(defaultSettings.attention)
                setDeclaration(defaultSettings.declaration)
                setSpecialNotes(defaultSettings.special_notes)
                setItems([])
                setTotals({ subtotal: 0, total_discount: 0, total_gst: 0, total_amount: 0 })
                setShowForm(true)
              }}
            >
              + New
            </Button>
          </div>
        </div>

        {showForm && (
        <form onSubmit={updatePerforma} className="rounded-lg border border-gray-200 bg-white p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Quotation</Label>
              <select
                className="w-full border border-gray-300 rounded-md h-10 px-3"
                value={selectedQuotationId}
                onChange={(e) => setSelectedQuotationId(e.target.value)}
              >
                <option value="">Select quotation</option>
                {quotations.map((quotation) => (
                  <option key={quotation.id} value={quotation.id}>
                    {quotation.quotation_number} - {quotation.company_name || "-"} ({quotation.inquiry_number})
                  </option>
                ))}
              </select>
              {selectedQuotation && (
                <p className="text-xs text-gray-500 mt-1">Selected: {selectedQuotation.company_name || "-"}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Terms & Conditions</Label>
              <Textarea value={termsConditions} onChange={(e) => setTermsConditions(e.target.value)} rows={3} />
            </div>
            <div>
              <Label>Attention</Label>
              <Textarea value={attention} onChange={(e) => setAttention(e.target.value)} rows={3} />
            </div>
            <div>
              <Label>Declaration</Label>
              <Textarea value={declaration} onChange={(e) => setDeclaration(e.target.value)} rows={3} />
            </div>
            <div>
              <Label>Special Notes</Label>
              <Textarea value={specialNotes} onChange={(e) => setSpecialNotes(e.target.value)} rows={3} />
            </div>
          </div>

          <div className="rounded border border-gray-200 bg-gray-50 p-4 text-sm grid grid-cols-1 md:grid-cols-4 gap-2">
            <div><span className="font-medium">Subtotal:</span> {Number(totals.subtotal || 0).toFixed(2)}</div>
            <div><span className="font-medium">Discount:</span> {Number(totals.total_discount || 0).toFixed(2)}</div>
            <div><span className="font-medium">GST:</span> {Number(totals.total_gst || 0).toFixed(2)}</div>
            <div><span className="font-medium">Total:</span> {Number(totals.total_amount || 0).toFixed(2)}</div>
          </div>

          <div className="rounded border border-gray-200 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-700">
                <tr>
                  <th className="px-3 py-2 text-left">Type</th>
                  <th className="px-3 py-2 text-left">Product</th>
                  <th className="px-3 py-2 text-left">Qty</th>
                  <th className="px-3 py-2 text-left">Price</th>
                  <th className="px-3 py-2 text-left">Disc</th>
                  <th className="px-3 py-2 text-left">GST %</th>
                  <th className="px-3 py-2 text-left">Total</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td className="px-3 py-3" colSpan={7}>No items loaded.</td>
                  </tr>
                ) : (
                  items.map((item, index) => (
                    <tr key={index} className="border-t">
                      <td className="px-3 py-2">{item.product_type}</td>
                      <td className="px-3 py-2">{item.product_name || `#${item.product_id}`}</td>
                      <td className="px-3 py-2">{item.quantity}</td>
                      <td className="px-3 py-2">{item.price}</td>
                      <td className="px-3 py-2">{item.discount_amount}</td>
                      <td className="px-3 py-2">{item.gst_percent}</td>
                      <td className="px-3 py-2">{item.total}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end">
            {editingId ? (
              <Button type="submit">Update Performa</Button>
            ) : (
              <Button type="button" onClick={createFromQuotation}>Save Performa</Button>
            )}
          </div>
        </form>
        )}

        {!showForm && (
        <div className="rounded-lg border border-gray-200 bg-white overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-700">
              <tr>
                <th className="px-3 py-2 text-left">Performa No</th>
                <th className="px-3 py-2 text-left">Quotation</th>
                <th className="px-3 py-2 text-left">Inquiry</th>
                <th className="px-3 py-2 text-left">Company</th>
                <th className="px-3 py-2 text-left">Total</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Action</th>
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
                    <td className="px-3 py-2">{performa.quotation_number || "-"}</td>
                    <td className="px-3 py-2">{performa.inquiry_number}</td>
                    <td className="px-3 py-2">{performa.company_name || "-"}</td>
                    <td className="px-3 py-2">{Number(performa.total_amount || 0).toFixed(2)}</td>
                    <td className="px-3 py-2">{performa.status || "draft"}</td>
                    <td className="px-3 py-2">
                      <Button size="sm" variant="outline" onClick={() => loadPerforma(performa.id)}>Edit</Button>
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
