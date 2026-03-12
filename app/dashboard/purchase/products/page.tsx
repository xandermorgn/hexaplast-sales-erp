"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { apiUrl } from "@/lib/api"
import { Download } from "lucide-react"
import * as XLSX from "xlsx"

type Machine = {
  id: number
  product_name: string | null
  product_code: string | null
  category_name: string | null
  created_by_name: string | null
  created_at: string | null
}

type MachinePart = {
  id?: number
  machine_id?: number
  part_number: string
  part_name: string
  specification: string
  unit: string
}

const menuItems = [
  { id: "pending-work-orders", label: "Pending Work Orders" },
  { id: "bom", label: "Bill of Materials" },
  { id: "purchase", label: "Purchase" },
  { id: "inquiries", label: "Inquiries" },
  { id: "purchase-orders", label: "Purchase Orders" },
  { id: "vendors", label: "Vendors" },
  { id: "products", label: "Products" },
]

function generatePartNumber(name: string, spec: string): string {
  const cleanName = name.trim().toUpperCase().replace(/[^A-Z0-9]/g, "")
  const cleanSpec = spec.trim().toUpperCase().replace(/[^A-Z0-9]/g, "")
  if (!cleanName) return ""
  return cleanSpec ? `${cleanName}-${cleanSpec}` : cleanName
}

