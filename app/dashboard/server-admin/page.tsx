"use client"

import { useEffect, useState, type FormEvent } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { MyProfile } from "@/components/profile/my-profile"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { apiUrl } from "@/lib/api"

type MasterAdminUser = {
  id: number
  name: string
  login_id: string
  created_at: string
  status: string
}

type KpiOverview = {
  total_inquiries: number
  total_quotations: number
  total_performas: number
  total_work_orders: number
  total_revenue: number
  inquiry_to_quotation_rate: number
  quotation_to_performa_rate: number
  performa_to_work_order_rate: number
}

type AuditLog = {
  id: number
  entity_type: string
  action: string
  performed_by_login: string
  performed_at: string
}

type WorkOrderRow = {
  id: number
  work_order_number: string
  company_name: string | null
  created_by_name: string | null
  total_amount: number
  status: string | null
  approved_by_name: string | null
  sent_to_production_at: string | null
  created_at: string
}

type DocumentDefaults = {
  terms_conditions: string
  attention: string
  declaration: string
  special_notes: string
}

const defaultKpis: KpiOverview = {
  total_inquiries: 0,
  total_quotations: 0,
  total_performas: 0,
  total_work_orders: 0,
  total_revenue: 0,
  inquiry_to_quotation_rate: 0,
  quotation_to_performa_rate: 0,
  performa_to_work_order_rate: 0,
}

