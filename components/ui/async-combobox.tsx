"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Loader2, Lock, Search } from "lucide-react"
import { useInView } from "react-intersection-observer"

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

export interface AsyncComboboxOption {
  value: string
  label: string
  dropdownLabel?: React.ReactNode
  original?: any
}

interface AsyncComboboxProps {
  fetchOptions: (search: string, page: number) => Promise<{
    options: AsyncComboboxOption[]
    hasMore: boolean
  }>
  value?: string
  onValueChange?: (value: string) => void
  onSelectOption?: (option: any) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  disabled?: boolean
  /** Shown as a lock icon + tooltip when the field is disabled because the value is fixed (not merely unavailable). */
  lockedHint?: string
  className?: string
  debounceItems?: number
  /** Optional block rendered above the search box (e.g. an "Add ..." button); gets a function that closes the dropdown. */
  headerAction?: (close: () => void) => React.ReactNode
  /** Optional per-row action rendered at the right of each option (e.g. an Edit button). */
  renderItemAction?: (option: AsyncComboboxOption, close: () => void) => React.ReactNode
  /** Return false to stop an option from being selected (the dropdown stays open). */
  onBeforeSelect?: (option: AsyncComboboxOption) => boolean
  /** Change this value to reload the options (e.g. after a record is added or edited). */
  reloadToken?: number
  /** Keep the dropdown pinned under its trigger (no flipping/shifting) and close it when the page is scrolled. */
  fixedPosition?: boolean
}

