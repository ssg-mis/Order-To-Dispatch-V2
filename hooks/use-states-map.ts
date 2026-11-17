"use client"

import { useEffect, useState } from "react"
import { stateApi } from "@/lib/api-service"

export type StateInfo = { id: number; name: string; shortName: string; gstStateCode?: string | number | null }

/** Loads the States master once (id -> {name, shortName}) - used to label a
 * customer_addresses row's state_id, which the addresses API returns as a bare
 * FK with no joined name. */
export function useStatesMap(): Map<number, StateInfo> {
  const [statesById, setStatesById] = useState<Map<number, StateInfo>>(new Map())

  useEffect(() => {
    let cancelled = false
    stateApi.getAll({ all: "true" }).then((res: any) => {
      if (cancelled || !res?.success) return
      const rows = res.data?.states || []
      setStatesById(new Map(rows.map((s: any) => [s.id, { id: s.id, name: s.state_name, shortName: s.short_name, gstStateCode: s.gst_state_code }])))
    }).catch(() => {})
    return () => { cancelled = true }
  }, [])

  return statesById
}
