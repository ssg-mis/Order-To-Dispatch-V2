import { useState, useCallback, useEffect, useRef } from "react"
import { useColumnPrefsServer, debouncedSaveColumnPref } from "@/lib/column-prefs"

const ORDER_PREFIX = "col_order_"

/** Merge saved order with current defaults: keep saved order, append new columns, drop removed. */
function mergeOrder(saved: string[], defaultOrder: string[]): string[] {
  const defaultSet = new Set(defaultOrder)
  const seen = new Set<string>()
  // Dedupe while preserving order — duplicate ids would crash the column
  // drag/sortable context (duplicate React keys).
  const keptSaved = saved.filter((id) => defaultSet.has(id) && !seen.has(id) && seen.add(id))
  const newCols = defaultOrder.filter((id) => !seen.has(id) && seen.add(id))
  return [...keptSaved, ...newCols]
}

function readOrder(stageKey: string): string[] | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(ORDER_PREFIX + stageKey)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed) && parsed.every((s: unknown) => typeof s === "string")) return parsed
    return null
  } catch {
    return null
  }
}

function writeOrder(stageKey: string, order: string[]): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(ORDER_PREFIX + stageKey, JSON.stringify(order))
  } catch {}
}

/**
 * useColumnOrder
 *
 * Persists the user's column ordering preferences to localStorage.
 * Mirrors the pattern of usePersistedColumns but tracks ORDER, not visibility.
 *
 * @param stageKey     Unique key per stage (e.g. "pre-approval"). Use the same key as usePersistedColumns.
 * @param defaultOrder Full ordered list of column IDs for this stage.
 * @returns            [columnOrder, setColumnOrder]
 */
export function useColumnOrder(
  stageKey: string,
  defaultOrder: string[]
): [string[], (order: string[]) => void] {
  const [columnOrder, setColumnOrderInternal] = useState<string[]>(() => {
    // localStorage = instant cache; server value hydrates in just after.
    const saved = readOrder(stageKey)
    return saved ? mergeOrder(saved, defaultOrder) : defaultOrder
  })

  // ── Hydrate from the logged-in user's server-saved prefs (once) ──────────
  const { userId, prefs, isReady } = useColumnPrefsServer()
  const hydratedRef = useRef(false)

  useEffect(() => {
    if (hydratedRef.current || !isReady) return
    hydratedRef.current = true
    const serverOrder = prefs?.[stageKey]?.order
    if (Array.isArray(serverOrder) && serverOrder.length > 0) {
      const merged = mergeOrder(serverOrder, defaultOrder)
      setColumnOrderInternal(merged)
      writeOrder(stageKey, merged)
    }
    // defaultOrder is conceptually constant per stage; hydration runs once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, prefs, stageKey])

  const setColumnOrder = useCallback(
    (order: string[]) => {
      setColumnOrderInternal(order)
      writeOrder(stageKey, order)
      if (userId) debouncedSaveColumnPref(userId, stageKey, "order", order)
    },
    [stageKey, userId]
  )

  return [columnOrder, setColumnOrder]
}
