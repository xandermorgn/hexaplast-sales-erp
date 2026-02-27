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

type ProductTab = "machines" | "spares" | "categories"

type Category = {
  id: number
  category_name: string
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

export default function ProductsPage() {
  const router = useRouter()
  const { user, isLoading, logout } = useAuth()
  const { toast } = useToast()

  const [activeSection, setActiveSection] = useState("products")
  const [activeTab, setActiveTab] = useState<ProductTab>("machines")
  const [categories, setCategories] = useState<Category[]>([])
  const [machineProducts, setMachineProducts] = useState<Product[]>([])
  const [spareProducts, setSpareProducts] = useState<Product[]>([])

  const [machineForm, setMachineForm] = useState<ProductForm>(emptyProductForm)
  const [spareForm, setSpareForm] = useState<ProductForm>(emptyProductForm)
  const [machineEditId, setMachineEditId] = useState<number | null>(null)
  const [spareEditId, setSpareEditId] = useState<number | null>(null)

  const [categoryName, setCategoryName] = useState("")

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

    setActiveSection("products")
  }

  async function fetchCategories() {
    const response = await fetch(apiUrl("/api/products/categories"), {
      credentials: "include",
    })

    if (!response.ok) {
      throw new Error("Failed to fetch categories")
    }

    const data = await response.json()
    setCategories(data.categories || [])
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
        fetchCategories(),
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

  function buildProductFormData(form: ProductForm) {
    const formData = new FormData()

    formData.append("category_id", form.category_id)
    formData.append("product_name", form.product_name)
    formData.append("model_number", form.model_number)
    formData.append("sales_price", form.sales_price)
    formData.append("purchase_price", form.purchase_price)
    formData.append("hsn_code", form.hsn_code)
    formData.append("sac_code", form.sac_code)
    formData.append("gst_percent", form.gst_percent)
    formData.append("quantity", form.quantity)
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

    try {
      const endpoint = editId
        ? `/api/products/${kind}/${editId}`
        : `/api/products/${kind}`

      const response = await fetch(apiUrl(endpoint), {
        method: editId ? "PUT" : "POST",
        credentials: "include",
        body: buildProductFormData(form),
      })

      const data = await response.json()
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

  async function submitCategory(event: FormEvent) {
    event.preventDefault()

    const payload = {
      category_name: categoryName.trim(),
    }

    if (!payload.category_name) {
      toast({
        title: "Validation",
        description: "Category name is required",
        variant: "destructive",
      })
      return
    }

    try {
      const response = await fetch(apiUrl("/api/products/categories"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.message || "Failed to create category")
      }

      toast({
        title: "Success",
        description: "Category created",
      })

      setCategoryName("")
      await fetchCategories()
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create category",
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
              <Input value={form.product_name} onChange={(e) => setForm({ ...form, product_name: e.target.value })} />
            </div>
            <div>
              <Label>Model Number</Label>
              <Input value={form.model_number} onChange={(e) => setForm({ ...form, model_number: e.target.value })} />
            </div>
            <div>
              <Label>Product Code</Label>
              <Input value={editId ? "Auto-preserved on update" : "Auto-generated on save"} disabled />
            </div>
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
              <Label>Quantity</Label>
              <Input value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
            </div>
            <div>
              <Label>Currency</Label>
              <Input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
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
                <th className="px-3 py-2 text-left">Code</th>
                <th className="px-3 py-2 text-left">Name</th>
                <th className="px-3 py-2 text-left">Category</th>
                <th className="px-3 py-2 text-left">Model</th>
                <th className="px-3 py-2 text-left">Sales</th>
                <th className="px-3 py-2 text-left">Purchase</th>
                <th className="px-3 py-2 text-left">Qty</th>
                <th className="px-3 py-2 text-left">GST</th>
                <th className="px-3 py-2 text-left">Image</th>
                <th className="px-3 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.length === 0 ? (
                <tr>
                  <td className="px-3 py-3" colSpan={10}>No products found.</td>
                </tr>
              ) : (
                list.map((product) => (
                  <tr key={product.id} className="border-t">
                    <td className="px-3 py-2">{product.product_code || "-"}</td>
                    <td className="px-3 py-2">{product.product_name || "-"}</td>
                    <td className="px-3 py-2">{product.category_name || "-"}</td>
                    <td className="px-3 py-2">{product.model_number || "-"}</td>
                    <td className="px-3 py-2">{product.sales_price ?? "-"}</td>
                    <td className="px-3 py-2">{product.purchase_price ?? "-"}</td>
                    <td className="px-3 py-2">{product.quantity ?? "-"}</td>
                    <td className="px-3 py-2">{product.gst_percent ?? "-"}</td>
                    <td className="px-3 py-2">{product.image_path ? "Uploaded" : "-"}</td>
                    <td className="px-3 py-2">
                      <Button size="sm" variant="outline" onClick={() => startEdit(kind, product)}>
                        Edit
                      </Button>
                    </td>
                  </tr>
                ))
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

        {activeTab === "categories" ? (
          <div className="space-y-4">
            <form onSubmit={submitCategory} className="rounded-lg border border-gray-200 bg-white p-5 space-y-3">
              <div>
                <Label>Category Name</Label>
                <Input value={categoryName} onChange={(e) => setCategoryName(e.target.value)} />
              </div>
              <div className="flex justify-end">
                <Button type="submit">Create Category</Button>
              </div>
            </form>

            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Existing Categories</h2>
              <div className="space-y-2">
                {categories.length === 0 ? (
                  <p className="text-sm text-gray-500">No categories yet.</p>
                ) : (
                  categories.map((category) => (
                    <div key={category.id} className="text-sm border rounded px-3 py-2">
                      {category.category_name}
                    </div>
                  ))
                )}
              </div>
            </div>
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
