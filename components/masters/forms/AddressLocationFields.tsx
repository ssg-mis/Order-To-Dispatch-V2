"use client"

import * as React from "react"
import { Combobox } from "@/components/ui/combobox"
import { Label } from "@/components/ui/label"
import { useAddressMasters } from "@/hooks/use-address-masters"

export interface AddressLocationValue {
  state_id?: number | string | null
  district?: string | null
  sub_district?: string | null
  thana?: string | null
  post?: string | null
  city?: string | null
}

export type AddressLocationPatch = Partial<{
  state_id: number | null
  state: string
  district: string
  sub_district: string
  thana: string
  post: string
  city: string
}>

const sameId = (a: number | null | undefined, b: number | null | undefined) => a == null || b == null || a === b

/**
 * State -> District -> Sub-District, then Thana -> Post -> City, all as searchable dropdowns fed by the Reference
 * Data masters. Each list is narrowed by what is already chosen above/beside it. The saved value is the NAME
 * (the address columns are text), so existing free-text addresses keep working - a saved value that is not in
 * the masters is still shown (and can be replaced).
 */
export function AddressLocationFields({
  value,
  activeStates,
  onChange,
  fieldClassName,
}: {
  value: AddressLocationValue
  activeStates: any[]
  onChange: (patch: AddressLocationPatch, changedLabel: string) => void
  /** extra classes for every dropdown trigger (e.g. "bg-white" on a tinted card) */
  fieldClassName?: string
}) {
  const { districts, subDistricts, cities, posts, thanas } = useAddressMasters()

  const stateId = value.state_id ? Number(value.state_id) : null
  const selState = activeStates.find((s: any) => Number(s.id) === stateId)

  const selDistrict = districts.find((d) => d.name === value.district && sameId(d.state_id, stateId))
  const selSub = subDistricts.find((s) => s.name === value.sub_district && sameId(s.district_id, selDistrict?.id))
  const selCity = cities.find(
    (c) => c.name === value.city && sameId(c.state_id, stateId) && sameId(c.district_id, selDistrict?.id) && sameId(c.sub_district_id, selSub?.id)
  )
  const selPost = posts.find(
    (p) => p.name === value.post && sameId(p.state_id, stateId) && sameId(p.district_id, selDistrict?.id) && sameId(p.sub_district_id, selSub?.id)
  )

  const toOptions = (names: string[], current?: string | null) => {
    const uniq = Array.from(new Set(names.filter(Boolean))).sort((a, b) => a.localeCompare(b))
    // keep a saved value that is not in the master list visible
    if (current && !uniq.includes(current)) uniq.unshift(current)
    return uniq.map((n) => ({ value: n, label: n }))
  }

  const districtOptions = toOptions(
    districts.filter((d) => sameId(d.state_id, stateId)).map((d) => d.name),
    value.district
  )

  const districtIdsOfState = new Set(districts.filter((d) => sameId(d.state_id, stateId)).map((d) => d.id))
  const subOptions = toOptions(
    subDistricts
      .filter((s) => (selDistrict ? s.district_id === selDistrict.id : stateId ? s.district_id != null && districtIdsOfState.has(s.district_id) : true))
      .map((s) => s.name),
    value.sub_district
  )

  const locOk = (x: { state_id: number | null; district_id: number | null; sub_district_id: number | null }) =>
    sameId(x.state_id, stateId) && sameId(x.district_id, selDistrict?.id) && sameId(x.sub_district_id, selSub?.id)

  const thanaOptions = toOptions(
    thanas
      .filter((t) => locOk(t) && sameId(t.city_id, selCity?.id) && sameId(t.post_id, selPost?.id))
      .map((t) => t.name),
    value.thana
  )
  const postOptions = toOptions(
    posts.filter((p) => locOk(p) && sameId(p.city_id, selCity?.id)).map((p) => p.name),
    value.post
  )
  const cityOptions = toOptions(cities.filter((c) => locOk(c)).map((c) => c.name), value.city)

  // a field is selectable only once its bigger parent is chosen (a saved value keeps its own field editable)
  const canDistrict = !!stateId || !!value.district
  const canSub = !!value.district || !!value.sub_district
  const canThana = !!value.sub_district || !!value.thana
  const canPost = !!value.thana || !!value.post
  const canCity = !!value.post || !!value.city

  const clearBelow = { district: "", sub_district: "", thana: "", post: "", city: "" }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-slate-800">State</Label>
          <Combobox
            options={activeStates.map((s: any) => ({
              value: String(s.id),
              label: [s.gst_state_code, s.short_name, s.state_name].filter(Boolean).join(" "),
            }))}
            value={value.state_id ? String(value.state_id) : ""}
            onValueChange={(val) => {
              const picked = activeStates.find((s: any) => String(s.id) === val)
              onChange(
                { state_id: val ? parseInt(val, 10) : null, state: picked?.state_name || "", ...clearBelow },
                "State"
              )
            }}
            placeholder="Select State"
            className={fieldClassName}
            searchPlaceholder="Search state..."
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-slate-800">District</Label>
          <Combobox
            options={districtOptions}
            value={value.district || ""}
            onValueChange={(val) => onChange({ district: val, sub_district: "", thana: "", post: "", city: "" }, "District")}
            placeholder={canDistrict ? "Select District" : "Select State first"}
            disabled={!canDistrict}
            className={fieldClassName}
            searchPlaceholder="Search district..."
            emptyText="No district found."
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-slate-800">Sub-District</Label>
          <Combobox
            options={subOptions}
            value={value.sub_district || ""}
            onValueChange={(val) => onChange({ sub_district: val, thana: "", post: "", city: "" }, "Sub-District")}
            placeholder={canSub ? "Select Sub-District" : "Select District first"}
            disabled={!canSub}
            className={fieldClassName}
            searchPlaceholder="Search sub-district..."
            emptyText="No sub-district found."
          />
        </div>
      </div>

      {selState && (
        <p className="text-[11px] text-slate-500">
          State Code: <span className="font-semibold text-slate-700">{selState.gst_state_code}</span>
          {" · "}Short Name: <span className="font-semibold text-slate-700">{selState.short_name || "—"}</span>
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-slate-800">Thana</Label>
          <Combobox
            options={thanaOptions}
            value={value.thana || ""}
            onValueChange={(val) => onChange({ thana: val }, "Thana")}
            placeholder={canThana ? "Select Thana" : "Select Sub-District first"}
            disabled={!canThana}
            className={fieldClassName}
            searchPlaceholder="Search thana..."
            emptyText="No thana found."
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-slate-800">Post</Label>
          <Combobox
            options={postOptions}
            value={value.post || ""}
            onValueChange={(val) => onChange({ post: val }, "Post")}
            placeholder={canPost ? "Select Post" : "Select Thana first"}
            disabled={!canPost}
            className={fieldClassName}
            searchPlaceholder="Search post..."
            emptyText="No post found."
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-slate-800">City</Label>
          <Combobox
            options={cityOptions}
            value={value.city || ""}
            onValueChange={(val) => onChange({ city: val }, "City")}
            placeholder={canCity ? "Select City" : "Select Post first"}
            disabled={!canCity}
            className={fieldClassName}
            searchPlaceholder="Search city..."
            emptyText="No city found."
          />
        </div>
      </div>
    </>
  )
}
