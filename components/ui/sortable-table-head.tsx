"use client"

import * as React from "react"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { TableHead } from "@/components/ui/table"
import { GripVertical } from "lucide-react"
import { cn } from "@/lib/utils"
import { ColumnDragDisabledContext } from "@/components/ui/column-drag-provider"

interface SortableTableHeadProps {
  id: string
  className?: string
  onClick?: () => void
  /** Make the inner wrapper span the full cell width (used by StageHeadCell so the totals band can fill the cell). */
  fill?: boolean
  children: React.ReactNode
}

export function SortableTableHead({ id, className, onClick, fill, children }: SortableTableHeadProps) {
  const disabled = React.useContext(ColumnDragDisabledContext)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })

  const style: React.CSSProperties = {
    transform: transform ? CSS.Transform.toString(transform) : undefined,
    transition: transform ? transition : undefined,
    opacity: isDragging ? 0.4 : 1,
    position: isDragging ? "relative" : undefined,
    zIndex: isDragging ? 10 : undefined,
  }

  const isRight = className?.includes("text-right")
  const isCenter = className?.includes("text-center")

  return (
    <TableHead
      ref={setNodeRef}
      style={style}
      className={cn("group relative", className)}
      onClick={onClick}
    >
      <div className={cn("flex items-center w-full", isRight ? "justify-end" : isCenter ? "justify-center" : "justify-start")}>
        <div className={cn("relative items-center", fill ? "flex w-full" : "inline-flex")}>
          {!disabled && (
            <span
              {...attributes}
              {...listeners}
              className="absolute -left-3.5 top-1/2 -translate-y-1/2 cursor-grab opacity-0 group-hover:opacity-40 hover:!opacity-70 active:cursor-grabbing flex-shrink-0 touch-none z-10 text-slate-400"
              onClick={(e) => e.stopPropagation()}
            >
              <GripVertical size={11} />
            </span>
          )}
          {children}
        </div>
      </div>
    </TableHead>
  )
}
