"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { useAuth } from "@/hooks/use-auth"
import { apiUrl } from "@/lib/api"

type UserRow = {
  id: number
  login_id: string
  name: string
  role: string
  role_type: string | null
  created_at: string
  employee_id: string | null
  full_name: string | null
  email: string | null
  contact_number: string | null
  designation: string | null
  status: string | null
}

const EMPTY_FORM = {
  login_id: "",
  password: "",
  full_name: "",
  email: "",
  contact_number: "",
  designation: "Sales Employee",
  role_type: "sub",
}

export default function AllUsersPage() {
  const router = useRouter()
  const { user, isLoading, logout } = useAuth()
  const [users, setUsers] = useState<UserRow[]>([])
  const [fetching, setFetching] = useState(false)
  const [activeSection, setActiveSection] = useState("all-users")

  // Add employee form state
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [formError, setFormError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  // Delete state
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const isEmployee = user?.role === "employee"
  const isAdmin = user?.role === "master_admin"
  const canViewUsers = isEmployee || isAdmin

  const menuItems = [
    { id: "inquiries", label: "Customer Inquiries" },
    { id: "quotations", label: "Quotations" },
    { id: "performas", label: "Performas" },
    { id: "work-orders", label: "Work Orders" },
    { id: "products", label: "Products" },
    { id: "followups", label: "Follow Ups" },
    { id: "reports", label: "Reports" },
    ...(canViewUsers ? [{ id: "all-users", label: "All Users" }] : []),
  ]

  function handleSectionChange(section: string) {
    const routeMap: Record<string, string> = {
      inquiries: "/dashboard/inquiries",
      quotations: "/dashboard/quotations",
      performas: "/dashboard/performas",
      "work-orders": "/dashboard/work-orders",
      products: "/dashboard/products",
      followups: "/dashboard/followups",
      reports: "/dashboard/reports",
      "all-users": "/dashboard/all-users",
    }
    const target = routeMap[section]
    if (target) router.push(target)
  }

  useEffect(() => {
    if (!isLoading && user) {
      if (!canViewUsers) {
        router.push("/dashboard/inquiries")
        return
      }
      fetchUsers()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, user])

  async function fetchUsers() {
    setFetching(true)
    try {
      const res = await fetch(apiUrl("/api/users/all"), { credentials: "include" })
      if (!res.ok) throw new Error("Failed")
      const data = await res.json()
      setUsers(data.users || [])
    } catch (err) {
      console.error("Failed to fetch users:", err)
    } finally {
      setFetching(false)
    }
  }

  async function handleAddEmployee(e: React.FormEvent) {
    e.preventDefault()
    setFormError("")
    setSubmitting(true)
    try {
      const res = await fetch(apiUrl("/api/employees"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          login_id: form.login_id.trim().toLowerCase(),
          password: form.password,
          full_name: form.full_name.trim(),
          email: form.email.trim() || null,
          contact_number: form.contact_number.trim() || null,
          designation: form.designation,
          role: "employee",
          role_type: form.role_type,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setFormError(data.message || "Failed to create employee")
        return
      }
      setShowForm(false)
      setForm({ ...EMPTY_FORM })
      fetchUsers()
    } catch {
      setFormError("Network error. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDeleteEmployee(u: UserRow) {
    if (!u.employee_id && !u.id) return
    if (!confirm(`Remove employee "${u.full_name || u.name}"? This will deactivate their account.`)) return
    setDeletingId(u.id)
    try {
      // Find the employee record ID — we need to look it up by user_id
      // The delete endpoint uses employee table ID, so we fetch it first
      const empRes = await fetch(apiUrl("/api/employees"), { credentials: "include" })
      if (!empRes.ok) throw new Error("Failed to fetch employees")
      const empData = await empRes.json()
      const emp = (empData.employees || []).find((e: { user_id: number }) => e.user_id === u.id)
      if (!emp) {
        alert("Employee record not found.")
        return
      }
      const res = await fetch(apiUrl(`/api/employees/${emp.id}`), {
        method: "DELETE",
        credentials: "include",
      })
      if (!res.ok) {
        const data = await res.json()
        alert(data.message || "Failed to remove employee")
        return
      }
      // Remove from UI immediately
      setUsers((prev) => prev.filter((row) => row.id !== u.id))
    } catch {
      alert("Network error. Please try again.")
    } finally {
      setDeletingId(null)
    }
  }

  if (isLoading) return <div className="p-8">Loading...</div>

  const roleTypeLabel = (rt: string | null) => {
    if (rt === "main") return "Main"
    if (rt === "sub") return "Sub"
    if (rt === "regular") return "Regular"
    return "-"
  }

  const roleTypeBadge = (rt: string | null) => {
    const cls =
      rt === "main" ? "bg-blue-100 text-blue-700" :
      rt === "sub" ? "bg-yellow-100 text-yellow-700" :
      rt === "regular" ? "bg-purple-100 text-purple-700" :
      "bg-gray-100 text-gray-600"
    return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{roleTypeLabel(rt)}</span>
  }

  return (
    <DashboardLayout
      title="Sales"
      menuItems={menuItems}
      activeSection={activeSection}
      onSectionChange={handleSectionChange}
      loginId={user?.loginId || ""}
      onLogout={logout}
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-800">All Users</h1>
          <button
            onClick={() => { setShowForm(true); setFormError("") }}
            className="px-4 py-2 text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 rounded-lg transition-colors"
          >
            + Add Employee
          </button>
        </div>

        {/* Add Employee Form */}
        {showForm && (
          <div className="rounded-lg border border-gray-200 bg-white p-5 space-y-4">
            <h2 className="text-base font-semibold text-gray-700">New Employee</h2>
            {formError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{formError}</p>}
            <form onSubmit={handleAddEmployee} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Full Name *</label>
                <input
                  type="text" required value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                  placeholder="John Doe"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">User ID (login) *</label>
                <input
                  type="text" required value={form.login_id}
                  onChange={(e) => setForm({ ...form, login_id: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                  placeholder="johndoe"
                />
                <p className="text-[11px] text-gray-400 mt-0.5">3-20 chars, lowercase, letters/numbers/underscore</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Password *</label>
                <input
                  type="password" required value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                  placeholder="Min 8 chars, A-Z, a-z, 0-9"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                <input
                  type="email" value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                  placeholder="john@example.com"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
                <input
                  type="text" value={form.contact_number}
                  onChange={(e) => setForm({ ...form, contact_number: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                  placeholder="+91 98765 43210"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Designation</label>
                <select
                  value={form.designation}
                  onChange={(e) => setForm({ ...form, designation: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                >
                  <option value="Sales Employee">Sales Employee</option>
                  <option value="Purchase Employee">Purchase Employee</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Role Type</label>
                <select
                  value={form.role_type}
                  onChange={(e) => setForm({ ...form, role_type: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                >
                  <option value="main">Main</option>
                  <option value="sub">Sub</option>
                  <option value="regular">Regular</option>
                </select>
              </div>
              <div className="flex items-end gap-2 md:col-span-2 lg:col-span-2">
                <button
                  type="submit" disabled={submitting}
                  className="px-5 py-2 text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-50 rounded-md transition-colors"
                >
                  {submitting ? "Creating..." : "Create Employee"}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setForm({ ...EMPTY_FORM }); setFormError("") }}
                  className="px-5 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {fetching ? (
          <p className="text-sm text-gray-500">Loading users...</p>
        ) : (
          <div className="rounded-lg border border-gray-200 bg-white overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-700">
                <tr>
                  <th className="px-4 py-2 text-left">Name</th>
                  <th className="px-4 py-2 text-left">User ID</th>
                  <th className="px-4 py-2 text-left">Email</th>
                  <th className="px-4 py-2 text-left">Phone</th>
                  <th className="px-4 py-2 text-left">Role</th>
                  <th className="px-4 py-2 text-left">Department</th>
                  <th className="px-4 py-2 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-400">No users found.</td></tr>
                ) : users.map((u) => (
                  <tr key={u.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium">{u.full_name || u.name}</td>
                    <td className="px-4 py-2">{u.login_id}</td>
                    <td className="px-4 py-2">{u.email || "-"}</td>
                    <td className="px-4 py-2">{u.contact_number || "-"}</td>
                    <td className="px-4 py-2">
                      {u.role === "master_admin" ? (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">Admin</span>
                      ) : (
                        roleTypeBadge(u.role_type)
                      )}
                    </td>
                    <td className="px-4 py-2">{u.designation || (u.role === "master_admin" ? "Administration" : "-")}</td>
                    <td className="px-4 py-2 text-center">
                      {u.role === "employee" ? (
                        <button
                          onClick={() => handleDeleteEmployee(u)}
                          disabled={deletingId === u.id}
                          className="px-3 py-1 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 disabled:opacity-50 rounded transition-colors"
                        >
                          {deletingId === u.id ? "Removing..." : "Remove"}
                        </button>
                      ) : (
                        <span className="text-gray-300 text-xs">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
