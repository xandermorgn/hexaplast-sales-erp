"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"

export default function DashboardPage() {
  const router = useRouter()
  const { user, isLoading } = useAuth()

  useEffect(() => {
    if (isLoading) return

    if (user?.role === "server_admin") {
      router.replace("/dashboard/server-admin")
      return
    }

    if (user?.role === "master_admin") {
      router.replace("/dashboard/master-admin")
      return
    }

    if (user?.role === "employee") {
      router.replace("/dashboard/inquiries")
      return
    }

    router.replace("/")
  }, [isLoading, router, user?.role])

  return null
}
