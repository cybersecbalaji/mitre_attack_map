import { ATTACKTechnique, CoverageCell, CoverageMap, CoverageStats, MappedRule } from "@/types"

export function buildCoverageMap(
  rules: MappedRule[],
  techniques: ATTACKTechnique[]
): CoverageMap {
  const map: CoverageMap = new Map()

  // Initialise all techniques as uncovered
  for (const technique of techniques) {
    map.set(technique.id, {
      techniqueId: technique.id,
      status: "uncovered",
      rules: [],
    })
  }

  // Apply rules
  for (const rule of rules) {
    for (const techniqueId of rule.techniqueIds) {
      const cell = map.get(techniqueId)
      if (!cell) continue // rule references an unknown technique ID

      // Add rule to cell
      cell.rules.push(rule)

      // Update status: "covered" (strong) beats "partial"
      if (rule.confidence === "strong") {
        cell.status = "covered"
      } else if (cell.status === "uncovered") {
        cell.status = "partial"
      }
    }
  }

  return map
}

export function calculateCoverageStats(
  techniques: ATTACKTechnique[],
  coverageMap: CoverageMap
): CoverageStats {
  const total = techniques.length

  let covered = 0
  let partial = 0
  let uncovered = 0

  for (const technique of techniques) {
    const cell = coverageMap.get(technique.id)
    if (!cell || cell.status === "uncovered") {
      uncovered++
    } else if (cell.status === "covered") {
      covered++
    } else if (cell.status === "partial") {
      partial++
    }
  }

  return {
    total,
    covered,
    partial,
    uncovered,
    coveragePercent: total > 0 ? (covered / total) * 100 : 0,
    partialPercent: total > 0 ? (partial / total) * 100 : 0,
  }
}
