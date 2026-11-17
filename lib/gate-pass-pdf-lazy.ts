"use client"

/**
 * Lazy wrapper for the Outgoing Gate Pass PDF generator (keeps jsPDF out of the initial bundle).
 */
import type { generateGatePassPdf as GenerateFn } from "@/lib/gate-pass-pdf"

export async function generateGatePassPdf(...args: Parameters<typeof GenerateFn>): Promise<void> {
  const mod = await import("@/lib/gate-pass-pdf")
  mod.generateGatePassPdf(...args)
}
