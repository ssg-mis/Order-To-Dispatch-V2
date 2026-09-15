"use client"

import * as React from "react"
import { ChevronsUpDown, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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

  const toggleValue = (val: string) => {
    onValuesChange(values.includes(val) ? values.filter((v) => v !== val) : [...values, val])
  }

  const selected = options.filter((o) => values.includes(o.value))

  return (
    <div className="space-y-1.5">
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
          className="w-full p-0"
          align="start"
          onWheel={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
        >
          <Command>
            <CommandInput placeholder={searchPlaceholder} />
            <CommandList className="max-h-[300px] overflow-y-auto overscroll-contain">
              <CommandEmpty>{emptyText}</CommandEmpty>
              <CommandGroup>
                {options.map((option, index) => {
                  const checked = values.includes(option.value)
                  return (
                    <CommandItem
                      key={`${option.value}-${index}`}
                      value={option.label ? `${option.label} ${option.value}` : option.value}
                      onSelect={() => toggleValue(option.value)}
                      className="gap-2"
                    >
                      <Checkbox checked={checked} className="shrink-0 pointer-events-none" />
                      <span>{option.label}</span>
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {showSelectedList && selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((option) => (
            <span
              key={option.value}
              className="inline-flex items-center gap-1 text-xs font-medium text-blue-900 bg-blue-50 border border-blue-200 rounded-full pl-2.5 pr-1.5 py-1"
            >
              {option.label}
              <button
                type="button"
                onClick={() => toggleValue(option.value)}
                className="rounded-full p-0.5 hover:bg-blue-200/60 transition-colors"
                aria-label={`Remove ${option.label}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
