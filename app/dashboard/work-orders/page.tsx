"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { DateRangeFilter } from "@/components/ui/date-range-filter"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { apiUrl } from "@/lib/api"

type PerformaOption = {
  id: number
  performa_number: string
  inquiry_number: string
  company_name: string | null
}

type WorkOrder = {
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
  prepared_by: number | null
  checked_by: number | null
  approved_by: number | null
  prepared_by_name: string | null
  checked_by_name: string | null
  approved_by_name: string | null
  status: string | null
  sent_to_production_at?: string | null
  error_log?: string | null
}

export default function WorkOrdersPage() {
  const router = useRouter()
  const { user, isLoading, logout } = useAuth()
  const { toast } = useToast()

  const [activeSection, setActiveSection] = useState("work-orders")
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

    setActiveSection("work-orders")
  }

  const [performas, setPerformas] = useState<PerformaOption[]>([])
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])
  const [showForm, setShowForm] = useState(false)
  const [filters, setFilters] = useState({ from_date: "", to_date: "" })

  const filteredWorkOrders = useMemo(() => {
    return workOrders.filter((workOrder) => {
      if (!workOrder.created_at) return true

      const created = new Date(workOrder.created_at)
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
  }, [workOrders, filters.from_date, filters.to_date])

  async function fetchPerformas() {
    const response = await fetch(apiUrl("/api/performas"), { credentials: "include" })
    if (!response.ok) throw new Error("Failed to fetch performas")
    const data = await response.json()
    setPerformas(data.performas || [])
  }

  async function fetchWorkOrders() {
    const response = await fetch(apiUrl("/api/work-orders"), { credentials: "include" })
    if (!response.ok) throw new Error("Failed to fetch work orders")
    const data = await response.json()
    setWorkOrders(data.work_orders || [])
  }

  async function loadAll() {
    try {
      await Promise.all([fetchPerformas(), fetchWorkOrders()])
    } catch {
      toast({ title: "Error", description: "Failed to load work order module data", variant: "destructive" })
    }
  }

  useEffect(() => {
    loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function createFromPerforma(performaId: number) {
    try {
      const response = await fetch(apiUrl(`/api/work-orders/from-performa/${performaId}`), {
        method: "POST",
        credentials: "include",
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data?.message || "Failed to create work order")

      const workOrder = data.work_order as WorkOrder
      if (workOrder?.id) {
        toast({ title: "Success", description: "Work order created from performa" })
      }

      await fetchWorkOrders()
      setShowForm(false)
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create work order",
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
      <div className="space-y-6">
        <div>
          <div>
            <h1 className="text-2xl font-semibold text-gray-800">Sales Work Order</h1>
            <p className="text-sm text-gray-500">Create work orders from performa with inquiry/products/amount auto-fetch.</p>
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
            <Button className="h-10 px-6 text-base" onClick={() => setShowForm(true)}>
              + New
            </Button>
          </div>
        </div>

        {showForm && (
          <div className="rounded-lg border border-gray-200 bg-white p-5 space-y-4">
            <div>
              <h3 className="text-base font-medium text-gray-800">Create Work Order from Performa</h3>
              <p className="text-sm text-gray-500">Select a performa and generate work order.</p>
            </div>

            <div className="rounded border border-gray-200 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-gray-700">
                  <tr>
                    <th className="px-3 py-2 text-left">Performa No</th>
                    <th className="px-3 py-2 text-left">Inquiry No</th>
                    <th className="px-3 py-2 text-left">Company</th>
                    <th className="px-3 py-2 text-left">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {performas.length === 0 ? (
                    <tr>
                      <td className="px-3 py-3" colSpan={4}>No performas available.</td>
                    </tr>
                  ) : (
                    performas.map((performa) => (
                      <tr key={performa.id} className="border-t">
                        <td className="px-3 py-2 font-medium">{performa.performa_number}</td>
                        <td className="px-3 py-2">{performa.inquiry_number}</td>
                        <td className="px-3 py-2">{performa.company_name || "-"}</td>
                        <td className="px-3 py-2">
                          <Button size="sm" onClick={() => createFromPerforma(performa.id)}>
                            Create Work Order
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!showForm && (
        <div className="rounded-lg border border-gray-200 bg-white overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-700">
              <tr>
                <th className="px-3 py-2 text-left">WO No</th>
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-left">Performa</th>
                <th className="px-3 py-2 text-left">Inquiry</th>
                <th className="px-3 py-2 text-left">Company</th>
                <th className="px-3 py-2 text-left">Total</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Sent To Production</th>
              </tr>
            </thead>
            <tbody>
              {filteredWorkOrders.length === 0 ? (
                <tr>
                  <td className="px-3 py-3" colSpan={8}>No work orders found.</td>
                </tr>
              ) : (
                filteredWorkOrders.map((workOrder) => (
                  <tr key={workOrder.id} className="border-t">
                    <td className="px-3 py-2 font-medium">{workOrder.work_order_number}</td>
                    <td className="px-3 py-2">{workOrder.created_at ? new Date(workOrder.created_at).toLocaleDateString() : "-"}</td>
                    <td className="px-3 py-2">{workOrder.performa_number || "-"}</td>
                    <td className="px-3 py-2">{workOrder.inquiry_number || "-"}</td>
                    <td className="px-3 py-2">{workOrder.company_name || "-"}</td>
                    <td className="px-3 py-2">{Number(workOrder.total_amount || 0).toFixed(2)}</td>
                    <td className="px-3 py-2">{workOrder.status || "generated"}</td>
                    <td className="px-3 py-2">{workOrder.sent_to_production_at ? "Yes" : "No"}</td>
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
