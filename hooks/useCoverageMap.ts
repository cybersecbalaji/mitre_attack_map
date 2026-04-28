"use client"
import { useState, useMemo, useEffect } from "react"
import { ATTACKTechnique, CoverageMap, CoverageStats, MappedRule } from "@/types"
import { buildCoverageMap, calculateCoverageStats } from "@/lib/coverageCalculator"

// Fallback key for local-only mode (when InstantDB not configured)
const RULES_STORAGE_KEY = "attackmap_active_rules"

interface UseCoverageMapProps {
  techniques: ATTACKTechnique[]
  workspaceRules?: MappedRule[]
  onRulesChange?: (rules: MappedRule[]) => Promise<void>
}

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

export function useCoverageMap({
  techniques,
  workspaceRules,
  onRulesChange,
}: UseCoverageMapProps): UseCoverageMapResult {
  // If workspace rules are provided, use them; otherwise load from localStorage
  const [rules, setRules] = useState<MappedRule[]>(() => workspaceRules ?? loadRulesFromStorage())

  // Sync workspace rules when they change (from InstantDB)
  useEffect(() => {
    if (workspaceRules) {
      setRules(workspaceRules)
    }
  }, [workspaceRules])

  const coverageMap = useMemo(() => buildCoverageMap(rules, techniques), [rules, techniques])
  const coverageStats = useMemo(() => calculateCoverageStats(techniques, coverageMap), [techniques, coverageMap])

  // Persist on every change via workspace callback or localStorage
  useEffect(() => {
    if (onRulesChange) {
      onRulesChange(rules)
    } else {
      // Fallback: save to localStorage when no workspace callback
      try {
        if (rules.length === 0) {
          localStorage.removeItem(RULES_STORAGE_KEY)
        } else {
          localStorage.setItem(RULES_STORAGE_KEY, JSON.stringify(rules))
        }
      } catch {}
    }
  }, [rules, onRulesChange])

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
