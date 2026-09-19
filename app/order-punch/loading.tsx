import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export default function OrderPunchListLoading() {
  return (
    <div className="p-3 sm:p-6 max-w-full space-y-4 sm:space-y-6">
      <div className="flex justify-between items-center">
        <div className="space-y-2">
          <Skeleton className="h-9 w-[220px]" />
          <Skeleton className="h-5 w-[320px]" />
        </div>
        <Skeleton className="h-10 w-[130px]" />
      </div>

      <Card>
        <CardHeader className="space-y-3">
          <Skeleton className="h-7 w-[200px]" />
          <Skeleton className="h-8 w-full" />
        </CardHeader>
        <CardContent className="space-y-2 p-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
