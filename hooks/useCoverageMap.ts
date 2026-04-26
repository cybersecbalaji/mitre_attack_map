"use client"
import { useState, useMemo } from "react"
import { ATTACKTechnique, CoverageMap, CoverageStats, MappedRule } from "@/types"
import { buildCoverageMap, calculateCoverageStats } from "@/lib/coverageCalculator"

interface UseCoverageMapResult {
  coverageMap: CoverageMap
  coverageStats: CoverageStats
  rules: MappedRule[]
  addRules: (newRules: MappedRule[]) => void
  clearRules: () => void
  replaceRules: (newRules: MappedRule[]) => void
}

export function useCoverageMap(techniques: ATTACKTechnique[]): UseCoverageMapResult {
  const [rules, setRules] = useState<MappedRule[]>([])

  const coverageMap = useMemo(() => buildCoverageMap(rules, techniques), [rules, techniques])
  const coverageStats = useMemo(() => calculateCoverageStats(techniques, coverageMap), [techniques, coverageMap])

  const addRules = (newRules: MappedRule[]) => {
    setRules((prev) => {
      const existing = new Set(prev.map((r) => r.id))
      return [...prev, ...newRules.filter((r) => !existing.has(r.id))]
    })
  }

  const clearRules = () => setRules([])

  const replaceRules = (newRules: MappedRule[]) => setRules(newRules)

  return { coverageMap, coverageStats, rules, addRules, clearRules, replaceRules }
}
