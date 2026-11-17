"use client"

import * as React from "react"

/**
 * Lets the list card (StageListHeader) pull the WorkflowStageShell's filters (search, dates, party...)
 * into its own toolbar so a stage shows ONE filter section instead of two. The first list header
 * mounted inside the shell claims the filters; the shell hides its own strip while one is claimed.
 */
export interface ShellFiltersValue {
  claimedBy: string | null
  claim: (id: string) => void
  release: (id: string) => void
  node: React.ReactNode
  /** DOM slot in the list strip where <StageActionBar/> buttons are portalled. */
  actionsEl: HTMLElement | null
  setActionsEl: (el: HTMLElement | null) => void
}

export const ShellFiltersContext = React.createContext<ShellFiltersValue | null>(null)
