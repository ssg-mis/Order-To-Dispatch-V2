"use client"

import { useState } from "react"
import { Search, Loader2, MapPin, User, Calendar, Hash } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { orderLookupApi } from "@/lib/api-service"

interface LookupResult {
  orderNo: string
  customerName: string
  depoName: string
  manualSaudaNo: string | null
  createdAt: string
  currentStage: string
  isCompleted: boolean
}

function formatDate(dateStr: string) {
  if (!dateStr) return "—"
  try {
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) return dateStr
    return date.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" })
  } catch {
    return dateStr
  }
}

export default function DoLookupPage() {
  const [search, setSearch] = useState("")
  const [results, setResults] = useState<LookupResult[] | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  const runSearch = async () => {
    if (!search.trim()) return
    setIsLoading(true)
    setHasSearched(true)
    try {
      const res = await orderLookupApi.lookup(search.trim())
      setResults(res.success ? res.data ?? [] : [])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="p-8 max-w-[900px] mx-auto min-h-screen space-y-8 animate-in fade-in duration-700">
      <PageHeader
        title="Track DO"
        description="Search a DO number to find which workflow stage it's currently sitting at"
      />

      <Card className="border-none shadow-sm">
        <CardContent className="p-4">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search DO Number..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && runSearch()}
              />
            </div>
            <Button onClick={runSearch} disabled={isLoading || !search.trim()}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {hasSearched && !isLoading && (
        <div className="space-y-3">
          {results && results.length > 0 ? (
            results.map((r) => (
              <Card key={r.orderNo} className="border-none shadow-sm">
                <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-bold text-sm">{r.orderNo}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <User className="h-3.5 w-3.5" />
                      {r.customerName || "—"}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{r.depoName || "—"}</span>
                      <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{formatDate(r.createdAt)}</span>
                      {r.manualSaudaNo && <span>Sauda No: {r.manualSaudaNo}</span>}
                    </div>
                  </div>
                  <Badge
                    className={
                      r.isCompleted
                        ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                        : "bg-blue-100 text-blue-700 border-blue-200"
                    }
                  >
                    {r.currentStage}
                  </Badge>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card className="border-none shadow-sm">
              <CardContent className="p-8 text-center text-sm text-muted-foreground">
                No matching DO found.
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
