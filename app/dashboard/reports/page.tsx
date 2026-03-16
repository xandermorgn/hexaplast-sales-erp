"use client"

import { useEffect, useMemo, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Search, Download, CheckSquare, Square } from "lucide-react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { apiUrl } from "@/lib/api"
import { MultiSelectFilter } from "@/components/ui/multi-select-filter"
import * as XLSX from "xlsx"

/* ── Types ── */
type Inquiry = {
  id: number
  inquiry_number: string
  created_at: string
  company_name: string | null
  authorized_person: string | null
  email: string | null
  authorized_phone: string | null
  enquiry_source: string | null
  category: string | null
  industry: string | null
  region: string | null
  country: string | null
  state: string | null
  city: string | null
  status: string | null
  remarks: string | null
}

type QuotationRow = {
  id: number
  quotation_number: string
  inquiry_number: string
  company_name: string | null
  authorized_person: string | null
  subtotal: number
  total_discount: number
  total_amount: number
  status: string | null
  quotation_type: string | null
  created_at: string
}

type PerformaRow = {
  id: number
  performa_number: string
  created_at?: string | null
  inquiry_number: string
  company_name: string | null
  subtotal: number
  total_discount: number
  total_gst: number
  total_amount: number
  status: string | null
}

type WorkOrderRow = {
  id: number
  work_order_number: string
  created_at?: string | null
  inquiry_number: string | null
  company_name: string | null
  subtotal: number
  total_discount: number
  total_gst: number
  total_amount: number
  status: string | null
  sent_to_production_at?: string | null
}

type ActiveTab = "inquiries" | "quotations" | "performas" | "workorders"

const menuItems = [
  { id: "inquiries", label: "Customer Inquiries" },
  { id: "quotations", label: "Quotations" },
  { id: "performas", label: "Performas" },
  { id: "work-orders", label: "Work Orders" },
  { id: "products", label: "Products" },
  { id: "followups", label: "Follow Ups" },
  { id: "reports", label: "Reports" },
]

