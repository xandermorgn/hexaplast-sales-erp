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
import { RichTextEditor } from "@/components/rich-text-editor"

type Employee = {
  id: number
  employee_id: string
  full_name: string
  login_id: string
  email: string | null
  contact_number: string | null
  status: string
  designation: string | null
  photo_data_uri: string | null
}

type WorkOrderRow = {
  id: number
  work_order_number: string
  company_name: string | null
  total_amount: number
  created_by_name: string | null
  created_at: string
  status: string | null
  error_log?: string | null
}

type Product = {
  id: number
  product_name: string | null
  product_code: string | null
  category_name?: string | null
  sales_price?: number | null
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

type DocumentDefaults = {
  terms_conditions: string
  attention: string
  declaration: string
  special_notes: string
}

type TermsTemplate = {
  id: number
  document_type: string
  title: string
  content: string
  is_active: number
  created_at: string
  updated_at: string
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

const defaultTerms: DocumentDefaults = {
  terms_conditions: "",
  attention: "",
  declaration: "",
  special_notes: "",
}

export default function MasterAdminPage() {
  const { user, isLoading, logout } = useAuth("master_admin")
  const { toast } = useToast()

  const [activeSection, setActiveSection] = useState("dashboard")
  const menuItems = [
    { id: "dashboard", label: "Dashboard (KPI)" },
    { id: "employees", label: "Employees" },
    { id: "workorders", label: "Work Orders (Approval)" },
    { id: "products", label: "Products" },
    { id: "terms", label: "Terms & Conditions" },
    { id: "profile", label: "Profile" },
  ]

  const [employees, setEmployees] = useState<Employee[]>([])
  const [generatedWorkOrders, setGeneratedWorkOrders] = useState<WorkOrderRow[]>([])
  const [retryWorkOrders, setRetryWorkOrders] = useState<WorkOrderRow[]>([])
  const [machineProducts, setMachineProducts] = useState<Product[]>([])
  const [spareProducts, setSpareProducts] = useState<Product[]>([])
  const [kpis, setKpis] = useState<KpiOverview>(defaultKpis)
  const [termsForm, setTermsForm] = useState<DocumentDefaults>(defaultTerms)

  const [rejectionReasons, setRejectionReasons] = useState<Record<number, string>>({})

  const [employeeForm, setEmployeeForm] = useState({
    login_id: "",
    password: "",
    full_name: "",
    contact_number: "",
    email: "",
    designation: "Sales Employee",
  })

  const [creatingEmployee, setCreatingEmployee] = useState(false)
  const [employeeModalOpen, setEmployeeModalOpen] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [savingTerms, setSavingTerms] = useState(false)

  // Terms & Conditions templates state
  const [termsTemplates, setTermsTemplates] = useState<TermsTemplate[]>([])
  const [termsModalOpen, setTermsModalOpen] = useState(false)
  const [editingTerm, setEditingTerm] = useState<TermsTemplate | null>(null)
  const [termForm, setTermForm] = useState({ document_type: "quotation", title: "", content: "", is_active: 1 })
  const [savingTerm, setSavingTerm] = useState(false)
  const [termsFilter, setTermsFilter] = useState<string>("all")
  const [fireConfirm, setFireConfirm] = useState<{ open: boolean; employee: Employee | null }>({ open: false, employee: null })
  const [firingEmployee, setFiringEmployee] = useState(false)
  const [employeeError, setEmployeeError] = useState("")
  const [employeeFieldError, setEmployeeFieldError] = useState("")

  async function fetchEmployees() {
    const response = await fetch(apiUrl("/api/employees"), { credentials: "include" })
    if (!response.ok) throw new Error("Failed to fetch employees")
    const data = await response.json()
    setEmployees(data.employees || [])
  }

  async function fetchGeneratedWorkOrders() {
    const response = await fetch(apiUrl("/api/work-orders?status=generated"), { credentials: "include" })
    if (!response.ok) throw new Error("Failed to fetch generated work orders")
    const data = await response.json()
    setGeneratedWorkOrders(data.work_orders || [])
  }

  async function fetchRetryQueue() {
    const response = await fetch(apiUrl("/api/work-orders?status=approved"), { credentials: "include" })
    if (!response.ok) throw new Error("Failed to fetch retry queue")
    const data = await response.json()
    const rows: WorkOrderRow[] = data.work_orders || []
    setRetryWorkOrders(rows.filter((row) => Boolean(row.error_log)))
  }

  async function fetchProducts() {
    const [machinesRes, sparesRes] = await Promise.all([
      fetch(apiUrl("/api/products/machines"), { credentials: "include" }),
      fetch(apiUrl("/api/products/spares"), { credentials: "include" }),
    ])

    if (!machinesRes.ok || !sparesRes.ok) throw new Error("Failed to fetch products")

    const machines = await machinesRes.json()
    const spares = await sparesRes.json()

    setMachineProducts(machines.products || [])
    setSpareProducts(spares.products || [])
  }

  async function fetchKpis() {
    const response = await fetch(apiUrl("/api/kpi/overview"), { credentials: "include" })
    if (!response.ok) throw new Error("Failed to fetch KPI overview")
    const data = await response.json()
    setKpis({ ...defaultKpis, ...(data || {}) })
  }

  async function fetchTerms() {
    const response = await fetch(apiUrl("/api/system-settings/document-defaults"), { credentials: "include" })
    if (!response.ok) throw new Error("Failed to fetch terms defaults")
    const data = await response.json()
    setTermsForm({ ...defaultTerms, ...(data.defaults || {}) })
  }

  async function fetchTermsTemplates() {
    const response = await fetch(apiUrl("/api/terms-conditions"), { credentials: "include" })
    if (!response.ok) throw new Error("Failed to fetch terms templates")
    const data = await response.json()
    setTermsTemplates(data.terms || [])
  }

  async function loadAll() {
    try {
      await Promise.all([
        fetchEmployees(),
        fetchGeneratedWorkOrders(),
        fetchRetryQueue(),
        fetchProducts(),
        fetchKpis(),
        fetchTerms(),
        fetchTermsTemplates(),
      ])
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load master admin portal",
        variant: "destructive",
      })
    }
  }

  useEffect(() => {
    if (!isLoading && user?.role === "master_admin") {
      loadAll()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, user?.role])

  // Socket.io real-time refresh disabled – will be replaced with polling/SSE

  function openEmployeeModal() {
    setEmployeeForm({ login_id: "", password: "", full_name: "", contact_number: "", email: "", designation: "Sales Employee" })
    setShowPassword(false)
    setEmployeeError("")
    setEmployeeFieldError("")
    setEmployeeModalOpen(true)
  }

  function closeEmployeeModal() {
    setEmployeeModalOpen(false)
    setShowPassword(false)
    setEmployeeError("")
    setEmployeeFieldError("")
  }

  async function handleFireEmployee() {
    if (!fireConfirm.employee) return
    setFiringEmployee(true)
    try {
      const response = await fetch(apiUrl(`/api/employees/${fireConfirm.employee.id}`), {
        method: "DELETE",
        credentials: "include",
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.message || "Failed to fire employee")
      toast({ title: "Success", description: `Employee ${fireConfirm.employee.full_name || fireConfirm.employee.login_id} has been fired` })
      setFireConfirm({ open: false, employee: null })
      await fetchEmployees()
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to fire employee",
        variant: "destructive",
      })
    } finally {
      setFiringEmployee(false)
    }
  }

  // ── Terms Template CRUD ──

  function openTermModal(term?: TermsTemplate) {
    if (term) {
      setEditingTerm(term)
      setTermForm({ document_type: term.document_type, title: term.title, content: term.content, is_active: term.is_active })
    } else {
      setEditingTerm(null)
      setTermForm({ document_type: "quotation", title: "", content: "", is_active: 1 })
    }
    setTermsModalOpen(true)
  }

  async function handleSaveTerm() {
    if (!termForm.title.trim()) {
      toast({ title: "Error", description: "Title is required", variant: "destructive" })
      return
    }
    setSavingTerm(true)
    try {
      const url = editingTerm ? apiUrl(`/api/terms-conditions/${editingTerm.id}`) : apiUrl("/api/terms-conditions")
      const method = editingTerm ? "PUT" : "POST"
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(termForm),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: "Error", description: data.message || "Failed to save", variant: "destructive" })
        return
      }
      toast({ title: "Success", description: editingTerm ? "Term updated" : "Term created" })
      setTermsModalOpen(false)
      await fetchTermsTemplates()
    } catch {
      toast({ title: "Error", description: "Failed to save term", variant: "destructive" })
    } finally {
      setSavingTerm(false)
    }
  }

  async function handleDeleteTerm(id: number) {
    try {
      const res = await fetch(apiUrl(`/api/terms-conditions/${id}`), { method: "DELETE", credentials: "include" })
      if (!res.ok) {
        const data = await res.json()
        toast({ title: "Error", description: data.message || "Failed to delete", variant: "destructive" })
        return
      }
      toast({ title: "Deleted", description: "Term template deleted" })
      await fetchTermsTemplates()
    } catch {
      toast({ title: "Error", description: "Failed to delete term", variant: "destructive" })
    }
  }

  async function handleToggleTermActive(term: TermsTemplate) {
    try {
      await fetch(apiUrl(`/api/terms-conditions/${term.id}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ is_active: term.is_active ? 0 : 1 }),
      })
      await fetchTermsTemplates()
    } catch {
      toast({ title: "Error", description: "Failed to update term", variant: "destructive" })
    }
  }

  const filteredTermsTemplates = termsFilter === "all"
    ? termsTemplates
    : termsTemplates.filter((t) => t.document_type === termsFilter)

  const docTypeLabels: Record<string, string> = {
    quotation: "Quotation",
    proforma_invoice: "Proforma Invoice",
    purchase_order: "Purchase Order",
  }

  async function handleCreateEmployee(event: FormEvent) {
    event.preventDefault()
    setEmployeeError("")
    setEmployeeFieldError("")

    // Client-side validation
    if (!employeeForm.login_id.trim()) {
      setEmployeeFieldError("login_id")
      setEmployeeError("User ID is required")
      return
    }
    if (!employeeForm.full_name.trim()) {
      setEmployeeFieldError("full_name")
      setEmployeeError("Full name is required")
      return
    }
    if (!employeeForm.password) {
      setEmployeeFieldError("password")
      setEmployeeError("Password is required")
      return
    }

    setCreatingEmployee(true)

    try {
      const response = await fetch(apiUrl("/api/employees"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...employeeForm, role: "employee" }),
      })

      const data = await response.json()
      if (!response.ok) {
        setEmployeeError(data?.message || "Failed to create employee")
        setEmployeeFieldError(data?.field || "")
        return
      }

      toast({ title: "Success", description: "Employee created" })
      closeEmployeeModal()
      await fetchEmployees()
    } catch (error) {
      setEmployeeError(error instanceof Error ? error.message : "Failed to create employee")
    } finally {
      setCreatingEmployee(false)
    }
  }

  async function approveWorkOrder(workOrderId: number) {
    try {
      const response = await fetch(apiUrl(`/api/work-orders/${workOrderId}/approve`), {
        method: "POST",
        credentials: "include",
      })

      const data = await response.json()
      if (!response.ok && !data?.requires_retry) {
        throw new Error(data?.message || "Failed to approve work order")
      }

      if (data?.requires_retry) {
        toast({
          title: "Approved with Warning",
          description: data?.message || "Production push failed. Retry required.",
          variant: "destructive",
        })
      } else {
        toast({ title: "Success", description: "Work order approved and sent to production" })
      }

      await Promise.all([fetchGeneratedWorkOrders(), fetchRetryQueue(), fetchKpis()])
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to approve work order",
        variant: "destructive",
      })
    }
  }

  async function rejectWorkOrder(workOrderId: number) {
    const rejection_reason = (rejectionReasons[workOrderId] || "").trim()
    if (!rejection_reason) {
      toast({ title: "Validation", description: "Rejection reason is required", variant: "destructive" })
      return
    }

    try {
      const response = await fetch(apiUrl(`/api/work-orders/${workOrderId}/reject`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ rejection_reason }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data?.message || "Failed to reject work order")

      toast({ title: "Success", description: "Work order rejected" })
      setRejectionReasons((prev) => {
        const next = { ...prev }
        delete next[workOrderId]
        return next
      })
      await Promise.all([fetchGeneratedWorkOrders(), fetchKpis()])
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to reject work order",
        variant: "destructive",
      })
    }
  }

  async function retryProductionPush(workOrderId: number) {
    try {
      const response = await fetch(apiUrl(`/api/work-orders/${workOrderId}/retry-production-push`), {
        method: "POST",
        credentials: "include",
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data?.message || "Failed to retry production push")

      toast({ title: "Success", description: "Production push retried successfully" })
      await Promise.all([fetchRetryQueue(), fetchKpis()])
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to retry production push",
        variant: "destructive",
      })
    }
  }

  async function saveTermsDefaults(event: FormEvent) {
    event.preventDefault()
    setSavingTerms(true)

    try {
      const response = await fetch(apiUrl("/api/system-settings/document-defaults"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(termsForm),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data?.message || "Failed to save defaults")

      setTermsForm({ ...defaultTerms, ...(data.defaults || {}) })
      toast({ title: "Success", description: "Document defaults updated" })
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save defaults",
        variant: "destructive",
      })
    } finally {
      setSavingTerms(false)
    }
  }

  if (isLoading) {
    return (
      <DashboardLayout
        title="Master Admin"
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

  if (user?.role !== "master_admin") {
    return (
      <DashboardLayout
        title="Master Admin"
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
      title="Master Admin"
      menuItems={menuItems}
      activeSection={activeSection}
      onSectionChange={setActiveSection}
      loginId={user?.loginId || ""}
      onLogout={logout}
      userRole={user?.role as "server_admin" | "master_admin" | "employee" | undefined}
    >
      <div className="space-y-6">
        {activeSection === "dashboard" && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="Total Inquiries" value={kpis.total_inquiries} />
            <MetricCard label="Total Quotations" value={kpis.total_quotations} />
            <MetricCard label="Total Performas" value={kpis.total_performas} />
            <MetricCard label="Total Work Orders" value={kpis.total_work_orders} />
            <MetricCard label="Total Revenue" value={Number(kpis.total_revenue || 0).toFixed(2)} />
            <MetricCard label="Inquiry→Quotation %" value={Number(kpis.inquiry_to_quotation_rate || 0).toFixed(2)} />
            <MetricCard label="Quotation→Performa %" value={Number(kpis.quotation_to_performa_rate || 0).toFixed(2)} />
            <MetricCard label="Performa→Work Order %" value={Number(kpis.performa_to_work_order_rate || 0).toFixed(2)} />
          </div>
        )}

        {activeSection === "profile" && <MyProfile />}

        {activeSection === "employees" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-800">Employees</h2>
              <Button onClick={openEmployeeModal}>+ New Employee</Button>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-gray-700">
                  <tr>
                    <th className="px-3 py-2 text-left w-12"></th>
                    <th className="px-3 py-2 text-left">User ID</th>
                    <th className="px-3 py-2 text-left">Full Name</th>
                    <th className="px-3 py-2 text-left">Email</th>
                    <th className="px-3 py-2 text-left">Phone</th>
                    <th className="px-3 py-2 text-left">Designation</th>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2 text-left">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.length === 0 ? (
                    <tr>
                      <td className="px-3 py-3" colSpan={8}>No employees found.</td>
                    </tr>
                  ) : (
                    employees.map((employee) => (
                      <tr key={employee.id} className="border-t">
                        <td className="px-3 py-2">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-xs font-semibold overflow-hidden">
                            {employee.photo_data_uri ? (
                              <img src={employee.photo_data_uri} alt="" className="w-full h-full rounded-full object-cover" />
                            ) : (
                              (employee.full_name || "?").charAt(0).toUpperCase()
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2 font-medium">{employee.login_id}</td>
                        <td className="px-3 py-2">{employee.full_name}</td>
                        <td className="px-3 py-2">{employee.email || "-"}</td>
                        <td className="px-3 py-2">{employee.contact_number || "-"}</td>
                        <td className="px-3 py-2">{employee.designation || "-"}</td>
                        <td className="px-3 py-2">{employee.status}</td>
                        <td className="px-3 py-2">
                          <Button
                            size="sm"
                            className="bg-red-600 hover:bg-red-700 text-white"
                            onClick={() => setFireConfirm({ open: true, employee })}
                          >
                            Fire
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Fire Employee Confirmation Modal */}
            {fireConfirm.open && fireConfirm.employee && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6 space-y-4">
                  <h3 className="text-lg font-semibold text-gray-800">Fire Employee</h3>
                  <p className="text-sm text-gray-600">
                    Are you sure you want to fire <span className="font-semibold">{fireConfirm.employee.full_name || fireConfirm.employee.login_id}</span>?
                    This action cannot be undone.
                  </p>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setFireConfirm({ open: false, employee: null })} disabled={firingEmployee}>
                      Cancel
                    </Button>
                    <Button
                      className="bg-red-600 hover:bg-red-700 text-white"
                      onClick={handleFireEmployee}
                      disabled={firingEmployee}
                    >
                      {firingEmployee ? "Firing..." : "Confirm Fire"}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* New Employee Modal */}
            {employeeModalOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6 space-y-4">
                  <h3 className="text-lg font-semibold text-gray-800">New Employee</h3>

                  {employeeError && (
                    <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                      {employeeError}
                    </div>
                  )}

                  <form onSubmit={handleCreateEmployee} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label>User ID (Login)</Label>
                        <Input
                          value={employeeForm.login_id}
                          onChange={(e) => { setEmployeeForm((prev) => ({ ...prev, login_id: e.target.value })); if (employeeFieldError === "login_id") { setEmployeeFieldError(""); setEmployeeError(""); } }}
                          placeholder="Enter user ID"
                          autoFocus
                          className={employeeFieldError === "login_id" ? "border-red-400" : ""}
                        />
                        {employeeFieldError === "login_id" && <p className="text-red-500 text-sm mt-1">{employeeError}</p>}
                        <p className="text-xs text-gray-400 mt-1">3–20 characters, lowercase letters, numbers, underscore. No spaces.</p>
                      </div>
                      <div>
                        <Label>Full Name</Label>
                        <Input
                          value={employeeForm.full_name}
                          onChange={(e) => { setEmployeeForm((prev) => ({ ...prev, full_name: e.target.value })); if (employeeFieldError === "full_name") { setEmployeeFieldError(""); setEmployeeError(""); } }}
                          placeholder="Enter full name"
                          className={employeeFieldError === "full_name" ? "border-red-400" : ""}
                        />
                        {employeeFieldError === "full_name" && <p className="text-red-500 text-sm mt-1">{employeeError}</p>}
                      </div>
                      <div>
                        <Label>Email</Label>
                        <Input
                          type="email"
                          value={employeeForm.email}
                          onChange={(e) => setEmployeeForm((prev) => ({ ...prev, email: e.target.value }))}
                          placeholder="Enter email"
                        />
                      </div>
                      <div>
                        <Label>Phone</Label>
                        <Input
                          value={employeeForm.contact_number}
                          onChange={(e) => setEmployeeForm((prev) => ({ ...prev, contact_number: e.target.value }))}
                          placeholder="Enter phone number"
                        />
                      </div>
                      <div>
                        <Label>Designation</Label>
                        <select
                          className="w-full border border-gray-300 rounded-md h-10 px-3 text-sm"
                          value={employeeForm.designation || "Sales Employee"}
                          onChange={(e) => setEmployeeForm((prev) => ({ ...prev, designation: e.target.value }))}
                        >
                          <option value="Sales Employee">Sales Employee</option>
                          <option value="Purchase Employee">Purchase Employee</option>
                        </select>
                      </div>
                      <div>
                        <Label>Password</Label>
                        <div className="relative">
                          <Input
                            type={showPassword ? "text" : "password"}
                            value={employeeForm.password}
                            onChange={(e) => { setEmployeeForm((prev) => ({ ...prev, password: e.target.value })); if (employeeFieldError === "password") { setEmployeeFieldError(""); setEmployeeError(""); } }}
                            placeholder="Enter password"
                            className={employeeFieldError === "password" ? "border-red-400" : ""}
                          />
                          <button
                            type="button"
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 text-xs select-none"
                            onClick={() => setShowPassword((v) => !v)}
                            tabIndex={-1}
                          >
                            {showPassword ? "Hide" : "Show"}
                          </button>
                        </div>
                        {employeeFieldError === "password" && <p className="text-red-500 text-sm mt-1">{employeeError}</p>}
                        <p className="text-xs text-gray-400 mt-1">Min 8 characters. Must include uppercase, lowercase, and a number.</p>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={closeEmployeeModal}>Cancel</Button>
                      <Button type="submit" disabled={creatingEmployee}>{creatingEmployee ? "Creating..." : "Create Employee"}</Button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {activeSection === "workorders" && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-800">Work Order Approval Center</h2>

            <div className="rounded-lg border border-gray-200 bg-white overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-gray-700">
                  <tr>
                    <th className="px-3 py-2 text-left">Work Order Number</th>
                    <th className="px-3 py-2 text-left">Company</th>
                    <th className="px-3 py-2 text-left">Total Amount</th>
                    <th className="px-3 py-2 text-left">Created By</th>
                    <th className="px-3 py-2 text-left">Created At</th>
                    <th className="px-3 py-2 text-left">Rejection Reason</th>
                    <th className="px-3 py-2 text-left">Approve</th>
                    <th className="px-3 py-2 text-left">Reject</th>
                  </tr>
                </thead>
                <tbody>
                  {generatedWorkOrders.length === 0 ? (
                    <tr>
                      <td className="px-3 py-3" colSpan={8}>No generated work orders awaiting approval.</td>
                    </tr>
                  ) : (
                    generatedWorkOrders.map((workOrder) => (
                      <tr key={workOrder.id} className="border-t align-top">
                        <td className="px-3 py-2 font-medium">{workOrder.work_order_number}</td>
                        <td className="px-3 py-2">{workOrder.company_name || "-"}</td>
                        <td className="px-3 py-2">{Number(workOrder.total_amount || 0).toFixed(2)}</td>
                        <td className="px-3 py-2">{workOrder.created_by_name || "-"}</td>
                        <td className="px-3 py-2">{new Date(workOrder.created_at).toLocaleString()}</td>
                        <td className="px-3 py-2 min-w-[220px]">
                          <Textarea
                            rows={2}
                            placeholder="Reason required for rejection"
                            value={rejectionReasons[workOrder.id] || ""}
                            onChange={(e) => setRejectionReasons((prev) => ({ ...prev, [workOrder.id]: e.target.value }))}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <Button size="sm" onClick={() => approveWorkOrder(workOrder.id)}>Approve</Button>
                        </td>
                        <td className="px-3 py-2">
                          <Button size="sm" variant="outline" onClick={() => rejectWorkOrder(workOrder.id)}>Reject</Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-gray-800">Production Push Retry Queue</h3>
              <div className="rounded-lg border border-gray-200 bg-white overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-gray-700">
                    <tr>
                      <th className="px-3 py-2 text-left">Work Order Number</th>
                      <th className="px-3 py-2 text-left">Company</th>
                      <th className="px-3 py-2 text-left">Error Log</th>
                      <th className="px-3 py-2 text-left">Retry</th>
                    </tr>
                  </thead>
                  <tbody>
                    {retryWorkOrders.length === 0 ? (
                      <tr>
                        <td className="px-3 py-3" colSpan={4}>No failed production pushes.</td>
                      </tr>
                    ) : (
                      retryWorkOrders.map((workOrder) => (
                        <tr key={`retry-${workOrder.id}`} className="border-t">
                          <td className="px-3 py-2 font-medium">{workOrder.work_order_number}</td>
                          <td className="px-3 py-2">{workOrder.company_name || "-"}</td>
                          <td className="px-3 py-2 text-red-600">{workOrder.error_log || "-"}</td>
                          <td className="px-3 py-2">
                            <Button size="sm" variant="outline" onClick={() => retryProductionPush(workOrder.id)}>Retry</Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeSection === "products" && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-800">Products</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-lg border border-gray-200 bg-white p-4">
                <p className="text-sm text-gray-500">Machine Products</p>
                <p className="text-2xl font-semibold text-gray-800">{machineProducts.length}</p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white p-4">
                <p className="text-sm text-gray-500">Spare Products</p>
                <p className="text-2xl font-semibold text-gray-800">{spareProducts.length}</p>
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-gray-700">
                  <tr>
                    <th className="px-3 py-2 text-left">Type</th>
                    <th className="px-3 py-2 text-left">Product Name</th>
                    <th className="px-3 py-2 text-left">Code</th>
                    <th className="px-3 py-2 text-left">Category</th>
                  </tr>
                </thead>
                <tbody>
                  {[...machineProducts.map((p) => ({ ...p, type: "Machine" })), ...spareProducts.map((p) => ({ ...p, type: "Spare" }))]
                    .slice(0, 20)
                    .map((product) => (
                      <tr key={`${product.type}-${product.id}`} className="border-t">
                        <td className="px-3 py-2">{product.type}</td>
                        <td className="px-3 py-2">{product.product_name || "-"}</td>
                        <td className="px-3 py-2">{product.product_code || "-"}</td>
                        <td className="px-3 py-2">{product.category_name || "-"}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeSection === "terms" && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-800">Terms & Conditions</h2>
                <p className="text-sm text-gray-500">Manage default terms for Quotations, Proforma Invoices, and Purchase Orders.</p>
              </div>
              <Button onClick={() => openTermModal()}>+ Add New Term</Button>
            </div>

            {/* Filter tabs */}
            <div className="flex gap-2 border-b border-gray-200">
              {[{ key: "all", label: "All" }, { key: "quotation", label: "Quotation" }, { key: "proforma_invoice", label: "Proforma Invoice" }, { key: "purchase_order", label: "Purchase Order" }].map((tab) => (
                <button
                  key={tab.key}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    termsFilter === tab.key ? "border-orange-500 text-orange-600" : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                  onClick={() => setTermsFilter(tab.key)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Terms list */}
            {filteredTermsTemplates.length === 0 ? (
              <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-400">
                No terms templates found. Click &quot;Add New Term&quot; to create one.
              </div>
            ) : (
              <div className="space-y-3">
                {filteredTermsTemplates.map((term) => (
                  <div key={term.id} className={`rounded-lg border bg-white overflow-hidden ${term.is_active ? "border-gray-200" : "border-gray-100 opacity-60"}`}>
                    <div className="flex items-center justify-between px-4 py-3 bg-gray-50">
                      <div className="flex items-center gap-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          term.document_type === "quotation" ? "bg-blue-100 text-blue-700" :
                          term.document_type === "proforma_invoice" ? "bg-purple-100 text-purple-700" :
                          "bg-orange-100 text-orange-700"
                        }`}>
                          {docTypeLabels[term.document_type] || term.document_type}
                        </span>
                        <span className="font-semibold text-gray-800">{term.title}</span>
                        {!term.is_active && <span className="text-xs text-gray-400">(Inactive)</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="ghost" className="text-xs" onClick={() => handleToggleTermActive(term)}>
                          {term.is_active ? "Deactivate" : "Activate"}
                        </Button>
                        <Button size="sm" variant="outline" className="text-xs" onClick={() => openTermModal(term)}>Edit</Button>
                        <Button size="sm" variant="ghost" className="text-xs text-red-500 hover:text-red-700" onClick={() => handleDeleteTerm(term.id)}>Delete</Button>
                      </div>
                    </div>
                    <div className="px-4 py-3 text-sm text-gray-600 prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: term.content || "<em>No content</em>" }} />
                  </div>
                ))}
              </div>
            )}

            {/* Legacy defaults (kept for backward compatibility) */}
            <details className="rounded-lg border border-gray-200 bg-white">
              <summary className="px-4 py-3 cursor-pointer text-sm font-medium text-gray-600">Legacy Document Defaults (System Settings)</summary>
              <form onSubmit={saveTermsDefaults} className="p-5 space-y-4 border-t">
                <div>
                  <Label>Default Terms & Conditions</Label>
                  <Textarea rows={4} value={termsForm.terms_conditions} onChange={(e) => setTermsForm((prev) => ({ ...prev, terms_conditions: e.target.value }))} />
                </div>
                <div>
                  <Label>Default Attention</Label>
                  <Textarea rows={3} value={termsForm.attention} onChange={(e) => setTermsForm((prev) => ({ ...prev, attention: e.target.value }))} />
                </div>
                <div>
                  <Label>Default Declaration</Label>
                  <Textarea rows={3} value={termsForm.declaration} onChange={(e) => setTermsForm((prev) => ({ ...prev, declaration: e.target.value }))} />
                </div>
                <div>
                  <Label>Default Special Notes</Label>
                  <Textarea rows={3} value={termsForm.special_notes} onChange={(e) => setTermsForm((prev) => ({ ...prev, special_notes: e.target.value }))} />
                </div>
                <div className="flex justify-end">
                  <Button type="submit" disabled={savingTerms}>{savingTerms ? "Saving..." : "Save Defaults"}</Button>
                </div>
              </form>
            </details>

            {/* Create/Edit Term Modal */}
            {termsModalOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl mx-4 max-h-[90vh] flex flex-col">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-800">{editingTerm ? "Edit Term" : "Create New Term"}</h3>
                  </div>
                  <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Document Type</Label>
                        <select
                          className="w-full mt-1 h-10 rounded-md border border-gray-300 px-3 text-sm"
                          value={termForm.document_type}
                          onChange={(e) => setTermForm((p) => ({ ...p, document_type: e.target.value }))}
                        >
                          <option value="quotation">Quotation</option>
                          <option value="proforma_invoice">Proforma Invoice</option>
                          <option value="purchase_order">Purchase Order</option>
                        </select>
                      </div>
                      <div>
                        <Label>Title</Label>
                        <Input
                          value={termForm.title}
                          onChange={(e) => setTermForm((p) => ({ ...p, title: e.target.value }))}
                          placeholder="e.g. General Terms, Export Terms, Payment Terms..."
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Content</Label>
                      <RichTextEditor
                        value={termForm.content}
                        onChange={(val) => setTermForm((p) => ({ ...p, content: val }))}
                        placeholder="Enter terms and conditions content..."
                        className="mt-1"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="term-active"
                        checked={termForm.is_active === 1}
                        onChange={(e) => setTermForm((p) => ({ ...p, is_active: e.target.checked ? 1 : 0 }))}
                        className="rounded border-gray-300"
                      />
                      <Label htmlFor="term-active" className="mb-0">Active</Label>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-200">
                    <Button variant="outline" onClick={() => setTermsModalOpen(false)}>Cancel</Button>
                    <Button onClick={handleSaveTerm} disabled={savingTerm}>
                      {savingTerm ? "Saving..." : editingTerm ? "Update Term" : "Create Term"}
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
