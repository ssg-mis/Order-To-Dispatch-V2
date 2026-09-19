"use client"

/**
 * Shared Customer/Depot dropdown formatting + fetch helpers for the Order
 * Punch create and modify forms (Section 10 of the Order Punch spec):
 *   - Customer dropdown label: Name on its own line, "City (State short) · GST · Mobile · Contact Person" as muted subtext
 *   - Searchable across all of those fields (server-side, via customerApi's
 *     existing masterLookup searchColumns - see customerService.getAllCustomers)
 *   - Customer list filtered by the selected Depot (Dispatch From), via customerApi's
 *     existing depot_id filter (customer_depot_tags)
 *
 * Centralized here (not duplicated per-page) since both the create form
 * (app/order-punch/create) and the Modify panel (app/order-punch/[id]) need the
 * exact same dropdown behavior.
 */

import type { ReactNode } from "react"
import { customerApi, depotApi } from "@/lib/api-service"

export type CustomerDropdownOption = {
  value: string
  label: string
  dropdownLabel: ReactNode
  original: any
}

/** City isn't its own column on `customers` (only on customer_addresses) - the
 * best-effort fallback used across this app (see commitment-punch's identical
 * approach) is the last comma-separated segment of address_line_1. */
function guessCity(customer: any): string {
  const addr1 = customer.address_line_1 || ""
  if (!addr1) return ""
  const parts = addr1.split(",")
  return parts[parts.length - 1]?.trim() || ""
}

export function buildCustomerDropdownOption(c: any): CustomerDropdownOption {
  const city = guessCity(c)
  // Prefer the real GST short state name (states.short_name, joined server-side
  // in customerService.getAllCustomers) over a guessed 2-letter fallback.
  const stateShort = c.state_short_name || (c.state ? String(c.state).substring(0, 2).toUpperCase() : "")
  const cityState = [city, stateShort ? `(${stateShort})` : ""].filter(Boolean).join(" ")

  const metaParts = [cityState, c.gstin, c.contact, c.contact_person].filter(Boolean)
  const label = [c.customer_name, ...metaParts].join(" · ")

  return {
    // Same composite-key convention used across the app's order forms
    // (customer_name is not guaranteed unique on its own).
    // Appending ID to ensure uniqueness for React keys.
    value: `${c.customer_name}|${c.gstin || ""}|${c.id}`,
    label,
    dropdownLabel: (
      <div className="flex flex-col min-w-0 py-0.5 text-left">
        <span className="font-medium text-slate-800 truncate">{c.customer_name}</span>
        {metaParts.length > 0 && (
          <span className="text-xs text-slate-500 truncate">{metaParts.join(" · ")}</span>
        )}
      </div>
    ),
    original: c,
  }
}

export async function fetchCustomerDropdownOptions(
  search: string,
  page: number,
  depotId?: number | null,
  limit = 20
): Promise<{ options: CustomerDropdownOption[]; hasMore: boolean }> {
  // depot_id is omitted entirely (not passed as undefined) - URLSearchParams
  // stringifies an undefined value as the literal text "undefined", which the
  // backend would then try to parseInt and filter on.
  const params: Record<string, any> = { search, page, limit }
  if (depotId != null) params.depot_id = depotId
  const res = await customerApi.getAll(params)
  const list = res.success ? (res.data.customers || []) : []
  const total = res.data?.pagination?.total || 0
  return {
    options: list.map(buildCustomerDropdownOption),
    hasMore: list.length + (page - 1) * limit < total,
  }
}

export async function fetchDepotDropdownOptions(
  search: string,
  page: number,
  limit = 20
): Promise<{ options: { value: string; label: string; original: any }[]; hasMore: boolean }> {
  const res = await depotApi.getAll({ search, page, limit })
  const list = res.success ? (res.data.depots || []) : []
  const total = res.data?.pagination?.total || 0
  return {
    options: list.map((d: any) => ({ value: d.depot_name, label: d.depot_name, original: d })),
    hasMore: list.length + (page - 1) * limit < total,
  }
}
