"use client"

/**
 * usePersistedFilters
 *
 * Remembers a stage table's "view state" across a page refresh, with two scopes
 * (the standard ERP split between *layout* and *data-narrowing filters*):
 *
 *  - PERMANENT keys (listed in `opts.permanentKeys`): layout-like choices - status
 *    segmented buttons, active tab, depot tab, sort. Kept in localStorage and in
 *    the logged-in user's server prefs (users.features.column_prefs[stage].filters),
 *    so they follow the user across logins and devices.
 *  - SESSION keys (everything else): quick search, customer/oil/vehicle selects,
 *    column searches, absolute date ranges. Kept in sessionStorage only: they
 *    survive a refresh but are cleared when the tab is closed / a new session
 *    starts. A stale filter must never silently hide today's pending work.
 *
 * Default is SESSION (safe). Opt a key into permanent storage explicitly.
 *
 * The page's Refresh button must only reload data - never call `reset`.
 * `reset` (the toolbar's Reset button) returns to the defaults and persists them.
 */

import { useState, useCallback, useEffect, useRef } from "react"
import { useColumnPrefsServer, debouncedSaveColumnPref } from "@/lib/column-prefs"

const PERM_PREFIX = "tbl_filters_"
const SESSION_PREFIX = "tbl_filters_s_"

function readStore(store: "local" | "session", key: string): any {
  if (typeof window === "undefined") return null
  try {
    const s = store === "local" ? localStorage : sessionStorage
    const raw = s.getItem((store === "local" ? PERM_PREFIX : SESSION_PREFIX) + key)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

function writeStore(store: "local" | "session", key: string, value: object): void {
  if (typeof window === "undefined") return
  try {
    const s = store === "local" ? localStorage : sessionStorage
    s.setItem((store === "local" ? PERM_PREFIX : SESSION_PREFIX) + key, JSON.stringify(value))
  } catch {}
}

/** Take saved values for `keys` only, and only when their type matches the default's type. */
function pickKeys<T extends object>(base: T, saved: any, keys: string[]): T {
  const out: any = { ...base }
  if (!saved) return out
  for (const k of keys) {
    if (saved[k] !== undefined && typeof saved[k] === typeof (base as any)[k]) out[k] = saved[k]
  }
  return out
}

function subset(obj: any, keys: string[]) {
  const o: any = {}
  for (const k of keys) o[k] = obj[k]
  return o
}

export function usePersistedFilters<T extends Record<string, any>>(
  /** null = no persistence (plain state). */
  stageKey: string | null,
  defaults: T,
  opts?: { permanentKeys?: (keyof T & string)[] }
): [T, (patch: Partial<T> | ((prev: T) => Partial<T>)) => void, () => void] {
  const defaultsRef = useRef(defaults)
  const allKeys = Object.keys(defaults)
  const permKeys = (opts?.permanentKeys ?? []).filter((k) => allKeys.includes(k)) as string[]
  const sessKeys = allKeys.filter((k) => !permKeys.includes(k))
  const permRef = useRef(permKeys)
  const sessRef = useRef(sessKeys)

  const [state, setState] = useState<T>(() => {
    if (!stageKey) return defaults
    const withPerm = pickKeys(defaults, readStore("local", stageKey), permKeys)
    return pickKeys(withPerm, readStore("session", stageKey), sessKeys)
  })

  const { userId, prefs, isReady } = useColumnPrefsServer()
  const hydratedRef = useRef(false)

  useEffect(() => {
    if (hydratedRef.current || !isReady || !stageKey) return
    hydratedRef.current = true
    const server = prefs?.[stageKey]?.filters
    if (server && typeof server === "object" && permRef.current.length > 0) {
      setState((prev) => {
        const merged = pickKeys(prev, server, permRef.current)
        writeStore("local", stageKey, subset(merged, permRef.current))
        return merged
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, prefs, stageKey])

  const persist = useCallback(
    (next: T) => {
      if (!stageKey) return
      if (permRef.current.length > 0) {
        const perm = subset(next, permRef.current)
        writeStore("local", stageKey, perm)
        if (userId) debouncedSaveColumnPref(userId, stageKey, "filters", perm)
      }
      if (sessRef.current.length > 0) writeStore("session", stageKey, subset(next, sessRef.current))
    },
    [stageKey, userId]
  )

  const patch = useCallback(
    (p: Partial<T> | ((prev: T) => Partial<T>)) => {
      setState((prev) => {
        const next = { ...prev, ...(typeof p === "function" ? p(prev) : p) }
        persist(next)
        return next
      })
    },
    [persist]
  )

  const reset = useCallback(() => {
    const next = defaultsRef.current
    setState(next)
    persist(next)
  }, [persist])

  return [state, patch, reset]
}
