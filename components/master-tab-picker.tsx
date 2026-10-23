"use client"

import * as React from "react"
import { Check, ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

interface MasterTabMeta {
  label: string
  icon: React.ComponentType<{ className?: string }>
}

/** Searchable master picker; options are listed A→Z by label. */
export function MasterTabPicker({
  tabs,
  meta,
  value,
  onChange,
}: {
  tabs: string[]
  meta: Record<string, MasterTabMeta | undefined>
  value: string
  onChange: (tab: string) => void
}) {
  const [open, setOpen] = React.useState(false)

  const sorted = React.useMemo(
    () =>
      tabs
        .filter((t) => meta[t])
        .sort((a, b) => meta[a]!.label.localeCompare(meta[b]!.label, undefined, { sensitivity: "base" })),
    [tabs, meta],
  )

  const current = meta[value]
  const CurrentIcon = current?.icon

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-12 w-full justify-between rounded-xl border-slate-200 bg-white px-4 font-medium shadow-sm sm:w-72"
        >
          <span className="flex min-w-0 items-center gap-2">
            {CurrentIcon && <CurrentIcon className="h-3.5 w-3.5 shrink-0 text-slate-500" />}
            <span className="truncate">{current?.label ?? "Select master"}</span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] rounded-xl p-0"
        align="start"
        onWheel={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
      >
        <Command>
          <CommandInput placeholder="Search master..." />
          <CommandList className="max-h-[300px] overflow-y-auto overscroll-contain">
            <CommandEmpty>No master found.</CommandEmpty>
            <CommandGroup>
              {sorted.map((tab) => {
                const Icon = meta[tab]!.icon
                return (
                  <CommandItem
                    key={tab}
                    value={meta[tab]!.label}
                    className="cursor-pointer rounded-lg"
                    onSelect={() => {
                      onChange(tab)
                      setOpen(false)
                    }}
                  >
                    <Icon className="h-3.5 w-3.5 text-slate-500" />
                    <span className="flex-1 truncate">{meta[tab]!.label}</span>
                    <Check className={cn("h-4 w-4", value === tab ? "opacity-100" : "opacity-0")} />
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
