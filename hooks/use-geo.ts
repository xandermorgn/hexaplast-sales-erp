"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { apiUrl } from "@/lib/api"

type GeoCountry = { id: number; name: string; iso2: string; iso3: string; currency: string }
type GeoState = { id: number; name: string; country_id: number; country_code: string; iso2: string }
type GeoCity = { id: number; name: string; state_id: number; country_id: number }
type GeoCurrency = { code: string; name: string; country: string; symbol: string }

// Module-level cache so data is fetched once across all hook instances
let countriesCache: GeoCountry[] | null = null
let currenciesCache: GeoCurrency[] | null = null
const statesCache = new Map<number, GeoState[]>()
const citiesCache = new Map<number, GeoCity[]>()

export function useGeoCountries() {
  const [countries, setCountries] = useState<GeoCountry[]>(countriesCache || [])
  const [loading, setLoading] = useState(!countriesCache)

  useEffect(() => {
    if (countriesCache) {
      setCountries(countriesCache)
      setLoading(false)
      return
    }
    let cancelled = false
    fetch(apiUrl("/api/geo/countries"), { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        countriesCache = data
        setCountries(data)
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  return { countries, loading }
}

export function useGeoStates(countryId: number | null) {
  const [states, setStates] = useState<GeoState[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!countryId) {
      setStates([])
      return
    }

    const cached = statesCache.get(countryId)
    if (cached) {
      setStates(cached)
      return
    }

    let cancelled = false
    setLoading(true)
    fetch(apiUrl(`/api/geo/states?country_id=${countryId}`), { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        statesCache.set(countryId, data)
        setStates(data)
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [countryId])

  return { states, loading }
}

export function useGeoCities(stateId: number | null) {
  const [cities, setCities] = useState<GeoCity[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!stateId) {
      setCities([])
      return
    }

    const cached = citiesCache.get(stateId)
    if (cached) {
      setCities(cached)
      return
    }

    let cancelled = false
    setLoading(true)
    fetch(apiUrl(`/api/geo/cities?state_id=${stateId}`), { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        citiesCache.set(stateId, data)
        setCities(data)
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [stateId])

  return { cities, loading }
}

export function useGeoCurrencies() {
  const [currencies, setCurrencies] = useState<GeoCurrency[]>(currenciesCache || [])
  const [loading, setLoading] = useState(!currenciesCache)

  useEffect(() => {
    if (currenciesCache) {
      setCurrencies(currenciesCache)
      setLoading(false)
      return
    }
    let cancelled = false
    fetch(apiUrl("/api/geo/currencies"), { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        currenciesCache = data
        setCurrencies(data)
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  return { currencies, loading }
}

export type { GeoCountry, GeoState, GeoCity, GeoCurrency }
