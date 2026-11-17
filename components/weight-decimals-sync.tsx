"use client"

import { useWeightDecimals } from "@/hooks/use-weight-decimals"

/** Keeps the module-level weight decimals (used by PDFs/helpers) in sync with the Units Master app-wide. */
export function WeightDecimalsSync() {
  useWeightDecimals()
  return null
}
