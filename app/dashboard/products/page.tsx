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
import { Pencil, Trash2, Plus, X } from "lucide-react"

type ProductTab = "machines" | "spares" | "categories" | "subcategories"

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
  const [productFormError, setProductFormError] = useState("")

  // Sub-categories state
  type Subcategory = { id: number; name: string; category_id: number | null; category_name: string | null; product_count: number }
  type SubcatProduct = { relation_id: number; product_id: number; product_type: string; product_name: string | null; product_code: string | null; sales_price: number | null; gst_percent: number | null }
  const [subcategories, setSubcategories] = useState<Subcategory[]>([])
  const [subcatModalOpen, setSubcatModalOpen] = useState(false)
  const [editingSubcatId, setEditingSubcatId] = useState<number | null>(null)
  const [subcatForm, setSubcatForm] = useState({ name: "", category_id: "" })
  const [subcatProducts, setSubcatProducts] = useState<{ product_id: number; product_type: string }[]>([])
  const [subcatSaving, setSubcatSaving] = useState(false)
  const [deletingSubcatId, setDeletingSubcatId] = useState<number | null>(null)

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

  async function fetchSubcategories() {
    try {
      const res = await fetch(apiUrl("/api/products/subcategories"), { credentials: "include" })
      if (!res.ok) return
      const data = await res.json()
      setSubcategories(data.subcategories || [])
    } catch { /* ignore */ }
  }

  function openSubcatModal(subcat?: Subcategory) {
    if (subcat) {
      setEditingSubcatId(subcat.id)
      setSubcatForm({ name: subcat.name, category_id: subcat.category_id ? String(subcat.category_id) : "" })
      // Load products for this subcategory
      fetch(apiUrl(`/api/products/subcategories/${subcat.id}`), { credentials: "include" })
        .then((r) => r.json())
        .then((d) => {
          setSubcatProducts((d.products || []).map((p: SubcatProduct) => ({ product_id: p.product_id, product_type: p.product_type })))
        })
        .catch(() => {})
    } else {
      setEditingSubcatId(null)
      setSubcatForm({ name: "", category_id: "" })
      setSubcatProducts([])
    }
    setSubcatModalOpen(true)
  }

  async function submitSubcategory() {
    if (!subcatForm.name.trim()) {
      toast({ title: "Validation", description: "Name is required", variant: "destructive" })
      return
    }
    setSubcatSaving(true)
    try {
      const isUpdate = editingSubcatId !== null
      const url = isUpdate
        ? apiUrl(`/api/products/subcategories/${editingSubcatId}`)
        : apiUrl("/api/products/subcategories")
      const res = await fetch(url, {
        method: isUpdate ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: subcatForm.name.trim(),
          category_id: subcatForm.category_id ? Number(subcatForm.category_id) : null,
          products: subcatProducts,
        }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d?.message || "Failed") }
      toast({ title: "Success", description: isUpdate ? "Sub-category updated" : "Sub-category created" })
      setSubcatModalOpen(false)
      await fetchSubcategories()
    } catch (error) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed", variant: "destructive" })
    } finally { setSubcatSaving(false) }
  }

  async function deleteSubcategory(id: number) {
    try {
      const res = await fetch(apiUrl(`/api/products/subcategories/${id}`), { method: "DELETE", credentials: "include" })
      if (!res.ok) throw new Error("Failed")
      toast({ title: "Success", description: "Sub-category deleted" })
      setDeletingSubcatId(null)
      await fetchSubcategories()
    } catch {
      toast({ title: "Error", description: "Failed to delete sub-category", variant: "destructive" })
    }
  }

  // All product options for subcategory editor
  const allProductOptions = [
    ...machineProducts.map((p) => ({ product_id: p.id, product_type: "machine" as const, label: `[M] ${p.product_name || p.product_code || "-"}` })),
    ...spareProducts.map((p) => ({ product_id: p.id, product_type: "spare" as const, label: `[S] ${p.product_name || p.product_code || "-"}` })),
  ]

  async function loadAll() {
    try {
      await Promise.all([
        fetchProducts("machines"),
        fetchProducts("spares"),
        fetchSubcategories(),
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
    setProductFormError("")

    const isMachine = kind === "machines"
    const form = isMachine ? machineForm : spareForm
    const editId = isMachine ? machineEditId : spareEditId

    if (!form.category_id) {
      setProductFormError("Please choose a category.")
      return
    }

    if (!form.product_name.trim()) {
      setProductFormError("Product name is required.")
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
        setProductFormError(data?.message || `Failed to save ${kind}`)
        return
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

      setProductFormError("")
      await fetchProducts(kind)
    } catch (error) {
      setProductFormError(error instanceof Error ? error.message : "Failed to save product")
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
          {productFormError && (
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {productFormError}
            </div>
          )}
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
                    <td className="px-3 py-2">
                      <Button size="sm" variant="outline" onClick={() => startEdit(kind, product)}>
                        Edit
                      </Button>
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
          <Button type="button" variant={activeTab === "subcategories" ? "default" : "outline"} onClick={() => setActiveTab("subcategories")}>Sub Categories</Button>
        </div>

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
        ) : activeTab === "subcategories" ? (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-800">Sub Categories (Product Bundles)</h2>
              <Button onClick={() => openSubcatModal()}>+ New Sub Category</Button>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-gray-700">
                  <tr>
                    <th className="px-4 py-2 text-left">#</th>
                    <th className="px-4 py-2 text-left">Name</th>
                    <th className="px-4 py-2 text-left">Category</th>
                    <th className="px-4 py-2 text-left">Products</th>
                    <th className="px-4 py-2 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {subcategories.length === 0 ? (
                    <tr><td className="px-4 py-3" colSpan={5}>No sub-categories yet.</td></tr>
                  ) : (
                    subcategories.map((sc, idx) => (
                      <tr key={sc.id} className="border-t">
                        <td className="px-4 py-2">{idx + 1}</td>
                        <td className="px-4 py-2 font-medium">{sc.name}</td>
                        <td className="px-4 py-2">{sc.category_name || "-"}</td>
                        <td className="px-4 py-2">{sc.product_count} items</td>
                        <td className="px-4 py-2 flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => openSubcatModal(sc)}>
                            <Pencil className="h-3.5 w-3.5 mr-1" />Edit
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => setDeletingSubcatId(sc.id)}>
                            <Trash2 className="h-3.5 w-3.5 mr-1" />Delete
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Subcategory Create/Edit Modal */}
            {subcatModalOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6 space-y-4 max-h-[80vh] overflow-y-auto">
                  <h3 className="text-lg font-semibold text-gray-800">{editingSubcatId ? "Edit Sub Category" : "New Sub Category"}</h3>
                  <div className="space-y-3">
                    <div>
                      <Label>Sub Category Name</Label>
                      <Input
                        value={subcatForm.name}
                        onChange={(e) => setSubcatForm({ ...subcatForm, name: e.target.value })}
                        placeholder="e.g. Full Lab Setup"
                        autoFocus
                      />
                    </div>
                    <div>
                      <Label>Category</Label>
                      <select
                        className="w-full border border-gray-300 rounded-md h-10 px-3 text-sm"
                        value={subcatForm.category_id}
                        onChange={(e) => setSubcatForm({ ...subcatForm, category_id: e.target.value })}
                      >
                        <option value="">Select category</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>{c.category_name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <Label>Products in Bundle</Label>
                      <div className="space-y-2 mt-1">
                        {subcatProducts.map((sp, idx) => {
                          const opt = allProductOptions.find((o) => o.product_id === sp.product_id && o.product_type === sp.product_type)
                          return (
                            <div key={idx} className="flex items-center gap-2">
                              <select
                                className="flex-1 border border-gray-200 rounded-md h-9 px-2.5 text-sm"
                                value={`${sp.product_type}-${sp.product_id}`}
                                onChange={(e) => {
                                  const [pt, pid] = e.target.value.split("-")
                                  setSubcatProducts((prev) => prev.map((item, i) => i === idx ? { product_type: pt, product_id: Number(pid) } : item))
                                }}
                              >
                                <option value="">Select product</option>
                                {allProductOptions.map((o) => (
                                  <option key={`${o.product_type}-${o.product_id}`} value={`${o.product_type}-${o.product_id}`}>{o.label}</option>
                                ))}
                              </select>
                              <button
                                type="button"
                                onClick={() => setSubcatProducts((prev) => prev.filter((_, i) => i !== idx))}
                                className="h-9 w-9 flex items-center justify-center text-red-500 hover:bg-red-50 rounded-md"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          )
                        })}
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setSubcatProducts((prev) => [...prev, { product_id: 0, product_type: "machine" }])}
                        >
                          <Plus className="h-3.5 w-3.5 mr-1" />Add Product
                        </Button>
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="outline" onClick={() => setSubcatModalOpen(false)}>Cancel</Button>
                    <Button onClick={submitSubcategory} disabled={subcatSaving}>
                      {subcatSaving ? "Saving..." : editingSubcatId ? "Update" : "Create"}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Delete Confirmation */}
            {deletingSubcatId !== null && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6 space-y-4">
                  <h3 className="text-lg font-semibold text-gray-800">Delete Sub Category</h3>
                  <p className="text-sm text-gray-600">Are you sure? This will remove the bundle and its product associations.</p>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setDeletingSubcatId(null)}>Cancel</Button>
                    <Button type="button" variant="destructive" onClick={() => deleteSubcategory(deletingSubcatId)}>Delete</Button>
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
