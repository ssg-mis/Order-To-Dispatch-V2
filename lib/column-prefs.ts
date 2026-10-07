"use client"

/**
 * Shared server-sync layer for per-user column preferences.
 *
 * Column visibility (usePersistedColumns) and column order (useColumnOrder) are
 * two separate hooks but persist to the SAME server record
 * (login.features.column_prefs[stageKey] = { visible, order }). This module:
 *
 *  - fetches that record ONCE per logged-in user (React Query dedupes the call
 *    across both hooks on the same page), and
 *  - debounces saves per (user, stage, field) so rapid toggling/reordering
 *    results in one PUT, and the visible/order slices never clobber each other
 *    (the backend deep-merges, and we only send the field that changed).
 *
 * localStorage remains the instant cache (handled in the hooks) so there is no
 * flash of default columns before the server value hydrates; when there is no
 * logged-in user, everything degrades gracefully to localStorage-only.
 */

import { useQuery, useQueryClient, QueryClient } from "@tanstack/react-query"
import { useAuth } from "@/hooks/use-auth"
import { userApi } from "@/lib/api-service"

let _globalQueryClient: QueryClient | null = null;

export type SortConfig = { field: string; dir: "asc" | "desc" }
export type StagePrefs = { visible?: string[]; order?: string[]; sort?: SortConfig | null; filters?: Record<string, any> | null }
export type ColumnPrefsMap = Record<string, StagePrefs>
type PrefField = "visible" | "order" | "sort" | "filters"
type PrefValue = string[] | SortConfig | Record<string, any> | null

/**
 * Loads the current user's column-prefs map. Shared (deduped) across hooks via
 * the ["column-prefs", userId] query key.
 */
export function useColumnPrefsServer() {
  const { user, isLoading } = useAuth()
  const userId = user?.id
  const queryClient = useQueryClient()
  
  if (typeof window !== "undefined") {
    _globalQueryClient = queryClient
  }

  const query = useQuery({
    queryKey: ["column-prefs", userId],
    queryFn: async () => {
      const res = await userApi.getColumnPrefs(userId as number)
      return (res?.data || {}) as ColumnPrefsMap
    },
    enabled: !!userId,
    staleTime: 10 * 60 * 1000,
  })

  // Readiness must NOT be true while auth is still resolving — otherwise the
  // consumer hydrates (once) during the transient userId=undefined window and
  // then ignores the real server data when it arrives. Once auth settles:
  //  - no user  -> ready immediately (pure-localStorage mode)
  //  - user     -> ready only after the prefs fetch completes
  const isReady = isLoading ? false : !userId ? true : query.isFetched

  return {
    userId,
    prefs: (query.data as ColumnPrefsMap | undefined) || null,
    isReady,
  }
}

const timers = new Map<string, ReturnType<typeof setTimeout>>()
const pending = new Map<string, { userId: number; stageKey: string; field: PrefField; value: PrefValue }>()
const DEBOUNCE_MS = 600

/**
 * Immediately sends a pending save (bypassing the remaining debounce delay)
 * and clears its timer/queue entry. Used both by the normal debounce timeout
 * and by the unload/visibility flush below.
 */
export function flushSave(key: string, keepalive: boolean): Promise<any> | void {
  const entry = pending.get(key)
  if (!entry) return
  pending.delete(key)
  const timer = timers.get(key)
  if (timer) {
    clearTimeout(timer)
    timers.delete(key)
  }
  return userApi
    .saveColumnPrefs(entry.userId, entry.stageKey, { [entry.field]: entry.value }, { keepalive })
    .catch(() => {})
}

/**
 * Debounced, fire-and-forget save of one field of one stage's prefs.
 * Failures are swallowed — the localStorage cache keeps the UI correct.
 */
export function debouncedSaveColumnPref(
  userId: number,
  stageKey: string,
  field: PrefField,
  value: PrefValue,
): void {
  const key = `${userId}:${stageKey}:${field}`
  pending.set(key, { userId, stageKey, field, value })
  
  // Optimistically update the React Query cache so client-side navigation
  // doesn't hydrate a stale server value over our correct localStorage value.
  if (_globalQueryClient) {
    _globalQueryClient.setQueryData(["column-prefs", userId], (old: ColumnPrefsMap | undefined) => {
      const current = old || {}
      const stagePrefs = current[stageKey] || {}
      return {
        ...current,
        [stageKey]: {
          ...stagePrefs,
          [field]: value
        }
      }
    })
  }

  const existing = timers.get(key)
  if (existing) clearTimeout(existing)
  timers.set(key, setTimeout(() => flushSave(key, false), DEBOUNCE_MS))
}

// Refreshing/closing the tab within the debounce window would otherwise drop
// the pending save (the setTimeout never fires), so the server keeps a stale
// value that then overwrites the correct localStorage state on next load's
// hydration. Flush any pending saves immediately (with keepalive so the
// request survives the page teardown) whenever the page is about to go away.
export const flushAllColumnPrefs = async () => {
  const promises = Array.from(pending.keys()).map(key => flushSave(key, true))
  await Promise.all(promises)
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", flushAllColumnPrefs)
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushAllColumnPrefs()
  })
}
