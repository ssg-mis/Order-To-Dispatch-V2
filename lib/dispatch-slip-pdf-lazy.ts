/**
 * Lazy wrapper for the dispatch slip / gate pass PDF generator.
 * jspdf + jspdf-autotable are heavy, so they are only loaded when a PDF is actually generated
 * instead of being bundled into (and compiled with) every stage page that offers a slip.
 */
import type { generateDispatchSlipPdf as GenerateFn } from "@/lib/dispatch-slip-pdf"

export async function generateDispatchSlipPdf(...args: Parameters<typeof GenerateFn>): Promise<void> {
  const mod = await import("@/lib/dispatch-slip-pdf")
  mod.generateDispatchSlipPdf(...args)
}
