"use client"

import { Fragment, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { apiUrl } from "@/lib/api"
import { ChevronDown, ChevronRight, Zap } from "lucide-react"

type PurchaseOrder = {
  id: number
  po_number: string
  vendor_id: number
  vendor_name: string
  vendor_phone: string | null
  status: string
  total_amount: number
  notes: string | null
  created_at: string
  item_count: number
}

type POItem = {
  id: number
  purchase_order_id: number
  bom_material_id: number
  inquiry_id: number | null
  part_name: string
  specification: string | null
  quantity: number
  unit: string
  unit_price: number
  total_price: number
}

const menuItems = [
  { id: "pending-work-orders", label: "Pending Work Orders" },
  { id: "bom", label: "Bill of Materials" },
  { id: "purchase", label: "Purchase" },
  { id: "inquiries", label: "Inquiries" },
  { id: "purchase-orders", label: "Purchase Orders" },
  { id: "vendors", label: "Vendors" },
]

export default function PurchaseOrdersPage() {
  const router = useRouter()
  const { user, isLoading, logout } = useAuth()
  const { toast } = useToast()

  const [activeSection, setActiveSection] = useState("purchase-orders")
  const [orders, setOrders] = useState<PurchaseOrder[]>([])
  const [expanded, setExpanded] = useState<Record<number, POItem[]>>({})
  const [loadingItems, setLoadingItems] = useState<number | null>(null)
  const [generating, setGenerating] = useState(false)

  function handleSectionChange(section: string) {
    const routeMap: Record<string, string> = {
      "pending-work-orders": "/dashboard/purchase/pending-work-orders",
      bom: "/dashboard/purchase/bom",
      purchase: "/dashboard/purchase/purchase",
      inquiries: "/dashboard/purchase/inquiries",
      "purchase-orders": "/dashboard/purchase/purchase-orders",
      vendors: "/dashboard/purchase/vendors",
    }
    const target = routeMap[section]
    if (target) router.push(target)
  }

  async function fetchOrders() {
    try {
      const res = await fetch(apiUrl("/api/purchase/orders"), { credentials: "include" })
      if (!res.ok) throw new Error("Failed to fetch")
      const data = await res.json()
      setOrders(data.purchase_orders || [])
    } catch {
      toast({ title: "Error", description: "Failed to load purchase orders", variant: "destructive" })
    }
  }

  async function toggleExpand(poId: number) {
    if (expanded[poId]) {
      setExpanded((prev) => {
        const copy = { ...prev }
        delete copy[poId]
        return copy
      })
      return
    }

    setLoadingItems(poId)
    try {
      const res = await fetch(apiUrl(`/api/purchase/orders/${poId}`), { credentials: "include" })
      if (!res.ok) throw new Error("Failed to fetch")
      const data = await res.json()
      setExpanded((prev) => ({ ...prev, [poId]: data.items || [] }))
    } catch {
      toast({ title: "Error", description: "Failed to load PO items", variant: "destructive" })
    } finally {
      setLoadingItems(null)
    }
  }

  async function generatePOs() {
    setGenerating(true)
    try {
      const res = await fetch(apiUrl("/api/purchase/orders/generate"), {
        method: "POST",
        credentials: "include",
      })

      const data = await res.json()

      if (!res.ok) {
        toast({ title: "Info", description: data.message || "Cannot generate POs at this time", variant: "destructive" })
        return
      }

      toast({
        title: "Purchase Orders Generated",
        description: data.message || `Created ${data.purchase_orders?.length || 0} PO(s)`,
      })
      await fetchOrders()
    } catch {
      toast({ title: "Error", description: "Failed to generate purchase orders", variant: "destructive" })
    } finally {
      setGenerating(false)
    }
  }

  useEffect(() => {
    fetchOrders()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const statusColors: Record<string, string> = {
    draft: "bg-gray-100 text-gray-700",
    sent: "bg-blue-100 text-blue-700",
    acknowledged: "bg-yellow-100 text-yellow-800",
    completed: "bg-green-100 text-green-700",
    cancelled: "bg-red-100 text-red-700",
  }

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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-800">Purchase Orders</h1>
            <p className="text-sm text-gray-500">
              Auto-generated POs based on lowest vendor prices. Click &quot;Generate POs&quot; after all vendor prices are filled in.
            </p>
          </div>
          <Button
            onClick={generatePOs}
            disabled={generating}
            className="bg-orange-500 hover:bg-orange-600 text-white"
          >
            <Zap className="h-4 w-4 mr-1" />
            {generating ? "Generating..." : "Generate POs"}
          </Button>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-700">
              <tr>
                <th className="px-4 py-2 text-left w-8"></th>
                <th className="px-4 py-2 text-left">PO Number</th>
                <th className="px-4 py-2 text-left">Vendor</th>
                <th className="px-4 py-2 text-left">Items</th>
                <th className="px-4 py-2 text-left">Total Amount</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-left">Created</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr>
                  <td className="px-4 py-4 text-gray-400" colSpan={7}>
                    No purchase orders yet. Fill in all vendor prices in Inquiries tab, then click &quot;Generate POs&quot;.
                  </td>
                </tr>
              ) : (
                orders.map((po) => {
                  const isOpen = !!expanded[po.id]
                  const items = expanded[po.id] || []
                  return (
                    <Fragment key={po.id}>
                      <tr
                        className="border-t hover:bg-gray-50 cursor-pointer"
                        onClick={() => toggleExpand(po.id)}
                      >
                        <td className="px-4 py-2">
                          {loadingItems === po.id ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-500" />
                          ) : isOpen ? (
                            <ChevronDown className="h-4 w-4 text-gray-500" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-gray-500" />
                          )}
                        </td>
                        <td className="px-4 py-2 font-medium">{po.po_number}</td>
                        <td className="px-4 py-2">{po.vendor_name}</td>
                        <td className="px-4 py-2">{po.item_count}</td>
                        <td className="px-4 py-2 font-medium">₹{po.total_amount.toFixed(2)}</td>
                        <td className="px-4 py-2">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[po.status] || "bg-gray-100 text-gray-700"}`}>
                            {po.status}
                          </span>
                        </td>
                        <td className="px-4 py-2">{po.created_at ? new Date(po.created_at).toLocaleDateString() : "-"}</td>
                      </tr>
                      {isOpen && items.length > 0 && (
                        <tr>
                          <td colSpan={7} className="px-0 py-0">
                            <div className="bg-gray-50 border-t border-b">
                              <table className="min-w-full text-sm">
                                <thead>
                                  <tr className="text-gray-500 text-xs">
                                    <th className="px-8 py-1.5 text-left">Part</th>
                                    <th className="px-4 py-1.5 text-left">Specification</th>
                                    <th className="px-4 py-1.5 text-left">Qty</th>
                                    <th className="px-4 py-1.5 text-left">Unit</th>
                                    <th className="px-4 py-1.5 text-left">Unit Price</th>
                                    <th className="px-4 py-1.5 text-left">Total</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {items.map((item) => (
                                    <tr key={item.id} className="border-t border-gray-200">
                                      <td className="px-8 py-2 font-medium">{item.part_name}</td>
                                      <td className="px-4 py-2 text-gray-500">{item.specification || "-"}</td>
                                      <td className="px-4 py-2">{item.quantity}</td>
                                      <td className="px-4 py-2">{item.unit}</td>
                                      <td className="px-4 py-2">₹{item.unit_price.toFixed(2)}</td>
                                      <td className="px-4 py-2 font-medium">₹{item.total_price.toFixed(2)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  )
}
