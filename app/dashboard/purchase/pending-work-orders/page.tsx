"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { apiUrl } from "@/lib/api"

type MachineItem = {
  product_id: number
  product_name: string | null
  quantity: number
  product_type: string
}

type PendingWO = {
  id: number
  work_order_number: string
  work_order_date: string | null
  status: string
  created_at: string
  company_name: string | null
  authorized_person: string | null
  machine_items: MachineItem[]
}

const menuItems = [
  { id: "pending-work-orders", label: "Pending Work Orders" },
  { id: "bom", label: "Bill of Materials" },
  { id: "purchase", label: "Purchase" },
  { id: "inquiries", label: "Inquiries" },
  { id: "purchase-orders", label: "Purchase Orders" },
  { id: "vendors", label: "Vendors" },
  { id: "products", label: "Products" },
]

export default function PendingWorkOrdersPage() {
  const router = useRouter()
  const { user, isLoading, logout } = useAuth()
  const { toast } = useToast()

  const [activeSection, setActiveSection] = useState("pending-work-orders")
  const [workOrders, setWorkOrders] = useState<PendingWO[]>([])
  const [creating, setCreating] = useState<number | null>(null)

  function handleSectionChange(section: string) {
    const routeMap: Record<string, string> = {
      "pending-work-orders": "/dashboard/purchase/pending-work-orders",
      products: "/dashboard/purchase/products",
      bom: "/dashboard/purchase/bom",
      purchase: "/dashboard/purchase/purchase",
      inquiries: "/dashboard/purchase/inquiries",
      "purchase-orders": "/dashboard/purchase/purchase-orders",
      vendors: "/dashboard/purchase/vendors",
    }
    const target = routeMap[section]
    if (target) router.push(target)
  }

  async function fetchPendingWorkOrders() {
    try {
      const res = await fetch(apiUrl("/api/purchase/pending-work-orders"), { credentials: "include" })
      if (!res.ok) throw new Error("Failed to fetch")
      const data = await res.json()
      setWorkOrders(data.work_orders || [])
    } catch {
      toast({ title: "Error", description: "Failed to load pending work orders", variant: "destructive" })
    }
  }

  async function createBom(workOrderId: number) {
    setCreating(workOrderId)
    try {
      const res = await fetch(apiUrl("/api/purchase/bom/create"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ work_order_id: workOrderId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.message || "Failed to create BOM")
      toast({ title: "Success", description: data.message || "BOM created" })
      await fetchPendingWorkOrders()
    } catch (error) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to create BOM", variant: "destructive" })
    } finally {
      setCreating(null)
    }
  }

  useEffect(() => {
    fetchPendingWorkOrders()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (isLoading) {
    return (
      <DashboardLayout title="Purchase" menuItems={menuItems} activeSection={activeSection} onSectionChange={handleSectionChange} loginId={user?.loginId || ""} onLogout={logout}>
        <div className="p-6">Loading...</div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout title="Purchase" menuItems={menuItems} activeSection={activeSection} onSectionChange={handleSectionChange} loginId={user?.loginId || ""} onLogout={logout}>
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">Pending Work Orders</h1>
          <p className="text-sm text-gray-500">Work orders that do not yet have a Bill of Materials created.</p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-700">
              <tr>
                <th className="px-4 py-2 text-left">Work Order Number</th>
                <th className="px-4 py-2 text-left">Customer</th>
                <th className="px-4 py-2 text-left">Product</th>
                <th className="px-4 py-2 text-left">Machine Qty</th>
                <th className="px-4 py-2 text-left">Date</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-left">Action</th>
              </tr>
            </thead>
            <tbody>
              {workOrders.length === 0 ? (
                <tr><td className="px-4 py-4 text-gray-400" colSpan={7}>No pending work orders.</td></tr>
              ) : (
                workOrders.map((wo) => (
                  <tr key={wo.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium">{wo.work_order_number}</td>
                    <td className="px-4 py-2">{wo.company_name || "-"}</td>
                    <td className="px-4 py-2">
                      {wo.machine_items.length === 0
                        ? <span className="text-gray-400">No machines</span>
                        : wo.machine_items.map((item, idx) => (
                            <div key={idx}>{item.product_name || "Machine"}</div>
                          ))}
                    </td>
                    <td className="px-4 py-2">
                      {wo.machine_items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0)}
                    </td>
                    <td className="px-4 py-2">{wo.work_order_date ? new Date(wo.work_order_date).toLocaleDateString() : wo.created_at ? new Date(wo.created_at).toLocaleDateString() : "-"}</td>
                    <td className="px-4 py-2">
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">{wo.status}</span>
                    </td>
                    <td className="px-4 py-2">
                      {wo.machine_items.length > 0 ? (
                        <Button
                          size="sm"
                          onClick={() => createBom(wo.id)}
                          disabled={creating === wo.id}
                        >
                          {creating === wo.id ? "Creating..." : "Create BOM"}
                        </Button>
                      ) : (
                        <span className="text-xs text-gray-400">No machines</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  )
}
