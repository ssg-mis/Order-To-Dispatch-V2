"use client"

import { useState, useMemo } from "react"
import { ChevronRight, ChevronDown, Clock, User, FileEdit, Calendar } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { fmtDate, fmtDateTime, fmtHistoryAmount } from "@/lib/table-format"
import { fmtHistoryWeight } from "@/lib/weight-col"
import { getWeightDecimals } from "@/lib/weight-format"
import { useWeightDecimals } from "@/hooks/use-weight-decimals"

const fmtHistVal = (v: string, fieldName?: string): string => {
  const amt = fmtHistoryWeight(fieldName, v, getWeightDecimals()) ?? fmtHistoryAmount(fieldName, v)
  if (amt !== null) return amt
  const t = String(v).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return fmtDate(t)
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(t)) return fmtDateTime(t)
  return v
}

interface HistoryItem {
  id: number | string
  fieldName: string
  oldValue?: string | null
  newValue?: string | null
  changedByName?: string | null
  createdAt: string
  wefDate?: string | null
  applicableFrom?: string | null
}

interface GroupedHistory {
  groupKey: string
  createdAt: string
  effectiveDate: string
  changedByName: string
  items: HistoryItem[]
  summaryFields: string
}

export function CustomerEditHistoryTable({ historyData }: { historyData: HistoryItem[] }) {
  useWeightDecimals() // re-render when the KG decimals load from the Units Master
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})

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

    // Sort descending by date
    const sorted = [...historyData].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )

    sorted.forEach(item => {
      const dateObj = new Date(item.createdAt)
      // Grouping key: year-month-day_hour:minute_user
      const minuteKey = `${dateObj.getFullYear()}-${dateObj.getMonth()}-${dateObj.getDate()}_${dateObj.getHours()}:${dateObj.getMinutes()}_${item.changedByName || 'unknown'}`

      const itemEffectiveDate = item.wefDate || item.applicableFrom || item.createdAt.split('T')[0]

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
        if (item.wefDate || item.applicableFrom) {
          group.effectiveDate = item.wefDate || item.applicableFrom || group.effectiveDate
        }
      }
    })

    // Format summary field names for each group
    const result: GroupedHistory[] = []
    groupsMap.forEach(group => {
      const fieldNames = Array.from(new Set(group.items.map(i => i.fieldName)))
      const summaryText = fieldNames.length <= 2
        ? fieldNames.join(", ")
        : `${fieldNames.slice(0, 2).join(", ")} +${fieldNames.length - 2} more`

      result.push({
        ...group,
        summaryFields: summaryText
      })
    })

    return result
  }, [historyData])

  if (!historyData || historyData.length === 0) {
    return (
      <div className="p-4 text-center border border-dashed rounded-lg bg-slate-50/50 text-slate-400 text-xs">
        No edit history recorded yet.
      </div>
    )
  }

  return (
    <div className="space-y-2 w-full">
      {groupedData.map(group => {
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
              className={`flex items-center justify-between px-3 py-2.5 cursor-pointer select-none transition-colors ${isExpanded ? "bg-blue-50/70 border-b border-blue-100" : "bg-slate-50/70 hover:bg-slate-100/70"
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
                  {fmtDateTime(group.createdAt)}
                </div>

                {/* Explicit Applicable From Column */}
                <div className="flex items-center gap-1.5 text-xs whitespace-nowrap shrink-0">
                  <Calendar className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] px-2 py-0.5 font-semibold shrink-0">
                    Applicable From: {fmtDate(group.effectiveDate)}
                  </Badge>
                </div>

                {/* Edited Fields Summary Column */}
                <div className="flex-1 flex items-center gap-2 min-w-0">
                  <Badge variant="secondary" className="bg-blue-100/80 text-blue-800 border-blue-200 text-[10px] px-2 py-0.5 font-medium shrink-0">
                    {itemCount} {itemCount === 1 ? 'Field' : 'Fields'} Updated
                  </Badge>
                  <span className="text-xs text-slate-500 truncate hidden lg:inline">
                    ({group.summaryFields})
                  </span>
                </div>
              </div>

              {/* Edited By User Column */}
              <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium shrink-0 ml-2">
                <User className="h-3.5 w-3.5 text-slate-400" />
                <div className="flex flex-col items-start leading-tight text-left">
                  <span>{group.changedByName}</span>
                  <span className="text-[10px] font-normal text-slate-400">{fmtDateTime(group.createdAt)}</span>
                </div>
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
                      <tr className="bg-slate-50 border-b border-slate-200 text-[11px] text-slate-600">
                        <th className="py-2 px-3 font-semibold w-1/4">Field Name</th>
                        <th className="py-2 px-3 font-semibold w-1/3">Old Value</th>
                        <th className="py-2 px-3 font-semibold w-1/3">New Value</th>
                        <th className="py-2 px-3 font-semibold whitespace-nowrap text-right">Effective Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {group.items.map(item => (
                        <tr key={item.id} className="hover:bg-slate-50/50">
                          <td className="py-2 px-3 font-medium text-slate-800 whitespace-nowrap">
                            {item.fieldName}
                          </td>
                          <td className="py-2 px-3 text-slate-500 font-mono text-[11px] break-all">
                            {item.oldValue ? fmtHistVal(item.oldValue, item.fieldName) : <span className="text-slate-300">—</span>}
                          </td>
                          <td className="py-2 px-3 text-slate-900 font-semibold font-mono text-[11px] break-all">
                            {item.newValue ? fmtHistVal(item.newValue, item.fieldName) : <span className="text-slate-300">—</span>}
                          </td>
                          <td className="py-2 px-3 text-right text-emerald-700 font-medium whitespace-nowrap font-mono text-[11px]">
                            {fmtDate(item.wefDate || item.applicableFrom || group.effectiveDate)}
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
