"use client"

import { useState, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { ChevronRight, ChevronDown, Clock, User, FileEdit, Loader2, History, ArrowRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { masterHistoryApi } from "@/lib/api-service"
import { fmtDate, fmtDateTime } from "@/lib/table-format"

// Display-only: ISO date / datetime strings become dd/mm/yyyy; everything else unchanged.
const fmtHistVal = (v: string): string => {
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
  applicableFrom?: string | null
  wefDate?: string | null
}

interface GroupedHistory {
  groupKey: string
  createdAt: string
  changedByName: string
  items: HistoryItem[]
  summaryFields: string
}

export function MasterEditHistoryTable({ masterType, recordId }: { masterType: string; recordId?: number | string }) {
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})

  const { data: historyData, isLoading } = useQuery({
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

  // Deduplicate items created within the same minute with identical fieldName, oldValue, and newValue,
  // and drop no-op entries where the value didn't actually change (e.g. an effective-dated version
  // save logs a full section snapshot, not just the fields that were touched - this audit view should
  // only ever read as a list of real edits).
  const uniqueHistoryData = useMemo(() => {
    if (!historyData || historyData.length === 0) return []
    const seen = new Set<string>()
    return historyData.filter((item: HistoryItem) => {
      if (String(item.oldValue ?? '').trim() === String(item.newValue ?? '').trim()) return false
      const timeKey = item.createdAt ? new Date(item.createdAt).toISOString().slice(0, 16) : ''
      const key = `${item.fieldName}_${item.oldValue || ''}_${item.newValue || ''}_${timeKey}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [historyData])

  // Group edits created within the same minute by the same user into a single audit session
  const groupedData = useMemo(() => {
    if (!uniqueHistoryData || uniqueHistoryData.length === 0) return []

    const groupsMap = new Map<string, GroupedHistory>()

    const sorted = [...uniqueHistoryData].sort(
      (a: HistoryItem, b: HistoryItem) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )

    sorted.forEach((item: HistoryItem) => {
      const dateObj = new Date(item.createdAt)
      const minuteKey = `${dateObj.getFullYear()}-${dateObj.getMonth()}-${dateObj.getDate()}_${dateObj.getHours()}:${dateObj.getMinutes()}_${item.changedByName || 'unknown'}`

      if (!groupsMap.has(minuteKey)) {
        groupsMap.set(minuteKey, {
          groupKey: minuteKey,
          createdAt: item.createdAt,
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
  }, [uniqueHistoryData])

  if (!recordId) return null

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-xs text-slate-500 gap-2 font-medium">
        <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
        <span>Fetching audit log history...</span>
      </div>
    )
  }

  if (groupedData.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center bg-slate-50/50 space-y-2">
        <div className="mx-auto w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
          <History className="h-5 w-5" />
        </div>
        <p className="text-xs font-semibold text-slate-700">No Audit Trail Recorded</p>
        <p className="text-[11px] text-slate-400">No edits or field updates have been logged for this record yet.</p>
      </div>
    )
  }

  return (
    <div className="space-y-2.5">
      {groupedData.map((group) => {
        const isExpanded = !!expandedGroups[group.groupKey]
        const itemCount = group.items.length

        return (
          <div 
            key={group.groupKey} 
            className={`border rounded-xl bg-white overflow-hidden transition-all duration-200 ${
              isExpanded ? "border-blue-300 ring-2 ring-blue-500/10 shadow-sm" : "border-slate-200/80 hover:border-slate-300 shadow-2xs"
            }`}
          >
            {/* Tally Prime Style Header Bar */}
            <div 
              onClick={() => toggleGroup(group.groupKey)}
              className={`flex items-center justify-between px-3.5 py-3 cursor-pointer select-none transition-colors ${
                isExpanded ? "bg-blue-50/60 border-b border-blue-100" : "bg-slate-50/50 hover:bg-slate-100/60"
              }`}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                {/* Expand/Collapse Chevron Icon */}
                <div className={`p-1 rounded-md transition-all ${
                  isExpanded ? "bg-blue-600 text-white shadow-2xs" : "bg-slate-200/70 text-slate-600 hover:bg-slate-300/80"
                }`}>
                  {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                </div>

                {/* Audit Log Timestamp */}
                <div className="w-44 flex items-center gap-1.5 text-xs font-bold text-slate-800 whitespace-nowrap">
                  <Clock className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                  {fmtDateTime(group.createdAt)}
                </div>

                {/* Field Count Badge & Summary */}
                <div className="flex-1 flex items-center gap-2 min-w-0">
                  <Badge className="bg-blue-100/80 hover:bg-blue-100 text-blue-800 border-blue-200 text-[10px] px-2 py-0.5 font-semibold shrink-0">
                    {itemCount} {itemCount === 1 ? 'Field Updated' : 'Fields Updated'}
                  </Badge>
                  <span className="text-xs text-slate-500 truncate hidden md:inline font-medium">
                    ({group.summaryFields})
                  </span>
                </div>
              </div>

              {/* Changed By User */}
              <div className="flex items-center gap-1.5 text-xs text-slate-600 font-semibold shrink-0 ml-3 bg-white border border-slate-200/80 px-2.5 py-1 rounded-md shadow-2xs">
                <User className="h-3.5 w-3.5 text-slate-400" />
                <div className="flex flex-col items-start leading-tight text-left">
                  <span className="text-slate-700 capitalize">{group.changedByName}</span>
                  <span className="text-[10px] font-normal text-slate-400">{fmtDateTime(group.createdAt)}</span>
                </div>
              </div>
            </div>

            {/* Detailed Old vs New Field Comparison (Tally Audit Table) */}
            {isExpanded && (
              <div className="p-3.5 bg-white space-y-2.5">
                <div className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5 uppercase tracking-wider">
                  <FileEdit className="h-3.5 w-3.5 text-blue-600" />
                  Audit Edit Details:
                </div>
                <div className="rounded-lg border border-slate-200 overflow-hidden shadow-2xs">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100/90 text-slate-700 font-bold border-b border-slate-200">
                        <th className="py-2 px-3.5 w-1/4">Field Name</th>
                        <th className="py-2 px-3.5 w-1/3 text-amber-800 bg-amber-50/70 border-r border-slate-200">Old Value (Before)</th>
                        <th className="py-2 px-3.5 w-1/3 text-emerald-800 bg-emerald-50/70">New Value (After)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {group.items.map((item, idx) => (
                        <tr key={item.id || idx} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-2.5 px-3.5 font-bold text-slate-800 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0" />
                            {item.fieldName}
                          </td>
                          <td className="py-2.5 px-3.5 text-slate-600 bg-amber-50/20 border-r border-slate-200 font-mono text-[11px] break-all">
                            {item.oldValue ? (
                              <span className="text-slate-700">{fmtHistVal(item.oldValue)}</span>
                            ) : (
                              <span className="text-slate-400 italic text-[10px]">None / Blank</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3.5 bg-emerald-50/20 font-mono text-[11px] font-bold break-all">
                            {item.newValue ? (
                              <span className="text-emerald-950 flex items-center gap-1.5">
                                <ArrowRight className="h-3 w-3 text-emerald-600 shrink-0 hidden sm:inline" />
                                {fmtHistVal(item.newValue)}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic text-[10px]">Cleared / Empty</span>
                            )}
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
