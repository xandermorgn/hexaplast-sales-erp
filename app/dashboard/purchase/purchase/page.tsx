"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { apiUrl } from "@/lib/api"
import { MessageCircle, Send } from "lucide-react"

type Vendor = {
  id: number
  name: string
  phone: string | null
  email: string | null
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
}

const menuItems = [
  { id: "pending-work-orders", label: "Pending Work Orders" },
  { id: "bom", label: "Bill of Materials" },
  { id: "purchase", label: "Purchase" },
  { id: "inquiries", label: "Inquiries" },
  { id: "purchase-orders", label: "Purchase Orders" },
  { id: "vendors", label: "Vendors" },
]

export default function PurchasePage() {
  const router = useRouter()
  const { user, isLoading, logout } = useAuth()
  const { toast } = useToast()

  const [activeSection, setActiveSection] = useState("purchase")
  const [materials, setMaterials] = useState<PurchaseMaterial[]>([])
  const [vendors, setVendors] = useState<Vendor[]>([])
  // Track selected vendors per material for multi-vendor inquiry
  const [selectedVendors, setSelectedVendors] = useState<Record<number, number[]>>({})
  const [sendingInquiry, setSendingInquiry] = useState<number | null>(null)

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

  function toggleVendorSelection(materialId: number, vendorId: number) {
    setSelectedVendors((prev) => {
      const current = prev[materialId] || []
      if (current.includes(vendorId)) {
        return { ...prev, [materialId]: current.filter((id) => id !== vendorId) }
      }
      return { ...prev, [materialId]: [...current, vendorId] }
    })
  }

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
      toast({ title: "Select vendors", description: "Check at least one vendor to send inquiry", variant: "destructive" })
      return
    }

    setSendingInquiry(mat.id)
    try {
      // Create inquiry records in DB
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

      // Open WhatsApp for each vendor
      for (const vendorId of vendorIds) {
        const vendor = vendors.find((v) => v.id === vendorId)
        if (vendor) sendWhatsApp(mat, vendor)
      }

      toast({
        title: "Inquiries sent",
        description: `Created ${data.inquiries?.length || vendorIds.length} inquiry record(s) and opened WhatsApp`,
      })

      // Clear selection for this material
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

  // Group materials by work order
  const grouped = materials.reduce<Record<string, PurchaseMaterial[]>>((acc, mat) => {
    const key = mat.work_order_number || `WO-${mat.work_order_id}`
    if (!acc[key]) acc[key] = []
    acc[key].push(mat)
    return acc
  }, {})

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
          Object.entries(grouped).map(([woNumber, mats]) => (
            <div key={woNumber} className="space-y-2">
              <h2 className="text-lg font-semibold text-gray-700">{woNumber}</h2>
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
                            <div className="flex flex-wrap gap-2">
                              {vendors.map((v) => (
                                <label key={v.id} className="flex items-center gap-1 text-xs cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={selected.includes(v.id)}
                                    onChange={() => toggleVendorSelection(mat.id, v.id)}
                                    className="rounded border-gray-300"
                                  />
                                  {v.name}
                                </label>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-2">
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                className="bg-green-600 hover:bg-green-700 text-white text-xs"
                                disabled={selected.length === 0 || sendingInquiry === mat.id}
                                onClick={() => sendInquiryToVendors(mat)}
                              >
                                <Send className="h-3 w-3 mr-1" />
                                {sendingInquiry === mat.id ? "Sending..." : "Send Inquiry"}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </div>
    </DashboardLayout>
  )
}
