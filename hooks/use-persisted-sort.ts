import { useState, useCallback, useEffect, useRef } from "react"
import { useColumnPrefsServer, debouncedSaveColumnPref, type SortConfig } from "@/lib/column-prefs"

const SORT_PREFIX = "col_sort_"

function readSort(stageKey: string): SortConfig | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(SORT_PREFIX + stageKey)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed.field === "string" && (parsed.dir === "asc" || parsed.dir === "desc")) return parsed
    return null
  } catch {
    return null
  }
}

function writeSort(stageKey: string, sort: SortConfig | null): void {
  if (typeof window === "undefined") return
  try {
    if (sort) localStorage.setItem(SORT_PREFIX + stageKey, JSON.stringify(sort))
    else localStorage.removeItem(SORT_PREFIX + stageKey)
  } catch {}
}

/**
 * usePersistedSort
 *
 * Persists the user's column-sort choice (field + direction) per stage, the
 * same way useColumnOrder persists column order: localStorage for the instant
 * cache, users.features.column_prefs[stageKey].sort on the server for
 * cross-device/cross-login durability.
 *
 * @param stageKey    Unique key per stage/table — use the same key as
 *                    usePersistedColumns/useColumnOrder for that table.
 * @param defaultSort Sort applied on first visit (or if preferences are lost).
 */
export function usePersistedSort(
  stageKey: string,
  defaultSort: SortConfig | null = null
): [SortConfig | null, (sort: SortConfig | null) => void] {
  const [sort, setSortInternal] = useState<SortConfig | null>(() => readSort(stageKey) ?? defaultSort)

  const { userId, prefs, isReady } = useColumnPrefsServer()
  const hydratedRef = useRef(false)

  useEffect(() => {
    if (hydratedRef.current || !isReady) return
    hydratedRef.current = true
    const serverSort = prefs?.[stageKey]?.sort
    if (serverSort && typeof serverSort.field === "string") {
      setSortInternal(serverSort)
      writeSort(stageKey, serverSort)
    }
    // defaultSort is conceptually constant per stage; hydration runs once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, prefs, stageKey])

  const setSort = useCallback(
    (next: SortConfig | null) => {
      setSortInternal(next)
      writeSort(stageKey, next)
      if (userId) debouncedSaveColumnPref(userId, stageKey, "sort", next)
    },
    [stageKey, userId]
  )

  return [sort, setSort]
}
