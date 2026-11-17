import type { StateInfo } from "@/hooks/use-states-map"

/**
 * The state of a depot / customer, read ONLY from master data (never guessed):
 *   1. the `state` text on the record,
 *   2. the States master through `state_id`,
 *   3. the first two digits of its GSTIN (the GST state code) looked up in the States master.
 * Returns "" when none of them is available.
 */
export function resolveStateName(
  src: { state?: string | null; state_id?: number | null; gstin?: string | null } | null | undefined,
  statesById: Map<number, StateInfo>
): string {
  if (!src) return ""
  const text = (src.state || "").trim()
  if (text) return text
  if (src.state_id != null) {
    const byId = statesById.get(Number(src.state_id))
    if (byId?.name) return byId.name
  }
  const code = (src.gstin || "").trim().slice(0, 2)
  if (/^\d{2}$/.test(code)) {
    for (const st of statesById.values()) {
      if (st.gstStateCode && String(st.gstStateCode).padStart(2, "0") === code) return st.name
    }
  }
  return ""
}

/** Same / Other state for GST. null = a state is missing in the masters, so nothing is assumed. */
export function gstSupplyTypeOf(billingState: string, shippingState: string): "INTRA" | "INTER" | null {
  if (!billingState || !shippingState) return null
  return billingState.trim().toLowerCase() === shippingState.trim().toLowerCase() ? "INTRA" : "INTER"
}
