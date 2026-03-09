"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"

interface User {
  loginId: string
  name: string
  role: string
  roleName: string
  designation?: string | null
}

interface AuthState {
  isLoading: boolean
  isAuthenticated: boolean
  user: User | null
  error: string | null
}

/**
 * Authentication hook for session-based auth
 * Validates session on mount and provides auth state
 */
export function useAuth(requiredRole?: string) {
  const router = useRouter()
  const [state, setState] = useState<AuthState>({
    isLoading: true,
    isAuthenticated: false,
    user: null,
    error: null,
  })

  const checkSession = useCallback(async () => {
    try {
      const response = await fetch(`/api/auth/me`, {
        method: "GET",
        credentials: "include", // Important: sends cookies
      })

      if (response.ok) {
        const data = await response.json()
        
        if (data.authenticated && data.user) {
          const isServerAdmin = data.user.role === "server_admin"

          // Check role requirement
          if (!isServerAdmin && requiredRole && data.user.role !== requiredRole) {
            setState({
              isLoading: false,
              isAuthenticated: false,
              user: null,
              error: "Access denied. Insufficient privileges.",
            })
            router.push("/")
            return
          }

          setState({
            isLoading: false,
            isAuthenticated: true,
            user: data.user,
            error: null,
          })

          // Sync to sessionStorage for backward compatibility with existing UI
          sessionStorage.setItem("loginId", data.user.loginId)
          sessionStorage.setItem("role", data.user.roleName)
        } else {
          throw new Error("Not authenticated")
        }
      } else {
        throw new Error("Session invalid")
      }
    } catch (error) {
      // Clear any stale sessionStorage
      sessionStorage.removeItem("loginId")
      sessionStorage.removeItem("role")

      setState({
        isLoading: false,
        isAuthenticated: false,
        user: null,
        error: "Session expired. Please log in again.",
      })

      // Redirect to login
      router.push("/")
    }
  }, [requiredRole, router])

  const logout = useCallback(async () => {
    try {
      await fetch(`/api/auth/logout`, {
        method: "POST",
        credentials: "include",
      })
    } catch (error) {
      // Logout anyway even if request fails
    }

    // Clear sessionStorage
    sessionStorage.removeItem("loginId")
    sessionStorage.removeItem("role")

    setState({
      isLoading: false,
      isAuthenticated: false,
      user: null,
      error: null,
    })

    router.push("/")
  }, [router])

  useEffect(() => {
    checkSession()
  }, [checkSession])

  return {
    ...state,
    logout,
    refreshSession: checkSession,
  }
}
