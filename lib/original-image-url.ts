/**
 * Uploads store a compressed copy (the URL kept in the DB) and the untouched original at
 * `<folder>/originals/<same file name>` (see backend services/uploadService.js).
 * Photos uploaded before that change have no original, so the link may 404 for them.
 */
export function getOriginalImageUrl(url?: string | null): string | null {
  if (!url) return null
  const marker = "/order-so-copies/"
  const idx = url.indexOf(marker)
  if (idx === -1 || url.includes("/order-so-copies/originals/")) return null
  return url.slice(0, idx + marker.length) + "originals/" + url.slice(idx + marker.length)
}
