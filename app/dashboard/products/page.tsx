"use client"

import { useEffect, useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { useGeoCurrencies } from "@/hooks/use-geo"
import { useCategories, type Category } from "@/hooks/use-categories"
import { apiUrl } from "@/lib/api"

type ProductTab = "machines" | "spares" | "categories"

type MachinePart = {
  id?: number
  machine_id?: number
  part_number: string
  part_name: string
  specification: string
  unit: string
}

type Product = {
  id: number
  category_id: number | null
  category_name: string | null
  product_name: string | null
  model_number: string | null
  product_code: string | null
  sales_price: number | null
  purchase_price: number | null
  hsn_code: string | null
  sac_code: string | null
  gst_percent: number | null
  quantity: number | null
  currency: string | null
  description: string | null
  specifications: string | null
  image_path: string | null
}

type ProductForm = {
  category_id: string
  product_name: string
  model_number: string
  sales_price: string
  purchase_price: string
  hsn_code: string
  sac_code: string
  gst_percent: string
  quantity: string
  currency: string
  description: string
  specifications: string
  image: File | null
}

const emptyProductForm: ProductForm = {
  category_id: "",
  product_name: "",
  model_number: "",
  sales_price: "",
  purchase_price: "",
  hsn_code: "",
  sac_code: "",
  gst_percent: "",
  quantity: "",
  currency: "INR",
  description: "",
  specifications: "",
  image: null,
}

function getImageUrl(path: string | null) {
  if (!path) return null
  if (path.startsWith("/uploads/")) return `/api/serve-upload/${path.replace("/uploads/", "")}`
  if (path.startsWith("uploads/")) return `/api/serve-upload/${path.replace("uploads/", "")}`
  return path
}


export default function ProductsPage() {
  const router = useRouter()
  const { user, isLoading, logout } = useAuth()
  const { toast } = useToast()

  const [activeSection, setActiveSection] = useState("products")
  const [activeTab, setActiveTab] = useState<ProductTab>("machines")
  const { categories, invalidate: refreshCategories } = useCategories()
  const [machineProducts, setMachineProducts] = useState<Product[]>([])
  const [spareProducts, setSpareProducts] = useState<Product[]>([])

  const [machineForm, setMachineForm] = useState<ProductForm>(emptyProductForm)
  const [spareForm, setSpareForm] = useState<ProductForm>(emptyProductForm)
  const [machineEditId, setMachineEditId] = useState<number | null>(null)
  const [spareEditId, setSpareEditId] = useState<number | null>(null)

  const [categoryName, setCategoryName] = useState("")
  const [categoryModalOpen, setCategoryModalOpen] = useState(false)
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null)
  const [deletingCategoryId, setDeletingCategoryId] = useState<number | null>(null)
  const { currencies: currencyOptions } = useGeoCurrencies()

  // Machine Parts state
  const [partsModalMachineId, setPartsModalMachineId] = useState<number | null>(null)
  const [partsModalMachineName, setPartsModalMachineName] = useState("")
  const [machineParts, setMachineParts] = useState<MachinePart[]>([])
  const [savingParts, setSavingParts] = useState(false)

  const menuItems = [
    { id: "inquiries", label: "Customer Inquiries" },
    { id: "quotations", label: "Quotations" },
    { id: "performas", label: "Performas" },
    { id: "work-orders", label: "Work Orders" },
    { id: "products", label: "Products" },
    { id: "followups", label: "Follow Ups" },
  ]

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
    if (target) {
      router.push(target)
      return
    }

    setActiveSection("products")
  }

  async function fetchProducts(kind: "machines" | "spares") {
    const response = await fetch(apiUrl(`/api/products/${kind}`), {
      credentials: "include",
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch ${kind}`)
    }

    const data = await response.json()
    if (kind === "machines") {
      setMachineProducts(data.products || [])
      return
    }

    setSpareProducts(data.products || [])
  }

  async function loadAll() {
    try {
      await Promise.all([
        fetchProducts("machines"),
        fetchProducts("spares"),
      ])
    } catch {
      toast({
        title: "Error",
        description: "Failed to load products data",
        variant: "destructive",
      })
    }
  }

  useEffect(() => {
    loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function stripCommas(value: string) {
    return value.replace(/,/g, "")
  }

  function buildProductFormData(form: ProductForm) {
    const formData = new FormData()

    formData.append("category_id", form.category_id)
    formData.append("product_name", form.product_name)
    formData.append("model_number", form.model_number)
    formData.append("sales_price", stripCommas(form.sales_price))
    formData.append("purchase_price", stripCommas(form.purchase_price))
    formData.append("hsn_code", form.hsn_code)
    formData.append("sac_code", form.sac_code)
    formData.append("gst_percent", stripCommas(form.gst_percent))
    formData.append("quantity", "0")
    formData.append("currency", form.currency || "INR")
    formData.append("description", form.description)
    formData.append("specifications", form.specifications)

    if (form.image) {
      formData.append("image", form.image)
    }

    return formData
  }

  async function submitProduct(kind: "machines" | "spares", event: FormEvent) {
    event.preventDefault()

    const isMachine = kind === "machines"
    const form = isMachine ? machineForm : spareForm
    const editId = isMachine ? machineEditId : spareEditId

    if (!form.category_id) {
      toast({
        title: "Validation",
        description: "Please choose a category",
        variant: "destructive",
      })
      return
    }

    if (!form.product_name.trim()) {
      toast({
        title: "Validation",
        description: "Product name is required",
        variant: "destructive",
      })
      return
    }

    try {
      const endpoint = editId
        ? `/api/products/${kind}/${editId}`
        : `/api/products/${kind}`

      const response = await fetch(apiUrl(endpoint), {
        method: editId ? "PUT" : "POST",
        credentials: "include",
        body: buildProductFormData(form),
      })

      const contentType = response.headers.get("content-type") || ""
      const data = contentType.includes("application/json")
        ? await response.json()
        : { message: await response.text() }

      if (!response.ok) {
        throw new Error(data?.message || `Failed to save ${kind}`)
      }

      toast({
        title: "Success",
        description: editId ? "Product updated" : "Product created",
      })

      if (isMachine) {
        setMachineForm(emptyProductForm)
        setMachineEditId(null)
      } else {
        setSpareForm(emptyProductForm)
        setSpareEditId(null)
      }

      await fetchProducts(kind)
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save product",
        variant: "destructive",
      })
    }
  }

  function openCategoryModal(category?: Category) {
    if (category) {
      setEditingCategoryId(category.id)
      setCategoryName(category.category_name)
    } else {
      setEditingCategoryId(null)
      setCategoryName("")
    }
    setCategoryModalOpen(true)
  }

  function closeCategoryModal() {
    setCategoryModalOpen(false)
    setEditingCategoryId(null)
    setCategoryName("")
  }

  async function submitCategory(event: FormEvent) {
    event.preventDefault()

    const trimmed = categoryName.trim()
    if (!trimmed) {
      toast({ title: "Validation", description: "Category name is required", variant: "destructive" })
      return
    }

    try {
      const isUpdate = editingCategoryId !== null
      const url = isUpdate
        ? apiUrl(`/api/products/categories/${editingCategoryId}`)
        : apiUrl("/api/products/categories")

      const response = await fetch(url, {
        method: isUpdate ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ category_name: trimmed }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data?.message || "Failed to save category")

      toast({ title: "Success", description: isUpdate ? "Category updated" : "Category created" })
      closeCategoryModal()
      await refreshCategories()
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save category",
        variant: "destructive",
      })
    }
  }

  async function deleteCategory(categoryId: number) {
    try {
      const response = await fetch(apiUrl(`/api/products/categories/${categoryId}`), {
        method: "DELETE",
        credentials: "include",
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data?.message || "Failed to delete category")

      toast({ title: "Success", description: "Category deleted" })
      setDeletingCategoryId(null)
      await refreshCategories()
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete category",
        variant: "destructive",
      })
    }
  }

  function mapProductToForm(product: Product): ProductForm {
    return {
      category_id: product.category_id ? String(product.category_id) : "",
      product_name: product.product_name || "",
      model_number: product.model_number || "",
      sales_price: product.sales_price !== null && product.sales_price !== undefined ? String(product.sales_price) : "",
      purchase_price: product.purchase_price !== null && product.purchase_price !== undefined ? String(product.purchase_price) : "",
      hsn_code: product.hsn_code || "",
      sac_code: product.sac_code || "",
      gst_percent: product.gst_percent !== null && product.gst_percent !== undefined ? String(product.gst_percent) : "",
      quantity: product.quantity !== null && product.quantity !== undefined ? String(product.quantity) : "",
      currency: product.currency || "INR",
      description: product.description || "",
      specifications: product.specifications || "",
      image: null,
    }
  }

  // ── Machine Parts ──

  async function openPartsModal(machine: Product) {
    setPartsModalMachineId(machine.id)
    setPartsModalMachineName(machine.product_name || "Machine")
    try {
      const res = await fetch(apiUrl(`/api/products/machines/${machine.id}/parts`), { credentials: "include" })
      if (res.ok) {
        const data = await res.json()
        setMachineParts((data.parts || []).map((p: any) => ({
          id: p.id,
          machine_id: p.machine_id,
          part_number: p.part_number || "",
          part_name: p.part_name || "",
          specification: p.specification || "",
          unit: p.unit || "Nos",
          default_quantity: Number(p.default_quantity) || 1,
        })))
      }
    } catch {
      toast({ title: "Error", description: "Failed to load parts", variant: "destructive" })
    }
  }

  function closePartsModal() {
    setPartsModalMachineId(null)
    setMachineParts([])
  }

  function addEmptyPart() {
    setMachineParts([...machineParts, { part_number: "", part_name: "", specification: "", unit: "Nos" }])
  }

  function autoGeneratePartNumber(name: string, spec: string): string {
    const shortName = name.trim().split(/\s+/)[0].toUpperCase().slice(0, 10)
    const shortSpec = spec.trim().split(/\s+/).slice(0, 2).join("").replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 6)
    if (!shortName) return ""
    return shortSpec ? `${shortName}-${shortSpec}` : shortName
  }

  function updatePartField(idx: number, field: keyof MachinePart, value: string | number) {
    setMachineParts(machineParts.map((p, i) => i === idx ? { ...p, [field]: value } : p))
  }

  function removePartRow(idx: number) {
    setMachineParts(machineParts.filter((_, i) => i !== idx))
  }

  async function saveParts() {
    if (!partsModalMachineId) return

    // Duplicate detection
    const validParts = machineParts.filter((p) => p.part_name.trim())
    const seen = new Set<string>()
    for (const p of validParts) {
      const key = `${p.part_name.trim().toLowerCase()}|${(p.specification || "").trim().toLowerCase()}`
      if (seen.has(key)) {
        toast({ title: "Duplicate part detected", description: `"${p.part_name}" with specification "${p.specification || "-"}" already exists in this list.`, variant: "destructive" })
        return
      }
      seen.add(key)
    }

    // Auto-generate part numbers
    const partsToSave = validParts.map((p) => ({
      ...p,
      part_number: p.part_number || autoGeneratePartNumber(p.part_name, p.specification),
    }))

    setSavingParts(true)
    try {
      const res = await fetch(apiUrl(`/api/products/machines/${partsModalMachineId}/parts`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ parts: partsToSave }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.message || "Failed to save parts")
      toast({ title: "Success", description: "Machine parts saved" })
      closePartsModal()
    } catch (error) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to save parts", variant: "destructive" })
    } finally {
      setSavingParts(false)
    }
  }

  function startEdit(kind: "machines" | "spares", product: Product) {
    if (kind === "machines") {
      setMachineEditId(product.id)
      setMachineForm(mapProductToForm(product))
      setActiveTab("machines")
      return
    }

    setSpareEditId(product.id)
    setSpareForm(mapProductToForm(product))
    setActiveTab("spares")
  }

  function renderProductForm(kind: "machines" | "spares") {
    const isMachine = kind === "machines"
    const form = isMachine ? machineForm : spareForm
    const setForm = isMachine ? setMachineForm : setSpareForm
    const editId = isMachine ? machineEditId : spareEditId
    const list = isMachine ? machineProducts : spareProducts

    return (
      <div className="space-y-5">
        <form onSubmit={(event) => submitProduct(kind, event)} className="rounded-lg border border-gray-200 bg-white p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Category</Label>
              <select
                className="w-full border border-gray-300 rounded-md h-10 px-3"
                value={form.category_id}
                onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                required
              >
                <option value="">Select category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.category_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Product Name</Label>
              <Input
                value={form.product_name}
                onChange={(e) => setForm({ ...form, product_name: e.target.value })}
                required
              />
            </div>
            {editId ? (
              <div>
                <Label>Product Code</Label>
                <Input value="Auto-preserved" disabled />
              </div>
            ) : null}
            <div>
              <Label>Sales Price</Label>
              <Input value={form.sales_price} onChange={(e) => setForm({ ...form, sales_price: e.target.value })} />
            </div>
            <div>
              <Label>Purchase Price</Label>
              <Input value={form.purchase_price} onChange={(e) => setForm({ ...form, purchase_price: e.target.value })} />
            </div>
            <div>
              <Label>HSN</Label>
              <Input value={form.hsn_code} onChange={(e) => setForm({ ...form, hsn_code: e.target.value })} />
            </div>
            <div>
              <Label>SAC</Label>
              <Input value={form.sac_code} onChange={(e) => setForm({ ...form, sac_code: e.target.value })} />
            </div>
            <div>
              <Label>GST</Label>
              <Input value={form.gst_percent} onChange={(e) => setForm({ ...form, gst_percent: e.target.value })} />
            </div>
            <div>
              <Label>Currency</Label>
              <Select
                value={form.currency || "INR"}
                onValueChange={(value) => setForm({ ...form, currency: value })}
              >
                <SelectTrigger className="w-full justify-start">
                  <span>{form.currency || "INR"}</span>
                </SelectTrigger>
                <SelectContent>
                  {currencyOptions.map((currency) => (
                    <SelectItem key={currency.code} value={currency.code}>
                      {currency.code} — {currency.country}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Image Upload</Label>
              <Input type="file" accept="image/png,image/jpeg,image/jpg" onChange={(e) => setForm({ ...form, image: e.target.files?.[0] || null })} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
            </div>
            <div>
              <Label>Specifications</Label>
              <Textarea value={form.specifications} onChange={(e) => setForm({ ...form, specifications: e.target.value })} rows={3} />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (isMachine) {
                  setMachineForm(emptyProductForm)
                  setMachineEditId(null)
                } else {
                  setSpareForm(emptyProductForm)
                  setSpareEditId(null)
                }
              }}
            >
              Clear
            </Button>
            <Button type="submit">{editId ? "Update" : "Create"}</Button>
          </div>
        </form>

        <div className="rounded-lg border border-gray-200 bg-white overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-700">
              <tr>
                <th className="px-3 py-2 text-left">Image</th>
                <th className="px-3 py-2 text-left">Code</th>
                <th className="px-3 py-2 text-left">Name</th>
                <th className="px-3 py-2 text-left">Category</th>
                <th className="px-3 py-2 text-left">Sales</th>
                <th className="px-3 py-2 text-left">Purchase</th>
                <th className="px-3 py-2 text-left">GST</th>
                <th className="px-3 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.length === 0 ? (
                <tr>
                  <td className="px-3 py-3" colSpan={8}>No products found.</td>
                </tr>
              ) : (
                list.map((product) => {
                  const imgUrl = getImageUrl(product.image_path)
                  return (
                  <tr key={product.id} className="border-t">
                    <td className="px-3 py-2">
                      {imgUrl ? (
                        <img src={imgUrl} alt="" className="w-10 h-10 rounded object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center text-gray-400 text-xs">—</div>
                      )}
                    </td>
                    <td className="px-3 py-2">{product.product_code || "-"}</td>
                    <td className="px-3 py-2">{product.product_name || "-"}</td>
                    <td className="px-3 py-2">{product.category_name || "-"}</td>
                    <td className="px-3 py-2">{product.sales_price ?? "-"}</td>
                    <td className="px-3 py-2">{product.purchase_price ?? "-"}</td>
                    <td className="px-3 py-2">{product.gst_percent ?? "-"}</td>
                    <td className="px-3 py-2 flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => startEdit(kind, product)}>
                        Edit
                      </Button>
                      {isMachine && (
                        <Button size="sm" variant="outline" onClick={() => openPartsModal(product)}>
                          Parts
                        </Button>
                      )}
                    </td>
                  </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    )
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
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">Product Master</h1>
          <p className="text-sm text-gray-500">Manage machine products, spare products, and categories.</p>
        </div>

        <div className="flex gap-2">
          <Button type="button" variant={activeTab === "machines" ? "default" : "outline"} onClick={() => setActiveTab("machines")}>Machine Products</Button>
          <Button type="button" variant={activeTab === "spares" ? "default" : "outline"} onClick={() => setActiveTab("spares")}>Spare Products</Button>
          <Button type="button" variant={activeTab === "categories" ? "default" : "outline"} onClick={() => setActiveTab("categories")}>Categories</Button>
        </div>

        {/* Machine Parts Modal */}
        {partsModalMachineId !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl mx-4 p-6 space-y-4 max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-semibold text-gray-800">Machine Parts — {partsModalMachineName}</h3>
              <p className="text-sm text-gray-500">Define the default parts list for this machine. These parts will auto-populate when a BOM is created.</p>

              <div className="rounded-lg border border-gray-200 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-gray-700">
                    <tr>
                      <th className="px-3 py-2 text-left">#</th>
                      <th className="px-3 py-2 text-left">Part Number</th>
                      <th className="px-3 py-2 text-left">Part Name</th>
                      <th className="px-3 py-2 text-left">Specification</th>
                      <th className="px-3 py-2 text-left">Unit</th>
                      <th className="px-3 py-2 text-left"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {machineParts.length === 0 ? (
                      <tr><td className="px-3 py-3 text-gray-400" colSpan={7}>No parts yet. Click "+ Add Part" to begin.</td></tr>
                    ) : (
                      machineParts.map((part, idx) => (
                        <tr key={idx} className="border-t">
                          <td className="px-3 py-1 text-gray-500">{idx + 1}</td>
                          <td className="px-3 py-1">
                            <Input className="h-8 bg-gray-50" value={part.part_number || autoGeneratePartNumber(part.part_name, part.specification)} readOnly tabIndex={-1} placeholder="Auto" />
                          </td>
                          <td className="px-3 py-1">
                            <Input className="h-8" value={part.part_name} onChange={(e) => updatePartField(idx, "part_name", e.target.value)} placeholder="Part name" required />
                          </td>
                          <td className="px-3 py-1">
                            <Input className="h-8" value={part.specification} onChange={(e) => updatePartField(idx, "specification", e.target.value)} placeholder="1HP AC Motor" />
                          </td>
                          <td className="px-3 py-1">
                            <Input className="h-8 w-20" value={part.unit} onChange={(e) => updatePartField(idx, "unit", e.target.value)} />
                          </td>
                          <td className="px-3 py-1">
                            <Button size="sm" variant="destructive" onClick={() => removePartRow(idx)}>×</Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between">
                <Button type="button" variant="outline" onClick={addEmptyPart}>+ Add Part</Button>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={closePartsModal}>Cancel</Button>
                  <Button type="button" onClick={saveParts} disabled={savingParts}>{savingParts ? "Saving..." : "Save Parts"}</Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "categories" ? (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-800">Categories</h2>
              <Button onClick={() => openCategoryModal()}>+ New Category</Button>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-gray-700">
                  <tr>
                    <th className="px-4 py-2 text-left">#</th>
                    <th className="px-4 py-2 text-left">Category Name</th>
                    <th className="px-4 py-2 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.length === 0 ? (
                    <tr><td className="px-4 py-3" colSpan={3}>No categories yet.</td></tr>
                  ) : (
                    categories.map((category, idx) => (
                      <tr key={category.id} className="border-t">
                        <td className="px-4 py-2">{idx + 1}</td>
                        <td className="px-4 py-2">{category.category_name}</td>
                        <td className="px-4 py-2 flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => openCategoryModal(category)}>Edit</Button>
                          <Button size="sm" variant="destructive" onClick={() => setDeletingCategoryId(category.id)}>Delete</Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Category Create/Edit Modal */}
            {categoryModalOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6 space-y-4">
                  <h3 className="text-lg font-semibold text-gray-800">{editingCategoryId ? "Edit Category" : "New Category"}</h3>
                  <form onSubmit={submitCategory} className="space-y-4">
                    <div>
                      <Label>Category Name</Label>
                      <Input
                        value={categoryName}
                        onChange={(e) => setCategoryName(e.target.value)}
                        placeholder="Enter category name"
                        autoFocus
                        required
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={closeCategoryModal}>Cancel</Button>
                      <Button type="submit">{editingCategoryId ? "Update Category" : "Create Category"}</Button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Delete Confirmation Modal */}
            {deletingCategoryId !== null && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6 space-y-4">
                  <h3 className="text-lg font-semibold text-gray-800">Delete Category</h3>
                  <p className="text-sm text-gray-600">Are you sure you want to delete this category? This cannot be undone if the category is not in use.</p>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setDeletingCategoryId(null)}>Cancel</Button>
                    <Button type="button" variant="destructive" onClick={() => deleteCategory(deletingCategoryId)}>Delete</Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : activeTab === "machines" ? (
          renderProductForm("machines")
        ) : (
          renderProductForm("spares")
        )}
      </div>
    </DashboardLayout>
  )
}
