"use client"

import { useState, useRef, useEffect } from "react"
import { ChevronDown, X, Check } from "lucide-react"

interface MultiSelectFilterProps {
  label: string
  options: string[]
  selected: string[]
  onChange: (selected: string[]) => void
  placeholder?: string
  className?: string
}

export function MultiSelectFilter({
  label,
  options,
  selected,
  onChange,
  placeholder = "All",
  className = "",
}: MultiSelectFilterProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  function toggle(value: string) {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value))
    } else {
      onChange([...selected, value])
    }
  }

  const displayText = selected.length === 0 ? placeholder : selected.length === 1 ? selected[0] : `${selected.length} selected`

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 h-8 px-2.5 text-xs border border-gray-200 rounded-md bg-white hover:bg-gray-50 transition-colors w-full min-w-[120px]"
      >
        <span className="text-gray-500 font-medium shrink-0">{label}:</span>
        <span className="truncate text-gray-700 flex-1 text-left">{displayText}</span>
        {selected.length > 0 && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onChange([]) }}
            className="shrink-0 text-gray-400 hover:text-gray-600"
          >
            <X className="h-3 w-3" />
          </button>
        )}
        <ChevronDown className={`h-3 w-3 shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-gray-200 rounded-md shadow-lg min-w-[180px] max-h-60 overflow-y-auto">
          {options.length === 0 && (
            <div className="px-3 py-2 text-xs text-gray-400">No options</div>
          )}
          {options.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => toggle(option)}
              className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-left hover:bg-gray-50 transition-colors"
            >
              <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                selected.includes(option) ? "bg-orange-500 border-orange-500" : "border-gray-300"
              }`}>
                {selected.includes(option) && <Check className="h-2.5 w-2.5 text-white" />}
              </div>
              <span className="truncate">{option}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