export default function ReportsPage() {
  const router = useRouter()
  const { user, isLoading, logout } = useAuth()
  const { toast } = useToast()

  const [activeSection, setActiveSection] = useState("reports")
  const [activeTab, setActiveTab] = useState<ActiveTab>("inquiries")

  const [inquiries, setInquiries] = useState<Inquiry[]>([])
  const [quotations, setQuotations] = useState<QuotationRow[]>([])
  const [performas, setPerformas] = useState<PerformaRow[]>([])
  const [workOrders, setWorkOrders] = useState<WorkOrderRow[]>([])

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())

  // Filters
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string[]>([])
  const [sourceFilter, setSourceFilter] = useState<string[]>([])
  const [categoryFilter, setCategoryFilter] = useState<string[]>([])
  const [industryFilter, setIndustryFilter] = useState<string[]>([])
  const [regionFilter, setRegionFilter] = useState<string[]>([])
  const [typeFilter, setTypeFilter] = useState<string[]>([])
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")

  function handleSectionChange(section: string) {
    const routeMap: Record<string, string> = {
      inquiries: "/dashboard/inquiries",
      quotations: "/dashboard/quotations",
      performas: "/dashboard/performas",
      "work-orders": "/dashboard/work-orders",
      products: "/dashboard/products",
      followups: "/dashboard/followups",
      reports: "/dashboard/reports",
    }
    const target = routeMap[section]
    if (target) router.push(target)
  }

  /* ── Data fetching ── */
  async function fetchInquiries() {
    try {
      const res = await fetch(apiUrl("/api/inquiries"), { credentials: "include" })
      if (!res.ok) return
      const data = await res.json()
      setInquiries(data.inquiries || [])
    } catch { /* ignore */ }
  }

  async function fetchQuotations() {
    try {
      const res = await fetch(apiUrl("/api/quotations"), { credentials: "include" })
      if (!res.ok) return
      const data = await res.json()
      setQuotations(data.quotations || [])
    } catch { /* ignore */ }
  }

  async function fetchPerformas() {
    try {
      const res = await fetch(apiUrl("/api/performas"), { credentials: "include" })
      if (!res.ok) return
      const data = await res.json()
      setPerformas(data.performas || [])
    } catch { /* ignore */ }
  }

  async function fetchWorkOrders() {
    try {
      const res = await fetch(apiUrl("/api/work-orders"), { credentials: "include" })
      if (!res.ok) return
      const data = await res.json()
      setWorkOrders(data.work_orders || [])
    } catch { /* ignore */ }
  }

  useEffect(() => {
    Promise.all([fetchInquiries(), fetchQuotations(), fetchPerformas(), fetchWorkOrders()])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Reset selection + filters on tab change
  useEffect(() => {
    setSelectedIds(new Set())
    setSearchQuery("")
    setStatusFilter([])
    setSourceFilter([])
    setCategoryFilter([])
    setIndustryFilter([])
    setRegionFilter([])
    setTypeFilter([])
    setDateFrom("")
    setDateTo("")
  }, [activeTab])

  /* ── Filter option extraction ── */
  const inquiryFilterOptions = useMemo(() => {
    const sources = new Set<string>()
    const categories = new Set<string>()
    const industries = new Set<string>()
    const regions = new Set<string>()
    const statuses = new Set<string>()
    for (const i of inquiries) {
      if (i.enquiry_source) sources.add(i.enquiry_source)
      if (i.category) categories.add(i.category)
      if (i.industry) industries.add(i.industry)
      if (i.region) regions.add(i.region)
      statuses.add(i.status || "new")
    }
    return {
      sources: Array.from(sources).sort(),
      categories: Array.from(categories).sort(),
      industries: Array.from(industries).sort(),
      regions: Array.from(regions).sort(),
      statuses: Array.from(statuses).sort(),
    }
  }, [inquiries])

  const quotationStatuses = useMemo(() => {
    const s = new Set(quotations.map((q) => q.status || "draft"))
    return Array.from(s).sort()
  }, [quotations])

  const quotationTypes = useMemo(() => {
    const s = new Set(quotations.filter((q) => q.quotation_type).map((q) => q.quotation_type!))
    return Array.from(s).sort()
  }, [quotations])

  const performaStatuses = useMemo(() => {
    const s = new Set(performas.map((p) => p.status || "draft"))
    return Array.from(s).sort()
  }, [performas])

  const workOrderStatuses = useMemo(() => {
    const s = new Set(workOrders.map((w) => w.status || "generated"))
    return Array.from(s).sort()
  }, [workOrders])

  /* ── Date filter helper ── */
  function dateInRange(dateStr: string | null | undefined): boolean {
    if (!dateStr) return true
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return true
    if (dateFrom && d < new Date(`${dateFrom}T00:00:00`)) return false
    if (dateTo && d > new Date(`${dateTo}T23:59:59`)) return false
    return true
  }

  /* ── Filtered data ── */
  const filteredInquiries = useMemo(() => {
    return inquiries.filter((i) => {
      if (!dateInRange(i.created_at)) return false
      if (statusFilter.length > 0 && !statusFilter.includes(i.status || "new")) return false
      if (sourceFilter.length > 0 && !sourceFilter.includes(i.enquiry_source || "")) return false
      if (categoryFilter.length > 0 && !categoryFilter.includes(i.category || "")) return false
      if (industryFilter.length > 0 && !industryFilter.includes(i.industry || "")) return false
      if (regionFilter.length > 0 && !regionFilter.includes(i.region || "")) return false
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const match =
          (i.inquiry_number || "").toLowerCase().includes(q) ||
          (i.company_name || "").toLowerCase().includes(q) ||
          (i.authorized_person || "").toLowerCase().includes(q) ||
          (i.email || "").toLowerCase().includes(q) ||
          (i.enquiry_source || "").toLowerCase().includes(q) ||
          (i.category || "").toLowerCase().includes(q)
        if (!match) return false
      }
      return true
    })
  }, [inquiries, searchQuery, statusFilter, sourceFilter, categoryFilter, industryFilter, regionFilter, dateFrom, dateTo])

  const filteredQuotations = useMemo(() => {
    return quotations.filter((q) => {
      if (!dateInRange(q.created_at)) return false
      if (statusFilter.length > 0 && !statusFilter.includes(q.status || "draft")) return false
      if (typeFilter.length > 0 && !typeFilter.includes(q.quotation_type || "")) return false
      if (searchQuery) {
        const s = searchQuery.toLowerCase()
        const match =
          (q.quotation_number || "").toLowerCase().includes(s) ||
          (q.company_name || "").toLowerCase().includes(s) ||
          (q.inquiry_number || "").toLowerCase().includes(s)
        if (!match) return false
      }
      return true
    })
  }, [quotations, searchQuery, statusFilter, typeFilter, dateFrom, dateTo])

  const filteredPerformas = useMemo(() => {
    return performas.filter((p) => {
      if (!dateInRange(p.created_at)) return false
      if (statusFilter.length > 0 && !statusFilter.includes(p.status || "draft")) return false
      if (searchQuery) {
        const s = searchQuery.toLowerCase()
        const match =
          (p.performa_number || "").toLowerCase().includes(s) ||
          (p.company_name || "").toLowerCase().includes(s) ||
          (p.inquiry_number || "").toLowerCase().includes(s)
        if (!match) return false
      }
      return true
    })
  }, [performas, searchQuery, statusFilter, dateFrom, dateTo])

  const filteredWorkOrders = useMemo(() => {
    return workOrders.filter((w) => {
      if (!dateInRange(w.created_at)) return false
      if (statusFilter.length > 0 && !statusFilter.includes(w.status || "generated")) return false
      if (searchQuery) {
        const s = searchQuery.toLowerCase()
        const match =
          (w.work_order_number || "").toLowerCase().includes(s) ||
          (w.company_name || "").toLowerCase().includes(s) ||
          (w.inquiry_number || "").toLowerCase().includes(s)
        if (!match) return false
      }
      return true
    })
  }, [workOrders, searchQuery, statusFilter, dateFrom, dateTo])

  /* ── Current dataset ── */
  const currentData = useMemo(() => {
    if (activeTab === "inquiries") return filteredInquiries
    if (activeTab === "quotations") return filteredQuotations
    if (activeTab === "performas") return filteredPerformas
    return filteredWorkOrders
  }, [activeTab, filteredInquiries, filteredQuotations, filteredPerformas, filteredWorkOrders])

  /* ── Selection helpers ── */
  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    const allIds = currentData.map((d: any) => d.id)
    const allSelected = allIds.length > 0 && allIds.every((id) => selectedIds.has(id))
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(allIds))
    }
  }

  const allSelected = currentData.length > 0 && currentData.every((d: any) => selectedIds.has(d.id))

  /* ── Export to Excel ── */
  function exportToExcel() {
    const selected = currentData.filter((d: any) => selectedIds.has(d.id))
    if (selected.length === 0) {
      toast({ title: "No rows selected", description: "Please select at least one row to export.", variant: "destructive" })
      return
    }

    let rows: Record<string, any>[] = []
    const tabLabel = activeTab === "inquiries" ? "Customer Inquiries"
      : activeTab === "quotations" ? "Quotations"
      : activeTab === "performas" ? "Performas"
      : "Work Orders"

    if (activeTab === "inquiries") {
      rows = (selected as Inquiry[]).map((i) => ({
        "Inquiry No": i.inquiry_number,
        "Date": i.created_at ? new Date(i.created_at).toLocaleDateString() : "",
        "Company": i.company_name || "",
        "Contact Person": i.authorized_person || "",
        "Phone": i.authorized_phone || "",
        "Email": i.email || "",
        "Source": i.enquiry_source || "",
        "Category": i.category || "",
        "Industry": i.industry || "",
        "Region": i.region || "",
        "Country": i.country || "",
        "State": i.state || "",
        "City": i.city || "",
        "Status": i.status || "new",
        "Remarks": i.remarks || "",
      }))
    } else if (activeTab === "quotations") {
      rows = (selected as QuotationRow[]).map((q) => ({
        "Quotation No": q.quotation_number,
        "Date": q.created_at ? new Date(q.created_at).toLocaleDateString() : "",
        "Inquiry No": q.inquiry_number || "",
        "Company": q.company_name || "",
        "Contact": q.authorized_person || "",
        "Type": q.quotation_type || "",
        "Subtotal": q.subtotal,
        "Discount": q.total_discount,
        "Total": q.total_amount,
        "Status": q.status || "draft",
      }))
    } else if (activeTab === "performas") {
      rows = (selected as PerformaRow[]).map((p) => ({
        "Performa No": p.performa_number,
        "Date": p.created_at ? new Date(p.created_at).toLocaleDateString() : "",
        "Inquiry No": p.inquiry_number || "",
        "Company": p.company_name || "",
        "Subtotal": p.subtotal,
        "Discount": p.total_discount,
        "GST": p.total_gst,
        "Total": p.total_amount,
        "Status": p.status || "draft",
      }))
    } else {
      rows = (selected as WorkOrderRow[]).map((w) => ({
        "WO No": w.work_order_number,
        "Date": w.created_at ? new Date(w.created_at).toLocaleDateString() : "",
        "Inquiry No": w.inquiry_number || "",
        "Company": w.company_name || "",
        "Subtotal": w.subtotal,
        "Discount": w.total_discount,
        "GST": w.total_gst,
        "Total": w.total_amount,
        "Status": w.status || "generated",
        "Sent to Production": w.sent_to_production_at ? "Yes" : "No",
      }))
    }

    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, tabLabel)
    XLSX.writeFile(wb, `${tabLabel.replace(/\s+/g, "_")}_Report_${new Date().toISOString().slice(0, 10)}.xlsx`)
    toast({ title: "Exported", description: `${selected.length} rows exported to Excel.` })
  }

  /* ── Format date ── */
  function fmtDate(d: string | null | undefined) {
    if (!d) return "-"
    const dt = new Date(d)
    return isNaN(dt.getTime()) ? d : dt.toLocaleDateString()
  }

  if (isLoading) {
    return (
      <DashboardLayout title="Sales" menuItems={menuItems} activeSection={activeSection} onSectionChange={handleSectionChange} loginId={user?.loginId || ""} onLogout={logout}>
        <div className="p-6">Loading...</div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout title="Sales" menuItems={menuItems} activeSection={activeSection} onSectionChange={handleSectionChange} loginId={user?.loginId || ""} onLogout={logout}>
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">Reports</h1>
          <p className="text-sm text-gray-500">Filter, select, and export data from Customer Inquiries, Quotations, Performas, and Work Orders.</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-gray-200">
          {([
            { key: "inquiries", label: "Customer Inquiries" },
            { key: "quotations", label: "Quotations" },
            { key: "performas", label: "Performas" },
            { key: "workorders", label: "Work Orders" },
          ] as { key: ActiveTab; label: string }[]).map((tab) => (
            <button
              key={tab.key}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.key ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Filters row */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <input type="text" placeholder="Search..." className="w-full h-8 pl-8 pr-3 text-xs border border-gray-200 rounded-md bg-white" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>

          {/* Date range */}
          <div className="flex items-center gap-1 text-xs">
            <span className="text-gray-500">From</span>
            <input type="date" className="h-8 px-2 border border-gray-200 rounded-md text-xs" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            <span className="text-gray-500">To</span>
            <input type="date" className="h-8 px-2 border border-gray-200 rounded-md text-xs" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>

          {/* Status filter — always visible */}
          {activeTab === "inquiries" && (
            <>
              <MultiSelectFilter label="Status" options={inquiryFilterOptions.statuses} selected={statusFilter} onChange={setStatusFilter} />
              <MultiSelectFilter label="Source" options={inquiryFilterOptions.sources} selected={sourceFilter} onChange={setSourceFilter} />
              <MultiSelectFilter label="Category" options={inquiryFilterOptions.categories} selected={categoryFilter} onChange={setCategoryFilter} />
              <MultiSelectFilter label="Industry" options={inquiryFilterOptions.industries} selected={industryFilter} onChange={setIndustryFilter} />
              <MultiSelectFilter label="Region" options={inquiryFilterOptions.regions} selected={regionFilter} onChange={setRegionFilter} />
            </>
          )}
          {activeTab === "quotations" && (
            <>
              <MultiSelectFilter label="Status" options={quotationStatuses} selected={statusFilter} onChange={setStatusFilter} />
              <MultiSelectFilter label="Type" options={quotationTypes} selected={typeFilter} onChange={setTypeFilter} />
            </>
          )}
          {activeTab === "performas" && (
            <MultiSelectFilter label="Status" options={performaStatuses} selected={statusFilter} onChange={setStatusFilter} />
          )}
          {activeTab === "workorders" && (
            <MultiSelectFilter label="Status" options={workOrderStatuses} selected={statusFilter} onChange={setStatusFilter} />
          )}
        </div>

        {/* Action bar */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">
            {selectedIds.size} of {currentData.length} selected
          </span>
          <Button size="sm" onClick={exportToExcel} disabled={selectedIds.size === 0}>
            <Download className="h-3.5 w-3.5 mr-1" />
            Export Selected to Excel
          </Button>
        </div>

        {/* Table */}
        <div className="rounded-lg border border-gray-200 bg-white overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-700">
              {activeTab === "inquiries" && (
                <tr>
                  <th className="px-3 py-2 w-8">
                    <button onClick={toggleSelectAll} className="flex items-center justify-center">
                      {allSelected ? <CheckSquare className="h-4 w-4 text-blue-600" /> : <Square className="h-4 w-4 text-gray-400" />}
                    </button>
                  </th>
                  <th className="px-3 py-2 text-left">Inquiry No</th>
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Company</th>
                  <th className="px-3 py-2 text-left">Contact</th>
                  <th className="px-3 py-2 text-left">Source</th>
                  <th className="px-3 py-2 text-left">Category</th>
                  <th className="px-3 py-2 text-left">Industry</th>
                  <th className="px-3 py-2 text-left">Region</th>
                  <th className="px-3 py-2 text-left">Status</th>
                </tr>
              )}
              {activeTab === "quotations" && (
                <tr>
                  <th className="px-3 py-2 w-8">
                    <button onClick={toggleSelectAll} className="flex items-center justify-center">
                      {allSelected ? <CheckSquare className="h-4 w-4 text-blue-600" /> : <Square className="h-4 w-4 text-gray-400" />}
                    </button>
                  </th>
                  <th className="px-3 py-2 text-left">Quotation No</th>
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Inquiry</th>
                  <th className="px-3 py-2 text-left">Company</th>
                  <th className="px-3 py-2 text-left">Type</th>
                  <th className="px-3 py-2 text-left">Total</th>
                  <th className="px-3 py-2 text-left">Status</th>
                </tr>
              )}
              {activeTab === "performas" && (
                <tr>
                  <th className="px-3 py-2 w-8">
                    <button onClick={toggleSelectAll} className="flex items-center justify-center">
                      {allSelected ? <CheckSquare className="h-4 w-4 text-blue-600" /> : <Square className="h-4 w-4 text-gray-400" />}
                    </button>
                  </th>
                  <th className="px-3 py-2 text-left">Performa No</th>
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Inquiry</th>
                  <th className="px-3 py-2 text-left">Company</th>
                  <th className="px-3 py-2 text-left">Total</th>
                  <th className="px-3 py-2 text-left">Status</th>
                </tr>
              )}
              {activeTab === "workorders" && (
                <tr>
                  <th className="px-3 py-2 w-8">
                    <button onClick={toggleSelectAll} className="flex items-center justify-center">
                      {allSelected ? <CheckSquare className="h-4 w-4 text-blue-600" /> : <Square className="h-4 w-4 text-gray-400" />}
                    </button>
                  </th>
                  <th className="px-3 py-2 text-left">WO No</th>
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Inquiry</th>
                  <th className="px-3 py-2 text-left">Company</th>
                  <th className="px-3 py-2 text-left">Total</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Production</th>
                </tr>
              )}
            </thead>
            <tbody>
              {currentData.length === 0 ? (
                <tr>
                  <td className="px-3 py-4 text-gray-400" colSpan={10}>No records match the current filters.</td>
                </tr>
              ) : (
                <>
                  {activeTab === "inquiries" && filteredInquiries.map((i) => (
                    <tr key={i.id} className={`border-t hover:bg-gray-50 ${selectedIds.has(i.id) ? "bg-blue-50" : ""}`}>
                      <td className="px-3 py-2">
                        <button onClick={() => toggleSelect(i.id)} className="flex items-center justify-center">
                          {selectedIds.has(i.id) ? <CheckSquare className="h-4 w-4 text-blue-600" /> : <Square className="h-4 w-4 text-gray-400" />}
                        </button>
                      </td>
                      <td className="px-3 py-2 font-medium">{i.inquiry_number}</td>
                      <td className="px-3 py-2">{fmtDate(i.created_at)}</td>
                      <td className="px-3 py-2">{i.company_name || "-"}</td>
                      <td className="px-3 py-2">{i.authorized_person || "-"}</td>
                      <td className="px-3 py-2">{i.enquiry_source || "-"}</td>
                      <td className="px-3 py-2">{i.category || "-"}</td>
                      <td className="px-3 py-2">{i.industry || "-"}</td>
                      <td className="px-3 py-2">{i.region || "-"}</td>
                      <td className="px-3 py-2">
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">{i.status || "new"}</span>
                      </td>
                    </tr>
                  ))}
                  {activeTab === "quotations" && filteredQuotations.map((q) => (
                    <tr key={q.id} className={`border-t hover:bg-gray-50 ${selectedIds.has(q.id) ? "bg-blue-50" : ""}`}>
                      <td className="px-3 py-2">
                        <button onClick={() => toggleSelect(q.id)} className="flex items-center justify-center">
                          {selectedIds.has(q.id) ? <CheckSquare className="h-4 w-4 text-blue-600" /> : <Square className="h-4 w-4 text-gray-400" />}
                        </button>
                      </td>
                      <td className="px-3 py-2 font-medium">{q.quotation_number}</td>
                      <td className="px-3 py-2">{fmtDate(q.created_at)}</td>
                      <td className="px-3 py-2">{q.inquiry_number || "-"}</td>
                      <td className="px-3 py-2">{q.company_name || "-"}</td>
                      <td className="px-3 py-2">{q.quotation_type || "-"}</td>
                      <td className="px-3 py-2">{Number(q.total_amount || 0).toFixed(2)}</td>
                      <td className="px-3 py-2">
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">{q.status || "draft"}</span>
                      </td>
                    </tr>
                  ))}
                  {activeTab === "performas" && filteredPerformas.map((p) => (
                    <tr key={p.id} className={`border-t hover:bg-gray-50 ${selectedIds.has(p.id) ? "bg-blue-50" : ""}`}>
                      <td className="px-3 py-2">
                        <button onClick={() => toggleSelect(p.id)} className="flex items-center justify-center">
                          {selectedIds.has(p.id) ? <CheckSquare className="h-4 w-4 text-blue-600" /> : <Square className="h-4 w-4 text-gray-400" />}
                        </button>
                      </td>
                      <td className="px-3 py-2 font-medium">{p.performa_number}</td>
                      <td className="px-3 py-2">{fmtDate(p.created_at)}</td>
                      <td className="px-3 py-2">{p.inquiry_number || "-"}</td>
                      <td className="px-3 py-2">{p.company_name || "-"}</td>
                      <td className="px-3 py-2">{Number(p.total_amount || 0).toFixed(2)}</td>
                      <td className="px-3 py-2">
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">{p.status || "draft"}</span>
                      </td>
                    </tr>
                  ))}
                  {activeTab === "workorders" && filteredWorkOrders.map((w) => (
                    <tr key={w.id} className={`border-t hover:bg-gray-50 ${selectedIds.has(w.id) ? "bg-blue-50" : ""}`}>
                      <td className="px-3 py-2">
                        <button onClick={() => toggleSelect(w.id)} className="flex items-center justify-center">
                          {selectedIds.has(w.id) ? <CheckSquare className="h-4 w-4 text-blue-600" /> : <Square className="h-4 w-4 text-gray-400" />}
                        </button>
                      </td>
                      <td className="px-3 py-2 font-medium">{w.work_order_number}</td>
                      <td className="px-3 py-2">{fmtDate(w.created_at)}</td>
                      <td className="px-3 py-2">{w.inquiry_number || "-"}</td>
                      <td className="px-3 py-2">{w.company_name || "-"}</td>
                      <td className="px-3 py-2">{Number(w.total_amount || 0).toFixed(2)}</td>
                      <td className="px-3 py-2">
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">{w.status || "generated"}</span>
                      </td>
                      <td className="px-3 py-2">{w.sent_to_production_at ? "Yes" : "No"}</td>
                    </tr>
                  ))}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  )
}
