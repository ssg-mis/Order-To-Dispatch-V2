"use client"

import { Label } from "@/components/ui/label"
import { MultiCombobox } from "@/components/ui/multi-combobox"

export type AgentTag = { agent_type: "broker" | "salesperson"; agent_id: number }

/**
 * Depot "Salesman / Broker Tags": two separate searchable multi-select dropdowns - one for Brokers, one for
 * Salespersons. The saved value is the same flat `agent_tags` array ({ agent_type, agent_id }) as before.
 * Inactive brokers/salespersons are not offered, except ones already tagged (so they can still be removed).
 */
export function AgentTagsPicker({
  value,
  onChange,
  brokerOptions = [],
  salespersonOptions = [],
  disabled = false,
  labelClassName = "text-xs font-semibold text-slate-800",
}: {
  labelClassName?: string
  value: AgentTag[]
  onChange: (tags: AgentTag[]) => void
  brokerOptions?: any[]
  salespersonOptions?: any[]
  disabled?: boolean
}) {
  const tags = value || []
  const idsOf = (type: AgentTag["agent_type"]) => tags.filter((t) => t.agent_type === type).map((t) => String(t.agent_id))

  const toOptions = (list: any[], type: AgentTag["agent_type"]) => {
    const tagged = new Set(idsOf(type))
    return (list || [])
      .filter((x: any) => x.status === "Active" || tagged.has(String(x.id)))
      .map((x: any) => ({ value: String(x.id), label: x.salesman_name || `#${x.id}` }))
  }

  const setType = (type: AgentTag["agent_type"], ids: string[]) => {
    const others = tags.filter((t) => t.agent_type !== type)
    onChange([...others, ...ids.map((id) => ({ agent_type: type, agent_id: Number(id) }))])
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
      <div className="space-y-1.5">
        <Label className={labelClassName}>Brokers</Label>
        <MultiCombobox
          options={toOptions(brokerOptions, "broker")}
          values={idsOf("broker")}
          onValuesChange={(ids) => setType("broker", ids)}
          placeholder="Select brokers"
          searchPlaceholder="Search broker..."
          emptyText="No broker found."
          disabled={disabled}
          className="text-xs"
        />
      </div>
      <div className="space-y-1.5">
        <Label className={labelClassName}>Salespersons</Label>
        <MultiCombobox
          options={toOptions(salespersonOptions, "salesperson")}
          values={idsOf("salesperson")}
          onValuesChange={(ids) => setType("salesperson", ids)}
          placeholder="Select salespersons"
          searchPlaceholder="Search salesperson..."
          emptyText="No salesperson found."
          disabled={disabled}
          className="text-xs"
        />
      </div>
    </div>
  )
}
