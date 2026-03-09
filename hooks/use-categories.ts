"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { apiUrl } from "@/lib/api"

export type Category = {
  id: number
  category_name: string
}

type CacheEntry = {
  categories: Category[]
  fetchedAt: number
}

// Module-level cache shared across all hook instances
let sharedCache: CacheEntry | null = null
let inflight: Promise<Category[]> | null = null

const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

function isCacheValid(): boolean {
  if (!sharedCache) return false
  return Date.now() - sharedCache.fetchedAt < CACHE_TTL_MS
}

async function fetchCategoriesFromApi(): Promise<Category[]> {
  const response = await fetch(apiUrl("/api/products/categories"), {
    credentials: "include",
  })
  if (!response.ok) throw new Error("Failed to fetch categories")
  const data = await response.json()
  const categories: Category[] = data.categories || []
  sharedCache = { categories, fetchedAt: Date.now() }
  return categories
}

/**
 * Shared hook for product categories.
 * Categories are fetched once and cached in memory for 5 minutes.
 * Multiple components mounting simultaneously share a single in-flight request.
 */
export function useCategories() {
  const [categories, setCategories] = useState<Category[]>(sharedCache?.categories || [])
  const [loading, setLoading] = useState(!isCacheValid())
  const mounted = useRef(true)

  const load = useCallback(async () => {
    if (isCacheValid()) {
      setCategories(sharedCache!.categories)
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      // Deduplicate parallel requests
      if (!inflight) {
        inflight = fetchCategoriesFromApi().finally(() => {
          inflight = null
        })
      }
      const result = await inflight
      if (mounted.current) {
        setCategories(result)
      }
    } catch {
      // keep stale data if available
      if (sharedCache && mounted.current) {
        setCategories(sharedCache.categories)
      }
    } finally {
      if (mounted.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    mounted.current = true
    load()
    return () => {
      mounted.current = false
    }
  }, [load])

  /** Force refetch (e.g. after creating/editing/deleting a category) */
  const invalidate = useCallback(async () => {
    sharedCache = null
    await load()
  }, [load])

  /** Build a Map<categoryId, categoryName> for dropdown label mapping */
  const categoryMap = new Map<number, string>(
    categories.map((cat) => [cat.id, cat.category_name]),
  )

  return { categories, categoryMap, loading, invalidate }
}
