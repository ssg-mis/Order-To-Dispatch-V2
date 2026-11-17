"use client"

import { useRouter } from "next/navigation"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { OrderPunchForm } from "@/components/order-punch/order-punch-form"

export default function OrderPunchCreatePage() {
  const router = useRouter()

  return (
    <div className="p-6 max-w-full space-y-6" suppressHydrationWarning>
      <div className="flex items-center gap-3">
        <SidebarTrigger className="-ml-1" />
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Stage 1: Order Punch</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">Create a new order with customer and product details.</p>
        </div>
      </div>

      <OrderPunchForm
        onCancel={() => router.push("/order-punch")}
        onSuccess={() => router.push("/order-punch")}
      />
    </div>
  )
}
