/**
 * PRINT order of an address (what lands on orders, invoices, gate passes ...):
 *   address line(s), City, Post, Thana, Sub-District, District, State, Pincode
 * i.e. the reverse of the order the fields appear on the Customer form (State -> District -> Sub-District ->
 * Thana -> Post -> City). Empty parts are skipped.
 */
export interface AddressParts {
  address_line_1?: string | null
  address_line_2?: string | null
  city?: string | null
  post?: string | null
  thana?: string | null
  sub_district?: string | null
  district?: string | null
  state?: string | null
  pincode?: string | null
}

export function formatAddressForPrint(a: AddressParts | null | undefined): string {
  if (!a) return ""
  return [a.address_line_1, a.address_line_2, a.city, a.post, a.thana, a.sub_district, a.district, a.state, a.pincode]
    .map((p) => (p === null || p === undefined ? "" : String(p).trim()))
    .filter(Boolean)
    .join(", ")
}
