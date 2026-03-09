"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Eye, EyeOff } from "lucide-react"
import { apiUrl } from "@/lib/api"

export default function LoginPage() {
  const router = useRouter()
  const [loginId, setLoginId] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [fieldError, setFieldError] = useState("")
  const [showPassword, setShowPassword] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setFieldError("")

    if (!loginId.trim()) {
      setFieldError("loginId")
      setError("Please enter your User ID")
      return
    }
    if (!password) {
      setFieldError("password")
      setError("Please enter your password")
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch(apiUrl("/api/auth/login"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          loginId,
          password,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.message || "Login failed")
        setIsLoading(false)
        return
      }

      if (!data || !data.Login) {
        setError("Invalid response from server")
        setIsLoading(false)
        return
      }

      const { Login, Role, Designation } = data

      sessionStorage.setItem("loginId", Login || loginId)
      sessionStorage.setItem("role", Role)
      if (Designation) sessionStorage.setItem("designation", Designation)

      if (Role === "Server Admin") {
        router.push("/dashboard/server-admin")
      } else if (Role === "Master Admin") {
        router.push("/dashboard/master-admin")
      } else if (Role === "Employee") {
        if (Designation === "Purchase Employee") {
          router.push("/dashboard/purchase/pending-work-orders")
        } else {
          router.push("/dashboard/inquiries")
        }
      } else {
        setError("Unknown role. Please contact administrator.")
      }
    } catch (err) {
      setError("Failed to connect to server")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4 text-center flex flex-col items-center pt-8">
          <img src="/hexaplast-logo.svg" alt="Hexaplast Logo" className="h-16 w-auto" />
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="flex flex-col space-y-1.5">
              <Label htmlFor="loginId">User ID</Label>
              <Input
                id="loginId"
                type="text"
                value={loginId}
                onChange={(e) => { setLoginId(e.target.value); if (fieldError === "loginId") { setFieldError(""); setError(""); } }}
                placeholder="Enter your User ID"
                className={fieldError === "loginId" ? "border-red-400" : ""}
              />
              {fieldError === "loginId" && <p className="text-red-500 text-sm">{error}</p>}
            </div>
            <div className="flex flex-col space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); if (fieldError === "password") { setFieldError(""); setError(""); } }}
                  placeholder="Enter your password"
                  className={`pr-10 ${fieldError === "password" ? "border-red-400" : ""}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {fieldError === "password" && <p className="text-red-500 text-sm">{error}</p>}
            </div>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Loading..." : "Login"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
