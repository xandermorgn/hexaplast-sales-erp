"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { apiUrl } from "@/lib/api"
import { Check, DollarSign } from "lucide-react"

type Inquiry = {
  id: number
  bom_material_id: number
  vendor_id: number
  message: string | null
  sent_via: string
  status: string
  created_at: string
  part_name: string
  part_number: string | null
  specification: string | null
  quantity: number
  unit: string
  vendor_name: string
  vendor_phone: string | null
  work_order_id: number
  machine_id: number
  machine_index: number
  work_order_number: string | null
  machine_name: string | null
  latest_unit_price: number | null
  latest_total_price: number | null
  latest_remarks: string | null
}

const menuItems = [
  { id: "pending-work-orders", label: "Pending Work Orders" },
  { id: "bom", label: "Bill of Materials" },
  { id: "purchase", label: "Purchase" },
  { id: "inquiries", label: "Inquiries" },
  { id: "purchase-orders", label: "Purchase Orders" },
  { id: "vendors", label: "Vendors" },
]

export default function InquiriesPage() {
  const router = useRouter()
  const { user, isLoading, logout } = useAuth()
  const { toast } = useToast()

  const [activeSection, setActiveSection] = useState("inquiries")
  const [inquiries, setInquiries] = useState<Inquiry[]>([])
  const [priceInputs, setPriceInputs] = useState<Record<number, { unit_price: string; remarks: string }>>({})
  const [savingId, setSavingId] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<"all" | "pending" | "responded">("all")

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

  async function fetchInquiries() {
    try {
      const res = await fetch(apiUrl("/api/purchase/inquiries"), { credentials: "include" })
      if (!res.ok) throw new Error("Failed to fetch")
      const data = await res.json()
      setInquiries(data.inquiries || [])
    } catch {
      toast({ title: "Error", description: "Failed to load inquiries", variant: "destructive" })
    }
  }

  useEffect(() => {
    fetchInquiries()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function getPriceInput(inquiryId: number) {
    return priceInputs[inquiryId] || { unit_price: "", remarks: "" }
  }

  function setPriceField(inquiryId: number, field: "unit_price" | "remarks", value: string) {
    setPriceInputs((prev) => ({
      ...prev,
      [inquiryId]: { ...getPriceInput(inquiryId), [field]: value },
    }))
  }

  async function saveResponse(inquiry: Inquiry) {
    const input = getPriceInput(inquiry.id)
    if (!input.unit_price || isNaN(Number(input.unit_price))) {
      toast({ title: "Error", description: "Enter a valid unit price", variant: "destructive" })
      return
    }

    setSavingId(inquiry.id)
    try {
      const res = await fetch(apiUrl(`/api/purchase/inquiries/${inquiry.id}/response`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          unit_price: Number(input.unit_price),
          remarks: input.remarks || null,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        toast({ title: "Error", description: err.message || "Failed to save response", variant: "destructive" })
        return
      }

      toast({ title: "Saved", description: `Price saved for ${inquiry.vendor_name}` })
      // Clear input
      setPriceInputs((prev) => {
        const copy = { ...prev }
        delete copy[inquiry.id]
        return copy
      })
      await fetchInquiries()
    } catch {
      toast({ title: "Error", description: "Failed to save response", variant: "destructive" })
    } finally {
      setSavingId(null)
    }
  }

  // Group inquiries by material
  type MaterialGroup = {
    bom_material_id: number
    part_name: string
    specification: string | null
    quantity: number
    unit: string
    work_order_number: string | null
    machine_name: string | null
    machine_index: number
    inquiries: Inquiry[]
  }

  const materialGroups: MaterialGroup[] = (() => {
    const map: Record<number, MaterialGroup> = {}
    for (const inq of inquiries) {
      if (!map[inq.bom_material_id]) {
        map[inq.bom_material_id] = {
          bom_material_id: inq.bom_material_id,
          part_name: inq.part_name,
          specification: inq.specification,
          quantity: inq.quantity,
          unit: inq.unit,
          work_order_number: inq.work_order_number,
          machine_name: inq.machine_name,
          machine_index: inq.machine_index,
          inquiries: [],
        }
      }
      map[inq.bom_material_id].inquiries.push(inq)
    }
    return Object.values(map)
  })()

  // Filter based on active tab
  const filtered = materialGroups.filter((group) => {
    if (activeTab === "pending") return group.inquiries.some((i) => i.status === "sent")
    if (activeTab === "responded") return group.inquiries.every((i) => i.status === "responded" || i.status === "closed")
    return true
  })

  const statusColors: Record<string, string> = {
    sent: "bg-blue-100 text-blue-700",
    responded: "bg-green-100 text-green-700",
    closed: "bg-gray-100 text-gray-500",
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
          <h1 className="text-2xl font-semibold text-gray-800">Inquiries</h1>
          <p className="text-sm text-gray-500">All purchase inquiries sent to vendors. Enter vendor prices to enable auto PO generation.</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-gray-200">
          {(["all", "pending", "responded"] as const).map((tab) => (
            <button
              key={tab}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? "border-orange-500 text-orange-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
              onClick={() => setActiveTab(tab)}
            >
              {tab === "all" ? "All Inquiries" : tab === "pending" ? "Awaiting Response" : "Responded"}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-400">
            {inquiries.length === 0
              ? "No inquiries sent yet. Send inquiries from the Purchase tab."
              : "No inquiries match this filter."}
          </div>
        ) : (
          filtered.map((group) => {
            // Check if all inquiries for this material have responses
            const allResponded = group.inquiries.every((i) => i.latest_unit_price !== null)
            // Find lowest price
            const respondedInqs = group.inquiries.filter((i) => i.latest_unit_price !== null)
            const lowestPrice = respondedInqs.length > 0
              ? Math.min(...respondedInqs.map((i) => i.latest_unit_price!))
              : null

            return (
              <div key={group.bom_material_id} className="rounded-lg border border-gray-200 bg-white overflow-hidden">
                {/* Material header */}
                <div className="bg-gray-50 px-4 py-3 flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-gray-800">{group.part_name}</span>
                    {group.specification && <span className="text-gray-400 text-sm ml-2">({group.specification})</span>}
                    <span className="text-gray-500 text-sm ml-3">Qty: {group.quantity} {group.unit}</span>
                    {group.work_order_number && (
                      <span className="text-gray-400 text-xs ml-3">{group.work_order_number} • {group.machine_name} #{group.machine_index}</span>
                    )}
                  </div>
                  {allResponded && respondedInqs.length >= 2 && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">
                      All prices received
                    </span>
                  )}
                </div>

                {/* Vendor inquiry rows */}
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-t text-gray-500 text-xs">
                      <th className="px-4 py-1.5 text-left">Vendor</th>
                      <th className="px-4 py-1.5 text-left">Status</th>
                      <th className="px-4 py-1.5 text-left">Unit Price</th>
                      <th className="px-4 py-1.5 text-left">Total</th>
                      <th className="px-4 py-1.5 text-left">Remarks</th>
                      <th className="px-4 py-1.5 text-left">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.inquiries.map((inq) => {
                      const input = getPriceInput(inq.id)
                      const isLowest = lowestPrice !== null && inq.latest_unit_price === lowestPrice
                      return (
                        <tr key={inq.id} className={`border-t hover:bg-gray-50 ${isLowest && inq.latest_unit_price !== null ? "bg-green-50" : ""}`}>
                          <td className="px-4 py-2 font-medium">{inq.vendor_name}</td>
                          <td className="px-4 py-2">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[inq.status] || "bg-gray-100 text-gray-700"}`}>
                              {inq.status}
                            </span>
                          </td>
                          <td className="px-4 py-2">
                            {inq.latest_unit_price !== null ? (
                              <span className={`font-medium ${isLowest ? "text-green-700" : ""}`}>
                                ₹{inq.latest_unit_price.toFixed(2)}
                                {isLowest && <span className="ml-1 text-xs">✓ Lowest</span>}
                              </span>
                            ) : (
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="Enter price"
                                value={input.unit_price}
                                onChange={(e) => setPriceField(inq.id, "unit_price", e.target.value)}
                                className="h-8 w-28 text-sm"
                              />
                            )}
                          </td>
                          <td className="px-4 py-2 text-gray-500">
                            {inq.latest_total_price !== null ? `₹${inq.latest_total_price.toFixed(2)}` : "-"}
                          </td>
                          <td className="px-4 py-2">
                            {inq.latest_remarks || (
                              inq.latest_unit_price === null ? (
                                <Input
                                  placeholder="Remarks"
                                  value={input.remarks}
                                  onChange={(e) => setPriceField(inq.id, "remarks", e.target.value)}
                                  className="h-8 w-32 text-sm"
                                />
                              ) : <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-4 py-2">
                            {inq.latest_unit_price === null ? (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={!input.unit_price || savingId === inq.id}
                                onClick={() => saveResponse(inq)}
                                className="text-xs"
                              >
                                <Check className="h-3 w-3 mr-1" />
                                {savingId === inq.id ? "Saving..." : "Save Price"}
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-xs text-gray-500"
                                onClick={() => {
                                  // Allow re-entry by resetting
                                  setPriceInputs((prev) => ({
                                    ...prev,
                                    [inq.id]: { unit_price: String(inq.latest_unit_price), remarks: inq.latest_remarks || "" },
                                  }))
                                  // Clear latest so it shows input again – re-fetch will reset
                                  setInquiries((prev) =>
                                    prev.map((i) =>
                                      i.id === inq.id
                                        ? { ...i, latest_unit_price: null, latest_total_price: null, latest_remarks: null, status: "sent" }
                                        : i
                                    )
                                  )
                                }}
                              >
                                Edit
                              </Button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )
          })
        )}
      </div>
    </DashboardLayout>
  )
}
