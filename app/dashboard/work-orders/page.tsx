"use client"

import { useEffect, useMemo, useState, useCallback, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { Printer, Pencil, Trash2, Search } from "lucide-react"
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
import { useSilentRefresh } from "@/hooks/use-silent-refresh"
import { parseNum } from "@/lib/parse-number"
import { FollowUpSection } from "@/components/follow-up-section"
import { MultiSelectFilter } from "@/components/ui/multi-select-filter"
import { getSalesMenuItems, salesRouteMap } from "@/lib/menu"

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

type WOItemForm = {
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

type WorkOrderRow = {
  id: number
  work_order_number: string
  created_at?: string | null
  performa_id: number | null
  performa_number: string | null
  inquiry_id: number | null
  inquiry_number: string | null
  company_name: string | null
  subtotal: number
  total_discount: number
  total_gst: number
  total_amount: number
  status: string | null
  sent_to_production_at?: string | null
}

type WorkOrderDetail = {
  id: number
  work_order_number: string
  performa_id: number | null
  quotation_id: number | null
  inquiry_id: number | null
  inquiry_number: string | null
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
  work_order_date: string | null
  calibration_nabl: string | null
  packing: string | null
  delivery_date: string | null
  remarks: string | null
  apply_gst: number
  extra_charge_gst_percent: number
  extra_charge_1: number
  extra_charge_2: number
  advance_display: number
  advance_date: string | null
  advance_description: string | null
  advance_amount: number
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

const emptyItem = (): WOItemForm => ({
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
  gst_percent: "18",
})

const round2 = (v: number) => Math.round(v * 100) / 100

export default function WorkOrdersPage() {
  const router = useRouter()
  const { user, isLoading, logout } = useAuth()
  const { toast } = useToast()
  const { categoryMap } = useCategories()

  const [activeSection, setActiveSection] = useState("work-orders")
  const menuItems = getSalesMenuItems(user)

  function handleSectionChange(section: string) {
    const target = salesRouteMap[section]
    if (target) { router.push(target); return }
    setActiveSection("work-orders")
  }

  const [inquiries, setInquiries] = useState<Inquiry[]>([])
  const [products, setProducts] = useState<ProductOption[]>([])
  const [workOrders, setWorkOrders] = useState<WorkOrderRow[]>([])
  const [showForm, setShowForm] = useState(false)
  const [filters, setFilters] = useState({ from_date: "", to_date: "" })
  const [formError, setFormError] = useState("")

  const [editingId, setEditingId] = useState<number | null>(null)
  const [inquiryId, setInquiryId] = useState("")
  const [items, setItems] = useState<WOItemForm[]>([emptyItem()])

  // Extra detail fields
  const [workOrderDate, setWorkOrderDate] = useState("")
  const [calibrationNabl, setCalibrationNabl] = useState("NO")
  const [packing, setPacking] = useState("")
  const [deliveryDate, setDeliveryDate] = useState("")
  const [remarks, setRemarks] = useState("")

  // GST & Extra Charges
  const [applyGst, setApplyGst] = useState(true)
  const [extraChargeGstPercent, setExtraChargeGstPercent] = useState("0")
  const [extraCharge1, setExtraCharge1] = useState("0")
  const [extraCharge2, setExtraCharge2] = useState("0")

  // Advance Payment
  const [advanceDisplay, setAdvanceDisplay] = useState(false)
  const [advanceDate, setAdvanceDate] = useState("")
  const [advanceDescription, setAdvanceDescription] = useState("")
  const [advanceAmount, setAdvanceAmount] = useState("0")
  const [currency, setCurrency] = useState<string>("INR")
  const [pendingFollowUps, setPendingFollowUps] = useState<{ note: string; reminder_date: string }[]>([])
  const [subcategories, setSubcategories] = useState<{ id: number; name: string; products: { product_id: number; product_type: string; sales_price: number | null; gst_percent: number | null }[] }[]>([])

  // List filters
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string[]>([])

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
      const gstAmount = applyGst ? (taxable * gstPercent) / 100 : 0

      subtotal += base
      totalDiscount += discAmount
      totalGst += gstAmount
    }

    // Include extra charges in total
    const ec1 = parseNum(extraCharge1)
    const ec2 = parseNum(extraCharge2)
    const ecGstPct = parseNum(extraChargeGstPercent)
    const extraChargesSubtotal = ec1 + ec2
    const extraChargesGst = applyGst ? (extraChargesSubtotal * ecGstPct) / 100 : 0

    return {
      subtotal: round2(subtotal),
      totalDiscount: round2(totalDiscount),
      totalGst: round2(totalGst + extraChargesGst),
      extraCharges: round2(extraChargesSubtotal),
      totalAmount: round2(subtotal - totalDiscount + totalGst + extraChargesSubtotal + extraChargesGst),
    }
  }, [items, applyGst, extraCharge1, extraCharge2, extraChargeGstPercent])

  const filteredWorkOrders = useMemo(() => {
    return workOrders.filter((wo) => {
      if (wo.created_at) {
        const created = new Date(wo.created_at)
        if (!Number.isNaN(created.getTime())) {
          if (filters.from_date && created < new Date(`${filters.from_date}T00:00:00`)) return false
          if (filters.to_date && created > new Date(`${filters.to_date}T23:59:59`)) return false
        }
      }
      if (statusFilter.length > 0 && !statusFilter.includes(wo.status || "generated")) return false
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const match =
          (wo.work_order_number || "").toLowerCase().includes(q) ||
          (wo.company_name || "").toLowerCase().includes(q) ||
          (wo.inquiry_number || "").toLowerCase().includes(q)
        if (!match) return false
      }
      return true
    })
  }, [workOrders, filters.from_date, filters.to_date, statusFilter, searchQuery])

  const allStatuses = useMemo(() => {
    const s = new Set(workOrders.map((wo) => wo.status || "generated"))
    return Array.from(s).sort()
  }, [workOrders])

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

    if (!machinesRes.ok || !sparesRes.ok) throw new Error("Failed to fetch products")

    const machinesData = await machinesRes.json()
    const sparesData = await sparesRes.json()

    const machineOptions: ProductOption[] = (machinesData.products || []).map((p: any) => ({
      key: `machine-${p.id}`,
      product_type: "machine" as const,
      product_id: p.id,
      label: `${categoryMap.get(Number(p.category_id)) || p.category_name || "Uncategorized"} — ${p.product_name || "-"} (${p.product_code || "-"})`,
      sales_price: Number(p.sales_price) || 0,
      gst_percent: Number(p.gst_percent) || 0,
      category_name: categoryMap.get(Number(p.category_id)) || p.category_name || "",
      sub_category: categoryMap.get(Number(p.category_id)) || p.category_name || "",
      product_name: p.product_name || "",
      model_number: p.model_number || "",
      hsn_sac_code: p.hsn_sac_code || "",
      unit: p.unit || "Nos",
    }))

    const spareOptions: ProductOption[] = (sparesData.products || []).map((p: any) => ({
      key: `spare-${p.id}`,
      product_type: "spare" as const,
      product_id: p.id,
      label: `${categoryMap.get(Number(p.category_id)) || p.category_name || "Uncategorized"} — ${p.product_name || "-"} (${p.product_code || "-"})`,
      sales_price: Number(p.sales_price) || 0,
      gst_percent: Number(p.gst_percent) || 0,
      category_name: categoryMap.get(Number(p.category_id)) || p.category_name || "",
      sub_category: categoryMap.get(Number(p.category_id)) || p.category_name || "",
      product_name: p.product_name || "",
      model_number: p.model_number || "",
      hsn_sac_code: p.hsn_sac_code || "",
      unit: p.unit || "Nos",
    }))

    setProducts([...machineOptions, ...spareOptions])
  }

  async function fetchWorkOrders() {
    const response = await fetch(apiUrl("/api/work-orders"), { credentials: "include" })
    if (!response.ok) throw new Error("Failed to fetch work orders")
    const data = await response.json()
    setWorkOrders(data.work_orders || [])
  }

  async function fetchSubcategories() {
    try {
      const res = await fetch(apiUrl("/api/products/subcategories"), { credentials: "include" })
      if (!res.ok) return
      const data = await res.json()
      const subs: typeof subcategories = []
      for (const sc of (data.subcategories || [])) {
        try {
          const detRes = await fetch(apiUrl(`/api/products/subcategories/${sc.id}`), { credentials: "include" })
          if (detRes.ok) {
            const det = await detRes.json()
            subs.push({ id: sc.id, name: sc.name, products: det.products || [] })
          }
        } catch { /* ignore */ }
      }
      setSubcategories(subs)
    } catch { /* ignore */ }
  }

  function onSelectSubcategory(subcatId: number) {
    const sc = subcategories.find((s) => s.id === subcatId)
    if (!sc || !sc.products.length) return
    const newItems: WOItemForm[] = sc.products.map((p) => {
      const prodOpt = products.find((o) => o.product_id === p.product_id && o.product_type === p.product_type)
      return {
        product_key: `${p.product_type}-${p.product_id}`,
        product_type: p.product_type as "machine" | "spare",
        product_id: p.product_id,
        category_name: prodOpt?.category_name || "",
        sub_category: prodOpt?.sub_category || "",
        product_name: prodOpt?.product_name || "",
        model_number: prodOpt?.model_number || "",
        hsn_sac_code: prodOpt?.hsn_sac_code || "",
        unit: prodOpt?.unit || "Nos",
        quantity: "1",
        price: String(p.sales_price || prodOpt?.sales_price || 0),
        discount_percent: "0",
        discount_amount: "0",
        gst_percent: String(p.gst_percent || prodOpt?.gst_percent || 0),
      }
    })
    setItems((prev) => {
      const nonEmpty = prev.filter((it) => it.product_id)
      return [...nonEmpty, ...newItems]
    })
  }

  async function loadAll() {
    try {
      await Promise.all([fetchInquiries(), fetchProducts(), fetchWorkOrders(), fetchSubcategories()])
    } catch {
      toast({ title: "Error", description: "Failed to load work order module data", variant: "destructive" })
    }
  }

  useEffect(() => {
    loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Silent background refresh every 30s
  const silentRefresh = useCallback(async () => {
    await Promise.all([fetchInquiries(), fetchWorkOrders()])
  }, [])
  useSilentRefresh(silentRefresh, 30000)

  function resetForm() {
    setEditingId(null)
    setInquiryId("")
    setItems([emptyItem()])
    setWorkOrderDate("")
    setCalibrationNabl("NO")
    setPacking("")
    setDeliveryDate("")
    setRemarks("")
    setApplyGst(true)
    setExtraChargeGstPercent("0")
    setExtraCharge1("0")
    setExtraCharge2("0")
    setAdvanceDisplay(false)
    setAdvanceDate("")
    setAdvanceDescription("")
    setAdvanceAmount("0")
    setCurrency("INR")
    setPendingFollowUps([])
  }

  function openCreateForm() {
    resetForm()
    // Auto-set work order date to today
    const today = new Date().toISOString().split("T")[0]
    setWorkOrderDate(today)
    setShowForm(true)
  }

  function updateItem(index: number, partial: Partial<WOItemForm>) {
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

  async function submitWorkOrder(event: FormEvent) {
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
        items: sanitizedItems,
        work_order_date: workOrderDate || null,
        calibration_nabl: calibrationNabl || null,
        packing: packing || null,
        delivery_date: deliveryDate || null,
        remarks: remarks || null,
        apply_gst: applyGst,
        extra_charge_gst_percent: parseNum(extraChargeGstPercent),
        extra_charge_1: parseNum(extraCharge1),
        extra_charge_2: parseNum(extraCharge2),
        advance_display: advanceDisplay,
        advance_date: advanceDate || null,
        advance_description: advanceDescription || null,
        advance_amount: parseNum(advanceAmount),
        currency,
      }

      const isUpdate = Boolean(editingId)
      const endpoint = isUpdate ? `/api/work-orders/${editingId}` : "/api/work-orders"
      const response = await fetch(apiUrl(endpoint), {
        method: isUpdate ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      })

      const data = await response.json()
      if (!response.ok) {
        setFormError(data?.message || "Failed to save work order")
        return
      }

      // Create pending follow-ups
      const savedId = editingId || data?.work_order?.id
      if (!isUpdate && pendingFollowUps.length > 0 && savedId) {
        for (const pf of pendingFollowUps) {
          try {
            await fetch(apiUrl("/api/followups"), {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ entity_type: "workorder", entity_id: savedId, note: pf.note || null, reminder_datetime: `${pf.reminder_date}T09:00:00` }),
            })
          } catch { /* ignore */ }
        }
        setPendingFollowUps([])
      }

      toast({ title: "Success", description: isUpdate ? "Work order updated" : "Work order saved" })
      await fetchWorkOrders()
      setShowForm(false)
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Failed to save work order")
    }
  }

  async function editWorkOrder(id: number) {
    try {
      const response = await fetch(apiUrl(`/api/work-orders/${id}`), { credentials: "include" })
      if (!response.ok) throw new Error("Failed to fetch work order")

      const data = await response.json()
      const wo = data.work_order as WorkOrderDetail

      setEditingId(wo.id)
      setInquiryId(wo.inquiry_id ? String(wo.inquiry_id) : "")
      setWorkOrderDate(wo.work_order_date || "")
      setCalibrationNabl(wo.calibration_nabl === "YES" || wo.calibration_nabl === "true" || wo.calibration_nabl === true as any ? "YES" : "NO")
      setPacking(wo.packing || "")
      setDeliveryDate(wo.delivery_date || "")
      setRemarks(wo.remarks || "")
      setApplyGst(wo.apply_gst === 1 || wo.apply_gst === undefined)
      setExtraChargeGstPercent(String(wo.extra_charge_gst_percent || 0))
      setExtraCharge1(String(wo.extra_charge_1 || 0))
      setExtraCharge2(String(wo.extra_charge_2 || 0))
      setAdvanceDisplay(wo.advance_display === 1)
      setAdvanceDate(wo.advance_date || "")
      setAdvanceDescription(wo.advance_description || "")
      setAdvanceAmount(String(wo.advance_amount || 0))
      setCurrency((wo as any).currency || "INR")
      setShowForm(true)

      setItems(
        (wo.items || []).map((item) => ({
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
      toast({ title: "Error", description: "Failed to load work order", variant: "destructive" })
    }
  }

  async function deleteWorkOrder(id: number) {
    if (!confirm("Are you sure you want to delete this work order?")) return

    try {
      const response = await fetch(apiUrl(`/api/work-orders/${id}`), {
        method: "DELETE",
        credentials: "include",
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data?.message || "Failed to delete work order")
      }

      toast({ title: "Success", description: "Work order deleted" })
      await fetchWorkOrders()
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete work order",
        variant: "destructive",
      })
    }
  }

  function printWorkOrder(id: number) {
    window.open(`/print/workorder/${id}`, "_blank", "noopener,noreferrer")
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
          <h1 className="text-2xl font-semibold text-gray-800">Sales Work Order</h1>
          <p className="text-sm text-gray-500">Create and manage work orders from customer inquiries.</p>
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
        <form onSubmit={submitWorkOrder} className="rounded-lg border border-gray-200 bg-white p-5 space-y-4">
          {formError && (
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {formError}
            </div>
          )}
          {/* Customer Inquiry Selector */}
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
            <div>
              <Label>Work Order Date</Label>
              <Input type="date" value={workOrderDate} readOnly className="bg-gray-50 cursor-not-allowed" />
            </div>
            <div>
              <Label>Currency</Label>
              <select
                className="w-full border border-gray-300 rounded-md h-10 px-3"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
              >
                <option value="INR">INR - Indian Rupee</option>
                <option value="USD">USD - US Dollar</option>
                <option value="EUR">EUR - Euro</option>
                <option value="GBP">GBP - British Pound</option>
                <option value="AED">AED - UAE Dirham</option>
                <option value="JPY">JPY - Japanese Yen</option>
              </select>
            </div>
          </div>

          {/* Auto-fill customer info */}
          <div className="rounded border border-gray-100 p-3 bg-gray-50 text-sm grid grid-cols-1 md:grid-cols-2 gap-2">
            <p><span className="font-medium">Contact:</span> {selectedInquiry?.authorized_person || "-"}</p>
            <p><span className="font-medium">Phone:</span> {selectedInquiry?.authorized_phone || "-"}</p>
            <p><span className="font-medium">Email:</span> {selectedInquiry?.email || "-"}</p>
            <p><span className="font-medium">Address:</span> {selectedInquiry?.address || "-"}</p>
          </div>

          {/* Extra Detail Fields */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Calibration / NABL</Label>
              <div className="flex items-center gap-3 mt-1">
                <button
                  type="button"
                  role="switch"
                  aria-checked={calibrationNabl === "YES"}
                  onClick={() => setCalibrationNabl(calibrationNabl === "YES" ? "NO" : "YES")}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${calibrationNabl === "YES" ? "bg-green-500" : "bg-gray-300"}`}
                >
                  <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform ${calibrationNabl === "YES" ? "translate-x-5" : "translate-x-0"}`} />
                </button>
                <span className="text-sm font-medium">{calibrationNabl === "YES" ? "YES" : "NO"}</span>
              </div>
            </div>
            <div>
              <Label>Packing</Label>
              <Input value={packing} onChange={(e) => setPacking(e.target.value)} placeholder="e.g. Wooden Box" />
            </div>
            <div>
              <Label>Delivery Date</Label>
              <Input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
            </div>
          </div>

          {/* Product Grid */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="font-medium text-gray-800">Work Order Items</h3>
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
                    const total = taxable + (applyGst ? (taxable * gstPercent) / 100 : 0)

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

          {/* GST & Extra Charges */}
          <div className="rounded border border-gray-200 p-4 space-y-3">
            <h3 className="font-medium text-gray-800">GST & Extra Charges</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="flex items-center gap-2">
                <input type="checkbox" id="applyGst" checked={applyGst} onChange={(e) => setApplyGst(e.target.checked)} className="h-4 w-4" />
                <Label htmlFor="applyGst" className="mb-0">Apply GST</Label>
              </div>
              <div>
                <Label>Extra Charge GST %</Label>
                <Input value={extraChargeGstPercent} onChange={(e) => setExtraChargeGstPercent(e.target.value)} />
              </div>
              <div>
                <Label>Extra Charge 1</Label>
                <Input value={extraCharge1} onChange={(e) => setExtraCharge1(e.target.value)} />
              </div>
              <div>
                <Label>Extra Charge 2</Label>
                <Input value={extraCharge2} onChange={(e) => setExtraCharge2(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Advance Payment */}
          <div className="rounded border border-gray-200 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <input type="checkbox" id="advanceDisplay" checked={advanceDisplay} onChange={(e) => setAdvanceDisplay(e.target.checked)} className="h-4 w-4" />
              <h3 className="font-medium text-gray-800"><label htmlFor="advanceDisplay">Advance Payment</label></h3>
            </div>
            {advanceDisplay && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Advance Date</Label>
                  <Input type="date" value={advanceDate} onChange={(e) => setAdvanceDate(e.target.value)} />
                </div>
                <div>
                  <Label>Description</Label>
                  <Input value={advanceDescription} onChange={(e) => setAdvanceDescription(e.target.value)} />
                </div>
                <div>
                  <Label>Amount</Label>
                  <Input value={advanceAmount} onChange={(e) => setAdvanceAmount(e.target.value)} />
                </div>
              </div>
            )}
          </div>

          {/* Remarks */}
          <div>
            <Label>Remarks</Label>
            <Textarea rows={3} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
          </div>

          {/* Totals */}
          <div className="rounded border border-gray-200 bg-gray-50 p-4 grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
            <div><span className="font-medium">Subtotal:</span> {summary.subtotal.toFixed(2)}</div>
            <div><span className="font-medium">Discount:</span> {summary.totalDiscount.toFixed(2)}</div>
            <div><span className="font-medium">GST:</span> {summary.totalGst.toFixed(2)}</div>
            <div><span className="font-medium">Extra Charges:</span> {summary.extraCharges.toFixed(2)}</div>
            <div className="col-span-full md:col-span-1"><span className="font-medium">Total:</span> {summary.totalAmount.toFixed(2)}</div>
          </div>

          {/* Follow-Up Section — above buttons */}
          <FollowUpSection
            entityType="workorder"
            entityId={editingId}
            pendingFollowUps={pendingFollowUps}
            onPendingChange={setPendingFollowUps}
          />

          {pendingFollowUps.length > 0 && !editingId && (
            <div className="text-xs text-gray-500">{pendingFollowUps.length} follow-up(s) will be created on save</div>
          )}

          <div className="flex justify-end">
            <Button type="submit">{editingId ? "Update Work Order" : "Save Work Order"}</Button>
          </div>
        </form>
        </>
        )}

        {!showForm && (
        <>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <input type="text" placeholder="Search work orders..." className="w-full h-8 pl-8 pr-3 text-xs border border-gray-200 rounded-md bg-white" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
          <MultiSelectFilter label="Status" options={allStatuses} selected={statusFilter} onChange={setStatusFilter} />
        </div>
        <div className="rounded-lg border border-gray-200 bg-white overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-700">
              <tr>
                <th className="px-3 py-2 text-left">WO No</th>
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-left">Inquiry</th>
                <th className="px-3 py-2 text-left">Company</th>
                <th className="px-3 py-2 text-left">Total</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Production</th>
                <th className="px-3 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredWorkOrders.length === 0 ? (
                <tr>
                  <td className="px-3 py-3" colSpan={8}>No work orders found.</td>
                </tr>
              ) : (
                filteredWorkOrders.map((wo) => (
                  <tr key={wo.id} className="border-t">
                    <td className="px-3 py-2 font-medium">{wo.work_order_number}</td>
                    <td className="px-3 py-2">{wo.created_at ? new Date(wo.created_at).toLocaleDateString() : "-"}</td>
                    <td className="px-3 py-2">{wo.inquiry_number || "-"}</td>
                    <td className="px-3 py-2">{wo.company_name || "-"}</td>
                    <td className="px-3 py-2">{round2(Number(wo.total_amount || 0)).toFixed(2)}</td>
                    <td className="px-3 py-2">{wo.status || "generated"}</td>
                    <td className="px-3 py-2">{wo.sent_to_production_at ? "Yes" : "No"}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <Button size="icon" variant="ghost" className="h-8 w-8" title="Print" onClick={() => printWorkOrder(wo.id)}>
                          <Printer className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8" title="Edit" onClick={() => editWorkOrder(wo.id)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600 hover:text-red-700" title="Delete" onClick={() => deleteWorkOrder(wo.id)}>
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
        </>
        )}
      </div>
    </DashboardLayout>
  )
}
