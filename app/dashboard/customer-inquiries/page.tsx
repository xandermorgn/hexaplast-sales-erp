"use client"

import { useEffect, useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { DateRangeFilter } from "@/components/ui/date-range-filter"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"
import { apiUrl } from "@/lib/api"

interface Inquiry {
  id: number
  inquiry_number: string
  created_at: string
  created_by_name: string
  company_name: string | null
  authorized_person: string | null
  email: string | null
  enquiry_source: string | null
  category: string | null
  status: string | null
  followup: string | null
  assigned_to: number | null
  authorized_phone: string | null
  alternate_email: string | null
  designation: string | null
  gst_number: string | null
  address: string | null
  industry: string | null
  region: string | null
  country: string | null
  state: string | null
  city: string | null
  remarks: string | null
}

type InquiryForm = {
  company_name: string
  authorized_person: string
  authorized_phone: string
  email: string
  alternate_email: string
  designation: string
  gst_number: string
  address: string
  assigned_to: string
  enquiry_source: string
  category: string
  industry: string
  region: string
  country: string
  state: string
  city: string
  remarks: string
  followup: string
  status: string
}

const initialForm: InquiryForm = {
  company_name: "",
  authorized_person: "",
  authorized_phone: "",
  email: "",
  alternate_email: "",
  designation: "",
  gst_number: "",
  address: "",
  assigned_to: "",
  enquiry_source: "",
  category: "",
  industry: "",
  region: "",
  country: "",
  state: "",
  city: "",
  remarks: "",
  followup: "",
  status: "open",
}

export default function CustomerInquiriesPage() {
  const router = useRouter()
  const { user, isLoading, logout } = useAuth()
  const { toast } = useToast()

  const [activeSection, setActiveSection] = useState("inquiries")
  const [inquiries, setInquiries] = useState<Inquiry[]>([])
  const [isFetching, setIsFetching] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<InquiryForm>(initialForm)

  const [filters, setFilters] = useState({
    from_date: "",
    to_date: "",
  })

  const menuItems = [
    { id: "inquiries", label: "Customer Inquiries" },
    { id: "quotations", label: "Quotations" },
    { id: "performas", label: "Performas" },
    { id: "work-orders", label: "Work Orders" },
    { id: "products", label: "Products" },
  ]

  function handleSectionChange(section: string) {
    const routeMap: Record<string, string> = {
      inquiries: "/dashboard/inquiries",
      quotations: "/dashboard/quotations",
      performas: "/dashboard/performas",
      "work-orders": "/dashboard/work-orders",
      products: "/dashboard/products",
    }

    const target = routeMap[section]
    if (target) {
      router.push(target)
      return
    }

    setActiveSection("inquiries")
  }

  async function fetchInquiries(nextFilters = filters) {
    try {
      setIsFetching(true)
      const params = new URLSearchParams()

      if (nextFilters.from_date) params.set("from_date", nextFilters.from_date)
      if (nextFilters.to_date) params.set("to_date", nextFilters.to_date)

      const url = params.toString()
        ? apiUrl(`/api/inquiries?${params.toString()}`)
        : apiUrl("/api/inquiries")

      const response = await fetch(url, {
        credentials: "include",
      })

      if (!response.ok) {
        throw new Error("Failed to fetch inquiries")
      }

      const data = await response.json()
      setInquiries(data.inquiries || [])
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load inquiries",
        variant: "destructive",
      })
    } finally {
      setIsFetching(false)
    }
  }

  useEffect(() => {
    fetchInquiries(filters)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.from_date, filters.to_date])

  // Socket.io real-time refresh disabled – will be replaced with polling/SSE

  function openCreateForm() {
    setEditingId(null)
    setForm(initialForm)
    setShowForm(true)
  }

  function openEditForm(item: Inquiry) {
    setEditingId(item.id)
    setForm({
      company_name: item.company_name || "",
      authorized_person: item.authorized_person || "",
      authorized_phone: item.authorized_phone || "",
      email: item.email || "",
      alternate_email: item.alternate_email || "",
      designation: item.designation || "",
      gst_number: item.gst_number || "",
      address: item.address || "",
      assigned_to: item.assigned_to ? String(item.assigned_to) : "",
      enquiry_source: item.enquiry_source || "",
      category: item.category || "",
      industry: item.industry || "",
      region: item.region || "",
      country: item.country || "",
      state: item.state || "",
      city: item.city || "",
      remarks: item.remarks || "",
      followup: item.followup || "",
      status: item.status || "open",
    })
    setShowForm(true)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()

    const payload = {
      ...form,
      assigned_to: form.assigned_to || null,
    }

    try {
      const url = editingId
        ? apiUrl(`/api/inquiries/${editingId}`)
        : apiUrl("/api/inquiries")

      const method = editingId ? "PUT" : "POST"

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.message || "Failed to save inquiry")
      }

      toast({
        title: "Success",
        description: editingId ? "Inquiry updated" : "Inquiry created",
      })

      setShowForm(false)
      setEditingId(null)
      setForm(initialForm)
      await fetchInquiries()
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save inquiry",
        variant: "destructive",
      })
    }
  }

  function formatDate(value: string | null | undefined) {
    if (!value) return "-"
    const dt = new Date(value)
    if (Number.isNaN(dt.getTime())) return value
    return dt.toLocaleDateString()
  }

  if (isLoading) {
    return (
      <DashboardLayout
        title="Sales"
        menuItems={menuItems}
        activeSection={activeSection}
        onSectionChange={handleSectionChange}
        loginId={user?.loginId || ""}
        onLogout={logout}
      >
        <div className="p-6">Loading...</div>
      </DashboardLayout>
    )
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
      <div className="space-y-6">
        <div>
          <div>
            <h1 className="text-2xl font-semibold text-gray-800">Customer Inquiries</h1>
            <p className="text-sm text-gray-500">Track and manage all incoming customer inquiries.</p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div />
          <div className="ml-auto flex items-center gap-2">
            {!showForm ? (
              <>
                <DateRangeFilter value={filters} onChange={setFilters} />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-10 w-10"
                  onClick={() => setFilters({ from_date: "", to_date: "" })}
                  aria-label="Reset date range"
                  title="Reset date range"
                >
                  ⟲
                </Button>
              </>
            ) : null}
            {showForm ? (
              <Button variant="outline" onClick={() => setShowForm(false)}>
                Back to List
              </Button>
            ) : null}
            <Button className="h-10 px-6 text-base" onClick={openCreateForm}>
              + New
            </Button>
          </div>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="rounded-lg border border-gray-200 bg-white p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Company Name</Label>
                <Input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} />
              </div>
              <div>
                <Label>Authorized Person</Label>
                <Input value={form.authorized_person} onChange={(e) => setForm({ ...form, authorized_person: e.target.value })} />
              </div>
              <div>
                <Label>Authorized Phone</Label>
                <Input value={form.authorized_phone} onChange={(e) => setForm({ ...form, authorized_phone: e.target.value })} />
              </div>
              <div>
                <Label>Email</Label>
                <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <Label>Alternate Email</Label>
                <Input value={form.alternate_email} onChange={(e) => setForm({ ...form, alternate_email: e.target.value })} />
              </div>
              <div>
                <Label>Designation</Label>
                <Input value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} />
              </div>
              <div>
                <Label>GST Number</Label>
                <Input value={form.gst_number} onChange={(e) => setForm({ ...form, gst_number: e.target.value })} />
              </div>
              <div>
                <Label>Assigned To (User ID)</Label>
                <Input
                  value={form.assigned_to}
                  onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}
                  placeholder="e.g. 2"
                />
              </div>
              <div>
                <Label>Enquiry Source</Label>
                <Input value={form.enquiry_source} onChange={(e) => setForm({ ...form, enquiry_source: e.target.value })} />
              </div>
              <div>
                <Label>Category</Label>
                <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
              </div>
              <div>
                <Label>Industry</Label>
                <Input value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} />
              </div>
              <div>
                <Label>Region</Label>
                <Input value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} />
              </div>
              <div>
                <Label>Country</Label>
                <Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
              </div>
              <div>
                <Label>State</Label>
                <Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
              </div>
              <div>
                <Label>City</Label>
                <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
              </div>
              <div>
                <Label>Follow-up</Label>
                <Input value={form.followup} onChange={(e) => setForm({ ...form, followup: e.target.value })} />
              </div>
              <div>
                <Label>Status</Label>
                <select
                  className="w-full border border-gray-300 rounded-md h-10 px-3"
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                >
                  <option value="open">open</option>
                  <option value="in_progress">in_progress</option>
                  <option value="closed">closed</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Address</Label>
                <Textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} rows={3} />
              </div>
              <div>
                <Label>Remarks</Label>
                <Textarea value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} rows={3} />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button type="submit">{editingId ? "Update" : "Create"}</Button>
            </div>
          </form>
        )}
        {!showForm && (
          <div className="rounded-lg border border-gray-200 bg-white overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-700">
                <tr>
                  <th className="px-3 py-2 text-left">Inquiry Number</th>
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Created By</th>
                  <th className="px-3 py-2 text-left">Company Name</th>
                  <th className="px-3 py-2 text-left">Authorized Person</th>
                  <th className="px-3 py-2 text-left">Email</th>
                  <th className="px-3 py-2 text-left">Source</th>
                  <th className="px-3 py-2 text-left">Category</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Follow-up</th>
                  <th className="px-3 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isFetching ? (
                  <tr>
                    <td className="px-3 py-3" colSpan={11}>Loading...</td>
                  </tr>
                ) : inquiries.length === 0 ? (
                  <tr>
                    <td className="px-3 py-3" colSpan={11}>No inquiries found.</td>
                  </tr>
                ) : (
                  inquiries.map((item) => (
                    <tr key={item.id} className="border-t">
                      <td className="px-3 py-2 font-medium">{item.inquiry_number}</td>
                      <td className="px-3 py-2">{formatDate(item.created_at)}</td>
                      <td className="px-3 py-2">{item.created_by_name || "-"}</td>
                      <td className="px-3 py-2">{item.company_name || "-"}</td>
                      <td className="px-3 py-2">{item.authorized_person || "-"}</td>
                      <td className="px-3 py-2">{item.email || "-"}</td>
                      <td className="px-3 py-2">{item.enquiry_source || "-"}</td>
                      <td className="px-3 py-2">{item.category || "-"}</td>
                      <td className="px-3 py-2">{item.status || "-"}</td>
                      <td className="px-3 py-2">{item.followup || "-"}</td>
                      <td className="px-3 py-2">
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => openEditForm(item)}>
                            Edit
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => openEditForm(item)}>
                            Follow-up
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
