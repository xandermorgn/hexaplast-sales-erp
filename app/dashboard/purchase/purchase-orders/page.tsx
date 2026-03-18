"use client"

import { Fragment, useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { apiUrl } from "@/lib/api"
import { useSilentRefresh } from "@/hooks/use-silent-refresh"
import { ChevronDown, ChevronRight, Zap, Printer, X, Check } from "lucide-react"

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
  work_order_number: string | null
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

type PendingPOItem = {
  bom_material_id: number
  inquiry_id: number | null
  part_name: string
  specification: string | null
  quantity: number
  unit: string
  unit_price: number
  total_price: number
}

type PendingPO = {
  vendor_id: number
  vendor_name: string
  vendor_phone: string | null
  vendor_email: string | null
  vendor_gst: string | null
  total_amount: number
  work_order_numbers: string[]
  items: PendingPOItem[]
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

export default function PurchaseOrdersPage() {
  const router = useRouter()
  const { user, isLoading, logout } = useAuth()
  const { toast } = useToast()

  const [activeSection, setActiveSection] = useState("purchase-orders")
  const [orders, setOrders] = useState<PurchaseOrder[]>([])
  const [expanded, setExpanded] = useState<Record<number, POItem[]>>({})
  const [loadingItems, setLoadingItems] = useState<number | null>(null)
  const [generating, setGenerating] = useState(false)
  const [generateMessage, setGenerateMessage] = useState("")

  // Generate PO Portal state
  const [portalOpen, setPortalOpen] = useState(false)
  const [pendingPOs, setPendingPOs] = useState<PendingPO[]>([])
  const [currentPOIndex, setCurrentPOIndex] = useState(0)
  const [gstAmount, setGstAmount] = useState("")
  const [termsConditions, setTermsConditions] = useState("")
  const [confirming, setConfirming] = useState(false)
  const [defaultPoTerms, setDefaultPoTerms] = useState("")
  const [poCurrency, setPoCurrency] = useState("INR")

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

  async function fetchPoTermsTemplate() {
    try {
      const res = await fetch(apiUrl("/api/terms-conditions?document_type=purchase_order&active=1"), { credentials: "include" })
      if (res.ok) {
        const data = await res.json()
        const terms = data.terms || []
        if (terms.length > 0) {
          setDefaultPoTerms(terms[0].content || "")
        }
      }
    } catch { /* ignore */ }
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

  // ── Generate PO Portal ──

  async function openGeneratePortal() {
    setGenerating(true)
    setGenerateMessage("")
    try {
      const res = await fetch(apiUrl("/api/purchase/orders/generate"), {
        method: "POST",
        credentials: "include",
      })
      const data = await res.json()

      if (!res.ok) {
        setGenerateMessage(data.message || "No purchase orders available to generate.")
        return
      }

      const pending = data.pending_purchase_orders || []
      if (pending.length === 0) {
        setGenerateMessage("No purchase orders available to generate.")
        return
      }

      setPendingPOs(pending)
      setCurrentPOIndex(0)
      // Default GST = 18% of subtotal
      const firstSubtotal = pending[0]?.items?.reduce((s: number, i: any) => s + (i.total_price || 0), 0) || 0
      setGstAmount((firstSubtotal * 0.18).toFixed(2))
      setTermsConditions(defaultPoTerms)
      setPortalOpen(true)
    } catch {
      setGenerateMessage("Failed to load pending purchase orders. Please try again.")
    } finally {
      setGenerating(false)
    }
  }

  function closePortal() {
    setPortalOpen(false)
    setPendingPOs([])
    setCurrentPOIndex(0)
    setGstAmount("")
    setTermsConditions("")
    setPoCurrency("INR")
  }

  async function confirmCurrentPO() {
    const po = pendingPOs[currentPOIndex]
    if (!po) return

    setConfirming(true)
    try {
      const res = await fetch(apiUrl("/api/purchase/orders/confirm"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          vendor_id: po.vendor_id,
          gst_amount: Number(gstAmount) || 0,
          terms_conditions: termsConditions.trim() || null,
          items: po.items,
          currency: poCurrency,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        toast({ title: "Error", description: data.message || "Failed to create PO", variant: "destructive" })
        return
      }

      toast({ title: "Success", description: data.message || "Purchase order created" })

      // Move to next PO or close portal
      if (currentPOIndex + 1 < pendingPOs.length) {
        const nextIdx = currentPOIndex + 1
        setCurrentPOIndex(nextIdx)
        const nextSubtotal = pendingPOs[nextIdx]?.items?.reduce((s, i) => s + (i.total_price || 0), 0) || 0
        setGstAmount((nextSubtotal * 0.18).toFixed(2))
        setTermsConditions(defaultPoTerms)
      } else {
        closePortal()
      }

      await fetchOrders()
    } catch {
      toast({ title: "Error", description: "Failed to create purchase order", variant: "destructive" })
    } finally {
      setConfirming(false)
    }
  }

  function skipCurrentPO() {
    if (currentPOIndex + 1 < pendingPOs.length) {
      const nextIdx = currentPOIndex + 1
      setCurrentPOIndex(nextIdx)
      const nextSubtotal = pendingPOs[nextIdx]?.items?.reduce((s, i) => s + (i.total_price || 0), 0) || 0
      setGstAmount((nextSubtotal * 0.18).toFixed(2))
      setTermsConditions(defaultPoTerms)
    } else {
      closePortal()
    }
  }

  useEffect(() => {
    fetchOrders()
    fetchPoTermsTemplate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Silent background refresh every 30s
  const silentRefresh = useCallback(async () => { await fetchOrders() }, [])
  useSilentRefresh(silentRefresh, 30000)

  const statusColors: Record<string, string> = {
    draft: "bg-gray-100 text-gray-700",
    sent: "bg-blue-100 text-blue-700",
    acknowledged: "bg-yellow-100 text-yellow-800",
    completed: "bg-green-100 text-green-700",
    cancelled: "bg-red-100 text-red-700",
  }

  const currentPO = portalOpen ? pendingPOs[currentPOIndex] : null
  const currentSubtotal = currentPO ? currentPO.items.reduce((s, i) => s + (i.total_price || 0), 0) : 0
  const currentGst = Number(gstAmount) || 0
  const currentTotal = currentSubtotal + currentGst

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
              Auto-generated POs based on lowest vendor prices. Click &quot;Generate POs&quot; to review and confirm.
            </p>
          </div>
          <Button
            onClick={openGeneratePortal}
            disabled={generating}
            className="bg-orange-500 hover:bg-orange-600 text-white"
          >
            <Zap className="h-4 w-4 mr-1" />
            {generating ? "Loading..." : "Generate POs"}
          </Button>
        </div>

        {generateMessage && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            {generateMessage}
          </div>
        )}

        <div className="rounded-lg border border-gray-200 bg-white overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-700">
              <tr>
                <th className="px-4 py-2 text-left w-8"></th>
                <th className="px-4 py-2 text-left">Work Order</th>
                <th className="px-4 py-2 text-left">PO Number</th>
                <th className="px-4 py-2 text-left">Vendor</th>
                <th className="px-4 py-2 text-left">Items</th>
                <th className="px-4 py-2 text-right">Amount</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr>
                  <td className="px-4 py-4 text-gray-400" colSpan={8}>
                    No purchase orders yet. Fill in all vendor prices in Inquiries tab, then click &quot;Generate POs&quot;.
                  </td>
                </tr>
              ) : (
                orders.map((po) => {
                  const isOpen = !!expanded[po.id]
                  const items = expanded[po.id] || []
                  return (
                    <Fragment key={po.id}>
                      <tr className="border-t hover:bg-gray-50">
                        <td className="px-4 py-2 cursor-pointer" onClick={() => toggleExpand(po.id)}>
                          {loadingItems === po.id ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-500" />
                          ) : isOpen ? (
                            <ChevronDown className="h-4 w-4 text-gray-500" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-gray-500" />
                          )}
                        </td>
                        <td className="px-4 py-2 cursor-pointer" onClick={() => toggleExpand(po.id)}>
                          {po.work_order_number || "-"}
                        </td>
                        <td className="px-4 py-2 font-medium cursor-pointer" onClick={() => toggleExpand(po.id)}>{po.po_number}</td>
                        <td className="px-4 py-2 cursor-pointer" onClick={() => toggleExpand(po.id)}>{po.vendor_name}</td>
                        <td className="px-4 py-2 cursor-pointer" onClick={() => toggleExpand(po.id)}>{po.item_count}</td>
                        <td className="px-4 py-2 font-medium text-right cursor-pointer" onClick={() => toggleExpand(po.id)}>₹{po.total_amount.toFixed(2)}</td>
                        <td className="px-4 py-2 cursor-pointer" onClick={() => toggleExpand(po.id)}>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[po.status] || "bg-gray-100 text-gray-700"}`}>
                            {po.status}
                          </span>
                        </td>
                        <td className="px-4 py-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation()
                              window.open(`/print/purchase-order/${po.id}`, "_blank")
                            }}
                          >
                            <Printer className="h-3.5 w-3.5 mr-1" />
                            Print
                          </Button>
                        </td>
                      </tr>
                      {isOpen && items.length > 0 && (
                        <tr>
                          <td colSpan={8} className="px-0 py-0">
                            <div className="bg-gray-50 border-t border-b">
                              <table className="min-w-full text-sm">
                                <thead>
                                  <tr className="text-gray-500 text-xs">
                                    <th className="px-8 py-1.5 text-left">Part</th>
                                    <th className="px-4 py-1.5 text-left">Specification</th>
                                    <th className="px-4 py-1.5 text-right">Qty</th>
                                    <th className="px-4 py-1.5 text-left">Unit</th>
                                    <th className="px-4 py-1.5 text-right">Unit Price</th>
                                    <th className="px-4 py-1.5 text-right">Total</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {items.map((item) => (
                                    <tr key={item.id} className="border-t border-gray-200">
                                      <td className="px-8 py-2 font-medium">{item.part_name}</td>
                                      <td className="px-4 py-2 text-gray-500">{item.specification || "-"}</td>
                                      <td className="px-4 py-2 text-right">{item.quantity}</td>
                                      <td className="px-4 py-2">{item.unit}</td>
                                      <td className="px-4 py-2 text-right">₹{item.unit_price.toFixed(2)}</td>
                                      <td className="px-4 py-2 font-medium text-right">₹{item.total_price.toFixed(2)}</td>
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

        {/* ── Generate PO Portal (Full-screen overlay) ── */}
        {portalOpen && currentPO && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl mx-4 max-h-[92vh] flex flex-col">
              {/* Portal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                <div>
                  <h2 className="text-lg font-semibold text-gray-800">
                    Review Purchase Order ({currentPOIndex + 1} of {pendingPOs.length})
                  </h2>
                  <p className="text-xs text-gray-500">Review details, set GST and Terms & Conditions, then confirm.</p>
                </div>
                <button onClick={closePortal} className="text-gray-400 hover:text-gray-600">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Portal Body — scrollable */}
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                {/* Vendor Info */}
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div>
                      <span className="text-gray-500 text-xs">Vendor</span>
                      <p className="font-medium">{currentPO.vendor_name}</p>
                    </div>
                    <div>
                      <span className="text-gray-500 text-xs">Phone</span>
                      <p>{currentPO.vendor_phone || "-"}</p>
                    </div>
                    <div>
                      <span className="text-gray-500 text-xs">Email</span>
                      <p>{currentPO.vendor_email || "-"}</p>
                    </div>
                    <div>
                      <span className="text-gray-500 text-xs">GST</span>
                      <p>{currentPO.vendor_gst || "-"}</p>
                    </div>
                  </div>
                  {currentPO.work_order_numbers.length > 0 && (
                    <div className="mt-2 text-xs text-gray-500">
                      Work Orders: <span className="font-medium text-gray-700">{currentPO.work_order_numbers.join(", ")}</span>
                    </div>
                  )}
                </div>

                {/* Items Table (read-only) */}
                <div className="rounded-lg border border-gray-200 overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 text-gray-700">
                      <tr>
                        <th className="px-3 py-2 text-left">#</th>
                        <th className="px-3 py-2 text-left">Material Name</th>
                        <th className="px-3 py-2 text-left">Specification</th>
                        <th className="px-3 py-2 text-left">Unit</th>
                        <th className="px-3 py-2 text-right">Qty</th>
                        <th className="px-3 py-2 text-right">Unit Price</th>
                        <th className="px-3 py-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentPO.items.map((item, idx) => (
                        <tr key={idx} className="border-t">
                          <td className="px-3 py-2 text-gray-500">{idx + 1}</td>
                          <td className="px-3 py-2 font-medium">{item.part_name}</td>
                          <td className="px-3 py-2 text-gray-500">{item.specification || "-"}</td>
                          <td className="px-3 py-2">{item.unit}</td>
                          <td className="px-3 py-2 text-right">{item.quantity}</td>
                          <td className="px-3 py-2 text-right">₹{item.unit_price.toFixed(2)}</td>
                          <td className="px-3 py-2 text-right font-medium">₹{item.total_price.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Totals + GST */}
                <div className="flex justify-end">
                  <div className="w-72 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Subtotal</span>
                      <span className="font-medium">₹{currentSubtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm gap-3">
                      <Label className="text-gray-600 whitespace-nowrap">GST Amount (₹)</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={gstAmount}
                        onChange={(e) => setGstAmount(e.target.value)}
                        className="w-32 h-8 text-right"
                      />
                    </div>
                    <div className="flex justify-between text-sm font-bold border-t pt-2">
                      <span>Total Amount</span>
                      <span className="text-orange-600">₹{currentTotal.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Currency + Terms & Conditions */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Currency</Label>
                    <select
                      className="w-full border border-gray-300 rounded-md h-10 px-3 text-sm"
                      value={poCurrency}
                      onChange={(e) => setPoCurrency(e.target.value)}
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
                <div>
                  <Label>Terms & Conditions</Label>
                  <Textarea
                    rows={4}
                    value={termsConditions}
                    onChange={(e) => setTermsConditions(e.target.value)}
                    placeholder="Enter any terms and conditions for this purchase order..."
                  />
                </div>
              </div>

              {/* Portal Footer */}
              <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
                <div className="flex gap-2">
                  <Button variant="outline" onClick={closePortal}>Cancel</Button>
                  {pendingPOs.length > 1 && (
                    <Button variant="outline" onClick={skipCurrentPO}>
                      Skip This PO
                    </Button>
                  )}
                </div>
                <Button
                  onClick={confirmCurrentPO}
                  disabled={confirming}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  <Check className="h-4 w-4 mr-1" />
                  {confirming ? "Creating..." : "Confirm & Create PO"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
