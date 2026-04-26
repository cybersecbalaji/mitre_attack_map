"use client"
import { useState } from "react"
import { ATTACKTechnique, CoverageCell, COVERAGE_COLORS, DENSITY_COLORS, MatrixView } from "@/types"
import { SubtechniqueCell } from "./SubtechniqueCell"
import { cn } from "@/lib/utils"

interface TechniqueCellProps {
  technique: ATTACKTechnique
  coverageCell?: CoverageCell
  coverageMap: Map<string, CoverageCell>
  onClick: (technique: ATTACKTechnique) => void
  view?: MatrixView
}

function getCoverageColor(cell?: CoverageCell): string {
  if (!cell) return COVERAGE_COLORS.uncovered
  return COVERAGE_COLORS[cell.status]
}

function getDensityColor(ruleCount: number): string {
  if (ruleCount === 0) return DENSITY_COLORS.none
  if (ruleCount === 1) return DENSITY_COLORS.low
  if (ruleCount <= 3) return DENSITY_COLORS.medium
  if (ruleCount <= 5) return DENSITY_COLORS.high
  return DENSITY_COLORS.over
}

export function TechniqueCell({ technique, coverageCell, coverageMap, onClick, view = "coverage" }: TechniqueCellProps) {
  const [expanded, setExpanded] = useState(false)
  const hasSubtechniques = technique.subtechniques.length > 0

  const ruleCount = coverageCell?.rules.length ?? 0
  const bgColor = view === "density" ? getDensityColor(ruleCount) : getCoverageColor(coverageCell)
  const isDark = view === "density" ? ruleCount <= 1 : (!coverageCell || coverageCell.status === "uncovered")

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onClick(technique)
  }

  const handleExpandToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    setExpanded((prev) => !prev)
  }

  return (
    <div>
      {/* Tooltip wrapper */}
      <div className="group relative">
        <button
          onClick={handleClick}
          className={cn(
            "w-full text-left px-1.5 py-0.5 rounded-sm text-[10px] leading-tight transition-all duration-150",
            "focus:outline-none focus:ring-1 focus:ring-teal-400",
            "hover:brightness-125 hover:z-10 hover:shadow-md relative",
            isDark ? "text-slate-400 hover:text-slate-200" : "text-slate-900 font-medium"
          )}
          style={{ backgroundColor: bgColor }}
          title={`${technique.id}: ${technique.name}`}
          aria-label={`${technique.id}: ${technique.name}${hasSubtechniques ? ` (${technique.subtechniques.length} sub-techniques)` : ""}`}
        >
          <span className="block truncate font-mono" style={{ fontSize: "9px" }}>{technique.id}</span>
          <span className="block truncate">{technique.name}</span>
          {view === "density" && ruleCount > 0 && (
            <span
              className="absolute right-0.5 bottom-0.5 text-[8px] font-mono opacity-80 px-0.5 rounded"
              aria-label={`${ruleCount} rules`}
            >
              {ruleCount}
            </span>
          )}
          {hasSubtechniques && (
            <button
              onClick={handleExpandToggle}
              className="absolute right-0.5 top-0.5 text-[8px] opacity-70 hover:opacity-100 px-0.5 rounded"
              aria-label={expanded ? "Collapse sub-techniques" : "Expand sub-techniques"}
            >
              {expanded ? "▲" : "▼"}{technique.subtechniques.length}
            </button>
          )}
        </button>

        {/* Tooltip */}
        <div
          className={cn(
            "absolute left-full top-0 ml-1 z-50 w-56 p-2 rounded-md shadow-lg",
            "bg-slate-800 border border-slate-600 text-xs text-slate-200",
            "opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150",
            "hidden group-hover:block"
          )}
        >
          <div className="font-mono text-teal-400 text-[11px] mb-1">{technique.id}</div>
          <div className="font-semibold mb-1 leading-tight">{technique.name}</div>
          {technique.description && (
            <div className="text-slate-400 text-[10px] leading-tight line-clamp-3">
              {technique.description}
            </div>
          )}
          {coverageCell && coverageCell.rules.length > 0 && (
            <div className="mt-1.5 pt-1.5 border-t border-slate-600">
              <div className="text-teal-400 text-[10px] font-medium mb-0.5">
                {coverageCell.rules.length} rule{coverageCell.rules.length !== 1 ? "s" : ""} mapped
              </div>
              {coverageCell.rules.slice(0, 3).map((r) => (
                <div key={r.id} className="text-slate-300 text-[9px] truncate">
                  • {r.name}
                </div>
              ))}
            </div>
          )}
          {hasSubtechniques && (
            <div className="mt-1 text-slate-500 text-[10px]">
              {technique.subtechniques.length} sub-technique{technique.subtechniques.length !== 1 ? "s" : ""}
            </div>
          )}
        </div>
      </div>

      {/* Sub-techniques (expanded) */}
      {expanded && hasSubtechniques && (
        <div className="ml-2 mt-0.5 flex flex-col gap-0.5">
          {technique.subtechniques.map((sub) => (
            <SubtechniqueCell
              key={sub.id}
              technique={sub}
              coverageCell={coverageMap.get(sub.id)}
              onClick={onClick}
            />
          ))}
        </div>
      )}
    </div>
  )
}
