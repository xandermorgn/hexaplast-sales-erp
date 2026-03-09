"use client"

import { Fragment, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { apiUrl } from "@/lib/api"
import { ChevronDown, ChevronRight } from "lucide-react"

type Bom = {
  id: number
  work_order_id: number
  machine_id: number
  machine_index: number
  status: string
  created_at: string
  work_order_number: string | null
  machine_name: string | null
  material_count: number
}

type WoGroup = {
  work_order_number: string
  work_order_id: number
  boms: Bom[]
  totalMaterials: number
  created: string
}

const menuItems = [
  { id: "pending-work-orders", label: "Pending Work Orders" },
  { id: "bom", label: "Bill of Materials" },
  { id: "purchase", label: "Purchase" },
  { id: "inquiries", label: "Inquiries" },
  { id: "purchase-orders", label: "Purchase Orders" },
  { id: "vendors", label: "Vendors" },
]

export default function BomListPage() {
  const router = useRouter()
  const { user, isLoading, logout } = useAuth()
  const { toast } = useToast()

  const [activeSection, setActiveSection] = useState("bom")
  const [boms, setBoms] = useState<Bom[]>([])
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

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

  async function fetchBoms() {
    try {
      const res = await fetch(apiUrl("/api/purchase/bom"), { credentials: "include" })
      if (!res.ok) throw new Error("Failed to fetch")
      const data = await res.json()
      setBoms(data.boms || [])
    } catch {
      toast({ title: "Error", description: "Failed to load BOMs", variant: "destructive" })
    }
  }

  useEffect(() => {
    fetchBoms()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Group BOMs by work order
  const woGroups: WoGroup[] = (() => {
    const map: Record<string, WoGroup> = {}
    for (const bom of boms) {
      const key = bom.work_order_number || `WO-${bom.work_order_id}`
      if (!map[key]) {
        map[key] = {
          work_order_number: key,
          work_order_id: bom.work_order_id,
          boms: [],
          totalMaterials: 0,
          created: bom.created_at,
        }
      }
      map[key].boms.push(bom)
      map[key].totalMaterials += bom.material_count
    }
    return Object.values(map)
  })()

  const toggleExpand = (woNum: string) => {
    setExpanded((prev) => ({ ...prev, [woNum]: !prev[woNum] }))
  }

  const statusColors: Record<string, string> = {
    draft: "bg-gray-100 text-gray-700",
    in_progress: "bg-yellow-100 text-yellow-800",
    completed: "bg-green-100 text-green-700",
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
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">Bill of Materials</h1>
          <p className="text-sm text-gray-500">All generated BOMs grouped by work order. Expand to see machines.</p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-700">
              <tr>
                <th className="px-4 py-2 text-left w-8"></th>
                <th className="px-4 py-2 text-left">Work Order</th>
                <th className="px-4 py-2 text-left">Machines</th>
                <th className="px-4 py-2 text-left">Total Materials</th>
                <th className="px-4 py-2 text-left">Created</th>
              </tr>
            </thead>
            <tbody>
              {woGroups.length === 0 ? (
                <tr><td className="px-4 py-4 text-gray-400" colSpan={5}>No BOMs created yet.</td></tr>
              ) : (
                woGroups.map((group) => {
                  const isOpen = expanded[group.work_order_number]
                  return (
                    <Fragment key={group.work_order_number}>
                      <tr
                        className="border-t hover:bg-gray-50 cursor-pointer"
                        onClick={() => toggleExpand(group.work_order_number)}
                      >
                        <td className="px-4 py-2">
                          {isOpen ? <ChevronDown className="h-4 w-4 text-gray-500" /> : <ChevronRight className="h-4 w-4 text-gray-500" />}
                        </td>
                        <td className="px-4 py-2 font-medium">{group.work_order_number}</td>
                        <td className="px-4 py-2">{group.boms.length} machine(s)</td>
                        <td className="px-4 py-2">{group.totalMaterials}</td>
                        <td className="px-4 py-2">{group.created ? new Date(group.created).toLocaleDateString() : "-"}</td>
                      </tr>
                      {isOpen && (
                        <tr>
                          <td colSpan={5} className="px-0 py-0">
                            <div className="bg-gray-50 border-t border-b">
                              <table className="min-w-full text-sm">
                                <thead>
                                  <tr className="text-gray-500 text-xs">
                                    <th className="px-8 py-1.5 text-left">Machine #</th>
                                    <th className="px-4 py-1.5 text-left">Product</th>
                                    <th className="px-4 py-1.5 text-left">Materials</th>
                                    <th className="px-4 py-1.5 text-left">Status</th>
                                    <th className="px-4 py-1.5 text-left">Action</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {group.boms.map((bom) => (
                                    <tr key={bom.id} className="border-t border-gray-200 hover:bg-white">
                                      <td className="px-8 py-2">Machine #{bom.machine_index}</td>
                                      <td className="px-4 py-2">{bom.machine_name || "-"}</td>
                                      <td className="px-4 py-2">{bom.material_count}</td>
                                      <td className="px-4 py-2">
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[bom.status] || "bg-gray-100 text-gray-700"}`}>
                                          {bom.status.replace("_", " ")}
                                        </span>
                                      </td>
                                      <td className="px-4 py-2">
                                        <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); router.push(`/dashboard/purchase/bom/${bom.id}`); }}>
                                          Open Editor
                                        </Button>
                                      </td>
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
