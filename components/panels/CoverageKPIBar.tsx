"use client"
import { CoverageStats } from "@/types"
import { Badge } from "@/components/ui/badge"

interface CoverageKPIBarProps {
  stats: CoverageStats
}

interface KPIChipProps {
  label: string
  value: number
  percent?: number
  color: string
  bgColor: string
  textColor: string
}

function KPIChip({ label, value, percent, color, bgColor, textColor }: KPIChipProps) {
  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 rounded-md border"
      style={{ backgroundColor: bgColor, borderColor: color + "40" }}
      data-testid={`kpi-${label.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <div
        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
        style={{ backgroundColor: color }}
      />
      <div>
        <div className="text-[10px] text-slate-400 leading-none">{label}</div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-sm font-bold" style={{ color: textColor }}>
            {value.toLocaleString()}
          </span>
          {percent !== undefined && (
            <span className="text-[10px] text-slate-400">
              {percent.toFixed(1)}%
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

export function CoverageKPIBar({ stats }: CoverageKPIBarProps) {
  return (
    <div
      className="flex items-center gap-3 flex-wrap"
      data-testid="coverage-kpi-bar"
      aria-label="Coverage statistics"
    >
      <KPIChip
        label="Total Techniques"
        value={stats.total}
        color="#64748b"
        bgColor="#1e293b"
        textColor="#94a3b8"
      />
      <KPIChip
        label="Covered"
        value={stats.covered}
        percent={stats.coveragePercent}
        color="#22c55e"
        bgColor="#14532d20"
        textColor="#22c55e"
      />
      <KPIChip
        label="Partial"
        value={stats.partial}
        percent={stats.partialPercent}
        color="#f59e0b"
        bgColor="#78350f20"
        textColor="#f59e0b"
      />
      <KPIChip
        label="Not Covered"
        value={stats.uncovered}
        percent={stats.total > 0 ? (stats.uncovered / stats.total) * 100 : 0}
        color="#ef4444"
        bgColor="#450a0a20"
        textColor="#ef4444"
      />
    </div>
  )
}
