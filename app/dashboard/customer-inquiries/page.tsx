"use client"

import { useEffect, useState, useCallback, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { DateRangeFilter } from "@/components/ui/date-range-filter"
import { useSilentRefresh } from "@/hooks/use-silent-refresh"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"
import { useGeoCountries, useGeoStates, useGeoCities } from "@/hooks/use-geo"
import { apiUrl } from "@/lib/api"
import { FollowUpSection } from "@/components/follow-up-section"
import { DynamicDropdown } from "@/components/ui/dynamic-dropdown"
import { MultiSelectFilter } from "@/components/ui/multi-select-filter"
import { useDropdownValues } from "@/hooks/use-dropdown-values"
import { Search } from "lucide-react"
import { getSalesMenuItems, salesRouteMap } from "@/lib/menu"

type AssignableUser = {
  id: number
  name: string
  role: string
  designation: string
  label: string
}

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
  alternate_email_2: string | null
  designation: string | null
  gst_number: string | null
  address: string | null
  industry: string | null
  region: string | null
  country: string | null
  state: string | null
  city: string | null
  remarks: string | null
  inquiry_date: string | null
}

type InquiryForm = {
  company_name: string
  authorized_person: string
  authorized_phone: string
  email: string
  alternate_email: string
  alternate_email_2: string
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
  inquiry_date: string
}

