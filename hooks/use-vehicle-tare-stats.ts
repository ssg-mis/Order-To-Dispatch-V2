"use client"

import { useQuery } from "@tanstack/react-query"
import { actualDispatchApi } from "@/lib/api-service"

export type VehicleTareStats = { avgTare: number | null; count: number; trips: any[] }

/** Average tare + trips for a vehicle (shared react-query cache across stages and the Vehicle Master). */
export function useVehicleTareStats(vehicleId?: number | string | null) {
  return useQuery({
    queryKey: ["vehicle-tare-stats", vehicleId],
    enabled: !!vehicleId,
    queryFn: async () => {
      const res = await actualDispatchApi.getVehicleTareStats(vehicleId as number | string)
      if (!res.success) throw new Error(res.message || "Failed to load tare history")
      return res.data as VehicleTareStats
    },
    retry: false,
  })
}
