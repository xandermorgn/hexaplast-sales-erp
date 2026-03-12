"use client"

import { useEffect, useRef, useCallback } from "react"

/**
 * Silent background data refresh hook.
 * Calls the provided refresh function at a fixed interval.
 * Also refreshes when the tab becomes visible (user switches back).
 * Does NOT cause any UI flash — just silently updates state in the background.
 *
 * @param refreshFn - async function that fetches fresh data and updates state
 * @param intervalMs - polling interval in milliseconds (default: 30s)
 * @param enabled - whether polling is active (default: true)
 */
export function useSilentRefresh(
  refreshFn: () => Promise<void>,
  intervalMs = 30000,
  enabled = true,
) {
  const fnRef = useRef(refreshFn)
  fnRef.current = refreshFn

  const silentRefresh = useCallback(async () => {
    try {
      await fnRef.current()
    } catch {
      // Silently ignore — no toast, no UI change
    }
  }, [])

  useEffect(() => {
    if (!enabled) return

    const interval = setInterval(silentRefresh, intervalMs)

    // Also refresh when tab becomes visible again
    function onVisibilityChange() {
      if (document.visibilityState === "visible") {
        silentRefresh()
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange)

    return () => {
      clearInterval(interval)
      document.removeEventListener("visibilitychange", onVisibilityChange)
    }
  }, [silentRefresh, intervalMs, enabled])
}
