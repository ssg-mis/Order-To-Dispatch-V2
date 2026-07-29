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
