"use client"

import { useEffect, useRef, useState, type FormEvent } from "react"
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
    { id: "database", label: "Database" },
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

  // Database management state
  const [dbDeleteStep, setDbDeleteStep] = useState<"idle" | "confirm" | "master_admin">("idle")
  const [dbDeletePassword, setDbDeletePassword] = useState("")
  const [dbDeleteNewAdmin, setDbDeleteNewAdmin] = useState({ name: "", login_id: "", password: "" })
  const [dbDeleteError, setDbDeleteError] = useState("")
  const [dbDeleting, setDbDeleting] = useState(false)
  const [dbBackingUp, setDbBackingUp] = useState(false)
  const [dbImportPassword, setDbImportPassword] = useState("")
  const [dbImportError, setDbImportError] = useState("")
  const [dbImporting, setDbImporting] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const dbImportFileRef = useRef<HTMLInputElement>(null)
  const [dbImportFile, setDbImportFile] = useState<File | null>(null)

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

  // ── Database Management Functions ──

  async function handleBackupDatabase() {
    setDbBackingUp(true)
    try {
      const res = await fetch(apiUrl("/api/database/backup"), { credentials: "include" })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: "Error", description: data.message || "Failed to backup database", variant: "destructive" })
        return
      }
      // Decode base64 to binary and trigger download
      const binaryStr = atob(data.data)
      const bytes = new Uint8Array(binaryStr.length)
      for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i)
      const blob = new Blob([bytes], { type: "application/octet-stream" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = data.filename || "hexaplast-erp-backup.db"
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast({ title: "Success", description: "Database backup downloaded" })
    } catch {
      toast({ title: "Error", description: "Failed to backup database", variant: "destructive" })
    } finally {
      setDbBackingUp(false)
    }
  }

  async function handleDeleteDatabase() {
    setDbDeleting(true)
    setDbDeleteError("")
    try {
      const res = await fetch(apiUrl("/api/database/delete"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          password: dbDeletePassword,
          new_master_admin: dbDeleteNewAdmin,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setDbDeleteError(data.message || "Failed to delete database")
        return
      }
      toast({ title: "Success", description: data.message || "Database deleted and re-initialized" })
      setDbDeleteStep("idle")
      setDbDeletePassword("")
      setDbDeleteNewAdmin({ name: "", login_id: "", password: "" })
      // Force logout since the DB has been wiped
      logout()
    } catch {
      setDbDeleteError("Failed to delete database")
    } finally {
      setDbDeleting(false)
    }
  }

  async function handleImportDatabase() {
    if (!dbImportFile) return
    setDbImporting(true)
    setDbImportError("")
    try {
      // Read file as base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(dbImportFile)
      })

      const res = await fetch(apiUrl("/api/database/import"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ db_base64: base64, password: dbImportPassword }),
      })
      const data = await res.json()
      if (!res.ok) {
        setDbImportError(data.message || "Failed to import database")
        return
      }
      toast({ title: "Success", description: data.message || "Database imported successfully" })
      setShowImportModal(false)
      setDbImportFile(null)
      setDbImportPassword("")
      logout()
    } catch {
      setDbImportError("Failed to import database")
    } finally {
      setDbImporting(false)
    }
  }

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

        {activeSection === "database" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-800">Database Management</h2>
              <p className="text-sm text-gray-500">Manage the ERP database. All ERP data is stored in a single database file.</p>
            </div>

            {/* Backup Database */}
            <div className="rounded-lg border border-gray-200 bg-white p-5 space-y-3">
              <h3 className="text-base font-semibold text-gray-800">Backup Database</h3>
              <p className="text-sm text-gray-500">Download a copy of the current database. Use this to create regular backups.</p>
              <Button onClick={handleBackupDatabase} disabled={dbBackingUp} variant="outline">
                {dbBackingUp ? "Downloading..." : "Download Backup"}
              </Button>
            </div>

            {/* Import Database */}
            <div className="rounded-lg border border-gray-200 bg-white p-5 space-y-3">
              <h3 className="text-base font-semibold text-gray-800">Import Database</h3>
              <p className="text-sm text-gray-500">
                Replace the current database with a previously backed-up database file. The current database will be overwritten.
              </p>
              <Button
                variant="outline"
                onClick={() => {
                  setShowImportModal(true)
                  setDbImportFile(null)
                  setDbImportPassword("")
                  setDbImportError("")
                }}
              >
                Import Database
              </Button>
            </div>

            {/* Delete Database */}
            <div className="rounded-lg border border-red-200 bg-red-50 p-5 space-y-3">
              <h3 className="text-base font-semibold text-red-800">Delete Database</h3>
              <p className="text-sm text-red-600">
                This will permanently delete all data in the ERP, including all inquiries, quotations, work orders, products,
                vendors, purchase orders, and user accounts. This action cannot be undone.
              </p>

              {dbDeleteStep === "idle" && (
                <Button variant="destructive" onClick={() => { setDbDeleteStep("confirm"); setDbDeletePassword(""); setDbDeleteError("") }}>
                  Delete Database
                </Button>
              )}

              {dbDeleteStep === "confirm" && (
                <div className="space-y-3 rounded-lg border border-red-300 bg-white p-4">
                  <p className="text-sm font-medium text-red-700">Enter your Server Admin password to proceed:</p>
                  {dbDeleteError && (
                    <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{dbDeleteError}</div>
                  )}
                  <Input
                    type="password"
                    placeholder="Server admin password"
                    value={dbDeletePassword}
                    onChange={(e) => setDbDeletePassword(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => { setDbDeleteStep("idle"); setDbDeletePassword(""); setDbDeleteError("") }}>Cancel</Button>
                    <Button
                      variant="destructive"
                      disabled={!dbDeletePassword.trim()}
                      onClick={() => { setDbDeleteStep("master_admin"); setDbDeleteError("") }}
                    >
                      Continue
                    </Button>
                  </div>
                </div>
              )}

              {dbDeleteStep === "master_admin" && (
                <div className="space-y-3 rounded-lg border border-red-300 bg-white p-4">
                  <p className="text-sm font-medium text-red-700">
                    Create a new Master Admin. After deletion, this will be the only admin account:
                  </p>
                  {dbDeleteError && (
                    <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{dbDeleteError}</div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <Label>Name</Label>
                      <Input value={dbDeleteNewAdmin.name} onChange={(e) => setDbDeleteNewAdmin((p) => ({ ...p, name: e.target.value }))} placeholder="Admin name" />
                    </div>
                    <div>
                      <Label>Login ID</Label>
                      <Input value={dbDeleteNewAdmin.login_id} onChange={(e) => setDbDeleteNewAdmin((p) => ({ ...p, login_id: e.target.value }))} placeholder="Login ID" />
                    </div>
                    <div>
                      <Label>Password</Label>
                      <Input type="password" value={dbDeleteNewAdmin.password} onChange={(e) => setDbDeleteNewAdmin((p) => ({ ...p, password: e.target.value }))} placeholder="Min 6 characters" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => { setDbDeleteStep("idle"); setDbDeletePassword(""); setDbDeleteNewAdmin({ name: "", login_id: "", password: "" }); setDbDeleteError("") }}>Cancel</Button>
                    <Button
                      variant="destructive"
                      disabled={dbDeleting || !dbDeleteNewAdmin.name.trim() || !dbDeleteNewAdmin.login_id.trim() || !dbDeleteNewAdmin.password.trim()}
                      onClick={handleDeleteDatabase}
                    >
                      {dbDeleting ? "Deleting..." : "Confirm Delete & Reset"}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Import Modal */}
            {showImportModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6 space-y-4">
                  <h3 className="text-lg font-semibold text-gray-800">Import Database</h3>
                  <p className="text-sm text-gray-500">
                    Select a previously backed-up database file (.db) and enter your server admin password to confirm.
                  </p>

                  {dbImportError && (
                    <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{dbImportError}</div>
                  )}

                  <div>
                    <Label>Database File</Label>
                    <div className="mt-1">
                      <input
                        ref={dbImportFileRef}
                        type="file"
                        accept=".db,.sqlite,.sqlite3"
                        className="hidden"
                        onChange={(e) => setDbImportFile(e.target.files?.[0] || null)}
                      />
                      <div className="flex items-center gap-2">
                        <Button variant="outline" onClick={() => dbImportFileRef.current?.click()}>
                          Choose File
                        </Button>
                        <span className="text-sm text-gray-500">{dbImportFile ? dbImportFile.name : "No file selected"}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label>Server Admin Password</Label>
                    <Input
                      type="password"
                      placeholder="Enter password to confirm"
                      value={dbImportPassword}
                      onChange={(e) => setDbImportPassword(e.target.value)}
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => { setShowImportModal(false); setDbImportFile(null); setDbImportPassword(""); setDbImportError("") }}>Cancel</Button>
                    <Button
                      disabled={dbImporting || !dbImportFile || !dbImportPassword.trim()}
                      onClick={handleImportDatabase}
                    >
                      {dbImporting ? "Importing..." : "Import & Replace Database"}
                    </Button>
                  </div>
                </div>
              </div>
            )}
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
