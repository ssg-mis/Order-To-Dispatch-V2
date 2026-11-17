"use client"

import * as React from "react"
import { Check, ChevronDown } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

/**
 * Single-choice dropdown where clicking the already-selected option deselects it
 * (Radix <Select> cannot do that - it never fires for the current value).
 */
export function ToggleSelect({
  value,
  onChange,
  options,
  placeholder = "Select",
  className,
}: {
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  placeholder?: string
  className?: string
}) {
  const [open, setOpen] = React.useState(false)
  const selected = options.find(o => o.value === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "border-input focus-visible:border-ring focus-visible:ring-ring/50 flex h-9 w-full items-center justify-between gap-2 rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:ring-[3px]",
            !selected && "text-muted-foreground",
            className
          )}
        >
          <span className="truncate">{selected ? selected.label : placeholder}</span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-(--radix-popover-trigger-width) p-1">
        <ul role="listbox" className="max-h-64 overflow-y-auto">
          {options.map(o => {
            const isSelected = o.value === value
            return (
              <li key={o.value} role="option" aria-selected={isSelected}>
                <button
                  type="button"
                  onClick={() => { onChange(isSelected ? "" : o.value); setOpen(false) }}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent focus-visible:bg-accent focus-visible:outline-none",
                    isSelected && "bg-accent/60 font-medium"
                  )}
                >
                  <span>{o.label}</span>
                  {isSelected && <Check className="h-4 w-4 shrink-0" />}
                </button>
              </li>
            )
          })}
        </ul>
      </PopoverContent>
    </Popover>
  )
}
