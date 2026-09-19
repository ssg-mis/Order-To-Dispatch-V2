"use client"

import { useEffect, useState } from "react"
import { customerApi } from "@/lib/api-service"
import type { StateInfo } from "@/hooks/use-states-map"

export type CustomerAddressOption = {
  id: "default" | number
  label: string
  addressLine1: string | null
  addressLine2: string | null
  city: string | null
  stateName: string | null
  pincode: string | null
}

export function formatCustomerAddress(a: CustomerAddressOption | undefined | null): string {
  if (!a) return ""
  return [a.addressLine1, a.addressLine2, a.city, a.stateName, a.pincode].filter(Boolean).join(", ")
}

/**
 * A customer's addresses: the one "default" address on the customer row
 * itself, plus any extra rows in customer_addresses (Section 10 - "user only
 * needs to select from a dropdown if multiple addresses were added on the
 * Customer Master"). The list/search customer endpoint doesn't include
 * addresses (only getCustomerById does), so this fetches per selected customer.
 */
export function useCustomerAddresses(customerId: number | null | undefined, statesById: Map<number, StateInfo>) {
  const [addresses, setAddresses] = useState<CustomerAddressOption[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    // Clear immediately on customer change (not just when there's no customer)
    // so a picker never briefly shows the PREVIOUS customer's addresses while
    // the new customer's own addresses are still in flight.
    setAddresses([])
    if (!customerId) {
      return
    }
    let cancelled = false
    setIsLoading(true)
    customerApi.getById(customerId)
      .then((res: any) => {
        if (cancelled || !res?.success) return
        const c = res.data
        const defaultOpt: CustomerAddressOption = {
          id: "default",
          label: "Registered Address (Default)",
          addressLine1: c.address_line_1 || null,
          addressLine2: c.address_line_2 || null,
          city: null,
          stateName: c.state || null,
          pincode: c.pincode || null,
        }
        const extra: CustomerAddressOption[] = (c.addresses || []).map((a: any) => ({
          id: a.id,
          label: [a.city, a.address_line_1].filter(Boolean).join(" - ") || `Address #${a.id}`,
          addressLine1: a.address_line_1 || null,
          addressLine2: a.address_line_2 || null,
          city: a.city || null,
          stateName: a.state_id ? statesById.get(a.state_id)?.name || null : null,
          pincode: a.pincode || null,
        }))
        setAddresses([defaultOpt, ...extra])
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [customerId, statesById])

  return { addresses, isLoading, hasMultiple: addresses.length > 1 }
}
