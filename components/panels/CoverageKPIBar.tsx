"use client"
import { CoverageStats, MatrixView, DENSITY_COLORS } from "@/types"

export interface DensityStats {
  none: number    // 0 rules
  low: number     // 1 rule
  medium: number  // 2-3 rules
  high: number    // 4-5 rules
  over: number    // 6+ rules
}

interface CoverageKPIBarProps {
  stats: CoverageStats
  view?: MatrixView
  densityStats?: DensityStats
}

interface KPIChipProps {
  label: string
  value: number
  percent?: number
  color: string
  bgColor: string
  textColor: string
  testId?: string
}

function KPIChip({ label, value, percent, color, bgColor, textColor, testId }: KPIChipProps) {
  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 rounded-md border"
      style={{ backgroundColor: bgColor, borderColor: color + "40" }}
      data-testid={testId ?? `kpi-${label.toLowerCase().replace(/\s+/g, "-")}`}
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

export function CoverageKPIBar({ stats, view = "coverage", densityStats }: CoverageKPIBarProps) {
  if (view === "density" && densityStats) {
    const total = densityStats.none + densityStats.low + densityStats.medium + densityStats.high + densityStats.over
    return (
      <div
        className="flex items-center gap-3 flex-wrap"
        data-testid="coverage-kpi-bar"
        aria-label="Detection density statistics"
      >
        <KPIChip
          label="No coverage"
          value={densityStats.none}
          percent={total > 0 ? (densityStats.none / total) * 100 : 0}
          color={DENSITY_COLORS.none}
          bgColor="#0f172a"
          textColor="#94a3b8"
          testId="kpi-density-none"
        />
        <KPIChip
          label="1 rule"
          value={densityStats.low}
          percent={total > 0 ? (densityStats.low / total) * 100 : 0}
          color={DENSITY_COLORS.low}
          bgColor="#0f766e20"
          textColor={DENSITY_COLORS.low}
          testId="kpi-density-low"
        />
        <KPIChip
          label="2-3 rules"
          value={densityStats.medium}
          percent={total > 0 ? (densityStats.medium / total) * 100 : 0}
          color={DENSITY_COLORS.medium}
          bgColor="#14b8a620"
          textColor={DENSITY_COLORS.medium}
          testId="kpi-density-medium"
        />
        <KPIChip
          label="4-5 rules"
          value={densityStats.high}
          percent={total > 0 ? (densityStats.high / total) * 100 : 0}
          color={DENSITY_COLORS.high}
          bgColor="#5eead420"
          textColor={DENSITY_COLORS.high}
          testId="kpi-density-high"
        />
        <KPIChip
          label="6+ rules"
          value={densityStats.over}
          percent={total > 0 ? (densityStats.over / total) * 100 : 0}
          color={DENSITY_COLORS.over}
          bgColor="#78350f20"
          textColor={DENSITY_COLORS.over}
          testId="kpi-density-over"
        />
      </div>
    )
  }

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
