"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { apiUrl } from "@/lib/api"
import { Clock, Plus, Check, Trash2 } from "lucide-react"

type FollowUp = {
  id: number
  entity_type: string
  entity_id: number
  employee_id: number
  note: string | null
  reminder_datetime: string
  status: string
  created_at: string
  employee_name: string | null
}

interface FollowUpSectionProps {
  entityType: "enquiry" | "quotation" | "performa" | "workorder"
  entityId: number | null
}

export function FollowUpSection({ entityType, entityId }: FollowUpSectionProps) {
  const { toast } = useToast()
  const [followUps, setFollowUps] = useState<FollowUp[]>([])
  const [showForm, setShowForm] = useState(false)
  const [note, setNote] = useState("")
  const [reminderDate, setReminderDate] = useState("")
  const [reminderTime, setReminderTime] = useState("")
  const [saving, setSaving] = useState(false)

  async function fetchFollowUps() {
    if (!entityId) return
    try {
      const res = await fetch(apiUrl(`/api/followups/entity/${entityType}/${entityId}`), { credentials: "include" })
      if (!res.ok) return
      const data = await res.json()
      setFollowUps(data.follow_ups || [])
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    fetchFollowUps()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityType, entityId])

  async function handleCreate() {
    if (!entityId) return
    if (!reminderDate || !reminderTime) {
      toast({ title: "Validation", description: "Please set both reminder date and time", variant: "destructive" })
      return
    }

    const reminder_datetime = `${reminderDate}T${reminderTime}:00`

    setSaving(true)
    try {
      const res = await fetch(apiUrl("/api/followups"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          entity_type: entityType,
          entity_id: entityId,
          note: note || null,
          reminder_datetime,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data?.message || "Failed to create follow-up")
      }
      toast({ title: "Reminder created", description: "Follow-up reminder has been scheduled" })
      setNote("")
      setReminderDate("")
      setReminderTime("")
      setShowForm(false)
      await fetchFollowUps()
    } catch (error) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to create follow-up", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  async function markCompleted(id: number) {
    try {
      const res = await fetch(apiUrl(`/api/followups/${id}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: "completed" }),
      })
      if (!res.ok) throw new Error("Failed")
      await fetchFollowUps()
    } catch {
      toast({ title: "Error", description: "Failed to update follow-up", variant: "destructive" })
    }
  }

  async function deleteFollowUp(id: number) {
    try {
      const res = await fetch(apiUrl(`/api/followups/${id}`), {
        method: "DELETE",
        credentials: "include",
      })
      if (!res.ok) throw new Error("Failed")
      await fetchFollowUps()
    } catch {
      toast({ title: "Error", description: "Failed to delete follow-up", variant: "destructive" })
    }
  }

  function formatDateTime(dt: string) {
    const d = new Date(dt)
    if (isNaN(d.getTime())) return dt
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const statusColors: Record<string, string> = {
    pending: "bg-blue-100 text-blue-700",
    completed: "bg-green-100 text-green-700",
    missed: "bg-red-100 text-red-700",
  }

  if (!entityId) return null

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
          <Clock className="h-4 w-4 text-gray-400" />
          Follow-Up Reminders
        </h3>
        <Button size="sm" variant="outline" onClick={() => setShowForm(!showForm)}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          Add Reminder
        </Button>
      </div>

      {showForm && (
        <div className="rounded border border-gray-100 bg-gray-50 p-3 space-y-3">
          <div>
            <Label className="text-xs">Note</Label>
            <Textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What should you follow up on?"
              className="text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Reminder Date</Label>
              <Input
                type="date"
                value={reminderDate}
                onChange={(e) => setReminderDate(e.target.value)}
                className="text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Reminder Time</Label>
              <Input
                type="time"
                value={reminderTime}
                onChange={(e) => setReminderTime(e.target.value)}
                className="text-sm"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button size="sm" onClick={handleCreate} disabled={saving}>
              {saving ? "Saving..." : "Schedule Reminder"}
            </Button>
          </div>
        </div>
      )}

      {followUps.length > 0 && (
        <div className="space-y-2">
          {followUps.map((f) => (
            <div key={f.id} className="flex items-center gap-3 rounded border border-gray-100 px-3 py-2 text-sm">
              <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[f.status] || "bg-gray-100 text-gray-700"}`}>
                {f.status}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-gray-800 truncate">{f.note || "No note"}</p>
                <p className="text-xs text-gray-400">{formatDateTime(f.reminder_datetime)}</p>
              </div>
              <div className="flex gap-1 shrink-0">
                {f.status === "pending" && (
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600" title="Mark completed" onClick={() => markCompleted(f.id)}>
                    <Check className="h-3.5 w-3.5" />
                  </Button>
                )}
                <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500" title="Delete" onClick={() => deleteFollowUp(f.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
