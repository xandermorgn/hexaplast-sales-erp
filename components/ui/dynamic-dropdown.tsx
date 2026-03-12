"use client"

import { useState, useRef, useEffect } from "react"
import { Plus, X, Trash2 } from "lucide-react"
import { apiUrl } from "@/lib/api"

interface DropdownValue {
  id: number
  field_name: string
  value: string
}

interface DynamicDropdownProps {
  fieldName: string
  label: string
  value: string
  onChange: (value: string) => void
  values: DropdownValue[]
  onValuesChange: () => void
  canDelete?: boolean
  className?: string
}

export function DynamicDropdown({
  fieldName,
  label,
  value,
  onChange,
  values,
  onValuesChange,
  canDelete = false,
  className = "",
}: DynamicDropdownProps) {
  const [showAdd, setShowAdd] = useState(false)
  const [newValue, setNewValue] = useState("")
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (showAdd && inputRef.current) inputRef.current.focus()
  }, [showAdd])

  async function handleAdd() {
    const trimmed = newValue.trim()
    if (!trimmed) return
    setSaving(true)
    try {
      const res = await fetch(apiUrl("/api/dropdown-values"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ field_name: fieldName, value: trimmed }),
      })
      if (res.ok) {
        onValuesChange()
        onChange(trimmed)
        setNewValue("")
        setShowAdd(false)
      }
    } catch { /* ignore */ }
    finally { setSaving(false) }
  }

  async function handleDelete(id: number, val: string) {
    if (!confirm(`Delete "${val}"?`)) return
    try {
      await fetch(apiUrl(`/api/dropdown-values/${id}`), {
        method: "DELETE",
        credentials: "include",
      })
      if (value === val) onChange("")
      onValuesChange()
    } catch { /* ignore */ }
  }

  return (
    <div className={className}>
      <div className="flex items-center gap-1">
        <select
          className="flex-1 h-9 border border-gray-200 rounded-md px-2.5 text-sm bg-white"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Select {label}</option>
          {values.map((v) => (
            <option key={v.id} value={v.value}>{v.value}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setShowAdd(!showAdd)}
          className="h-9 w-9 flex items-center justify-center border border-gray-200 rounded-md hover:bg-gray-50 transition-colors shrink-0"
          title={`Add new ${label}`}
        >
          {showAdd ? <X className="h-3.5 w-3.5 text-gray-500" /> : <Plus className="h-3.5 w-3.5 text-gray-500" />}
        </button>
      </div>

      {showAdd && (
        <div className="mt-1.5 flex items-center gap-1">
          <input
            ref={inputRef}
            type="text"
            className="flex-1 h-8 border border-gray-200 rounded-md px-2.5 text-sm"
            placeholder={`New ${label}...`}
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAdd() } }}
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={saving || !newValue.trim()}
            className="h-8 px-3 text-xs bg-orange-500 text-white rounded-md hover:bg-orange-600 disabled:opacity-50 transition-colors"
          >
            {saving ? "..." : "Add"}
          </button>
        </div>
      )}

      {canDelete && values.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {values.map((v) => (
            <span key={v.id} className="inline-flex items-center gap-0.5 text-[10px] bg-gray-100 text-gray-600 rounded px-1.5 py-0.5">
              {v.value}
              <button type="button" onClick={() => handleDelete(v.id, v.value)} className="text-red-400 hover:text-red-600">
                <Trash2 className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