const initialForm: InquiryForm = {
  company_name: "",
  authorized_person: "",
  authorized_phone: "",
  email: "",
  alternate_email: "",
  alternate_email_2: "",
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
  inquiry_date: new Date().toISOString().split("T")[0],
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
  const [formError, setFormError] = useState("")

  const [filters, setFilters] = useState({
    from_date: "",
    to_date: "",
  })

  // Geo dropdowns
  const [selectedCountryId, setSelectedCountryId] = useState<number | null>(null)
  const [selectedStateId, setSelectedStateId] = useState<number | null>(null)
  const { countries } = useGeoCountries()
  const { states } = useGeoStates(selectedCountryId)
  const { cities } = useGeoCities(selectedStateId)

  // Assignable users
  const [assignableUsers, setAssignableUsers] = useState<AssignableUser[]>([])
  const { getValues, getOptions, refresh: refreshDropdowns } = useDropdownValues()
  const [pendingFollowUps, setPendingFollowUps] = useState<{ note: string; reminder_date: string }[]>([])

  // List filters
  const [searchQuery, setSearchQuery] = useState("")
  const [sourceFilter, setSourceFilter] = useState<string[]>([])
  const [categoryFilter, setCategoryFilter] = useState<string[]>([])
  const [industryFilter, setIndustryFilter] = useState<string[]>([])
  const [statusFilter, setStatusFilter] = useState<string[]>([])

  const isAdmin = user?.role === "master_admin"

  useEffect(() => {
    fetch(apiUrl("/api/users/assignable?designation=Sales Employee"), { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setAssignableUsers(d.users || []))
      .catch(() => {})
  }, [])

  const menuItems = getSalesMenuItems(user)

  function handleSectionChange(section: string) {
    const target = salesRouteMap[section]
    if (target) { router.push(target); return }
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

  // Silent background refresh every 30s
  const silentFetch = useCallback(async () => { await fetchInquiries(filters) }, [filters.from_date, filters.to_date])
  useSilentRefresh(silentFetch, 30000)

  function openCreateForm() {
    setEditingId(null)
    setForm({ ...initialForm, assigned_to: user?.id ? String(user.id) : "" })
    setSelectedCountryId(null)
    setSelectedStateId(null)
    setFormError("")
    setPendingFollowUps([])
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
      alternate_email_2: item.alternate_email_2 || "",
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
      inquiry_date: item.inquiry_date || new Date().toISOString().split("T")[0],
    })
    // Resolve geo IDs from names for editing
    const matchedCountry = countries.find((c) => c.name === item.country)
    setSelectedCountryId(matchedCountry?.id ?? null)
    // State/city IDs will resolve via effects once states/cities load
    setSelectedStateId(null)
    setShowForm(true)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError("")

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
        setFormError(data?.message || "Failed to save inquiry")
        return
      }

      // Create pending follow-ups
      const savedId = editingId || data?.inquiry?.id
      if (!editingId && pendingFollowUps.length > 0 && savedId) {
        for (const pf of pendingFollowUps) {
          try {
            await fetch(apiUrl("/api/followups"), {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({
                entity_type: "enquiry",
                entity_id: savedId,
                note: pf.note || null,
                reminder_datetime: `${pf.reminder_date}T09:00:00`,
              }),
            })
          } catch { /* ignore */ }
        }
        setPendingFollowUps([])
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
      setFormError(error instanceof Error ? error.message : "Failed to save inquiry")
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
          <>
          <form onSubmit={handleSubmit} className="rounded-lg border border-gray-200 bg-white p-5 space-y-4">
            {formError && (
              <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                {formError}
              </div>
            )}
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
                <Label>Alternate Email 2</Label>
                <Input value={form.alternate_email_2} onChange={(e) => setForm({ ...form, alternate_email_2: e.target.value })} />
              </div>
              <div>
                <Label>Inquiry Date</Label>
                <Input type="date" value={form.inquiry_date} onChange={(e) => setForm({ ...form, inquiry_date: e.target.value })} />
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
                <Label>Assigned To</Label>
                <select
                  className="w-full border border-gray-300 rounded-md h-10 px-3"
                  value={form.assigned_to}
                  onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}
                >
                  <option value="">Select employee</option>
                  {assignableUsers.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Enquiry Source</Label>
                <DynamicDropdown
                  fieldName="enquiry_source"
                  label="Source"
                  value={form.enquiry_source}
                  onChange={(v) => setForm({ ...form, enquiry_source: v })}
                  values={getValues("enquiry_source")}
                  onValuesChange={refreshDropdowns}
                  canDelete={isAdmin}
                />
              </div>
              <div>
                <Label>Category</Label>
                <DynamicDropdown
                  fieldName="category"
                  label="Category"
                  value={form.category}
                  onChange={(v) => setForm({ ...form, category: v })}
                  values={getValues("category")}
                  onValuesChange={refreshDropdowns}
                  canDelete={isAdmin}
                />
              </div>
              <div>
                <Label>Industry</Label>
                <DynamicDropdown
                  fieldName="industry"
                  label="Industry"
                  value={form.industry}
                  onChange={(v) => setForm({ ...form, industry: v })}
                  values={getValues("industry")}
                  onValuesChange={refreshDropdowns}
                  canDelete={isAdmin}
                />
              </div>
              <div>
                <Label>Region</Label>
                <DynamicDropdown
                  fieldName="region"
                  label="Region"
                  value={form.region}
                  onChange={(v) => setForm({ ...form, region: v })}
                  values={getValues("region")}
                  onValuesChange={refreshDropdowns}
                  canDelete={isAdmin}
                />
              </div>
              <div>
                <Label>Country</Label>
                <select
                  className="w-full border border-gray-300 rounded-md h-10 px-3"
                  value={form.country}
                  onChange={(e) => {
                    const name = e.target.value
                    const c = countries.find((x) => x.name === name)
                    setSelectedCountryId(c?.id ?? null)
                    setSelectedStateId(null)
                    setForm({ ...form, country: name, state: "", city: "" })
                  }}
                >
                  <option value="">Select country</option>
                  {countries.map((c) => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>State</Label>
                <select
                  className="w-full border border-gray-300 rounded-md h-10 px-3"
                  value={form.state}
                  onChange={(e) => {
                    const name = e.target.value
                    const s = states.find((x) => x.name === name)
                    setSelectedStateId(s?.id ?? null)
                    setForm({ ...form, state: name, city: "" })
                  }}
                >
                  <option value="">Select state</option>
                  {states.map((s) => (
                    <option key={s.id} value={s.name}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>City</Label>
                <select
                  className="w-full border border-gray-300 rounded-md h-10 px-3"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                >
                  <option value="">Select city</option>
                  {cities.map((c) => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
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

            {/* Follow-Up Section — above buttons */}
            <FollowUpSection
              entityType="enquiry"
              entityId={editingId}
              pendingFollowUps={pendingFollowUps}
              onPendingChange={setPendingFollowUps}
            />

            {pendingFollowUps.length > 0 && !editingId && (
              <div className="text-xs text-gray-500">
                {pendingFollowUps.length} follow-up(s) will be created on save
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button type="submit">{editingId ? "Update" : "Create"}</Button>
            </div>
          </form>
          </>
        )}
        {!showForm && (
          <>
          {/* Search + filters bar */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="Search inquiries..."
                className="w-full h-8 pl-8 pr-3 text-xs border border-gray-200 rounded-md bg-white"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <MultiSelectFilter label="Source" options={getOptions("enquiry_source")} selected={sourceFilter} onChange={setSourceFilter} />
            <MultiSelectFilter label="Category" options={getOptions("category")} selected={categoryFilter} onChange={setCategoryFilter} />
            <MultiSelectFilter label="Industry" options={getOptions("industry")} selected={industryFilter} onChange={setIndustryFilter} />
            <MultiSelectFilter label="Status" options={["open", "converted", "closed"]} selected={statusFilter} onChange={setStatusFilter} />
          </div>
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
                  <th className="px-3 py-2 text-left">Follow-up</th>
                  <th className="px-3 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isFetching ? (
                  <tr>
                    <td className="px-3 py-3" colSpan={10}>Loading...</td>
                  </tr>
                ) : inquiries.length === 0 ? (
                  <tr>
                    <td className="px-3 py-3" colSpan={10}>No inquiries found.</td>
                  </tr>
                ) : (
                  inquiries.filter((item) => {
                    if (sourceFilter.length > 0 && !sourceFilter.includes(item.enquiry_source || "")) return false
                    if (categoryFilter.length > 0 && !categoryFilter.includes(item.category || "")) return false
                    if (industryFilter.length > 0 && !industryFilter.includes(item.industry || "")) return false
                    if (statusFilter.length > 0 && !statusFilter.includes(item.status || "open")) return false
                    if (searchQuery) {
                      const q = searchQuery.toLowerCase()
                      const match =
                        (item.inquiry_number || "").toLowerCase().includes(q) ||
                        (item.company_name || "").toLowerCase().includes(q) ||
                        (item.authorized_person || "").toLowerCase().includes(q) ||
                        (item.email || "").toLowerCase().includes(q)
                      if (!match) return false
                    }
                    return true
                  }).map((item) => (
                    <tr key={item.id} className="border-t">
                      <td className="px-3 py-2 font-medium">{item.inquiry_number}</td>
                      <td className="px-3 py-2">{formatDate(item.created_at)}</td>
                      <td className="px-3 py-2">{item.created_by_name || "-"}</td>
                      <td className="px-3 py-2">{item.company_name || "-"}</td>
                      <td className="px-3 py-2">{item.authorized_person || "-"}</td>
                      <td className="px-3 py-2">{item.email || "-"}</td>
                      <td className="px-3 py-2">{item.enquiry_source || "-"}</td>
                      <td className="px-3 py-2">{item.category || "-"}</td>
                      <td className="px-3 py-2">{item.status || "open"}</td>
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
          </>
        )}
      </div>
    </DashboardLayout>
  )
}
