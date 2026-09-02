"use client"

import { useState, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { ChevronRight, ChevronDown, Clock, User, FileEdit, Calendar, Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { masterHistoryApi } from "@/lib/api-service"

interface HistoryItem {
  id: number | string
  fieldName: string
  oldValue?: string | null
  newValue?: string | null
  changedByName?: string | null
  createdAt: string
  applicableFrom?: string | null
  wefDate?: string | null
}

interface GroupedHistory {
  groupKey: string
  createdAt: string
  effectiveDate: string
  changedByName: string
  items: HistoryItem[]
  summaryFields: string
}

export function MasterEditHistoryTable({ masterType, recordId }: { masterType: string; recordId?: number | string }) {
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})

  const { data: historyData, isLoading, isError } = useQuery({
    queryKey: ["master-edit-history", masterType, recordId],
    queryFn: async () => {
      if (!masterType || !recordId) return []
      try {
        const res = await masterHistoryApi.getHistory(masterType, recordId)
        return res.success ? (res.data || []) : []
      } catch (e) {
        console.error("Failed to fetch master history:", e)
        return []
      }
    },
    enabled: !!masterType && !!recordId,
    staleTime: 0,
    refetchOnMount: 'always',
  })

  const toggleGroup = (groupKey: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupKey]: !prev[groupKey]
    }))
  }

  // Group edits created within the same minute by the same user into a single session
  const groupedData = useMemo(() => {
    if (!historyData || historyData.length === 0) return []

    const groupsMap = new Map<string, GroupedHistory>()

    const sorted = [...historyData].sort(
      (a: HistoryItem, b: HistoryItem) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )

    sorted.forEach((item: HistoryItem) => {
      const dateObj = new Date(item.createdAt)
      const minuteKey = `${dateObj.getFullYear()}-${dateObj.getMonth()}-${dateObj.getDate()}_${dateObj.getHours()}:${dateObj.getMinutes()}_${item.changedByName || 'unknown'}`

      const itemEffectiveDate = item.applicableFrom || item.wefDate || item.createdAt.split('T')[0]

      if (!groupsMap.has(minuteKey)) {
        groupsMap.set(minuteKey, {
          groupKey: minuteKey,
          createdAt: item.createdAt,
          effectiveDate: itemEffectiveDate,
          changedByName: item.changedByName || '—',
          items: [item],
          summaryFields: item.fieldName
        })
      } else {
        const group = groupsMap.get(minuteKey)!
        group.items.push(item)
        
        const fieldSet = new Set(group.summaryFields.split(', '))
        fieldSet.add(item.fieldName)
        const fieldsArr = Array.from(fieldSet)
        if (fieldsArr.length <= 2) {
          group.summaryFields = fieldsArr.join(', ')
        } else {
          group.summaryFields = `${fieldsArr.slice(0, 2).join(', ')} +${fieldsArr.length - 2} more`
        }
      }
    })

    return Array.from(groupsMap.values())
  }, [historyData])

  if (!recordId) return null

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4 text-xs text-slate-400 gap-2">
        <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
        <span>Loading history...</span>
      </div>
    )
  }

  if (!historyData || historyData.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-slate-200 p-4 text-center text-xs text-slate-500 bg-slate-50/50">
        No history recorded yet for this item.
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {groupedData.map((group) => {
        const isExpanded = !!expandedGroups[group.groupKey]
        const itemCount = group.items.length

        return (
          <div 
            key={group.groupKey} 
            className="border border-slate-200 rounded-lg bg-white overflow-hidden shadow-2xs hover:border-slate-300 transition-all"
          >
            {/* Main Header Bar (Session Row with Explicit Columns) */}
            <div 
              onClick={() => toggleGroup(group.groupKey)}
              className={`flex items-center justify-between px-3 py-2.5 cursor-pointer select-none transition-colors ${
                isExpanded ? "bg-blue-50/70 border-b border-blue-100" : "bg-slate-50/70 hover:bg-slate-100/70"
              }`}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                {/* Chevron */}
                <div className={`p-1 rounded transition-transform ${isExpanded ? "bg-blue-200/70 text-blue-700" : "bg-slate-200/60 text-slate-500"}`}>
                  {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                </div>

                {/* Date & Time Column */}
                <div className="w-36 flex items-center gap-1.5 text-xs font-semibold text-slate-700 whitespace-nowrap">
                  <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  {new Date(group.createdAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                </div>

                {/* Explicit Applicable From Column */}
                <div className="flex items-center gap-1.5 text-xs whitespace-nowrap shrink-0">
                  <Calendar className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] px-2 py-0.5 font-semibold shrink-0">
                    Applicable From: {new Date(group.effectiveDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </Badge>
                </div>

                {/* Edited Fields Summary Column */}
                <div className="flex-1 flex items-center gap-2 min-w-0">
                  <Badge variant="secondary" className="bg-blue-100/80 text-blue-800 border-blue-200 text-[10px] px-2 py-0.5 font-medium shrink-0">
                    {itemCount} {itemCount === 1 ? 'Field' : 'Fields'} Updated
                  </Badge>
                  <span className="text-xs text-slate-500 truncate hidden lg:inline font-medium">
                    ({group.summaryFields})
                  </span>
                </div>
              </div>

              {/* Edited By User Column */}
              <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium shrink-0 ml-2">
                <User className="h-3.5 w-3.5 text-slate-400" />
                <span>{group.changedByName}</span>
              </div>
            </div>

            {/* Expanded Detailed Sub-table */}
            {isExpanded && (
              <div className="p-3 bg-white space-y-2">
                <div className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5 pb-1">
                  <FileEdit className="h-3.5 w-3.5 text-blue-600" />
                  Detailed Changes for this Edit Session:
                </div>
                <div className="rounded border border-slate-200 overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100/80 text-slate-600 font-medium border-b border-slate-200">
                        <th className="py-1.5 px-3 w-1/4">Field Name</th>
                        <th className="py-1.5 px-3 w-1/3 text-amber-700 bg-amber-50/50">Old Value</th>
                        <th className="py-1.5 px-3 w-1/3 text-emerald-700 bg-emerald-50/50">New Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {group.items.map((item, idx) => (
                        <tr key={item.id || idx} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-2 px-3 font-semibold text-slate-800 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                            {item.fieldName}
                          </td>
                          <td className="py-2 px-3 text-slate-600 bg-amber-50/20 font-mono text-[11px] break-all">
                            {item.oldValue || '—'}
                          </td>
                          <td className="py-2 px-3 text-slate-900 bg-emerald-50/20 font-mono text-[11px] font-semibold break-all">
                            {item.newValue || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