export function AsyncCombobox({
  fetchOptions,
  value,
  onValueChange,
  onSelectOption,
  placeholder = "Select option...",
  searchPlaceholder = "Search...",
  emptyText = "No option found.",
  disabled = false,
  lockedHint,
  className,
  debounceItems = 300,
  headerAction,
  renderItemAction,
  onBeforeSelect,
  reloadToken,
  fixedPosition = false,
}: AsyncComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const [options, setOptions] = React.useState<AsyncComboboxOption[]>([])
  const [page, setPage] = React.useState(1)
  const [hasMore, setHasMore] = React.useState(true)
  const [isLoading, setIsLoading] = React.useState(false)
  const [isInitialLoading, setIsInitialLoading] = React.useState(true)
  
  const { ref: scrollRef, inView } = useInView({
    threshold: 0,
  })

  // Fixed mode: close the dropdown when the page is scrolled (scrolling inside the list itself is fine)
  React.useEffect(() => {
    if (!fixedPosition || !open) return
    const handleScroll = (event: Event) => {
      const target = event.target as HTMLElement | null
      if (
        target &&
        target.closest &&
        (target.closest('[data-slot="popover-content"]') ||
          target.closest('[data-radix-popper-content-wrapper]') ||
          target.closest('[cmdk-list]'))
      ) {
        return
      }
      setOpen(false)
    }
    window.addEventListener('scroll', handleScroll, { capture: true, passive: true })
    return () => window.removeEventListener('scroll', handleScroll, { capture: true })
  }, [fixedPosition, open])

  // Selected label state to show current value even before options are loaded
  const [selectedLabel, setSelectedLabel] = React.useState<string>(value || "")

  const loadOptions = React.useCallback(async (currentSearch: string, currentPage: number, isNewSearch: boolean) => {
    setIsLoading(true)
    try {
      const result = await fetchOptions(currentSearch, currentPage)
      // De-duplicate by value: overlapping loads (initial + scroll) or a backend join can return
      // the same record twice, which breaks React's unique-key rule for the list.
      setOptions(prev => {
        const seen = new Set<string>(isNewSearch ? [] : prev.map(o => o.value))
        const fresh = result.options.filter(o => {
          if (seen.has(o.value)) return false
          seen.add(o.value)
          return true
        })
        return isNewSearch ? fresh : [...prev, ...fresh]
      })
      setHasMore(result.hasMore)
      
      // If we find the current value in the new options, update the label
      if (value) {
        const found = result.options.find(o => o.value === value)
        if (found) setSelectedLabel(found.label)
      }
    } catch (error) {
      console.error("Failed to fetch options:", error)
    } finally {
      setIsLoading(false)
      setIsInitialLoading(false)
    }
  }, [fetchOptions, value])

  // Load initial options if value is provided even before popover is opened
  React.useEffect(() => {
    if (value && options.length === 0) {
      loadOptions("", 1, true)
    }
  }, [value, options.length, loadOptions])

  // Initial load
  React.useEffect(() => {
    if (open) {
      setPage(1)
      loadOptions(search, 1, true)
    }
  }, [open, search, loadOptions])

  // Reload when the parent signals the underlying data changed. The very first
  // value is skipped (nothing has changed yet); the open-effect covers an open list.
  const lastReloadToken = React.useRef(reloadToken)
  React.useEffect(() => {
    if (lastReloadToken.current === reloadToken) return
    lastReloadToken.current = reloadToken
    setPage(1)
    loadOptions(search, 1, true)
  }, [reloadToken, search, loadOptions])

  // Load more when scrolling
  React.useEffect(() => {
    if (inView && hasMore && !isLoading && open) {
      const nextPage = page + 1
      setPage(nextPage)
      loadOptions(search, nextPage, false)
    }
  }, [inView, hasMore, isLoading, search, page, open, loadOptions])

  // Update selected label when value changes locally if possible
  React.useEffect(() => {
    if (value) {
      const found = options.find(o => o.value === value)
      if (found) setSelectedLabel(found.label)
    } else {
      setSelectedLabel("")
    }
  }, [value, options])

  const popover = (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal",
            !value && "text-muted-foreground",
            className
          )}
        >
          <span className="truncate">
            {selectedLabel || placeholder}
          </span>
          {disabled && lockedHint ? (
            <Lock className="ml-2 h-3.5 w-3.5 shrink-0 text-slate-400" />
          ) : (
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] min-w-[320px] p-0 shadow-lg border-slate-200 rounded-xl"
        align="start"
        {...(fixedPosition
          ? {
              side: "bottom" as const,
              sideOffset: 4,
              avoidCollisions: false,
              sticky: "always" as const,
              hideWhenDetached: true,
              updatePositionStrategy: "always" as const,
            }
          : {})}
      >
        {headerAction && (
          <div className="p-2 border-b border-slate-100 bg-slate-50/60">
            {headerAction(() => setOpen(false))}
          </div>
        )}
        <Command shouldFilter={false}>
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
              className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
            />
          </div>
          <CommandList
            className="max-h-[300px] overflow-y-auto"
            onWheel={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
          >
            <CommandEmpty>
              {isLoading && page === 1 ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  <span>Loading...</span>
                </div>
              ) : (
                emptyText
              )}
            </CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  onSelect={(currentValue) => {
                    const isDeselect = currentValue === value
                    const selected = options.find(o => o.value === currentValue)
                    if (selected && !isDeselect && onBeforeSelect && onBeforeSelect(selected) === false) return
                    onValueChange?.(isDeselect ? "" : currentValue)
                    if (isDeselect) {
                      onSelectOption?.(null)
                      setSelectedLabel("")
                    } else if (selected) {
                      onSelectOption?.(selected)
                    }
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4 shrink-0",
                      value === option.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="min-w-0 flex-1">{option.dropdownLabel || option.label}</div>
                  {renderItemAction && (
                    <div className="ml-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                      {renderItemAction(option, () => setOpen(false))}
                    </div>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
            {hasMore && (
              <div
                ref={scrollRef}
                className="flex items-center justify-center py-4 border-t"
              >
                {isLoading && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
              </div>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )

  // Locked (fixed-by-design) fields get a not-allowed cursor and an explanatory tooltip; the
  // wrapper is only added then, so every other combobox renders exactly as before.
  return disabled && lockedHint ? (
    <span className="block w-full cursor-not-allowed" title={lockedHint}>
      {popover}
    </span>
  ) : (
    popover
  )
}
