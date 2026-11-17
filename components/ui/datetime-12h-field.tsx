"use client"

import * as React from "react"
import { CalendarClock } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

const pad = (n: number) => String(n).padStart(2, "0")

function parseLocal(date: string, time: string): Date | null {
  if (!date) return null
  const [y, m, d] = date.split("-").map(Number)
  const [hh, mm] = (time || "00:00").split(":").map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d, hh || 0, mm || 0)
}

/** "29-10-2026 12:11 PM" */
export function formatDateTime12h(date: string, time: string): string {
  const dt = parseLocal(date, time)
  if (!dt) return ""
  const h = dt.getHours()
  return `${pad(dt.getDate())}-${pad(dt.getMonth() + 1)}-${dt.getFullYear()} ${pad(h % 12 || 12)}:${pad(dt.getMinutes())} ${h >= 12 ? "PM" : "AM"}`
}

const SIZE = 220
const C = SIZE / 2
const R_NUM = 84 // radius of the number ring

/** Analog clock face: pick the hour first, then the minute (click or drag on the dial). */
function ClockDial({
  mode,
  hour12,
  minute,
  onPick,
  onDone,
}: {
  mode: "hour" | "minute"
  hour12: number
  minute: number
  onPick: (value: number) => void
  onDone: () => void
}) {
  const svgRef = React.useRef<SVGSVGElement>(null)
  const dragging = React.useRef(false)

  const valueAt = (clientX: number, clientY: number) => {
    const rect = svgRef.current!.getBoundingClientRect()
    const dx = clientX - (rect.left + rect.width / 2)
    const dy = clientY - (rect.top + rect.height / 2)
    const deg = (Math.atan2(dx, -dy) * 180) / Math.PI
    const angle = (deg + 360) % 360
    return mode === "hour" ? Math.round(angle / 30) % 12 || 12 : Math.round(angle / 6) % 60
  }

  const angleOf = mode === "hour" ? (hour12 % 12) * 30 : minute * 6
  const rad = (angleOf * Math.PI) / 180
  const hx = C + R_NUM * Math.sin(rad)
  const hy = C - R_NUM * Math.cos(rad)
  const onFiveMark = mode === "minute" && minute % 5 === 0

  const labels = mode === "hour" ? Array.from({ length: 12 }, (_, i) => i + 1) : Array.from({ length: 12 }, (_, i) => i * 5)

  return (
    <svg
      ref={svgRef}
      width={SIZE}
      height={SIZE}
      className="touch-none select-none"
      onPointerDown={(e) => {
        dragging.current = true
        e.currentTarget.setPointerCapture(e.pointerId)
        onPick(valueAt(e.clientX, e.clientY))
      }}
      onPointerMove={(e) => {
        if (dragging.current) onPick(valueAt(e.clientX, e.clientY))
      }}
      onPointerUp={(e) => {
        if (!dragging.current) return
        dragging.current = false
        e.currentTarget.releasePointerCapture(e.pointerId)
        onDone()
      }}
    >
      <circle cx={C} cy={C} r={C - 4} className="fill-slate-100" />
      <circle cx={C} cy={C} r={3} className="fill-blue-600" />
      <line x1={C} y1={C} x2={hx} y2={hy} className="stroke-blue-600" strokeWidth={2} />
      <circle cx={hx} cy={hy} r={17} className="fill-blue-600" />
      {!onFiveMark && mode === "minute" && <circle cx={hx} cy={hy} r={3} className="fill-white" />}
      {labels.map((n, i) => {
        const a = ((mode === "hour" ? n % 12 : n) * (mode === "hour" ? 30 : 6) * Math.PI) / 180
        const x = C + R_NUM * Math.sin(a)
        const y = C - R_NUM * Math.cos(a)
        const active = mode === "hour" ? n === hour12 : n === minute
        return (
          <text
            key={i}
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="central"
            className={cn("pointer-events-none text-[13px] font-medium", active ? "fill-white" : "fill-slate-700")}
          >
            {mode === "hour" ? n : pad(n)}
          </text>
        )
      })}
    </svg>
  )
}

/**
 * One field for date + time, always in 12-hour format with AM / PM (the native date / time inputs follow the
 * OS locale and can show 24-hour time). The time is set on a clock face. `date` is YYYY-MM-DD and `time` is
 * 24-hour HH:mm, so callers keep sending the same values to the API.
 */
export function DateTime12hField({
  date,
  time,
  onChange,
  disabled,
  className,
}: {
  date: string
  time: string
  onChange: (next: { date: string; time: string }) => void
  disabled?: boolean
  className?: string
}) {
  const [mode, setMode] = React.useState<"hour" | "minute">("hour")
  const dt = parseLocal(date, time)
  const hour24 = dt ? dt.getHours() : 12
  const hour12 = hour24 % 12 || 12
  const minute = dt ? dt.getMinutes() : 0
  const meridiem = hour24 >= 12 ? "PM" : "AM"

  const today = () => {
    const n = new Date()
    return `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}`
  }

  const emit = (d: string, h12: number, m: number, mer: string) => {
    const h = (h12 % 12) + (mer === "PM" ? 12 : 0)
    onChange({ date: d, time: `${pad(h)}:${pad(m)}` })
  }

  const chip = (active: boolean) =>
    cn("rounded-md px-2 py-1 text-3xl font-semibold tabular-nums transition-colors", active ? "bg-blue-100 text-blue-700" : "text-slate-700 hover:bg-slate-100")

  return (
    <Popover onOpenChange={(open) => open && setMode("hour")}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn("w-full justify-between font-normal", !dt && "text-muted-foreground", className)}
        >
          <span>{dt ? formatDateTime12h(date, time) : "Select date & time"}</span>
          <CalendarClock className="h-4 w-4 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <div className="flex flex-col sm:flex-row">
          <Calendar
            mode="single"
            selected={dt ?? undefined}
            defaultMonth={dt ?? undefined}
            onSelect={(d) => {
              if (!d) return
              emit(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, hour12, minute, meridiem)
            }}
          />
          <div className="flex flex-col items-center gap-3 border-t p-3 sm:border-l sm:border-t-0">
            <div className="flex items-center gap-2">
              <button type="button" className={chip(mode === "hour")} onClick={() => setMode("hour")}>{pad(hour12)}</button>
              <span className="text-3xl font-semibold text-slate-400">:</span>
              <button type="button" className={chip(mode === "minute")} onClick={() => setMode("minute")}>{pad(minute)}</button>
              <div className="ml-1 flex flex-col overflow-hidden rounded-md border text-xs font-bold">
                {["AM", "PM"].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => emit(date || today(), hour12, minute, m)}
                    className={cn("px-2.5 py-1.5 transition-colors", meridiem === m ? "bg-blue-600 text-white" : "bg-white text-slate-600 hover:bg-slate-100")}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
            <ClockDial
              mode={mode}
              hour12={hour12}
              minute={minute}
              onPick={(v) => (mode === "hour" ? emit(date || today(), v, minute, meridiem) : emit(date || today(), hour12, v, meridiem))}
              onDone={() => mode === "hour" && setMode("minute")}
            />
            <p className="text-[10px] font-medium text-slate-400">{mode === "hour" ? "Select hour" : "Select minute"}</p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
