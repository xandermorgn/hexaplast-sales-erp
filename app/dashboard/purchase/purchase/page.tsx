"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { apiUrl } from "@/lib/api"
import { useSilentRefresh } from "@/hooks/use-silent-refresh"
import { Send, X, Plus, ChevronDown, ChevronRight } from "lucide-react"

type Vendor = {
  id: number
  name: string
  phone: string | null
  email: string | null
  gst: string | null
}

type PurchaseMaterial = {
  id: number
  bom_id: number
  part_number: string | null
  part_name: string
  specification: string | null
  quantity: number
  unit: string
  work_order_id: number
  machine_id: number
  machine_index: number
  work_order_number: string | null
  machine_name: string | null
  vendor_id: number | null
  vendor_name: string | null
  vendor_phone: string | null
  vendor_email: string | null
  inquiry_count: number
  inquiry_pending_count: number
  inquiry_responded_count: number
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

export default function PurchasePage() {
  const router = useRouter()
  const { user, isLoading, logout } = useAuth()
  const { toast } = useToast()

  const [activeSection, setActiveSection] = useState("purchase")
  const [materials, setMaterials] = useState<PurchaseMaterial[]>([])
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [selectedVendors, setSelectedVendors] = useState<Record<number, number[]>>({})
  const [sendingInquiry, setSendingInquiry] = useState<number | null>(null)

  // Vendor selection modal state
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})
  const [vendorModalMaterialId, setVendorModalMaterialId] = useState<number | null>(null)
  const [vendorSearch, setVendorSearch] = useState("")
  const [vendorModalSelection, setVendorModalSelection] = useState<number[]>([])

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

  async function fetchData() {
    try {
      const [matRes, vendorRes] = await Promise.all([
        fetch(apiUrl("/api/purchase/materials"), { credentials: "include" }),
        fetch(apiUrl("/api/vendors"), { credentials: "include" }),
      ])
      if (matRes.ok) {
        const matData = await matRes.json()
        setMaterials(matData.materials || [])
      }
      if (vendorRes.ok) {
        const vendorData = await vendorRes.json()
        setVendors(vendorData.vendors || [])
      }
    } catch {
      toast({ title: "Error", description: "Failed to load purchase data", variant: "destructive" })
    }
  }

  // ── Vendor Modal ──

  function openVendorModal(materialId: number) {
    setVendorModalMaterialId(materialId)
    setVendorSearch("")
    setVendorModalSelection(selectedVendors[materialId] || [])
  }

  function closeVendorModal() {
    setVendorModalMaterialId(null)
    setVendorSearch("")
    setVendorModalSelection([])
  }

  function toggleModalVendor(vendorId: number) {
    setVendorModalSelection((prev) =>
      prev.includes(vendorId) ? prev.filter((id) => id !== vendorId) : [...prev, vendorId]
    )
  }

  function confirmVendorSelection() {
    if (vendorModalMaterialId === null) return
    setSelectedVendors((prev) => ({ ...prev, [vendorModalMaterialId]: vendorModalSelection }))
    closeVendorModal()
  }

  function removeVendorTag(materialId: number, vendorId: number) {
    setSelectedVendors((prev) => ({
      ...prev,
      [materialId]: (prev[materialId] || []).filter((id) => id !== vendorId),
    }))
  }

  const filteredVendors = vendors.filter((v) => {
    if (!vendorSearch.trim()) return true
    const q = vendorSearch.toLowerCase()
    return (
      v.name.toLowerCase().includes(q) ||
      (v.phone || "").toLowerCase().includes(q) ||
      (v.email || "").toLowerCase().includes(q) ||
      (v.gst || "").toLowerCase().includes(q)
    )
  })

  // ── WhatsApp + Inquiry ──

  function buildWhatsAppMessage(mat: PurchaseMaterial): string {
    let msg = "Hello,\n\nWe require the following material:\n\n"
    msg += `*${mat.part_name}*${mat.specification ? ` – ${mat.specification}` : ""}\n`
    msg += `Qty: ${mat.quantity} ${mat.unit}\n`
    if (mat.work_order_number) msg += `Work Order: ${mat.work_order_number}\n`
    msg += "\nPlease share your best quotation.\n\nHexaplast Procurement Team"
    return msg
  }

  function sendWhatsApp(mat: PurchaseMaterial, vendor: Vendor) {
    if (!vendor.phone) {
      toast({ title: "Error", description: `${vendor.name} has no phone number`, variant: "destructive" })
      return
    }
    const message = buildWhatsAppMessage(mat)
    const phone = vendor.phone.replace(/[^0-9]/g, "")
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer")
  }

  async function sendInquiryToVendors(mat: PurchaseMaterial) {
    const vendorIds = selectedVendors[mat.id] || []
    if (vendorIds.length === 0) {
      toast({ title: "Select vendors", description: "Click '+ Add Vendors' to select vendors first", variant: "destructive" })
      return
    }

    setSendingInquiry(mat.id)
    try {
      const res = await fetch(apiUrl("/api/purchase/inquiries"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          bom_material_id: mat.id,
          vendor_ids: vendorIds,
          message: buildWhatsAppMessage(mat),
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        toast({ title: "Error", description: err.message || "Failed to create inquiry", variant: "destructive" })
        setSendingInquiry(null)
        return
      }

      const data = await res.json()

      for (const vendorId of vendorIds) {
        const vendor = vendors.find((v) => v.id === vendorId)
        if (vendor) sendWhatsApp(mat, vendor)
      }

      toast({
        title: "Inquiries sent",
        description: `Created ${data.inquiries?.length || vendorIds.length} inquiry record(s) and opened WhatsApp`,
      })

      setSelectedVendors((prev) => {
        const copy = { ...prev }
        delete copy[mat.id]
        return copy
      })
    } catch {
      toast({ title: "Error", description: "Failed to send inquiry", variant: "destructive" })
    } finally {
      setSendingInquiry(null)
    }
  }

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Silent background refresh every 30s
  const silentRefresh = useCallback(async () => { await fetchData() }, [])
  useSilentRefresh(silentRefresh, 30000)

  // Group materials by work order, newest first
  const grouped = materials.reduce<Record<string, PurchaseMaterial[]>>((acc, mat) => {
    const key = mat.work_order_number || `WO-${mat.work_order_id}`
    if (!acc[key]) acc[key] = []
    acc[key].push(mat)
    return acc
  }, {})

  // Sort work order keys in reverse (newest/highest number first)
  const sortedWoKeys = Object.keys(grouped).sort((a, b) => {
    const numA = parseInt(a.replace(/[^0-9]/g, "")) || 0
    const numB = parseInt(b.replace(/[^0-9]/g, "")) || 0
    return numB - numA
  })

  // Auto-collapse all except the first (newest) group on initial load
  useEffect(() => {
    if (sortedWoKeys.length > 1) {
      setCollapsedGroups((prev) => {
        const next = { ...prev }
        sortedWoKeys.forEach((key, idx) => {
          if (!(key in next)) next[key] = idx > 0
        })
        return next
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [materials.length])

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
          <h1 className="text-2xl font-semibold text-gray-800">Purchase</h1>
          <p className="text-sm text-gray-500">Materials added to purchase from BOM editors. Select vendors and send inquiries per material.</p>
        </div>

        {materials.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-400">
            No materials in purchase list. Add materials from the BOM editor.
          </div>
        ) : (
          sortedWoKeys.map((woNumber) => {
            const mats = grouped[woNumber]
            const isCollapsed = collapsedGroups[woNumber] ?? false
            return (
            <div key={woNumber} className="space-y-0">
              <button
                type="button"
                className="flex items-center gap-2 w-full text-left py-2 group"
                onClick={() => setCollapsedGroups((prev) => ({ ...prev, [woNumber]: !prev[woNumber] }))}
              >
                {isCollapsed ? <ChevronRight className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
                <h2 className="text-lg font-semibold text-gray-700 group-hover:text-orange-600 transition-colors">{woNumber}</h2>
                <span className="text-xs text-gray-400 ml-2">{mats.length} material{mats.length !== 1 ? "s" : ""}</span>
              </button>
              {!isCollapsed && (
              <div className="rounded-lg border border-gray-200 bg-white overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-gray-700">
                    <tr>
                      <th className="px-4 py-2 text-left">Machine</th>
                      <th className="px-4 py-2 text-left">Material</th>
                      <th className="px-4 py-2 text-left">Qty</th>
                      <th className="px-4 py-2 text-left">Unit</th>
                      <th className="px-4 py-2 text-left">Send Inquiry To</th>
                      <th className="px-4 py-2 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mats.map((mat) => {
                      const selected = selectedVendors[mat.id] || []
                      return (
                        <tr key={mat.id} className="border-t hover:bg-gray-50">
                          <td className="px-4 py-2">{mat.machine_name || "-"} #{mat.machine_index}</td>
                          <td className="px-4 py-2 font-medium">
                            {mat.part_name}
                            {mat.specification && <span className="text-gray-400 text-xs ml-1">({mat.specification})</span>}
                          </td>
                          <td className="px-4 py-2">{mat.quantity}</td>
                          <td className="px-4 py-2">{mat.unit}</td>
                          <td className="px-4 py-2">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {selected.map((vid) => {
                                const v = vendors.find((vn) => vn.id === vid)
                                if (!v) return null
                                return (
                                  <span key={vid} className="inline-flex items-center gap-1 bg-blue-50 border border-blue-200 text-blue-700 text-xs px-2 py-0.5 rounded-full">
                                    {v.name}
                                    <button type="button" onClick={() => removeVendorTag(mat.id, vid)} className="hover:text-red-500">
                                      <X className="h-3 w-3" />
                                    </button>
                                  </span>
                                )
                              })}
                              <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => openVendorModal(mat.id)}>
                                <Plus className="h-3 w-3 mr-1" />
                                Add Vendors
                              </Button>
                            </div>
                          </td>
                          <td className="px-4 py-2">
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                className="bg-green-600 hover:bg-green-700 text-white text-xs"
                                disabled={selected.length === 0 || sendingInquiry === mat.id}
                                onClick={() => sendInquiryToVendors(mat)}
                              >
                                <Send className="h-3 w-3 mr-1" />
                                {sendingInquiry === mat.id ? "Sending..." : "Send Inquiry"}
                              </Button>
                              {mat.inquiry_count > 0 && (
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                  mat.inquiry_responded_count >= mat.inquiry_count
                                    ? "bg-green-100 text-green-700"
                                    : mat.inquiry_pending_count > 0
                                    ? "bg-blue-100 text-blue-700"
                                    : "bg-gray-100 text-gray-600"
                                }`}>
                                  {mat.inquiry_responded_count >= mat.inquiry_count
                                    ? `${mat.inquiry_count} responded`
                                    : `${mat.inquiry_count} sent`}
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              )}
            </div>
            )
          })
        )}

        {/* Add Vendors Modal */}
        {vendorModalMaterialId !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 p-6 space-y-4 max-h-[85vh] flex flex-col">
              <h3 className="text-lg font-semibold text-gray-800">Select Vendors</h3>
              <Input
                placeholder="Search vendors by name, phone, email, or GST..."
                value={vendorSearch}
                onChange={(e) => setVendorSearch(e.target.value)}
                autoFocus
              />
              <div className="flex-1 overflow-y-auto rounded-lg border border-gray-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-gray-700 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left w-10"></th>
                      <th className="px-3 py-2 text-left">Vendor Name</th>
                      <th className="px-3 py-2 text-left">Phone</th>
                      <th className="px-3 py-2 text-left">Email</th>
                      <th className="px-3 py-2 text-left">GST</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredVendors.length === 0 ? (
                      <tr><td className="px-3 py-4 text-gray-400" colSpan={5}>No vendors found.</td></tr>
                    ) : (
                      filteredVendors.map((v) => (
                        <tr key={v.id} className="border-t hover:bg-gray-50 cursor-pointer" onClick={() => toggleModalVendor(v.id)}>
                          <td className="px-3 py-2">
                            <input type="checkbox" checked={vendorModalSelection.includes(v.id)} onChange={() => toggleModalVendor(v.id)} className="rounded border-gray-300" />
                          </td>
                          <td className="px-3 py-2 font-medium">{v.name}</td>
                          <td className="px-3 py-2">{v.phone || "-"}</td>
                          <td className="px-3 py-2">{v.email || "-"}</td>
                          <td className="px-3 py-2">{v.gst || "-"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">{vendorModalSelection.length} vendor(s) selected</span>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={closeVendorModal}>Cancel</Button>
                  <Button type="button" onClick={confirmVendorSelection}>Confirm Vendors</Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
