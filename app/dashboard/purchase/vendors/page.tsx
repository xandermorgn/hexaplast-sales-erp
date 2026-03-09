"use client"

import { useEffect, useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { apiUrl } from "@/lib/api"

type Vendor = {
  id: number
  name: string
  phone: string | null
  email: string | null
  address: string | null
  gst: string | null
  created_at: string
}

type VendorForm = {
  name: string
  phone: string
  email: string
  address: string
  gst: string
}

const emptyForm: VendorForm = { name: "", phone: "", email: "", address: "", gst: "" }

const menuItems = [
  { id: "pending-work-orders", label: "Pending Work Orders" },
  { id: "bom", label: "Bill of Materials" },
  { id: "purchase", label: "Purchase" },
  { id: "inquiries", label: "Inquiries" },
  { id: "purchase-orders", label: "Purchase Orders" },
  { id: "vendors", label: "Vendors" },
]

export default function VendorsPage() {
  const router = useRouter()
  const { user, isLoading, logout } = useAuth()
  const { toast } = useToast()

  const [activeSection, setActiveSection] = useState("vendors")
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [form, setForm] = useState<VendorForm>(emptyForm)
  const [editId, setEditId] = useState<number | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)

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

  async function fetchVendors() {
    try {
      const res = await fetch(apiUrl("/api/vendors"), { credentials: "include" })
      if (!res.ok) throw new Error("Failed to fetch vendors")
      const data = await res.json()
      setVendors(data.vendors || [])
    } catch {
      toast({ title: "Error", description: "Failed to load vendors", variant: "destructive" })
    }
  }

  function openModal(vendor?: Vendor) {
    if (vendor) {
      setEditId(vendor.id)
      setForm({
        name: vendor.name || "",
        phone: vendor.phone || "",
        email: vendor.email || "",
        address: vendor.address || "",
        gst: vendor.gst || "",
      })
    } else {
      setEditId(null)
      setForm(emptyForm)
    }
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditId(null)
    setForm(emptyForm)
  }

  async function submitVendor(e: FormEvent) {
    e.preventDefault()
    const trimmed = form.name.trim()
    if (!trimmed) return

    try {
      const isUpdate = editId !== null
      const url = isUpdate ? apiUrl(`/api/vendors/${editId}`) : apiUrl("/api/vendors")
      const res = await fetch(url, {
        method: isUpdate ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...form, name: trimmed }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.message || "Failed to save vendor")

      toast({ title: "Success", description: isUpdate ? "Vendor updated" : "Vendor created" })
      closeModal()
      await fetchVendors()
    } catch (error) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to save vendor", variant: "destructive" })
    }
  }

  async function deleteVendor(vendorId: number) {
    try {
      const res = await fetch(apiUrl(`/api/vendors/${vendorId}`), { method: "DELETE", credentials: "include" })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.message || "Failed to delete vendor")

      toast({ title: "Success", description: "Vendor deleted" })
      setDeletingId(null)
      await fetchVendors()
    } catch (error) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to delete vendor", variant: "destructive" })
    }
  }

  useEffect(() => {
    fetchVendors()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
            <h1 className="text-2xl font-semibold text-gray-800">Vendors</h1>
            <p className="text-sm text-gray-500">Manage vendor contacts for procurement.</p>
          </div>
          <Button onClick={() => openModal()}>+ New Vendor</Button>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-700">
              <tr>
                <th className="px-4 py-2 text-left">#</th>
                <th className="px-4 py-2 text-left">Vendor Name</th>
                <th className="px-4 py-2 text-left">Phone</th>
                <th className="px-4 py-2 text-left">Email</th>
                <th className="px-4 py-2 text-left">GST</th>
                <th className="px-4 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {vendors.length === 0 ? (
                <tr><td className="px-4 py-4 text-gray-400" colSpan={6}>No vendors yet.</td></tr>
              ) : (
                vendors.map((vendor, idx) => (
                  <tr key={vendor.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-2">{idx + 1}</td>
                    <td className="px-4 py-2 font-medium">{vendor.name}</td>
                    <td className="px-4 py-2">{vendor.phone || "-"}</td>
                    <td className="px-4 py-2">{vendor.email || "-"}</td>
                    <td className="px-4 py-2">{vendor.gst || "-"}</td>
                    <td className="px-4 py-2 flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => openModal(vendor)}>Edit</Button>
                      <Button size="sm" variant="destructive" onClick={() => setDeletingId(vendor.id)}>Delete</Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Vendor Create/Edit Modal */}
        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6 space-y-4">
              <h3 className="text-lg font-semibold text-gray-800">{editId ? "Edit Vendor" : "New Vendor"}</h3>
              <form onSubmit={submitVendor} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <Label>Vendor Name</Label>
                    <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Vendor name" required autoFocus />
                  </div>
                  <div>
                    <Label>Phone</Label>
                    <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+91..." />
                  </div>
                  <div>
                    <Label>Email</Label>
                    <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="vendor@example.com" />
                  </div>
                  <div>
                    <Label>GST Number</Label>
                    <Input value={form.gst} onChange={(e) => setForm({ ...form, gst: e.target.value })} placeholder="GST number" />
                  </div>
                  <div className="md:col-span-2">
                    <Label>Address</Label>
                    <Textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} rows={2} placeholder="Full address" />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={closeModal}>Cancel</Button>
                  <Button type="submit">{editId ? "Update Vendor" : "Create Vendor"}</Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deletingId !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6 space-y-4">
              <h3 className="text-lg font-semibold text-gray-800">Delete Vendor</h3>
              <p className="text-sm text-gray-600">Are you sure you want to delete this vendor?</p>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setDeletingId(null)}>Cancel</Button>
                <Button type="button" variant="destructive" onClick={() => deleteVendor(deletingId)}>Delete</Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