export default function ServerAdminPage() {
  const { user, isLoading, logout } = useAuth("server_admin")
  const { toast } = useToast()

  const [activeSection, setActiveSection] = useState("system-overview")
  const menuItems = [
    { id: "system-overview", label: "System Overview (KPI)" },
    { id: "master-admins", label: "Master Admins" },
    { id: "global-workorders", label: "Global Work Orders" },
    { id: "audit-logs", label: "Audit Logs" },
    { id: "system-settings", label: "System Settings" },
    { id: "profile", label: "Profile" },
  ]

  const [masterAdmins, setMasterAdmins] = useState<MasterAdminUser[]>([])
  const [kpis, setKpis] = useState<KpiOverview>(defaultKpis)
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [workOrders, setWorkOrders] = useState<WorkOrderRow[]>([])
  const [systemDefaults, setSystemDefaults] = useState<DocumentDefaults>({
    terms_conditions: "",
    attention: "",
    declaration: "",
    special_notes: "",
  })

  const [showCreateMasterAdminForm, setShowCreateMasterAdminForm] = useState(false)
  const [newMasterAdmin, setNewMasterAdmin] = useState({ name: "", login_id: "", password: "" })
  const [savingMasterAdmin, setSavingMasterAdmin] = useState(false)
  const [masterAdminFormError, setMasterAdminFormError] = useState("")

  async function fetchMasterAdmins() {
    const response = await fetch(apiUrl("/api/users/master-admins"), { credentials: "include" })
    if (!response.ok) throw new Error("Failed to fetch master admins")
    const data = await response.json()
    setMasterAdmins(data.users || [])
  }

  async function fetchKpis() {
    const response = await fetch(apiUrl("/api/kpi/overview"), { credentials: "include" })
    if (!response.ok) throw new Error("Failed to fetch KPI overview")
    const data = await response.json()
    setKpis({ ...defaultKpis, ...(data || {}) })
  }

  async function fetchAuditLogs() {
    const response = await fetch(apiUrl("/api/audit?limit=100"), { credentials: "include" })
    if (!response.ok) throw new Error("Failed to fetch audit logs")
    const data = await response.json()
    setAuditLogs(data.audit_logs || [])
  }

  async function fetchWorkOrders() {
    const response = await fetch(apiUrl("/api/work-orders"), { credentials: "include" })
    if (!response.ok) throw new Error("Failed to fetch work orders")
    const data = await response.json()
    setWorkOrders(data.work_orders || [])
  }

  async function fetchSystemSettings() {
    const response = await fetch(apiUrl("/api/system-settings/document-defaults"), { credentials: "include" })
    if (!response.ok) throw new Error("Failed to fetch system settings")
    const data = await response.json()
    setSystemDefaults({
      terms_conditions: data?.defaults?.terms_conditions || "",
      attention: data?.defaults?.attention || "",
      declaration: data?.defaults?.declaration || "",
      special_notes: data?.defaults?.special_notes || "",
    })
  }

  async function loadAll() {
    try {
      await Promise.all([fetchMasterAdmins(), fetchKpis(), fetchAuditLogs(), fetchWorkOrders(), fetchSystemSettings()])
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load server admin portal",
        variant: "destructive",
      })
    }
  }

  useEffect(() => {
    if (!isLoading && user?.role === "server_admin") {
      loadAll()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, user?.role])

  // Socket.io real-time refresh disabled – will be replaced with polling/SSE

  async function handleCreateMasterAdmin(event: FormEvent) {
    event.preventDefault()
    setMasterAdminFormError("")
    setSavingMasterAdmin(true)

    try {
      const response = await fetch(apiUrl("/api/users/master-admin"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(newMasterAdmin),
      })

      const data = await response.json()
      if (!response.ok) {
        setMasterAdminFormError(data?.message || "Failed to create master admin")
        return
      }

      toast({ title: "Success", description: "Master admin created" })
      setNewMasterAdmin({ name: "", login_id: "", password: "" })
      setMasterAdminFormError("")
      setShowCreateMasterAdminForm(false)
      await fetchMasterAdmins()
    } catch (error) {
      setMasterAdminFormError(error instanceof Error ? error.message : "Failed to create master admin")
    } finally {
      setSavingMasterAdmin(false)
    }
  }

  if (isLoading) {
    return (
      <DashboardLayout
        title="Server Admin"
        menuItems={menuItems}
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        loginId={user?.loginId || ""}
        onLogout={logout}
        userRole={user?.role as "server_admin" | "master_admin" | "employee" | undefined}
      >
        <div className="p-6">Loading...</div>
      </DashboardLayout>
    )
  }

  if (user?.role !== "server_admin") {
    return (
      <DashboardLayout
        title="Server Admin"
        menuItems={menuItems}
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        loginId={user?.loginId || ""}
        onLogout={logout}
        userRole={user?.role as "server_admin" | "master_admin" | "employee" | undefined}
      >
        <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-red-600">Access denied.</div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout
      title="Server Admin"
      menuItems={menuItems}
      activeSection={activeSection}
      onSectionChange={setActiveSection}
      loginId={user?.loginId || ""}
      onLogout={logout}
      userRole={user?.role as "server_admin" | "master_admin" | "employee" | undefined}
    >
      <div className="space-y-6">
        {activeSection === "system-overview" && (
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
            <MetricCard label="Total Inquiries" value={kpis.total_inquiries} />
            <MetricCard label="Total Quotations" value={kpis.total_quotations} />
            <MetricCard label="Total Performas" value={kpis.total_performas} />
            <MetricCard label="Total Work Orders" value={kpis.total_work_orders} />
            <MetricCard label="Total Revenue" value={Number(kpis.total_revenue || 0).toFixed(2)} />
            <MetricCard label="Conversion Rate %" value={Number(kpis.inquiry_to_quotation_rate || 0).toFixed(2)} />
          </div>
        )}

        {activeSection === "profile" && <MyProfile />}

        {activeSection === "master-admins" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-800">Master Admins</h2>
              <Button onClick={() => setShowCreateMasterAdminForm((prev) => !prev)}>+ New Master Admin</Button>
            </div>

            {showCreateMasterAdminForm && (
              <form onSubmit={handleCreateMasterAdmin} className="rounded-lg border border-gray-200 bg-white p-5 space-y-4">
                {masterAdminFormError && (
                  <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                    {masterAdminFormError}
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label>Name</Label>
                    <Input value={newMasterAdmin.name} onChange={(e) => setNewMasterAdmin((prev) => ({ ...prev, name: e.target.value }))} required />
                  </div>
                  <div>
                    <Label>Login ID</Label>
                    <Input value={newMasterAdmin.login_id} onChange={(e) => setNewMasterAdmin((prev) => ({ ...prev, login_id: e.target.value }))} required />
                  </div>
                  <div>
                    <Label>Password</Label>
                    <Input type="password" value={newMasterAdmin.password} onChange={(e) => setNewMasterAdmin((prev) => ({ ...prev, password: e.target.value }))} required />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button type="submit" disabled={savingMasterAdmin}>{savingMasterAdmin ? "Creating..." : "Create Master Admin"}</Button>
                </div>
              </form>
            )}

            <div className="rounded-lg border border-gray-200 bg-white overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-gray-700">
                  <tr>
                    <th className="px-3 py-2 text-left">Name</th>
                    <th className="px-3 py-2 text-left">Login ID</th>
                    <th className="px-3 py-2 text-left">Created At</th>
                    <th className="px-3 py-2 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {masterAdmins.length === 0 ? (
                    <tr>
                      <td className="px-3 py-3" colSpan={4}>No master admins found.</td>
                    </tr>
                  ) : (
                    masterAdmins.map((admin) => (
                      <tr key={admin.id} className="border-t">
                        <td className="px-3 py-2">{admin.name}</td>
                        <td className="px-3 py-2">{admin.login_id}</td>
                        <td className="px-3 py-2">{new Date(admin.created_at).toLocaleString()}</td>
                        <td className="px-3 py-2">{admin.status || "active"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeSection === "audit-logs" && (
          <div className="rounded-lg border border-gray-200 bg-white overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-700">
                <tr>
                  <th className="px-3 py-2 text-left">Time</th>
                  <th className="px-3 py-2 text-left">Entity</th>
                  <th className="px-3 py-2 text-left">Action</th>
                  <th className="px-3 py-2 text-left">Performed By</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.length === 0 ? (
                  <tr>
                    <td className="px-3 py-3" colSpan={4}>No audit logs found.</td>
                  </tr>
                ) : (
                  auditLogs.map((log) => (
                    <tr key={log.id} className="border-t">
                      <td className="px-3 py-2">{new Date(log.performed_at).toLocaleString()}</td>
                      <td className="px-3 py-2">{log.entity_type}</td>
                      <td className="px-3 py-2">{log.action}</td>
                      <td className="px-3 py-2">{log.performed_by_login || "-"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeSection === "global-workorders" && (
          <div className="rounded-lg border border-gray-200 bg-white overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-700">
                <tr>
                  <th className="px-3 py-2 text-left">Work Order Number</th>
                  <th className="px-3 py-2 text-left">Created By</th>
                  <th className="px-3 py-2 text-left">Company</th>
                  <th className="px-3 py-2 text-left">Amount</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Approved By</th>
                  <th className="px-3 py-2 text-left">Sent To Production</th>
                  <th className="px-3 py-2 text-left">Created At</th>
                  <th className="px-3 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {workOrders.length === 0 ? (
                  <tr>
                    <td className="px-3 py-3" colSpan={9}>No work orders found.</td>
                  </tr>
                ) : (
                  workOrders.map((workOrder) => (
                    <tr key={workOrder.id} className="border-t">
                      <td className="px-3 py-2 font-medium">{workOrder.work_order_number}</td>
                      <td className="px-3 py-2">{workOrder.created_by_name || "-"}</td>
                      <td className="px-3 py-2">{workOrder.company_name || "-"}</td>
                      <td className="px-3 py-2">{Number(workOrder.total_amount || 0).toFixed(2)}</td>
                      <td className="px-3 py-2">{workOrder.status || "generated"}</td>
                      <td className="px-3 py-2">{workOrder.approved_by_name || "-"}</td>
                      <td className="px-3 py-2">{workOrder.sent_to_production_at ? "Yes" : "No"}</td>
                      <td className="px-3 py-2">{new Date(workOrder.created_at).toLocaleString()}</td>
                      <td className="px-3 py-2">
                        <Button size="sm" variant="outline" onClick={() => fetchWorkOrders()}>Refresh</Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeSection === "system-settings" && (
          <div className="rounded-lg border border-gray-200 bg-white p-5 space-y-4">
            <h2 className="text-xl font-semibold text-gray-800">System Settings</h2>
            <div>
              <Label>Default Terms & Conditions</Label>
              <Textarea rows={4} value={systemDefaults.terms_conditions} readOnly />
            </div>
            <div>
              <Label>Default Attention</Label>
              <Textarea rows={3} value={systemDefaults.attention} readOnly />
            </div>
            <div>
              <Label>Default Declaration</Label>
              <Textarea rows={3} value={systemDefaults.declaration} readOnly />
            </div>
            <div>
              <Label>Default Special Notes</Label>
              <Textarea rows={3} value={systemDefaults.special_notes} readOnly />
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-xl font-semibold text-gray-800 mt-1">{value}</p>
    </div>
  )
}
