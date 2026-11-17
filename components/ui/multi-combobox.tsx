"use client"

import * as React from "react"
import { Check, ChevronsUpDown, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export interface MultiComboboxOption {
  value: string
  label: string
}

interface MultiComboboxProps {
  options: MultiComboboxOption[]
  values: string[]
  onValuesChange: (values: string[]) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  disabled?: boolean
  className?: string
  /** Show a chip per selected item below the trigger (default true). */
  showSelectedList?: boolean
}

export function MultiCombobox({
  options,
  values,
  onValuesChange,
  placeholder = "Select options...",
  searchPlaceholder = "Search...",
  emptyText = "No option found.",
  disabled = false,
  className,
  showSelectedList = true,
}: MultiComboboxProps) {
  const [open, setOpen] = React.useState(false)

  const selectedOptions = options.filter((o) => values.includes(o.value))

  const toggle = (value: string) => {
    onValuesChange(values.includes(value) ? values.filter((v) => v !== value) : [...values, value])
  }

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn(
              "w-full justify-between font-normal",
              values.length === 0 && "text-muted-foreground",
              className
            )}
          >
            <span className="min-w-0 flex-1 truncate text-left">
              {values.length === 0 ? placeholder : `${values.length} selected`}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="p-0"
          style={{ width: "var(--radix-popover-trigger-width)" }}
          align="start"
          onWheel={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
        >
          <Command>
            <CommandInput placeholder={searchPlaceholder} />
            <CommandList className="max-h-[260px] overflow-y-auto overscroll-contain p-1.5">
              <CommandEmpty>{emptyText}</CommandEmpty>
              <CommandGroup className="p-0">
                {options.map((option) => {
                  const checked = values.includes(option.value)
                  return (
                    <CommandItem
                      key={option.value}
                      value={option.label}
                      onSelect={() => toggle(option.value)}
                      className={cn(
                        "gap-2.5 rounded-md px-2.5 py-2 text-[13px] text-slate-700 data-[selected=true]:bg-slate-100 data-[selected=true]:text-slate-900",
                        checked && "bg-emerald-50/70 font-medium text-emerald-900 data-[selected=true]:bg-emerald-100/70 data-[selected=true]:text-emerald-900"
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border transition-colors",
                          checked ? "border-emerald-600 bg-emerald-600" : "border-slate-300 bg-white"
                        )}
                      >
                        {checked && <Check className="size-3 text-white" strokeWidth={3.5} />}
                      </span>
                      <span className="truncate">{option.label}</span>
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            </CommandList>
            <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/70 px-3 py-1.5 text-[11px] text-slate-500">
              <span>{values.length} selected</span>
              {values.length > 0 && (
                <button
                  type="button"
                  onClick={() => onValuesChange([])}
                  className="font-semibold text-emerald-700 hover:text-emerald-800 hover:underline"
                >
                  Clear all
                </button>
              )}
            </div>
          </Command>
        </PopoverContent>
      </Popover>

      {showSelectedList && selectedOptions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedOptions.map((o) => (
            <span
              key={o.value}
              className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800"
            >
              {o.label}
              {!disabled && (
                <button type="button" onClick={() => toggle(o.value)} className="rounded-full hover:bg-emerald-100" aria-label={`Remove ${o.label}`}>
                  <X className="h-3 w-3" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
