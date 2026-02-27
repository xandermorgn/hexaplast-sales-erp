"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { LogOut, Settings, User, ChevronDown, Bell, X, Clock } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { getSocket } from "@/lib/socket"
import { API_BASE } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"

interface MenuItem {
  id: string
  label: string
  icon?: React.ReactNode
}

interface Notification {
  id: string
  title: string
  message: string
  time: Date
  read: boolean
  workOrderId?: string
}

type ProfileData = {
  name: string
  email: string
  phone: string
  photoUrl: string
}

interface DashboardLayoutProps {
  title: string
  menuItems: MenuItem[]
  activeSection: string
  onSectionChange: (section: string) => void
  loginId: string
  onLogout: () => void
  children: React.ReactNode
  userRole?: "employee" | "master_admin" | "server_admin"
  notifications?: Notification[]
  onNotificationRead?: (id: string) => void
  onClearAllNotifications?: () => void
}

function HexaplastLogo({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 250 100" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      {/* 3D Cube Icon */}
      <polygon fill="#F58120" points="31.09,17.68 43.37,24.77 31.09,31.86 18.81,24.77" />
      <polygon fill="#58585A" points="17.47,40.88 17.47,26.7 29.76,33.79 29.76,47.96" />
      <polygon fill="#B2B4B5" points="44.69,40.93 44.69,26.74 32.41,33.83 32.41,48.02" />
      <polygon fill="#F58120" points="16.05,42.61 28.34,49.7 16.05,56.79 3.77,49.7" />
      <polygon fill="#58585A" points="2.44,65.81 2.42,51.63 14.72,58.72 14.72,72.91" />
      <polygon fill="#B2B4B5" points="29.65,65.86 29.65,51.68 17.37,58.78 17.37,73.35" />
      <polygon fill="#F58120" points="45.93,43 58.23,50.1 45.93,57.19 33.65,50.1" />
      <polygon fill="#58585A" points="32.31,66.21 32.31,52.04 44.59,59.12 44.6,73.3" />
      <polygon fill="#B2B4B5" points="59.53,66.25 59.53,52.08 47.26,59.16 47.26,73.35" />
      <polygon fill="#58585A" points="47.35,41.08 47.35,26.89 59.63,33.99 59.64,48.16" />
      <polygon fill="#B2B4B5" points="15.01,41.12 15.01,26.94 2.73,34.03 2.73,48.22" />
      <polygon fill="#F58120" points="31.09,68.13 43.37,75.23 31.09,82.32 18.81,75.23" />
      {/* Hexaplast Text */}
      <path
        fill="#58585A"
        d="M67.52,64.34V35.03h6.11v11.14h11.53V35.03h6.1v29.31h-6.1V51.25H73.63v13.09H67.52z M98.35,55.23
        c0.04,1.63,0.51,2.9,1.41,3.82c0.91,0.93,2.07,1.39,3.5,1.39c0.99,0,1.8-0.21,2.47-0.68c0.67-0.44,1.13-1.07,1.39-1.87h5.85
        c-0.28,1.43-0.81,2.64-1.59,3.67c-0.77,1.03-1.92,1.86-3.46,2.5c-1.55,0.64-3.18,0.96-4.92,0.96c-2.02,0-3.79-0.43-5.33-1.27
        c-1.53-0.83-2.75-2.15-3.66-3.96c-0.89-1.82-1.35-3.94-1.35-6.38c0-3.08,0.77-5.67,2.28-7.78c1.74-2.43,4.39-3.64,7.95-3.64
        c1.52,0,2.88,0.2,4.11,0.6c1.21,0.4,2.27,1.01,3.15,1.86c0.89,0.83,1.56,1.82,2.03,2.95c0.47,1.13,0.77,2.39,0.92,3.8
        c0.09,0.93,0.13,2.28,0.12,4.04H98.35z M107.37,51.47c-0.09-1.52-0.4-2.64-0.91-3.38c-0.72-1.04-1.83-1.56-3.32-1.56
        c-1.04,0-1.9,0.23-2.59,0.68c-0.68,0.45-1.2,1.11-1.57,1.96c-0.25,0.57-0.41,1.35-0.51,2.3H107.37z M117.25,53.28l-7.07-10.66h6.95
        l3.55,6.34l3.63-6.34h6.74l-7.13,10.66l7.41,11.06h-7.06l-3.59-6.54l-3.94,6.54h-6.89L117.25,53.28z M135.94,49.53h-5.62
        c0.12-2.22,1-4.03,2.62-5.45c1.62-1.4,4.08-2.11,7.41-2.11c1.43,0,2.74,0.15,3.91,0.45c1.16,0.29,2.03,0.68,2.6,1.16
        c0.57,0.47,1.01,1.07,1.32,1.8c0.43,0.95,0.64,2.14,0.64,3.56l-0.03,11.1c0,1.29,0.12,2.15,0.33,2.55
        c0.24,0.43,0.56,0.71,0.99,0.84v0.89h-6.25c-0.35-0.83-0.52-1.67-0.53-2.54c-1.16,1.21-2.23,2.04-3.23,2.51
        c-1,0.45-2.19,0.69-3.56,0.69c-1.43,0-2.67-0.28-3.71-0.83c-1.05-0.55-1.84-1.33-2.36-2.38c-0.52-1.03-0.77-2.15-0.77-3.34
        c0-1.82,0.48-3.34,1.43-4.55c0.95-1.23,2.7-2.03,5.25-2.42l4.79-0.72c0.77-0.11,1.31-0.31,1.59-0.59c0.28-0.28,0.43-0.67,0.43-1.16
        c0,0.79-0.27,1.4-0.79-1.84c-0.52-0.43-1.4-0.65-2.64-0.65c-1.28,0-2.18,0.23-2.72,0.65C136.49,47.63,136.12,48.42,135.94,49.53
        L135.94,49.53z M143.18,53.73c-0.49,0.27-0.97,0.45-1.43,0.61c-0.45,0.15-1.07,0.31-1.84,0.47c-1.47,0.28-2.38,0.49-2.75,0.64
        c-0.61,0.25-1.08,0.6-1.37,1.04c-0.31,0.43-0.47,0.97-0.47,1.61c0,0.85,0.27,1.55,0.8,2.1c0.53,0.52,1.23,0.79,2.07,0.79
        c1.25,0,2.4-0.4,3.43-1.21c1.04-0.81,1.56-2.1,1.56-3.84V53.73z M151.27,72.75V42.61h5.42v3.11h0.08c0.47-0.84,0.95-1.51,1.47-2.03
        c0.49-0.51,1.15-0.92,1.95-1.24c0.79-0.32,1.74-0.48,2.83-0.48c1.65,0,3.08,0.32,4.27,0.96c1.19,0.63,2.12,1.39,2.78,2.26
        c0.65,0.87,1.2,1.99,1.63,3.36c0.43,1.39,0.63,2.95,0.63,4.71c0,2.14-0.33,4.15-1,6.02c-0.67,1.9-1.72,3.31-3.18,4.27
        c-1.45,0.96-3.16,1.45-5.15,1.45c-1.44,0-2.63-0.28-3.55-0.84c-0.93-0.55-1.74-1.39-2.43-2.52h-0.08v11.1H151.27z M161.6,46.8
        c-1.61,0-2.83,0.64-3.64,1.91c-0.81,1.28-1.23,2.87-1.23,4.78c0,2.27,0.45,3.94,1.37,5.03c0.92,1.09,2.08,1.64,3.5,1.64
        c1.4,0,2.58-0.55,3.48-1.63c0.92-1.08,1.37-2.76,1.37-5.05c0-1.88-0.4-3.47-1.21-4.76C164.44,47.44,163.21,46.8,161.6,46.8
        L161.6,46.8z M179.69,34.95v29.39h-5.67V34.95H179.69z M187.38,49.53h-5.62c0.12-2.22,1-4.03,2.62-5.45
        c1.61-1.4,4.08-2.11,7.41-2.11c1.43,0,2.74,0.15,3.91,0.45c1.17,0.29,2.03,0.68,2.6,1.16c0.57,0.47,1.01,1.07,1.32,1.8
        c0.43,0.95,0.64,2.14,0.64,3.56l-0.03,11.1c0,1.29,0.12,2.15,0.33,2.55c0.24,0.43,0.56,0.71,0.99,0.84v0.89h-6.25
        c-0.35-0.83-0.52-1.67-0.53-2.54c-1.16,1.21-2.23,2.04-3.23,2.51c-1,0.45-2.19,0.69-3.56,0.69c-1.43,0-2.67-0.28-3.71-0.83
        c-1.05-0.55-1.84-1.33-2.36-2.38c-0.51-1.03-0.77-2.15-0.77-3.34c0-1.82,0.48-3.34,1.43-4.55c0.95-1.23,2.7-2.03,5.25-2.42
        l4.79-0.72c0.77-0.11,1.31-0.31,1.59-0.59c0.28-0.28,0.43-0.67,0.43-1.16c0-0.79-0.27-1.4-0.79-1.84c-0.52-0.43-1.4-0.65-2.64-0.65
        c-1.28,0-2.18,0.23-2.72,0.65C187.93,47.63,187.57,48.42,187.38,49.53L187.38,49.53z M194.62,53.73c-0.49,0.27-0.97,0.45-1.43,0.61
        c-0.45,0.15-1.07,0.31-1.84,0.47c-1.47,0.28-2.38,0.49-2.75,0.64c-0.61,0.25-1.08,0.6-1.37,1.04c-0.31,0.43-0.47,0.97-0.47,1.61
        c0,0.85,0.27,1.55,0.8,2.1c0.53,0.52,1.23,0.79,2.08,0.79c1.24,0,2.39-0.4,3.43-1.21c1.03-0.81,1.55-2.1,1.55-3.84V53.73z
        M215.18,49.19c-0.11-0.73-0.27-1.27-0.49-1.61c-0.29-0.45-0.68-0.77-1.16-0.97c-0.63-0.25-1.31-0.39-2.07-0.39
        c-1.29,0-2.2,0.21-2.75,0.63c-0.53,0.4-0.8,0.88-0.8,1.41c0,0.29,0.07,0.55,0.2,0.77c0.13,0.24,0.36,0.45,0.69,0.64
        c0.35,0.2,0.97,0.41,1.9,0.65l3.96,0.97c1.33,0.35,2.16,0.59,2.5,0.69c0.83,0.28,1.51,0.61,2.06,0.99c0.56,0.37,1,0.77,1.32,1.2
        c0.33,0.44,0.59,0.93,0.76,1.49c0.17,0.55,0.27,1.16,0.27,1.83c0,1.17-0.21,2.26-0.67,3.23c-0.44,0.96-1.08,1.76-1.91,2.38
        c-0.84,0.63-1.87,1.08-3.1,1.4c-1.23,0.32-2.67,0.49-4.31,0.49c-1.7,0-3.16-0.19-4.42-0.55c-1.25-0.36-2.27-0.88-3.04-1.56
        c-0.79-0.68-1.36-1.45-1.76-2.28c-0.37-0.84-0.64-1.91-0.81-3.22h5.89c0,0.69,0.11,1.24,0.33,1.66c0.32,0.57,0.81,1,1.47,1.28
        c0.65,0.28,1.49,0.41,2.48,0.41c1.48,0,2.55-0.24,3.23-0.73c0.49-0.37,0.73-0.87,0.73-1.48c0-0.45-0.17-0.87-0.53-1.19
        c-0.37-0.33-1.28-0.67-2.75-1.03c-3.23-0.73-5.31-1.29-6.25-1.67c-1.29-0.53-2.27-1.24-2.91-2.15c-0.64-0.91-0.95-2-0.95-3.31
        c0-1.33,0.35-2.56,1.04-3.7c0.69-1.12,1.74-2,3.11-2.6c1.37-0.61,3.08-0.92,5.11-0.92c1.17,0,2.28,0.12,3.35,0.35
        c1.05,0.24,1.94,0.57,2.64,1.03c0.72,0.45,1.29,0.97,1.76,1.56c0.45,0.6,0.79,1.2,1.01,1.83c0.21,0.6,0.39,1.43,0.51,2.46H215.18z
        M223.83,46.67h-3.03v-4.06h3.03v-5.86h5.66v5.86H233v4.06h-3.51v11.67c0,0.68,0.05,1.13,0.15,1.35c0.09,0.23,0.27,0.39,0.55,0.49
        c0.28,0.11,0.85,0.16,1.72,0.16c0.31,0,0.67-0.03,1.09-0.07v4.24c-1.17,0.09-2.1,0.13-2.74,0.13c-1.83,0-3.16-0.16-3.98-0.47
        c-0.83-0.31-1.44-0.76-1.86-1.39c-0.4-0.61-0.6-1.47-0.6-2.56V46.67z"
      />
    </svg>
  )
}

