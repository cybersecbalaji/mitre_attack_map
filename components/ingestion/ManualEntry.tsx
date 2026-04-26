"use client"
import { useState, useMemo } from "react"
import { ATTACKTechnique, MappedRule } from "@/types"
import { buildManualRule } from "@/lib/ruleIngestion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface ManualEntryProps {
  techniques: ATTACKTechnique[]
  onRulesIngested: (rules: MappedRule[]) => void
}

export function ManualEntry({ techniques, onRulesIngested }: ManualEntryProps) {
  const [search, setSearch] = useState("")
  const [label, setLabel] = useState("")
  const [selected, setSelected] = useState<ATTACKTechnique | null>(null)

  const filtered = useMemo(() => {
    if (search.length < 2) return []
    const q = search.toLowerCase()
    return techniques
      .filter((t) =>
        t.id.toLowerCase().includes(q) || t.name.toLowerCase().includes(q)
      )
      .slice(0, 10)
  }, [search, techniques])

  function handleAdd() {
    if (!selected) return
    onRulesIngested([buildManualRule(selected.id, label || undefined)])
    setSelected(null)
    setSearch("")
    setLabel("")
  }

  return (
    <div className="flex flex-col gap-2 p-2">
      <label className="text-[11px] text-slate-300 font-medium">
        Search technique by ID or name
      </label>
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="e.g. T1059 or PowerShell"
        className="bg-slate-800 border-slate-600 text-xs text-slate-200 h-8"
        data-testid="manual-search"
      />

      {filtered.length > 0 && (
        <div className="bg-slate-800 border border-slate-600 rounded-md max-h-48 overflow-y-auto">
          {filtered.map((t) => (
            <button
              key={t.id}
              onClick={() => { setSelected(t); setSearch(`${t.id} — ${t.name}`) }}
              className="w-full text-left px-2 py-1 text-xs text-slate-200 hover:bg-slate-700 border-b border-slate-700 last:border-b-0"
              data-testid={`manual-result-${t.id}`}
            >
              <span className="text-teal-400 font-mono">{t.id}</span>
              <span className="text-slate-300 ml-2">{t.name}</span>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <>
          <div className="text-[11px] text-slate-400">
            Selected: <span className="text-teal-400 font-mono">{selected.id}</span> — {selected.name}
          </div>
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Optional rule label"
            className="bg-slate-800 border-slate-600 text-xs text-slate-200 h-8"
            data-testid="manual-label"
          />
          <Button
            onClick={handleAdd}
            size="sm"
            className="bg-teal-700 hover:bg-teal-600 text-xs h-7"
            data-testid="manual-add"
          >
            Add to coverage
          </Button>
        </>
      )}

      {techniques.length === 0 && (
        <div className="text-slate-500 text-xs italic">
          Loading techniques...
        </div>
      )}
    </div>
  )
}
