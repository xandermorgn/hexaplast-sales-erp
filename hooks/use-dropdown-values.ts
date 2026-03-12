"use client"

import { useEffect, useState, useCallback } from "react"
import { apiUrl } from "@/lib/api"

type DropdownValue = {
  id: number
  field_name: string
  value: string
}

export function useDropdownValues() {
  const [values, setValues] = useState<Record<string, DropdownValue[]>>({})
  const [loading, setLoading] = useState(true)

  const fetch_ = useCallback(async () => {
    try {
      const res = await fetch(apiUrl("/api/dropdown-values"), { credentials: "include" })
      if (!res.ok) return
      const data = await res.json()
      const grouped: Record<string, DropdownValue[]> = data.grouped || {}
      setValues(grouped)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetch_() }, [fetch_])

  const refresh = useCallback(() => { fetch_() }, [fetch_])

  const getValues = useCallback((fieldName: string): DropdownValue[] => {
    return values[fieldName] || []
  }, [values])

  const getOptions = useCallback((fieldName: string): string[] => {
    return (values[fieldName] || []).map((v) => v.value)
  }, [values])

  return { values, loading, refresh, getValues, getOptions }
}
