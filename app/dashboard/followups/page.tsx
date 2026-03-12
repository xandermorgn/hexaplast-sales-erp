"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { apiUrl } from "@/lib/api"
import { Check, Clock, AlertTriangle, Search, ThumbsUp } from "lucide-react"

type FollowUp = {
  id: number
  entity_type: string
  entity_id: number
  employee_id: number
  note: string | null
  reminder_datetime: string
  status: string
  created_at: string
  employee_name: string | null
  customer_name: string | null
  entity_number: string | null
}

const menuItems = [
  { id: "inquiries", label: "Customer Inquiries" },
  { id: "quotations", label: "Quotations" },
  { id: "performas", label: "Performas" },
  { id: "work-orders", label: "Work Orders" },
  { id: "products", label: "Products" },
  { id: "followups", label: "Follow Ups" },
]

export default function FollowUpsPage() {
  const router = useRouter()
  const { user, isLoading, logout } = useAuth()
  const { toast } = useToast()

  const [activeSection, setActiveSection] = useState("followups")
  const [followUps, setFollowUps] = useState<FollowUp[]>([])
  const [activeTab, setActiveTab] = useState<"upcoming" | "completed" | "missed">("upcoming")
  const [searchQuery, setSearchQuery] = useState("")

  function handleSectionChange(section: string) {
    const routeMap: Record<string, string> = {
      inquiries: "/dashboard/inquiries",
      quotations: "/dashboard/quotations",
      performas: "/dashboard/performas",
      "work-orders": "/dashboard/work-orders",
      products: "/dashboard/products",
      followups: "/dashboard/followups",
    }
    const target = routeMap[section]
    if (target) router.push(target)
  }

  async function fetchFollowUps() {
    try {
      const res = await fetch(apiUrl("/api/followups"), { credentials: "include" })
      if (!res.ok) throw new Error("Failed to fetch")
      const data = await res.json()
      setFollowUps(data.follow_ups || [])
    } catch {
      toast({ title: "Error", description: "Failed to load follow-ups", variant: "destructive" })
    }
  }

  async function markCompleted(id: number) {
    try {
      const res = await fetch(apiUrl(`/api/followups/${id}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: "completed" }),
      })
      if (!res.ok) throw new Error("Failed to update")
      toast({ title: "Done", description: "Follow-up marked as completed" })
      await fetchFollowUps()
    } catch {
      toast({ title: "Error", description: "Failed to update follow-up", variant: "destructive" })
    }
  }

  async function deleteFollowUp(id: number) {
    if (!confirm("Delete this follow-up?")) return
    try {
      const res = await fetch(apiUrl(`/api/followups/${id}`), {
        method: "DELETE",
        credentials: "include",
      })
      if (!res.ok) throw new Error("Failed to delete")
      toast({ title: "Deleted", description: "Follow-up removed" })
      await fetchFollowUps()
    } catch {
      toast({ title: "Error", description: "Failed to delete follow-up", variant: "destructive" })
    }
  }

  async function acceptQuotation(entityId: number, followUpId: number) {
    try {
      const res = await fetch(apiUrl(`/api/quotations/${entityId}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: "accepted" }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data?.message || "Failed to accept quotation")
      }
      // Also mark the follow-up as completed
      await fetch(apiUrl(`/api/followups/${followUpId}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: "completed" }),
      })
      toast({ title: "Accepted", description: "Quotation has been marked as accepted" })
      await fetchFollowUps()
    } catch (error) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to accept quotation", variant: "destructive" })
    }
  }

  useEffect(() => {
    fetchFollowUps()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const now = new Date()

  const filtered = followUps.filter((f) => {
    if (activeTab === "upcoming" && f.status !== "pending") return false
    if (activeTab === "completed" && f.status !== "completed") return false
    if (activeTab === "missed" && f.status !== "missed") return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      const match =
        (f.employee_name || "").toLowerCase().includes(q) ||
        (f.note || "").toLowerCase().includes(q) ||
        (f.entity_number || "").toLowerCase().includes(q) ||
        (f.customer_name || "").toLowerCase().includes(q) ||
        (f.entity_type || "").toLowerCase().includes(q)
      if (!match) return false
    }
    return true
  })

  const entityLabel: Record<string, string> = {
    enquiry: "Enquiry",
    quotation: "Quotation",
    performa: "Performa",
    workorder: "Work Order",
  }

  const statusColors: Record<string, string> = {
    pending: "bg-blue-100 text-blue-700",
    completed: "bg-green-100 text-green-700",
    missed: "bg-red-100 text-red-700",
  }

  function formatDateTime(dt: string) {
    const d = new Date(dt)
    if (isNaN(d.getTime())) return dt
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
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
          <h1 className="text-2xl font-semibold text-gray-800">Follow Ups</h1>
          <p className="text-sm text-gray-500">All scheduled reminders across enquiries, quotations, performas, and work orders.</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-gray-200">
          <button
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === "upcoming" ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
            onClick={() => setActiveTab("upcoming")}
          >
            <Clock className="h-4 w-4" />
            Upcoming ({followUps.filter((f) => f.status === "pending").length})
          </button>
          <button
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === "completed" ? "border-green-500 text-green-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
            onClick={() => setActiveTab("completed")}
          >
            <Check className="h-4 w-4" />
            Completed ({followUps.filter((f) => f.status === "completed").length})
          </button>
          <button
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === "missed" ? "border-red-500 text-red-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
            onClick={() => setActiveTab("missed")}
          >
            <AlertTriangle className="h-4 w-4" />
            Missed ({followUps.filter((f) => f.status === "missed").length})
          </button>
        </div>

        {/* Search bar */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <input type="text" placeholder="Search follow-ups..." className="w-full h-8 pl-8 pr-3 text-xs border border-gray-200 rounded-md bg-white" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-700">
              <tr>
                <th className="px-4 py-2 text-left">Employee</th>
                <th className="px-4 py-2 text-left">Note</th>
                <th className="px-4 py-2 text-left">Entity Type</th>
                <th className="px-4 py-2 text-left">Reference</th>
                <th className="px-4 py-2 text-left">Customer</th>
                <th className="px-4 py-2 text-left">Follow-Up Date</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td className="px-4 py-4 text-gray-400" colSpan={8}>
                    No {activeTab} follow-ups.
                  </td>
                </tr>
              ) : (
                filtered.map((f) => (
                  <tr key={f.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-2">{f.employee_name || "-"}</td>
                    <td className="px-4 py-2 max-w-[200px] truncate">{f.note || "-"}</td>
                    <td className="px-4 py-2">{entityLabel[f.entity_type] || f.entity_type}</td>
                    <td className="px-4 py-2 font-medium">{f.entity_number || "-"}</td>
                    <td className="px-4 py-2">{f.customer_name || "-"}</td>
                    <td className="px-4 py-2">{formatDateTime(f.reminder_datetime)}</td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[f.status] || "bg-gray-100 text-gray-700"}`}>
                        {f.status}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex gap-1">
                        {f.status === "pending" && f.entity_type === "quotation" && (
                          <Button size="sm" variant="outline" className="text-orange-600 text-xs" onClick={() => acceptQuotation(f.entity_id, f.id)}>
                            <ThumbsUp className="h-3 w-3 mr-1" />
                            Accept
                          </Button>
                        )}
                        {f.status === "pending" && (
                          <Button size="sm" variant="outline" className="text-green-600 text-xs" onClick={() => markCompleted(f.id)}>
                            Complete
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="text-red-500 text-xs" onClick={() => deleteFollowUp(f.id)}>
                          Delete
                        </Button>
                      </div>
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
