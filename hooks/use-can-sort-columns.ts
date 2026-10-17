"use client"

import { useAuth } from "@/hooks/use-auth"

/**
 * Column sorting (ascending / descending) is a per-user feature: admins always have it, everyone else
 * only when "Can sort columns" is ticked for them in Settings (features.can_sort_columns).
 */
export function useCanSortColumns(): boolean {
  const { isAdmin, isFeatureEnabled } = useAuth()
  return isAdmin || isFeatureEnabled("can_sort_columns")
}