export default function PurchaseProductsPage() {
  const router = useRouter()
  const { user, isLoading, logout } = useAuth()
  const { toast } = useToast()

  const [activeSection, setActiveSection] = useState("products")
  const [machines, setMachines] = useState<Machine[]>([])
  const [loading, setLoading] = useState(true)

  // Parts modal state
  const [partsModalMachineId, setPartsModalMachineId] = useState<number | null>(null)
  const [partsModalMachineName, setPartsModalMachineName] = useState("")
  const [machineParts, setMachineParts] = useState<MachinePart[]>([])
  const [savingParts, setSavingParts] = useState(false)
  const [partsError, setPartsError] = useState("")

  // Excel upload state
  const [importSummary, setImportSummary] = useState<{ imported: number; skipped: number } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleSectionChange(section: string) {
    const routeMap: Record<string, string> = {
      "pending-work-orders": "/dashboard/purchase/pending-work-orders",
      products: "/dashboard/purchase/products",
      bom: "/dashboard/purchase/bom",
      purchase: "/dashboard/purchase/purchase",
      inquiries: "/dashboard/purchase/inquiries",
      "purchase-orders": "/dashboard/purchase/purchase-orders",
      vendors: "/dashboard/purchase/vendors",
    }
    const target = routeMap[section]
    if (target) router.push(target)
  }

  async function fetchMachines() {
    setLoading(true)
    try {
      const res = await fetch(apiUrl("/api/products/machines"), { credentials: "include" })
      if (!res.ok) throw new Error("Failed to fetch machines")
      const data = await res.json()
      setMachines(data.products || [])
    } catch {
      toast({ title: "Error", description: "Failed to load machines", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMachines()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Parts Modal ──

  async function openPartsModal(machine: Machine) {
    setPartsModalMachineId(machine.id)
    setPartsModalMachineName(machine.product_name || "Machine")
    setPartsError("")
    setImportSummary(null)
    try {
      const res = await fetch(apiUrl(`/api/products/machines/${machine.id}/parts`), { credentials: "include" })
      if (res.ok) {
        const data = await res.json()
        setMachineParts(
          (data.parts || []).map((p: any) => ({
            id: p.id,
            machine_id: p.machine_id,
            part_number: p.part_number || "",
            part_name: p.part_name || "",
            specification: p.specification || "",
            unit: p.unit || "Nos",
          }))
        )
      }
    } catch {
      toast({ title: "Error", description: "Failed to load parts", variant: "destructive" })
    }
  }

  function closePartsModal() {
    setPartsModalMachineId(null)
    setMachineParts([])
    setPartsError("")
    setImportSummary(null)
  }

  function addEmptyPart() {
    setMachineParts([...machineParts, { part_number: "", part_name: "", specification: "", unit: "Nos" }])
  }

  function updatePartField(idx: number, field: keyof MachinePart, value: string | number) {
    setMachineParts(machineParts.map((p, i) => (i === idx ? { ...p, [field]: value } : p)))
  }

  function removePartRow(idx: number) {
    setMachineParts(machineParts.filter((_, i) => i !== idx))
  }

  async function saveParts() {
    if (!partsModalMachineId) return
    setPartsError("")

    const validParts = machineParts.filter((p) => p.part_name.trim())

    // Client-side duplicate detection
    const seen = new Set<string>()
    for (const p of validParts) {
      const key = `${p.part_name.trim().toLowerCase()}|${(p.specification || "").trim().toLowerCase()}`
      if (seen.has(key)) {
        setPartsError(`Duplicate part: "${p.part_name}" with specification "${p.specification || "-"}" appears more than once.`)
        return
      }
      seen.add(key)
    }

    // Auto-generate part numbers
    const partsToSave = validParts.map((p) => ({
      ...p,
      part_number: p.part_number || generatePartNumber(p.part_name, p.specification),
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
      if (!res.ok) {
        setPartsError(data?.message || "Failed to save parts")
        return
      }
      toast({ title: "Success", description: "Machine parts saved" })
      closePartsModal()
    } catch (error) {
      setPartsError(error instanceof Error ? error.message : "Failed to save parts")
    } finally {
      setSavingParts(false)
    }
  }

  // ── Sample Download ──

  function downloadPartsSample() {
    const sampleData = [
      { Name: "Motor", Specification: "1HP AC" },
      { Name: "Bearing", Specification: "6205 ZZ" },
    ]
    const ws = XLSX.utils.json_to_sheet(sampleData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Machine Parts")
    XLSX.writeFile(wb, "machine_parts_sample.xlsx")
  }

  // ── Excel Import ──

  function handleExcelUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImportSummary(null)
    setPartsError("")

    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result
        const workbook = XLSX.read(data, { type: "binary" })
        const sheetName = workbook.SheetNames[0]
        const sheet = workbook.Sheets[sheetName]
        const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "" })

        if (rows.length === 0) {
          setPartsError("Excel file is empty or has no valid rows.")
          return
        }

        // Normalize header keys
        const normalizedRows = rows.map((row) => {
          const normalized: Record<string, string> = {}
          for (const key of Object.keys(row)) {
            normalized[key.trim().toLowerCase()] = String(row[key]).trim()
          }
          return normalized
        })

        // Validate columns
        const first = normalizedRows[0]
        if (!("name" in first) || !("specification" in first)) {
          setPartsError("Excel must have exactly two columns: 'Name' and 'Specification'.")
          return
        }

        // Build existing parts lookup (name+spec lowercase)
        const existingKeys = new Set<string>()
        for (const p of machineParts) {
          const key = `${p.part_name.trim().toLowerCase()}|${(p.specification || "").trim().toLowerCase()}`
          existingKeys.add(key)
        }

        let imported = 0
        let skipped = 0
        const newParts: MachinePart[] = [...machineParts]

        for (const row of normalizedRows) {
          const name = (row["name"] || "").trim()
          const spec = (row["specification"] || "").trim()
          if (!name) continue

          const key = `${name.toLowerCase()}|${spec.toLowerCase()}`
          if (existingKeys.has(key)) {
            skipped++
            continue
          }

          existingKeys.add(key)
          newParts.push({
            part_number: generatePartNumber(name, spec),
            part_name: name,
            specification: spec,
            unit: "Nos",
          })
          imported++
        }

        setMachineParts(newParts)
        setImportSummary({ imported, skipped })
      } catch {
        setPartsError("Failed to parse Excel file. Please check the format.")
      }
    }
    reader.readAsBinaryString(file)

    // Reset file input so re-uploading same file triggers change
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  // ── Render ──

  if (isLoading) {
    return (
      <DashboardLayout
        title="Purchase"
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
      title="Purchase"
      menuItems={menuItems}
      activeSection={activeSection}
      onSectionChange={handleSectionChange}
      loginId={user?.loginId || ""}
      onLogout={logout}
    >
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">Products — Machine Parts Management</h1>
          <p className="text-sm text-gray-500">View machines created by Sales and manage their parts list.</p>
        </div>

        {/* Machine List Table */}
        <div className="rounded-lg border border-gray-200 bg-white overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-700">
              <tr>
                <th className="px-3 py-2 text-left">Machine Name</th>
                <th className="px-3 py-2 text-left">Machine Code</th>
                <th className="px-3 py-2 text-left">Category</th>
                <th className="px-3 py-2 text-left">Created Date</th>
                <th className="px-3 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="px-3 py-3 text-gray-400" colSpan={5}>Loading machines...</td>
                </tr>
              ) : machines.length === 0 ? (
                <tr>
                  <td className="px-3 py-3 text-gray-400" colSpan={5}>No machines found.</td>
                </tr>
              ) : (
                machines.map((machine) => (
                  <tr key={machine.id} className="border-t">
                    <td className="px-3 py-2 font-medium">{machine.product_name || "-"}</td>
                    <td className="px-3 py-2">{machine.product_code || "-"}</td>
                    <td className="px-3 py-2">{machine.category_name || "-"}</td>
                    <td className="px-3 py-2">{machine.created_at ? new Date(machine.created_at).toLocaleDateString() : "-"}</td>
                    <td className="px-3 py-2">
                      <Button size="sm" variant="outline" onClick={() => openPartsModal(machine)}>
                        Add Parts
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Parts Editor Modal */}
        {partsModalMachineId !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl mx-4 p-6 space-y-4 max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-semibold text-gray-800">Machine Parts — {partsModalMachineName}</h3>
              <p className="text-sm text-gray-500">
                Define the default parts list for this machine. These parts will auto-populate when a BOM is created.
              </p>

              {partsError && (
                <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                  {partsError}
                </div>
              )}

              {importSummary && (
                <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                  Imported: {importSummary.imported} parts. Skipped duplicates: {importSummary.skipped}.
                </div>
              )}

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
                      <tr>
                        <td className="px-3 py-3 text-gray-400" colSpan={6}>
                          No parts yet. Click &quot;+ Add Part&quot; or &quot;Upload Excel&quot; to begin.
                        </td>
                      </tr>
                    ) : (
                      machineParts.map((part, idx) => (
                        <tr key={idx} className="border-t">
                          <td className="px-3 py-1 text-gray-500">{idx + 1}</td>
                          <td className="px-3 py-1">
                            <Input
                              className="h-8 bg-gray-50"
                              value={part.part_number || generatePartNumber(part.part_name, part.specification)}
                              readOnly
                              tabIndex={-1}
                              placeholder="Auto"
                            />
                          </td>
                          <td className="px-3 py-1">
                            <Input
                              className="h-8"
                              value={part.part_name}
                              onChange={(e) => updatePartField(idx, "part_name", e.target.value)}
                              placeholder="Part name"
                            />
                          </td>
                          <td className="px-3 py-1">
                            <Input
                              className="h-8"
                              value={part.specification}
                              onChange={(e) => updatePartField(idx, "specification", e.target.value)}
                              placeholder="e.g. 1HP AC"
                            />
                          </td>
                          <td className="px-3 py-1">
                            <Input
                              className="h-8 w-20"
                              value={part.unit}
                              onChange={(e) => updatePartField(idx, "unit", e.target.value)}
                            />
                          </td>
                          <td className="px-3 py-1">
                            <Button size="sm" variant="destructive" onClick={() => removePartRow(idx)}>
                              ×
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between items-center flex-wrap gap-2">
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={addEmptyPart}>
                    + Add Part
                  </Button>
                  <Button type="button" variant="outline" onClick={downloadPartsSample}>
                    <Download className="h-4 w-4 mr-1" />
                    Download Sample
                  </Button>
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,.csv"
                      className="hidden"
                      onChange={handleExcelUpload}
                    />
                    <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
                      Upload Excel
                    </Button>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={closePartsModal}>
                    Cancel
                  </Button>
                  <Button type="button" onClick={saveParts} disabled={savingParts}>
                    {savingParts ? "Saving..." : "Save Parts"}
                  </Button>
                </div>
              </div>

              <p className="text-xs text-gray-400">
                Excel format: Two columns — &quot;Name&quot; and &quot;Specification&quot;. Part numbers are auto-generated as PARTNAME-SPEC (uppercase, no spaces).
              </p>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
