"use client"
import { useMemo } from "react"
import { ATTACKTechnique, CoverageMap, CoverageStats, MappedRule } from "@/types"
import { buildCoverageMap, calculateCoverageStats } from "@/lib/coverageCalculator"

interface UseCoverageMapResult {
  coverageMap: CoverageMap
  coverageStats: CoverageStats
}

/**
 * Pure derivation hook: takes rules + techniques and returns the coverage map
 * and stats. No state, no side effects. Rules ownership lives in useWorkspace.
 */
export function useCoverageMap(
  rules: MappedRule[],
  techniques: ATTACKTechnique[]
): UseCoverageMapResult {
  const coverageMap = useMemo(
    () => buildCoverageMap(rules, techniques),
    [rules, techniques]
  )
  const coverageStats = useMemo(
    () => calculateCoverageStats(techniques, coverageMap),
    [techniques, coverageMap]
  )

  return { coverageMap, coverageStats }
}
