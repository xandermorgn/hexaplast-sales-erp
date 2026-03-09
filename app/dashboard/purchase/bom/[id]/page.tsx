"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { apiUrl } from "@/lib/api"

type BomDetail = {
  id: number
  work_order_id: number
  machine_id: number
  machine_index: number
  status: string
  work_order_number: string | null
  machine_name: string | null
}

type Material = {
  id: number
  bom_id: number
  part_id: number | null
  part_number: string | null
  part_name: string
  specification: string | null
  quantity: number
  unit: string
  notes: string | null
  added_to_purchase: number
  vendor_id: number | null
  vendor_name: string | null
}

const menuItems = [
  { id: "pending-work-orders", label: "Pending Work Orders" },
  { id: "bom", label: "Bill of Materials" },
  { id: "purchase", label: "Purchase" },
  { id: "inquiries", label: "Inquiries" },
  { id: "purchase-orders", label: "Purchase Orders" },
  { id: "vendors", label: "Vendors" },
]

export default function BomEditorPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const { user, isLoading, logout } = useAuth()
  const { toast } = useToast()

  const [activeSection, setActiveSection] = useState("bom")
  const [bom, setBom] = useState<BomDetail | null>(null)
  const [materials, setMaterials] = useState<Material[]>([])
  const [loading, setLoading] = useState(true)

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

  async function fetchBom() {
    try {
      setLoading(true)
      const res = await fetch(apiUrl(`/api/purchase/bom/${params?.id}`), { credentials: "include" })
      if (!res.ok) throw new Error("Failed to fetch BOM")
      const data = await res.json()
      setBom(data.bom)
      setMaterials(data.materials || [])
    } catch {
      toast({ title: "Error", description: "Failed to load BOM", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  async function updateMaterialQuantity(materialId: number, quantity: number) {
    try {
      const res = await fetch(apiUrl(`/api/purchase/bom/${params?.id}/material/${materialId}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ quantity }),
      })
      if (!res.ok) throw new Error("Failed to update")
      setMaterials((prev) => prev.map((m) => m.id === materialId ? { ...m, quantity } : m))
    } catch {
      toast({ title: "Error", description: "Failed to update quantity", variant: "destructive" })
    }
  }

  async function addToPurchase(materialId: number) {
    try {
      const res = await fetch(apiUrl(`/api/purchase/bom/${params?.id}/material/${materialId}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ added_to_purchase: true }),
      })
      if (!res.ok) throw new Error("Failed to update")
      const data = await res.json()
      setMaterials((prev) => prev.map((m) => m.id === materialId ? { ...m, ...data.material, added_to_purchase: 1 } : m))
      toast({ title: "Added", description: "Material added to purchase list" })
    } catch {
      toast({ title: "Error", description: "Failed to add to purchase", variant: "destructive" })
    }
  }

  async function removeFromPurchase(materialId: number) {
    try {
      const res = await fetch(apiUrl(`/api/purchase/bom/${params?.id}/material/${materialId}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ added_to_purchase: false }),
      })
      if (!res.ok) throw new Error("Failed to update")
      setMaterials((prev) => prev.map((m) => m.id === materialId ? { ...m, added_to_purchase: 0 } : m))
    } catch {
      toast({ title: "Error", description: "Failed to remove from purchase", variant: "destructive" })
    }
  }

  async function updateBomStatus(status: string) {
    try {
      const res = await fetch(apiUrl(`/api/purchase/bom/${params?.id}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error("Failed to update status")
      setBom((prev) => prev ? { ...prev, status } : prev)
      toast({ title: "Updated", description: `BOM status set to ${status.replace("_", " ")}` })
    } catch {
      toast({ title: "Error", description: "Failed to update BOM status", variant: "destructive" })
    }
  }

  useEffect(() => {
    if (params?.id) fetchBom()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params?.id])

  if (isLoading || loading) {
    return (
      <DashboardLayout title="Purchase" menuItems={menuItems} activeSection={activeSection} onSectionChange={handleSectionChange} loginId={user?.loginId || ""} onLogout={logout}>
        <div className="p-6">Loading...</div>
      </DashboardLayout>
    )
  }

  if (!bom) {
    return (
      <DashboardLayout title="Purchase" menuItems={menuItems} activeSection={activeSection} onSectionChange={handleSectionChange} loginId={user?.loginId || ""} onLogout={logout}>
        <div className="p-6 text-red-600">BOM not found.</div>
      </DashboardLayout>
    )
  }

  const statusColors: Record<string, string> = {
    draft: "bg-gray-100 text-gray-700",
    in_progress: "bg-yellow-100 text-yellow-800",
    completed: "bg-green-100 text-green-700",
  }

  return (
    <DashboardLayout title="Purchase" menuItems={menuItems} activeSection={activeSection} onSectionChange={handleSectionChange} loginId={user?.loginId || ""} onLogout={logout}>
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-800">BOM Editor</h1>
            <p className="text-sm text-gray-500">
              {bom.work_order_number} — {bom.machine_name || "Machine"} #{bom.machine_index}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[bom.status] || ""}`}>
              {bom.status.replace("_", " ")}
            </span>
            <Button size="sm" variant="outline" onClick={() => router.push("/dashboard/purchase/bom")}>
              ← Back to list
            </Button>
          </div>
        </div>

        <div className="flex gap-2">
          <Button size="sm" variant={bom.status === "draft" ? "default" : "outline"} onClick={() => updateBomStatus("draft")}>Draft</Button>
          <Button size="sm" variant={bom.status === "in_progress" ? "default" : "outline"} onClick={() => updateBomStatus("in_progress")}>In Progress</Button>
          <Button size="sm" variant={bom.status === "completed" ? "default" : "outline"} onClick={() => updateBomStatus("completed")}>Completed</Button>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-700">
              <tr>
                <th className="px-4 py-2 text-left">#</th>
                <th className="px-4 py-2 text-left">Part Number</th>
                <th className="px-4 py-2 text-left">Part Name</th>
                <th className="px-4 py-2 text-left">Specification</th>
                <th className="px-4 py-2 text-left">Unit</th>
                <th className="px-4 py-2 text-left">Quantity</th>
                <th className="px-4 py-2 text-left">Add to Purchase</th>
              </tr>
            </thead>
            <tbody>
              {materials.length === 0 ? (
                <tr><td className="px-4 py-4 text-gray-400" colSpan={7}>No materials in this BOM.</td></tr>
              ) : (
                materials.map((mat, idx) => (
                  <tr key={mat.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-500">{idx + 1}</td>
                    <td className="px-4 py-2">{mat.part_number || "-"}</td>
                    <td className="px-4 py-2 font-medium">{mat.part_name}</td>
                    <td className="px-4 py-2">{mat.specification || "-"}</td>
                    <td className="px-4 py-2">{mat.unit}</td>
                    <td className="px-4 py-2">
                      <Input
                        type="number"
                        min="1"
                        className="h-8 w-20"
                        value={mat.quantity}
                        onChange={(e) => {
                          const newQty = Number(e.target.value) || 1
                          setMaterials((prev) => prev.map((m) => m.id === mat.id ? { ...m, quantity: newQty } : m))
                        }}
                        onBlur={(e) => {
                          const newQty = Number(e.target.value) || 1
                          updateMaterialQuantity(mat.id, newQty)
                        }}
                      />
                    </td>
                    <td className="px-4 py-2">
                      {mat.added_to_purchase ? (
                        <Button size="sm" variant="outline" className="text-green-600 border-green-300" onClick={() => removeFromPurchase(mat.id)}>
                          ✓ Added
                        </Button>
                      ) : (
                        <Button size="sm" onClick={() => addToPurchase(mat.id)}>
                          + Add
                        </Button>
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
