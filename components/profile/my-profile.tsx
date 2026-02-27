"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useToast } from "@/hooks/use-toast"
import { Pencil, Save, X, Upload, Trash2 } from "lucide-react"
import { API_BASE } from "@/lib/api"

interface Profile {
  id: number
  user_id: number
  display_name: string
  personal_phone: string | null
  personal_email: string | null
  photo_path: string | null
  login_id: string
  system_name: string
  system_full_name: string | null
  system_phone: string | null
  system_email: string | null
  role: string
  employee_id: string | null
  designation: string | null
}

export function MyProfile() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false)
  const [editData, setEditData] = useState({
    display_name: "",
    personal_phone: "",
    personal_email: "",
  })
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  useEffect(() => {
    fetchProfile()
  }, [])

  const fetchProfile = async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`${API_BASE}/api/profile/me`, {
        credentials: "include",
      })

      if (response.ok) {
        const data = await response.json()
        setProfile(data.profile)
        setEditData({
          display_name: data.profile.display_name,
          personal_phone: data.profile.personal_phone || "",
          personal_email: data.profile.personal_email || "",
        })
      } else {
        toast({
          title: "Error",
          description: "Failed to load profile",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Unable to connect to server",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      setIsSaving(true)
      const response = await fetch(`${API_BASE}/api/profile/me`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          display_name: editData.display_name,
          personal_phone: editData.personal_phone || null,
          personal_email: editData.personal_email || null,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setProfile(data.profile)
        setIsEditing(false)
        toast({
          title: "Success",
          description: "Profile updated successfully",
        })
      } else {
        const error = await response.json()
        toast({
          title: "Error",
          description: error.message || "Failed to update profile",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Unable to connect to server",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!["image/jpeg", "image/jpg", "image/png"].includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Only JPG and PNG images are allowed",
        variant: "destructive",
      })
      return
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Photo must be less than 5MB",
        variant: "destructive",
      })
      return
    }

    try {
      setIsUploadingPhoto(true)
      const formData = new FormData()
      formData.append("photo", file)

      const response = await fetch(`${API_BASE}/api/profile/photo`, {
        method: "POST",
        credentials: "include",
        body: formData,
      })

      if (response.ok) {
        // Re-fetch profile to get updated photo_path
        await fetchProfile()
        toast({
          title: "Success",
          description: "Photo uploaded successfully",
        })
      } else {
        const error = await response.json()
        toast({
          title: "Error",
          description: error.message || "Failed to upload photo",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Unable to upload photo",
        variant: "destructive",
      })
    } finally {
      setIsUploadingPhoto(false)
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  const handleDeletePhoto = async () => {
    try {
      setIsUploadingPhoto(true)
      const response = await fetch(`${API_BASE}/api/profile/photo`, {
        method: "DELETE",
        credentials: "include",
      })

      if (response.ok) {
        await fetchProfile()
        toast({
          title: "Success",
          description: "Photo deleted successfully",
        })
      } else {
        const error = await response.json()
        toast({
          title: "Error",
          description: error.message || "Failed to delete photo",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Unable to delete photo",
        variant: "destructive",
      })
    } finally {
      setIsUploadingPhoto(false)
    }
  }

  const handleCancel = () => {
    if (profile) {
      setEditData({
        display_name: profile.display_name,
        personal_phone: profile.personal_phone || "",
        personal_email: profile.personal_email || "",
      })
    }
    setIsEditing(false)
  }

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  // Get full photo URL from backend path
  const getPhotoUrl = (photoPath: string | null) => {
    if (!photoPath) return undefined
    return `${API_BASE}${photoPath}`
  }

  if (isLoading) {
    return (
      <Card className="bg-white border-gray-200">
        <CardContent className="p-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!profile) {
    return (
      <Card className="bg-white border-gray-200">
        <CardContent className="p-8">
          <p className="text-gray-500 text-center">Profile not found</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-white border-gray-200">
      <CardHeader className="border-b border-gray-200">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-semibold text-gray-800">My Profile</CardTitle>
          {!isEditing && (
            <Button
              onClick={() => setIsEditing(true)}
              variant="outline"
              size="sm"
              className="border-gray-200 text-gray-600 hover:bg-gray-50"
            >
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        {/* Profile Photo Section */}
        <div className="flex items-center space-x-4">
          <div className="relative">
            <Avatar className="h-20 w-20">
              <AvatarImage src={getPhotoUrl(profile.photo_path)} alt={profile.display_name} />
              <AvatarFallback className="bg-gradient-to-br from-orange-400 to-orange-600 text-white text-xl">
                {getInitials(profile.display_name)}
              </AvatarFallback>
            </Avatar>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-800">{profile.display_name}</h3>
            <p className="text-sm text-gray-500">{profile.role}</p>
            {/* Photo Upload/Delete Buttons */}
            <div className="flex gap-2 mt-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handlePhotoUpload}
                accept="image/jpeg,image/jpg,image/png"
                className="hidden"
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                variant="outline"
                size="sm"
                disabled={isUploadingPhoto}
                className="text-xs"
              >
                <Upload className="h-3 w-3 mr-1" />
                {isUploadingPhoto ? "Uploading..." : "Upload Photo"}
              </Button>
              {profile.photo_path && (
                <Button
                  onClick={handleDeletePhoto}
                  variant="outline"
                  size="sm"
                  disabled={isUploadingPhoto}
                  className="text-xs text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Remove
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Editable Fields */}
        {isEditing ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-gray-600 text-sm">Display Name *</Label>
              <Input
                value={editData.display_name}
                onChange={(e) => setEditData({ ...editData, display_name: e.target.value })}
                className="bg-gray-50 border-gray-200 text-gray-800"
                placeholder="Enter display name"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-gray-600 text-sm">Personal Phone</Label>
              <Input
                value={editData.personal_phone}
                onChange={(e) => setEditData({ ...editData, personal_phone: e.target.value })}
                className="bg-gray-50 border-gray-200 text-gray-800"
                placeholder="Enter personal phone (optional)"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-gray-600 text-sm">Personal Email</Label>
              <Input
                value={editData.personal_email}
                onChange={(e) => setEditData({ ...editData, personal_email: e.target.value })}
                className="bg-gray-50 border-gray-200 text-gray-800"
                placeholder="Enter personal email (optional)"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                onClick={handleCancel}
                variant="outline"
                className="flex-1 border-gray-200 text-gray-600 hover:bg-gray-50"
                disabled={isSaving}
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                className="flex-1 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white"
                disabled={isSaving}
              >
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Read-only System Fields */}
            <div className="border-b pb-4 mb-4">
              <h4 className="text-sm font-medium text-gray-700 mb-3">System Information (Read-only)</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-gray-600 text-sm">Login ID</Label>
                  <Input
                    value={profile.login_id}
                    disabled
                    className="bg-gray-100 border-gray-200 text-gray-500 cursor-not-allowed"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-600 text-sm">Employee ID</Label>
                  <Input
                    value={profile.employee_id || "N/A"}
                    disabled
                    className="bg-gray-100 border-gray-200 text-gray-500 cursor-not-allowed"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-600 text-sm">Full Name (System)</Label>
                  <Input
                    value={profile.system_full_name || profile.system_name}
                    disabled
                    className="bg-gray-100 border-gray-200 text-gray-500 cursor-not-allowed"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-600 text-sm">Role</Label>
                  <Input
                    value={profile.role}
                    disabled
                    className="bg-gray-100 border-gray-200 text-gray-500 cursor-not-allowed"
                  />
                </div>
                {profile.designation && (
                  <div className="space-y-2">
                    <Label className="text-gray-600 text-sm">Designation</Label>
                    <Input
                      value={profile.designation}
                      disabled
                      className="bg-gray-100 border-gray-200 text-gray-500 cursor-not-allowed"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Editable Profile Fields (View Mode) */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">Personal Information</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-gray-600 text-sm">Display Name</Label>
                  <Input
                    value={profile.display_name}
                    disabled
                    className="bg-gray-50 border-gray-200 text-gray-700 cursor-not-allowed"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-600 text-sm">Personal Phone</Label>
                  <Input
                    value={profile.personal_phone || "Not set"}
                    disabled
                    className="bg-gray-50 border-gray-200 text-gray-700 cursor-not-allowed"
                  />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label className="text-gray-600 text-sm">Personal Email</Label>
                  <Input
                    value={profile.personal_email || "Not set"}
                    disabled
                    className="bg-gray-50 border-gray-200 text-gray-700 cursor-not-allowed"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
