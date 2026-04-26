"use client"
import { ATTACKTechnique, CoverageCell, TACTIC_NAMES } from "@/types"
import { TechniqueCell } from "./TechniqueCell"
import { ScrollArea } from "@/components/ui/scroll-area"

interface TacticColumnProps {
  tacticId: string
  techniques: ATTACKTechnique[]
  coverageMap: Map<string, CoverageCell>
  onTechniqueClick: (technique: ATTACKTechnique) => void
  tacticNames?: Record<string, string>
}

export function TacticColumn({ tacticId, techniques, coverageMap, onTechniqueClick, tacticNames }: TacticColumnProps) {
  const nameMap = tacticNames ?? TACTIC_NAMES
  const displayName = nameMap[tacticId] ?? tacticId
  const coveredCount = techniques.filter((t) => {
    const cell = coverageMap.get(t.id)
    return cell && cell.status !== "uncovered"
  }).length

  return (
    <div className="flex flex-col min-w-[108px] max-w-[108px]">
      {/* Tactic header */}
      <div
        className="px-1.5 py-1.5 text-center bg-slate-800 border-b border-slate-600 sticky top-0 z-10"
        title={displayName}
      >
        <div className="text-[10px] font-semibold text-teal-400 truncate leading-tight">
          {displayName}
        </div>
        <div className="text-[9px] text-slate-500 mt-0.5">
          {techniques.length} techniques
        </div>
        {coveredCount > 0 && (
          <div className="text-[8px] text-green-500">
            {coveredCount} covered
          </div>
        )}
      </div>

      {/* Techniques */}
      <div className="flex flex-col gap-0.5 p-0.5 overflow-y-auto">
        {techniques.map((technique) => (
          <TechniqueCell
            key={`${tacticId}-${technique.id}`}
            technique={technique}
            coverageCell={coverageMap.get(technique.id)}
            coverageMap={coverageMap}
            onClick={onTechniqueClick}
          />
        ))}
        {techniques.length === 0 && (
          <div className="text-slate-600 text-[9px] text-center py-2">
            No techniques
          </div>
        )}
      </div>
    </div>
  )
}
