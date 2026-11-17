"use client"

import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { districtApi, lookupApi, subDistrictApi } from "@/lib/api-service"

/**
 * The location Reference Data masters (District, Sub-District, City, Post, Thana) as flat, normalised lists for
 * address dropdowns. Uses the SAME react-query keys as the Reference Data tab, so the data is shared / cached.
 * Only Active records are offered.
 */

export interface DistrictOpt { id: number; name: string; state_id: number | null }
export interface SubDistrictOpt { id: number; name: string; district_id: number | null }
export interface CityOpt { id: number; name: string; state_id: number | null; district_id: number | null; sub_district_id: number | null }
export interface PostOpt extends CityOpt { city_id: number | null }
export interface ThanaOpt extends PostOpt { post_id: number | null }

const num = (v: any): number | null => (v === null || v === undefined || v === "" ? null : Number(v))
const isActive = (r: any) => (r?.status ?? "Active") === "Active"

async function fetchList(type: "district" | "sub_district" | "city" | "post" | "thana"): Promise<any[]> {
  if (type === "district") {
    const res = await districtApi.getAll({ all: "true" })
    return res.success ? res.data?.districts || [] : []
  }
  if (type === "sub_district") {
    const res = await subDistrictApi.getAll({ all: "true" })
    return res.success ? res.data?.sub_districts || res.data?.subDistricts || [] : []
  }
  const res = await lookupApi.getAll(type, { all: "true" })
  return res.success ? res.data?.items || [] : []
}

const q = (type: "district" | "sub_district" | "city" | "post" | "thana") => ({
  queryKey: ["small-masters", type],
  queryFn: () => fetchList(type),
  staleTime: 60 * 1000,
})

export function useAddressMasters() {
  const { data: d } = useQuery(q("district"))
  const { data: sd } = useQuery(q("sub_district"))
  const { data: c } = useQuery(q("city"))
  const { data: p } = useQuery(q("post"))
  const { data: t } = useQuery(q("thana"))

  return useMemo(() => {
    const districts: DistrictOpt[] = (d || []).filter(isActive).map((r: any) => ({
      id: Number(r.id), name: r.district_name || r.name, state_id: num(r.state_id),
    }))
    const subDistricts: SubDistrictOpt[] = (sd || []).filter(isActive).map((r: any) => ({
      id: Number(r.id), name: r.sub_district_name || r.name, district_id: num(r.district_id),
    }))
    const cities: CityOpt[] = (c || []).filter(isActive).map((r: any) => ({
      id: Number(r.id), name: r.name, state_id: num(r.state_id), district_id: num(r.district_id), sub_district_id: num(r.sub_district_id),
    }))
    const posts: PostOpt[] = (p || []).filter(isActive).map((r: any) => ({
      id: Number(r.id), name: r.name, state_id: num(r.state_id), district_id: num(r.district_id),
      sub_district_id: num(r.sub_district_id), city_id: num(r.city_id),
    }))
    const thanas: ThanaOpt[] = (t || []).filter(isActive).map((r: any) => ({
      id: Number(r.id), name: r.name, state_id: num(r.state_id), district_id: num(r.district_id),
      sub_district_id: num(r.sub_district_id), city_id: num(r.city_id), post_id: num(r.post_id),
    }))
    return { districts, subDistricts, cities, posts, thanas }
  }, [d, sd, c, p, t])
}
