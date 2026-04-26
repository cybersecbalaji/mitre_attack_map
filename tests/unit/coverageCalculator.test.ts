import { buildCoverageMap, calculateCoverageStats } from "@/lib/coverageCalculator"
import { ATTACKTechnique, MappedRule } from "@/types"

// Minimal technique fixtures
const makeTechnique = (id: string, tactics: string[] = ["execution"]): ATTACKTechnique => ({
  id,
  name: `Technique ${id}`,
  description: "",
  tactics,
  platforms: ["Windows"],
  subtechniques: [],
  isSubtechnique: false,
  url: `https://attack.mitre.org/techniques/${id}/`,
})

const techniques: ATTACKTechnique[] = [
  makeTechnique("T1059"),
  makeTechnique("T1078", ["defense-evasion", "persistence"]),
  makeTechnique("T1003"),
  makeTechnique("T1059.001"),
]

const makeRule = (id: string, techniqueIds: string[], confidence: "strong" | "partial" = "strong"): MappedRule => ({
  id,
  name: `Rule ${id}`,
  techniqueIds,
  confidence,
  source: "sigma",
})

describe("buildCoverageMap", () => {
  test("all techniques start as uncovered with no rules", () => {
    const map = buildCoverageMap([], techniques)
    for (const t of techniques) {
      expect(map.get(t.id)?.status).toBe("uncovered")
      expect(map.get(t.id)?.rules).toHaveLength(0)
    }
  })

  test("strong rule marks technique as covered", () => {
    const rules = [makeRule("r1", ["T1059"], "strong")]
    const map = buildCoverageMap(rules, techniques)
    expect(map.get("T1059")?.status).toBe("covered")
  })

  test("partial rule marks technique as partial when uncovered", () => {
    const rules = [makeRule("r1", ["T1059"], "partial")]
    const map = buildCoverageMap(rules, techniques)
    expect(map.get("T1059")?.status).toBe("partial")
  })

  test("strong rule beats partial: covered wins", () => {
    const rules = [
      makeRule("r1", ["T1059"], "partial"),
      makeRule("r2", ["T1059"], "strong"),
    ]
    const map = buildCoverageMap(rules, techniques)
    expect(map.get("T1059")?.status).toBe("covered")
  })

  test("partial rule does NOT downgrade covered", () => {
    const rules = [
      makeRule("r1", ["T1059"], "strong"),
      makeRule("r2", ["T1059"], "partial"),
    ]
    const map = buildCoverageMap(rules, techniques)
    expect(map.get("T1059")?.status).toBe("covered")
  })

  test("multiple rules accumulate in cell", () => {
    const rules = [
      makeRule("r1", ["T1059"], "strong"),
      makeRule("r2", ["T1059"], "partial"),
    ]
    const map = buildCoverageMap(rules, techniques)
    expect(map.get("T1059")?.rules).toHaveLength(2)
  })

  test("rule mapping multiple techniques updates all of them", () => {
    const rules = [makeRule("r1", ["T1059", "T1078"], "strong")]
    const map = buildCoverageMap(rules, techniques)
    expect(map.get("T1059")?.status).toBe("covered")
    expect(map.get("T1078")?.status).toBe("covered")
    expect(map.get("T1003")?.status).toBe("uncovered")
  })

  test("rule with unknown technique ID is silently ignored", () => {
    const rules = [makeRule("r1", ["T9999"], "strong")]
    const map = buildCoverageMap(rules, techniques)
    // No crash, all known techniques remain uncovered
    for (const t of techniques) {
      expect(map.get(t.id)?.status).toBe("uncovered")
    }
  })

  test("sub-techniques are tracked independently", () => {
    const rules = [makeRule("r1", ["T1059.001"], "strong")]
    const map = buildCoverageMap(rules, techniques)
    expect(map.get("T1059.001")?.status).toBe("covered")
    expect(map.get("T1059")?.status).toBe("uncovered") // parent unaffected
  })
})

describe("calculateCoverageStats", () => {
  test("zero stats when no rules", () => {
    const map = buildCoverageMap([], techniques)
    const stats = calculateCoverageStats(techniques, map)
    expect(stats.total).toBe(techniques.length)
    expect(stats.covered).toBe(0)
    expect(stats.partial).toBe(0)
    expect(stats.uncovered).toBe(techniques.length)
    expect(stats.coveragePercent).toBe(0)
    expect(stats.partialPercent).toBe(0)
  })

  test("100% covered when all techniques have strong rules", () => {
    const rules = techniques.map((t) => makeRule(`r-${t.id}`, [t.id], "strong"))
    const map = buildCoverageMap(rules, techniques)
    const stats = calculateCoverageStats(techniques, map)
    expect(stats.covered).toBe(techniques.length)
    expect(stats.coveragePercent).toBeCloseTo(100)
  })

  test("partial coverage percentages are correct", () => {
    // 1 strong covered, 1 partial, rest uncovered
    const rules = [
      makeRule("r1", ["T1059"], "strong"),
      makeRule("r2", ["T1078"], "partial"),
    ]
    const map = buildCoverageMap(rules, techniques)
    const stats = calculateCoverageStats(techniques, map)
    expect(stats.covered).toBe(1)
    expect(stats.partial).toBe(1)
    expect(stats.uncovered).toBe(2)
    expect(stats.coveragePercent).toBeCloseTo(25) // 1/4
    expect(stats.partialPercent).toBeCloseTo(25)  // 1/4
  })

  test("total is always the number of techniques passed in", () => {
    const subset = [techniques[0], techniques[1]]
    const map = buildCoverageMap([], subset)
    const stats = calculateCoverageStats(subset, map)
    expect(stats.total).toBe(2)
  })
})
