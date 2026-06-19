"use client"

import * as React from "react"
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  horizontalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable"

export const ColumnDragDisabledContext = React.createContext(false)

interface ColumnDragProviderProps {
  columnIds: string[]
  onReorder: (newOrder: string[]) => void
  disabled?: boolean
  children: React.ReactNode
}

export function ColumnDragProvider({ columnIds, onReorder, disabled = false, children }: ColumnDragProviderProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  )
  const noSensors = useSensors()

  // dnd-kit renders hidden screen-reader nodes (<div>s) as part of DndContext.
  // Because this provider sits INSIDE a <tr> (wrapping the <th> cells), those
  // <div>s would be invalid children of <tr> ("div cannot be a child of tr"
  // hydration error). Portaling them to <body> keeps the row valid. These
  // tables only ever render client-side (the app gates page render on auth),
  // so document is always available here.
  const a11yContainer = typeof document !== "undefined" ? document.body : undefined

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = columnIds.indexOf(active.id as string)
    const newIndex = columnIds.indexOf(over.id as string)
    if (oldIndex !== -1 && newIndex !== -1) {
      onReorder(arrayMove(columnIds, oldIndex, newIndex))
    }
  }

  return (
    <ColumnDragDisabledContext.Provider value={disabled}>
      <DndContext sensors={disabled ? noSensors : sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd} accessibility={{ container: a11yContainer }}>
        <SortableContext items={columnIds} strategy={horizontalListSortingStrategy}>
          {children}
        </SortableContext>
      </DndContext>
    </ColumnDragDisabledContext.Provider>
  )
}
