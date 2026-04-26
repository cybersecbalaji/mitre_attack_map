"use client"
import { useMemo } from "react"
import { ATTACKTechnique, CoverageMap, TACTIC_ORDER, TACTIC_NAMES } from "@/types"
import { TacticColumn } from "./TacticColumn"

interface AttackMatrixProps {
  techniques: ATTACKTechnique[]      // top-level techniques only
  coverageMap: CoverageMap
  platformFilter: string[]
  onTechniqueClick: (technique: ATTACKTechnique) => void
  tacticOrder?: readonly string[]
  tacticNames?: Record<string, string>
  ariaLabel?: string
}

export function AttackMatrix({
  techniques,
  coverageMap,
  platformFilter,
  onTechniqueClick,
  tacticOrder: customTacticOrder,
  tacticNames: customTacticNames,
  ariaLabel,
}: AttackMatrixProps) {
  const activeTacticOrder = customTacticOrder ?? TACTIC_ORDER
  const activeTacticNames = customTacticNames ?? TACTIC_NAMES

  // Group techniques by tactic, applying platform filter
  const tacticGroups = useMemo(() => {
    const groups = new Map<string, ATTACKTechnique[]>()

    // Initialise all tactics in order (even empty ones)
    for (const tactic of activeTacticOrder) {
      groups.set(tactic, [])
    }

    for (const technique of techniques) {
      // Apply platform filter: skip if platform filter is active and technique doesn't match
      if (platformFilter.length > 0) {
        const matches = technique.platforms.some((p) =>
          platformFilter.map((f) => f.toLowerCase()).includes(p.toLowerCase())
        )
        if (!matches) continue
      }

      // Add technique to each tactic it belongs to (a technique can span multiple tactics)
      for (const tactic of technique.tactics) {
        if (groups.has(tactic)) {
          groups.get(tactic)!.push(technique)
        }
      }
    }

    // Sort each tactic's techniques by ID
    for (const tacticId of Array.from(groups.keys())) {
      groups.get(tacticId)!.sort((a, b) => a.id.localeCompare(b.id))
    }

    return groups
  }, [techniques, platformFilter, activeTacticOrder])

  if (techniques.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500 text-sm">
        No techniques loaded
      </div>
    )
  }

  return (
    <div
      className="flex gap-px bg-slate-700 w-max min-w-full"
      data-testid="attack-matrix"
      role="grid"
      aria-label={ariaLabel ?? "MITRE ATT&CK Enterprise Matrix"}
    >
      {Array.from(activeTacticOrder).map((tacticId) => {
        const tacticTechniques = tacticGroups.get(tacticId) ?? []
        return (
          <div
            key={tacticId}
            role="gridcell"
            className="bg-slate-900"
          >
            <TacticColumn
              tacticId={tacticId}
              techniques={tacticTechniques}
              coverageMap={coverageMap}
              onTechniqueClick={onTechniqueClick}
              tacticNames={activeTacticNames}
            />
          </div>
        )
      })}
    </div>
  )
}
