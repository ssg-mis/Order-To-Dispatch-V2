"use client"

import { useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { unitApi } from "@/lib/api-service"
import { setWeightDecimals, weightDecimalsFromUnits, DEFAULT_WEIGHT_DECIMALS } from "@/lib/weight-format"

/**
 * Decimal places for weight (KGS) values, taken from the KG unit in the Units Master.
 * Share one cached query across the app; also updates the module-level value used by PDFs / helpers.
 * Usage:  const wd = useWeightDecimals();  fmtWeight(value, wd)
 */
export function useWeightDecimals(): number {
  const { data } = useQuery({
    queryKey: ["unit-options"],
    queryFn: async () => {
      const res = await unitApi.getAll({ all: "true" })
      return res.success ? (res.data?.units || []) : []
    },
    staleTime: 5 * 60 * 1000,
  })
  const dp = data ? weightDecimalsFromUnits(data) : DEFAULT_WEIGHT_DECIMALS
  useEffect(() => {
    setWeightDecimals(dp)
  }, [dp])
  return dp
}
