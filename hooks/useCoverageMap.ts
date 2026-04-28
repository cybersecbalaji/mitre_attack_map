"use client"
import { useState, useMemo, useEffect } from "react"
import { ATTACKTechnique, CoverageMap, CoverageStats, MappedRule } from "@/types"
import { buildCoverageMap, calculateCoverageStats } from "@/lib/coverageCalculator"

// Fixed key — not workspace-scoped, keeps it simple and avoids async workspace-ID race
const RULES_STORAGE_KEY = "attackmap_active_rules"

interface UseCoverageMapResult {
  coverageMap: CoverageMap
  coverageStats: CoverageStats
  rules: MappedRule[]
  addRules: (newRules: MappedRule[]) => void
  clearRules: () => void
  replaceRules: (newRules: MappedRule[]) => void
}

function loadRulesFromStorage(): MappedRule[] {
  if (typeof localStorage === "undefined") return []
  try {
    const raw = localStorage.getItem(RULES_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function useCoverageMap(techniques: ATTACKTechnique[]): UseCoverageMapResult {
  // Lazy initializer runs synchronously on first mount — no async race possible
  const [rules, setRules] = useState<MappedRule[]>(loadRulesFromStorage)

  const coverageMap = useMemo(() => buildCoverageMap(rules, techniques), [rules, techniques])
  const coverageStats = useMemo(() => calculateCoverageStats(techniques, coverageMap), [techniques, coverageMap])

  // Persist on every change
  useEffect(() => {
    try {
      if (rules.length === 0) {
        localStorage.removeItem(RULES_STORAGE_KEY)
      } else {
        localStorage.setItem(RULES_STORAGE_KEY, JSON.stringify(rules))
      }
    } catch {}
  }, [rules])

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
