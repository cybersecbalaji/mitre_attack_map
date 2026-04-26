"use client"
import { ATTACKTechnique, CoverageCell, COVERAGE_COLORS } from "@/types"
import { cn } from "@/lib/utils"

interface SubtechniqueCellProps {
  technique: ATTACKTechnique
  coverageCell?: CoverageCell
  onClick: (technique: ATTACKTechnique) => void
}

function getCellColor(cell?: CoverageCell): string {
  if (!cell) return COVERAGE_COLORS.uncovered
  return COVERAGE_COLORS[cell.status]
}

export function SubtechniqueCell({ technique, coverageCell, onClick }: SubtechniqueCellProps) {
  const bgColor = getCellColor(coverageCell)
  const isUncovered = !coverageCell || coverageCell.status === "uncovered"

  return (
    <div className="group relative">
      <button
        onClick={(e) => { e.stopPropagation(); onClick(technique) }}
        className={cn(
          "w-full text-left px-1.5 py-0.5 rounded-sm text-[9px] leading-tight transition-all duration-150",
          "focus:outline-none focus:ring-1 focus:ring-teal-400",
          "hover:brightness-125 hover:z-10 relative",
          isUncovered ? "text-slate-500 hover:text-slate-200" : "text-slate-900 font-medium"
        )}
        style={{ backgroundColor: bgColor, opacity: 0.9 }}
        title={`${technique.id}: ${technique.name}`}
        aria-label={`${technique.id}: ${technique.name}`}
      >
        <span className="block truncate font-mono" style={{ fontSize: "8px" }}>{technique.id}</span>
        <span className="block truncate">{technique.name}</span>
      </button>

      {/* Tooltip */}
      <div
        className={cn(
          "absolute left-full top-0 ml-1 z-50 w-52 p-2 rounded-md shadow-lg",
          "bg-slate-800 border border-slate-600 text-xs text-slate-200",
          "opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity",
          "hidden group-hover:block"
        )}
      >
        <div className="font-mono text-teal-400 text-[10px] mb-0.5">{technique.id}</div>
        <div className="font-semibold text-[11px] mb-1 leading-tight">{technique.name}</div>
        {technique.description && (
          <div className="text-slate-400 text-[10px] leading-tight line-clamp-2">
            {technique.description}
          </div>
        )}
        {coverageCell && coverageCell.rules.length > 0 && (
          <div className="mt-1 pt-1 border-t border-slate-600 text-teal-400 text-[10px]">
            {coverageCell.rules.length} rule{coverageCell.rules.length !== 1 ? "s" : ""} mapped
          </div>
        )}
      </div>
    </div>
  )
}