function Ripple({ x, y }: { x: number; y: number }) {
  return (
    <span
      className="absolute rounded-full bg-orange-400/30 animate-ripple pointer-events-none"
      style={{
        left: x,
        top: y,
        width: 10,
        height: 10,
        transform: "translate(-50%, -50%)",
      }}
    />
  )
}

export function DashboardLayout({
  title,
  menuItems,
  activeSection,
  onSectionChange,
  loginId,
  onLogout,
  children,
  userRole = "employee",
  notifications: externalNotifications,
  onNotificationRead,
  onClearAllNotifications,
}: DashboardLayoutProps) {
  const { toast } = useToast()
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [profileData, setProfileData] = useState<ProfileData>({
    name: loginId,
    email: "",
    phone: "",
    photoUrl: "",
  })
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number; buttonId: string }[]>([])
  const rippleIdRef = useRef(0)
  const notificationRef = useRef<HTMLDivElement>(null)

  const [internalNotifications, setInternalNotifications] = useState<Notification[]>([])

  useEffect(() => {
    const socket = getSocket()
    const handler = (n: any) => {
      const notif: Notification = {
        id: String(n?.id ?? Date.now()),
        title: String(n?.title ?? "Notification"),
        message: String(n?.message ?? ""),
        time: n?.time ? new Date(n.time) : new Date(),
        read: Boolean(n?.read ?? false),
        workOrderId: n?.workOrderId ? String(n.workOrderId) : undefined,
      }

      setInternalNotifications((prev) => [notif, ...prev])
      toast({ title: notif.title, description: notif.message })
    }

    socket.on("notification:new", handler)
    return () => {
      socket.off("notification:new", handler)
    }
  }, [])

  const notifications = externalNotifications || internalNotifications
  const unreadCount = notifications.filter((n) => !n.read).length
  const isEmployee = userRole === "employee"

  useEffect(() => {
    let cancelled = false

    const loadProfile = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/profile/me`, { credentials: "include" })
        const json = res.ok ? await res.json() : null
        const p = json?.profile

        if (cancelled || !p) return

        const rawPath = p.photo_path ? String(p.photo_path) : ""
        const photoUrl = rawPath
          ? rawPath.startsWith("http://") || rawPath.startsWith("https://")
            ? rawPath
            : `${API_BASE}${rawPath.startsWith("/") ? "" : "/"}${rawPath}`
          : ""
        setProfileData((prev: ProfileData) => ({
          ...prev,
          name: String(p.display_name || prev.name || loginId),
          email: String(p.personal_email || prev.email || ""),
          phone: String(p.personal_phone || prev.phone || ""),
          photoUrl,
        }))
      } catch {
        // ignore: header should still render with fallback initials
      }
    }

    loadProfile()
    return () => {
      cancelled = true
    }
  }, [loginId])

  useEffect(() => {
    if (typeof window !== "undefined") {
      // Never persist blob: URLs across sessions (they break after reload)
      const safe: ProfileData = {
        ...profileData,
        photoUrl: profileData.photoUrl?.startsWith("blob:") ? "" : profileData.photoUrl,
      }
      sessionStorage.setItem("profileData", JSON.stringify(safe))
    }
  }, [profileData])

  const getInitials = (name: string) => {
    return name.charAt(0).toUpperCase()
  }

  const handleButtonClick = (e: React.MouseEvent<HTMLButtonElement>, itemId: string) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const id = rippleIdRef.current++

    setRipples((prev) => [...prev, { id, x, y, buttonId: itemId }])
    setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== id))
    }, 600)

    onSectionChange(itemId)
  }

  const handleSaveProfile = () => {
    setShowProfileModal(false)
  }

  const handleNotificationRead = (id: string) => {
    if (onNotificationRead) {
      onNotificationRead(id)
    }
  }

  const handleClearAll = () => {
    if (onClearAllNotifications) {
      onClearAllNotifications()
    }
    setShowNotifications(false)
  }

  const formatTimeAgo = (date: Date) => {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
    if (seconds < 60) return "Just now"
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  return (
    <div className="flex flex-col h-screen bg-white">
      <header className="h-16 bg-white/80 backdrop-blur-md flex items-center justify-between px-6 border-b border-gray-100/50 sticky top-0 z-50">
        {/* Logo on the left */}
        <HexaplastLogo className="w-36 h-auto flex-shrink-0" />

        {/* Nothing in middle - just flex spacer */}
        <div className="flex-1" />

        {/* Notification Bell and Profile on the right */}
        <div className="flex items-center gap-3">
          {/* Notification Bell - Only for employees */}
          {isEmployee && (
            <div className="relative" ref={notificationRef}>
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 rounded-full hover:bg-gray-100 transition-colors"
              >
                <Bell className="w-5 h-5 text-gray-600" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-[10px] font-bold text-white animate-pulse">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Dropdown */}
              {showNotifications && (
                <div className="absolute right-0 top-12 w-80 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden z-50">
                  {/* Header */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
                    <h3 className="font-semibold text-gray-800">Notifications</h3>
                    <div className="flex items-center gap-2">
                      {unreadCount > 0 && (
                        <button
                          onClick={handleClearAll}
                          className="text-xs text-orange-500 hover:text-orange-600 font-medium"
                        >
                          Mark all read
                        </button>
                      )}
                      <button
                        onClick={() => setShowNotifications(false)}
                        className="p-1 hover:bg-gray-200 rounded-full transition-colors"
                      >
                        <X className="w-4 h-4 text-gray-500" />
                      </button>
                    </div>
                  </div>

                  {/* Notifications List */}
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="py-8 text-center text-gray-500">
                        <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">No notifications</p>
                      </div>
                    ) : (
                      notifications.map((notification) => (
                        <div
                          key={notification.id}
                          onClick={() => handleNotificationRead(notification.id)}
                          className={`px-4 py-3 border-b border-gray-50 cursor-pointer transition-colors hover:bg-gray-50 ${
                            !notification.read ? "bg-orange-50/50" : ""
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            {/* Unread indicator */}
                            <div className="mt-1.5">
                              {!notification.read ? (
                                <div className="w-2 h-2 rounded-full bg-orange-500" />
                              ) : (
                                <div className="w-2 h-2 rounded-full bg-gray-300" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p
                                className={`text-sm ${!notification.read ? "font-semibold text-gray-900" : "font-medium text-gray-700"}`}
                              >
                                {notification.title}
                              </p>
                              <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{notification.message}</p>
                              <div className="flex items-center gap-1 mt-1.5 text-xs text-gray-400">
                                <Clock className="w-3 h-3" />
                                {formatTimeAgo(notification.time)}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Footer */}
                  {notifications.length > 0 && (
                    <div className="px-4 py-2 border-t border-gray-100 bg-gray-50">
                      <button className="w-full text-center text-sm text-orange-500 hover:text-orange-600 font-medium py-1">
                        View all notifications
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Profile Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2.5 py-1.5 px-3 rounded-full hover:bg-gray-50 transition-all duration-200 group">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center text-white font-semibold text-sm shadow-md shadow-orange-500/20">
                  {profileData.photoUrl ? (
                    <img
                      src={profileData.photoUrl || "/placeholder.svg"}
                      alt="Profile"
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    getInitials(profileData.name || loginId)
                  )}
                </div>
                <span className="text-sm font-medium text-gray-700">{profileData.name || loginId}</span>
                <ChevronDown className="w-3.5 h-3.5 text-gray-400 group-hover:text-gray-600 transition-colors" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-white border border-gray-200 shadow-xl">
              <DropdownMenuItem
                onClick={() => setShowProfileModal(true)}
                className="text-gray-700 hover:text-gray-900 hover:bg-gray-100 cursor-pointer"
              >
                <User className="mr-2 h-4 w-4" />
                Profile Settings
              </DropdownMenuItem>
              <DropdownMenuItem className="text-gray-700 hover:text-gray-900 hover:bg-gray-100 cursor-pointer">
                <Settings className="mr-2 h-4 w-4" />
                Preferences
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-gray-200" />
              <DropdownMenuItem
                onClick={onLogout}
                className="text-red-600 hover:text-red-700 hover:bg-red-50 cursor-pointer"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Main content area with sidebar and page content */}
      <div className="flex flex-1 overflow-hidden">
        <aside className="w-64 bg-[#f9fafb] flex flex-col">
          {/* Section title at top of control panel */}
          <div className="px-5 pt-5 pb-4">
            <p className="text-xs uppercase tracking-[0.2em] text-orange-500 font-semibold">{title}</p>
          </div>

          <nav className="flex-1 px-3 py-2 space-y-1.5">
            {menuItems.map((item) => {
              const isActive = activeSection === item.id
              const buttonRipples = ripples.filter((r) => r.buttonId === item.id)
              return (
                <button
                  key={item.id}
                  onClick={(e) => handleButtonClick(e, item.id)}
                  className={`
                    w-full px-4 py-2.5 rounded-lg text-left text-sm font-medium
                    transition-all duration-200 ease-out
                    flex items-center gap-3 group relative overflow-hidden
                    ${
                      isActive
                        ? "bg-white/80 text-gray-800 shadow-sm border border-gray-200/60"
                        : "bg-white/50 text-gray-600 border border-transparent hover:bg-white/70 hover:border-gray-200/40 hover:shadow-sm"
                    }
                    backdrop-blur-md
                  `}
                  style={{
                    background: isActive
                      ? "linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.7) 100%)"
                      : "linear-gradient(135deg, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0.4) 100%)",
                  }}
                >
                  {isActive && (
                    <span
                      className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-orange-400 via-orange-500 to-orange-600 rounded-l-lg"
                      style={{
                        boxShadow: "2px 0 8px rgba(245, 129, 32, 0.3)",
                      }}
                    />
                  )}
                  {buttonRipples.map((ripple) => (
                    <Ripple key={ripple.id} x={ripple.x} y={ripple.y} />
                  ))}
                  <span
                    className={`relative z-10 transition-all duration-200 ${isActive ? "text-gray-800 font-semibold pl-1" : "group-hover:translate-x-0.5"}`}
                  >
                    {item.label}
                  </span>
                </button>
              )
            })}
          </nav>
        </aside>

        {/* Content Area - no border between sidebar and content */}
        <main className="flex-1 overflow-y-auto p-6 bg-white">{children}</main>
      </div>

      {/* Profile Modal */}
      <Dialog open={showProfileModal} onOpenChange={setShowProfileModal}>
        <DialogContent className="bg-white border border-gray-200 text-gray-800 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">Profile Settings</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {/* Avatar */}
            <div className="flex justify-center">
              <div className="relative group">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center text-white text-3xl font-bold shadow-xl shadow-orange-500/20">
                  {profileData.photoUrl ? (
                    <img
                      src={profileData.photoUrl || "/placeholder.svg"}
                      alt="Profile"
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    getInitials(profileData.name || loginId)
                  )}
                </div>
                <label className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                  <span className="text-xs text-white">Change</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) {
                        const url = URL.createObjectURL(file)
                        setProfileData((prev: ProfileData) => ({ ...prev, photoUrl: url }))
                      }
                    }}
                  />
                </label>
              </div>
            </div>

            {/* Form Fields */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-gray-600 text-sm">Full Name</Label>
                <Input
                  value={profileData.name}
                  onChange={(e) => setProfileData((prev: ProfileData) => ({ ...prev, name: e.target.value }))}
                  className="bg-gray-50 border-gray-200 text-gray-800 placeholder:text-gray-400 focus:border-orange-500 focus:ring-orange-500/20"
                  placeholder="Enter your name"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-600 text-sm">Email Address</Label>
                <Input
                  type="email"
                  value={profileData.email}
                  onChange={(e) => setProfileData((prev: ProfileData) => ({ ...prev, email: e.target.value }))}
                  className="bg-gray-50 border-gray-200 text-gray-800 placeholder:text-gray-400 focus:border-orange-500 focus:ring-orange-500/20"
                  placeholder="Enter your email"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-600 text-sm">Phone Number</Label>
                <Input
                  type="tel"
                  value={profileData.phone}
                  onChange={(e) => setProfileData((prev: ProfileData) => ({ ...prev, phone: e.target.value }))}
                  className="bg-gray-50 border-gray-200 text-gray-800 placeholder:text-gray-400 focus:border-orange-500 focus:ring-orange-500/20"
                  placeholder="Enter your phone number"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowProfileModal(false)}
                className="flex-1 bg-transparent border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-800"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveProfile}
                className="flex-1 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white border-0"
              >
                Save Changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
