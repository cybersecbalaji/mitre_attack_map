"use client"
import { useMemo } from "react"
import { ATTACKTechnique } from "@/types"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"

interface DataSourceFilterProps {
  techniques: ATTACKTechnique[]
  selected: string[]   // selected DS ids, e.g. ["DS0009"]
  onChange: (selected: string[]) => void
}

export function DataSourceFilter({ techniques, selected, onChange }: DataSourceFilterProps) {
  // Derive unique data sources from loaded techniques (deduplicated by DS id)
  const availableSources = useMemo(() => {
    const seen = new Map<string, string>() // id → name
    for (const t of techniques) {
      for (const ds of t.dataSources) {
        if (!seen.has(ds.id)) seen.set(ds.id, ds.name)
      }
    }
    return Array.from(seen.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [techniques])

  if (availableSources.length === 0) return null

  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id])
  }

  const clearAll = () => onChange([])

  const label =
    selected.length === 0
      ? "All data sources"
      : selected.length === 1
        ? (availableSources.find((s) => s.id === selected[0])?.name ?? selected[0])
        : `${selected.length} data sources`

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="text-xs border-slate-600 h-8 px-2 gap-1.5"
          data-testid="data-source-filter-trigger"
        >
          <span className="text-slate-400">Data source:</span>
          <span className="text-slate-200">{label}</span>
          <span className="text-slate-500 text-[10px]">▾</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="bg-slate-800 border-slate-600 text-slate-200 w-64 max-h-80 overflow-y-auto"
        data-testid="data-source-filter-menu"
      >
        <DropdownMenuLabel className="text-slate-400 text-xs">
          Filter by log/telemetry source
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-slate-700" />
        {availableSources.map(({ id, name }) => (
          <DropdownMenuCheckboxItem
            key={id}
            checked={selected.includes(id)}
            onCheckedChange={() => toggle(id)}
            onSelect={(e) => e.preventDefault()}
            className="text-xs hover:bg-slate-700 focus:bg-slate-700"
            data-testid={`data-source-option-${id.toLowerCase()}`}
          >
            <span>{name}</span>
            <span className="ml-1.5 text-slate-500 text-[9px] font-mono">{id}</span>
          </DropdownMenuCheckboxItem>
        ))}
        {selected.length > 0 && (
          <>
            <DropdownMenuSeparator className="bg-slate-700" />
            <button
              onClick={clearAll}
              className="w-full text-left px-2 py-1.5 text-xs text-red-400 hover:bg-slate-700 rounded-sm"
              data-testid="data-source-filter-clear"
            >
              Clear all
            </button>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
