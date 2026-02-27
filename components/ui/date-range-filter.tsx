"use client"

import { useMemo } from "react"
import { CalendarDays } from "lucide-react"
import type { DateRange } from "react-day-picker"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

export type DateFilterValue = {
  from_date: string
  to_date: string
}

type DateRangeFilterProps = {
  value: DateFilterValue
  onChange: (nextValue: DateFilterValue) => void
  className?: string
}

function parseDate(value: string): Date | undefined {
  if (!value) return undefined

  const parts = value.split("-")
  if (parts.length !== 3) return undefined

  const year = Number(parts[0])
  const month = Number(parts[1])
  const day = Number(parts[2])

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return undefined
  }

  return new Date(year, month - 1, day)
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function formatDateLabel(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

function formatRangeLabel(range: DateRange | undefined): string {
  if (!range?.from && !range?.to) {
    return "Select date range"
  }

  if (range.from && range.to) {
    return `${formatDateLabel(range.from)} – ${formatDateLabel(range.to)}`
  }

  if (range.from) {
    return `${formatDateLabel(range.from)} – ...`
  }

  return range.to ? formatDateLabel(range.to) : "Select date range"
}

export function DateRangeFilter({ value, onChange, className }: DateRangeFilterProps) {
  const selectedRange = useMemo<DateRange | undefined>(() => {
    const from = parseDate(value.from_date)
    const to = parseDate(value.to_date)

    if (!from && !to) return undefined
    return { from, to }
  }, [value.from_date, value.to_date])

  const label = formatRangeLabel(selectedRange)

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn("h-10 w-[280px] justify-start px-3 text-sm font-normal", className)}
        >
          <CalendarDays className="mr-2 h-4 w-4 shrink-0" />
          <span className="truncate">{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto p-0">
        <Calendar
          mode="range"
          numberOfMonths={2}
          selected={selectedRange}
          onSelect={(range) => {
            onChange({
              from_date: range?.from ? toIsoDate(range.from) : "",
              to_date: range?.to ? toIsoDate(range.to) : "",
            })
          }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  )
}
