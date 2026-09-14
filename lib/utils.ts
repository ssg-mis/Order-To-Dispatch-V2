import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Lowercase and drop everything that isn't a letter or digit, so spaces, dots
 *  and dashes never block a match: "himy" finds "Hi my name is". */
export function fuzzyMatch(query: string, text: string): boolean {
  const strip = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "")
  return strip(text).includes(strip(query))
}

/** SKU Selling Price's landing cost / selling cost / actual margin chain.
 *  Mirrors the backend formula (order-to-dispatch-backend-v2/services/skuSellingPriceService.js):
 *  landing_cost = (gt / 1000) * net_oil_in_gm + packing_cost
 *  selling_cost = landing_cost * (1 + margin% / 100)
 *  actual_margin = selling_cost - landing_cost
 *  `gt` is the latest var_calc rate. Returns the four derived fields as strings
 *  (2 decimal places) so they merge straight into the form state. */
export function calculateSkuSellingPriceDerived(
  form: { sku_weight_in_gm?: any; packing_material_weight_in_gm?: any; packing_cost?: any; margin?: any },
  gt: number
) {
  const skuWeightGm = parseFloat(form.sku_weight_in_gm) || 0
  const packingWeightGm = parseFloat(form.packing_material_weight_in_gm) || 0
  const packingCost = parseFloat(form.packing_cost) || 0
  const netOilInGm = skuWeightGm - packingWeightGm

  const landingCost = (gt / 1000) * netOilInGm + packingCost

  const marginVal = parseFloat(String(form.margin ?? '0').replace('%', '')) || 0
  const sellingCost = landingCost * (1 + marginVal / 100)
  const actualMargin = sellingCost - landingCost

  return {
    net_oil_in_gm: netOilInGm.toFixed(2),
    landing_cost: landingCost.toFixed(2),
    selling_cost: sellingCost.toFixed(2),
    actual_margin: actualMargin.toFixed(2),
  }
}
