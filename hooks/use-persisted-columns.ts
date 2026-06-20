/**
 * usePersistedColumns
 *
 * A production-ready custom React hook that persists the user's column-visibility
 * preferences for any workflow-stage table to the browser's localStorage.
 *
 * ─── HOW IT WORKS ────────────────────────────────────────────────────────────
 *  1. On first mount, the hook reads the saved value from localStorage under the
 *     key  `col_prefs_<stageKey>`.
 *  2. If a saved value exists and is valid (non-empty string array) it is used as
 *     the initial state — so the user sees exactly the columns they last chose.
 *  3. If no saved value exists (e.g. first visit) the provided `defaultColumns`
 *     are used instead.
 *  4. Whenever the returned setter is called, the new value is written to
 *     localStorage immediately and the React state is updated — keeping both
 *     in sync at all times.
 *
 * ─── USAGE ───────────────────────────────────────────────────────────────────
 *
 *  // In any page component, replace:
 *  //   const [visibleColumns, setVisibleColumns] = useState<string[]>([...defaults])
 *  // with:
 *  const [visibleColumns, setVisibleColumns] = usePersistedColumns(
 *    "make-invoice",           // unique key per workflow stage
 *    ["partySoDate", "orderNo", "customerName", "status"]  // fallback defaults
 *  )
 *
 *  // The setter works exactly like a normal React setState:
 *  setVisibleColumns(prev => checked ? [...prev, col.id] : prev.filter(id => id !== col.id))
 *
 * ─── STORAGE KEY CONVENTION ──────────────────────────────────────────────────
 *  localStorage key format:  col_prefs_<stageKey>
 *
 *  Recommended stageKey values (keep them stable — changing a key loses prefs):
 *    "make-invoice"      "check-invoice"     "gate-out"
 *    "material-receipt"  "damage-adjustment" "security-approval"
 *    "pre-approval"      "approval-of-order" "actual-dispatch"
 *    "dispatch-material"
 *
 * ─── PRODUCTION NOTES ────────────────────────────────────────────────────────
 *  • Safe in SSR/Next.js — localStorage access is guarded by typeof window check.
 *  • Safe against corrupt/stale data — invalid stored values fall back to defaults.
 *  • Zero external dependencies — uses only React hooks.
 *  • Per-user, per-browser persistence — no server round-trip needed.
 *  • To reset a user's preferences programmatically:
 *      localStorage.removeItem("col_prefs_make-invoice")
 *  • To wipe ALL column preferences at once:
 *      Object.keys(localStorage).filter(k => k.startsWith("col_prefs_")).forEach(k => localStorage.removeItem(k))
 */

import { useState, useCallback, useEffect, useRef, Dispatch, SetStateAction } from "react"
import { useColumnPrefsServer, debouncedSaveColumnPref } from "@/lib/column-prefs"

const STORAGE_PREFIX = "col_prefs_"

/**
 * Reconcile a saved VISIBLE-column list: keep exactly the user's saved choices,
 * only deduping (which guards downstream drag/sortable keys).
 *
 * We deliberately do NOT filter against `defaultColumns` (the default-VISIBLE
 * set) — a stage's toggle menu offers a much wider universe than its default
 * list (e.g. check-invoice defaults to ~8 columns but lets you toggle every
 * column up to that stage). Filtering here would silently drop any non-default
 * column the user enabled, so it would reappear correctly in-session but vanish
 * on reload. The user can only ever save ids that exist in the toggle menu, and
 * any id the current page can't render is already excluded at render time
 * (visible ∩ columnOrder), so keeping the saved ids as-is is both safe and
 * correct. We also do NOT append "new default" columns — otherwise a column the
 * user intentionally unchecked would get re-added, so hiding a default could
 * never persist.
 */
function mergeVisible(saved: string[]): string[] {
  const seen = new Set<string>()
  return saved.filter((id) => typeof id === "string" && !seen.has(id) && seen.add(id))
}

/**
 * Reads and validates a column preference array from localStorage.
 * Returns null if nothing is stored or the stored value is invalid.
 */
function readFromStorage(stageKey: string): string[] | null {
  if (typeof window === "undefined") return null          // SSR safety
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + stageKey)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    // Validate: must be a non-empty array of strings
    if (
      Array.isArray(parsed) &&
      parsed.length > 0 &&
      parsed.every((item) => typeof item === "string")
    ) {
      return parsed
    }
    return null
  } catch {
    return null   // JSON.parse failed — corrupt data, ignore
  }
}

/**
 * Writes a column preference array to localStorage.
 * Silently swallows errors (e.g. private browsing with storage disabled).
 */
function writeToStorage(stageKey: string, columns: string[]): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(STORAGE_PREFIX + stageKey, JSON.stringify(columns))
  } catch {
    // Storage full or disabled — silently continue, UI still works
  }
}

/**
 * usePersistedColumns
 *
 * @param stageKey       Unique identifier for this workflow stage (e.g. "make-invoice").
 *                       This becomes the localStorage key suffix.
 * @param defaultColumns The columns to show on first visit (or if preferences are lost).
 * @returns              [visibleColumns, setVisibleColumns] — a drop-in replacement
 *                       for useState<string[]>.
 */
export function usePersistedColumns(
  stageKey: string,
  defaultColumns: string[]
): [string[], Dispatch<SetStateAction<string[]>>] {
  const [visibleColumns, setVisibleColumnsInternal] = useState<string[]>(() => {
    // localStorage acts as an instant cache so there's no flash of defaults
    // before the per-user server value hydrates.
    const saved = readFromStorage(stageKey)
    return saved ? mergeVisible(saved) : defaultColumns
  })

  // ── Hydrate from the logged-in user's server-saved prefs (once) ──────────
  const { userId, prefs, isReady } = useColumnPrefsServer()
  const hydratedRef = useRef(false)

  useEffect(() => {
    if (hydratedRef.current || !isReady) return
    hydratedRef.current = true
    const serverVisible = prefs?.[stageKey]?.visible
    if (Array.isArray(serverVisible) && serverVisible.length > 0) {
      const merged = mergeVisible(serverVisible)
      setVisibleColumnsInternal(merged)
      writeToStorage(stageKey, merged) // refresh the cache to match the server
    }
    // defaultColumns is conceptually constant per stage; hydration runs once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, prefs, stageKey])

  // Wrap the setter so every update is mirrored to localStorage AND (debounced)
  // to the user's server prefs.
  const setVisibleColumns: Dispatch<SetStateAction<string[]>> = useCallback(
    (value) => {
      setVisibleColumnsInternal((prev) => {
        const next = typeof value === "function" ? value(prev) : value
        writeToStorage(stageKey, next)
        if (userId) debouncedSaveColumnPref(userId, stageKey, "visible", next)
        return next
      })
    },
    [stageKey, userId]
  )

  return [visibleColumns, setVisibleColumns]
}
