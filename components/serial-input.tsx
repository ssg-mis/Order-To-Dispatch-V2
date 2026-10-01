"use client"

import * as React from "react"
import { Camera, ScanBarcode, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

/** Serials are stored trimmed + upper-case, with scanner control characters removed. */
export const normalizeSerial = (raw: string) => raw.replace(/[\u0000-\u001f\u007f]/g, "").trim().toUpperCase()

const BARCODE_FORMATS = ["code_128", "code_39", "code_93", "ean_13", "ean_8", "upc_a", "upc_e", "itf", "codabar", "qr_code", "data_matrix"]

function CameraScanner({ open, onClose, onDetect }: { open: boolean; onClose: () => void; onDetect: (value: string) => void }) {
  const videoRef = React.useRef<HTMLVideoElement | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!open) return
    let stream: MediaStream | null = null
    let raf = 0
    let cancelled = false
    setError(null)

    const start = async () => {
      const Detector = (window as any).BarcodeDetector
      if (!Detector) {
        setError("Camera scanning is not supported in this browser. Use a handheld scanner, or type the number.")
        return
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false })
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return }
        const video = videoRef.current
        if (!video) return
        video.srcObject = stream
        await video.play()
        const detector = new Detector({ formats: BARCODE_FORMATS })
        const tick = async () => {
          if (cancelled) return
          try {
            const codes = await detector.detect(video)
            const value = codes?.[0]?.rawValue
            if (value) {
              onDetect(normalizeSerial(String(value)))
              return
            }
          } catch { /* frame not ready - keep scanning */ }
          raf = requestAnimationFrame(tick)
        }
        raf = requestAnimationFrame(tick)
      } catch {
        setError("Could not open the camera. Allow camera permission (needs HTTPS), or type the number.")
      }
    }
    start()

    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      stream?.getTracks().forEach(t => t.stop())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Scan barcode / QR</DialogTitle>
          <DialogDescription>Hold the code on the TIN / Box steady inside the frame.</DialogDescription>
        </DialogHeader>
        {error ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{error}</div>
        ) : (
          <div className="relative overflow-hidden rounded-lg bg-black">
            <video ref={videoRef} playsInline muted className="aspect-video w-full object-cover" />
            <div className="pointer-events-none absolute inset-x-8 top-1/2 h-0.5 -translate-y-1/2 bg-red-500/80" />
          </div>
        )}
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Serial / barcode field for TIN, Box and SFG numbers.
 *  - A USB / Bluetooth handheld scanner works as-is: it "types" the code and presses Enter,
 *    which fires `onEnter` (used to jump to the next row).
 *  - The camera button scans with the browser's BarcodeDetector (Chrome / Edge / Android).
 *  - Manual typing stays available; the value is normalised to upper case.
 */
export function SerialInput({
  value,
  onChange,
  onEnter,
  placeholder = "Scan or type serial no.",
  error,
  autoFocus,
  className,
}: {
  value: string
  onChange: (value: string) => void
  onEnter?: () => void
  placeholder?: string
  error?: string | null
  autoFocus?: boolean
  className?: string
}) {
  const [scanning, setScanning] = React.useState(false)

  return (
    <div className="space-y-1">
      <div className="relative">
        <ScanBarcode className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          value={value}
          onChange={(e) => onChange(normalizeSerial(e.target.value))}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              if (value.trim()) onEnter?.()
            }
          }}
          autoFocus={autoFocus}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder={placeholder}
          aria-invalid={!!error}
          className={cn("pl-9 pr-11 font-mono tracking-wide", error && "border-red-400 focus-visible:ring-red-300", className)}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          title="Scan with camera"
          onClick={() => setScanning(true)}
          className="absolute right-0.5 top-1/2 h-8 w-8 -translate-y-1/2 text-blue-600 hover:bg-blue-50"
        >
          <Camera className="h-4 w-4" />
        </Button>
      </div>
      {error && (
        <p className="flex items-center gap-1 text-xs font-medium text-red-600">
          <X className="h-3 w-3" /> {error}
        </p>
      )}
      <CameraScanner
        open={scanning}
        onClose={() => setScanning(false)}
        onDetect={(v) => { onChange(v); setScanning(false); onEnter?.() }}
      />
    </div>
  )
}
