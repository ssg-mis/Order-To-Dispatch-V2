"use client"

import React from "react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { LucideIcon } from "lucide-react"

interface MasterCardWrapperProps {
  icon: LucideIcon
  title: string
  description: string
  isAdminOrSuper?: boolean
  subTab?: "active" | "pending"
  setSubTab?: (subTab: "active" | "pending") => void
  pendingCount?: number
  hideSubTabs?: boolean
  headerActions?: React.ReactNode
  children: React.ReactNode
}

export function MasterCardWrapper({
  icon: Icon,
  title,
  description,
  isAdminOrSuper = false,
  subTab = "active",
  setSubTab,
  pendingCount = 0,
  hideSubTabs = false,
  headerActions,
  children
}: MasterCardWrapperProps) {
  return (
    <Card className="shadow-xl border-none rounded-2xl bg-white">
      <CardHeader className="bg-slate-50/50 border-b p-6">
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <Icon className="h-5 w-5 text-primary" />
              {title}
            </CardTitle>
            <CardDescription className="mt-1">{description}</CardDescription>
          </div>
          {headerActions && (
            <div className="flex items-center gap-2">
              {headerActions}
            </div>
          )}
        </div>
        {isAdminOrSuper && !hideSubTabs && setSubTab && (
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => setSubTab('active')}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${subTab === 'active' ? 'bg-primary text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              Active Records
            </button>
            <button
              onClick={() => setSubTab('pending')}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${subTab === 'pending' ? 'bg-amber-500 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              Pending Approval {pendingCount > 0 && <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${subTab === 'pending' ? 'bg-white text-amber-600' : 'bg-amber-500 text-white'}`}>{pendingCount}</span>}
            </button>
          </div>
        )}
      </CardHeader>
      <CardContent className="p-0">
        {children}
      </CardContent>
    </Card>
  )
}
