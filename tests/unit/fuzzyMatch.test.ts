import { fuzzyMatchTechnique, fuzzyMatchAll } from "@/lib/fuzzyMatch"
import { ATTACKTechnique } from "@/types"

const techniques: ATTACKTechnique[] = [
  { id: "T1003", name: "OS Credential Dumping", description: "", tactics: [], platforms: [], subtechniques: [], isSubtechnique: false, url: "" },
  { id: "T1003.001", name: "LSASS Memory", description: "", tactics: [], platforms: [], subtechniques: [], isSubtechnique: true, parentId: "T1003", url: "" },
  { id: "T1059", name: "Command and Scripting Interpreter", description: "", tactics: [], platforms: [], subtechniques: [], isSubtechnique: false, url: "" },
  { id: "T1059.001", name: "PowerShell", description: "", tactics: [], platforms: [], subtechniques: [], isSubtechnique: true, parentId: "T1059", url: "" },
  { id: "T1078", name: "Valid Accounts", description: "", tactics: [], platforms: [], subtechniques: [], isSubtechnique: false, url: "" },
]

describe("fuzzyMatchTechnique", () => {
  test("matches exact technique name", () => {
    const match = fuzzyMatchTechnique("PowerShell", techniques)
    expect(match?.id).toBe("T1059.001")
  })

  test("matches partial name", () => {
    const match = fuzzyMatchTechnique("LSASS Memory Dump", techniques)
    expect(match?.id).toBe("T1003.001")
  })

  test("returns null when no match exceeds threshold", () => {
    const match = fuzzyMatchTechnique("Completely unrelated random query", techniques)
    expect(match).toBeNull()
  })

  test("returns null for empty input", () => {
    const match = fuzzyMatchTechnique("", techniques)
    expect(match).toBeNull()
  })

  test("ignores stopwords", () => {
    // "Detect" and "Rule" are stopwords; only "PowerShell" should match
    const match = fuzzyMatchTechnique("Detect PowerShell Rule", techniques)
    expect(match?.id).toBe("T1059.001")
  })

  test("matches valid accounts", () => {
    const match = fuzzyMatchTechnique("Valid Accounts Detection", techniques)
    expect(match?.id).toBe("T1078")
  })

  test("respects threshold parameter", () => {
    // Lower threshold = more permissive
    const lenient = fuzzyMatchTechnique("Memory access pattern", techniques, 0.1)
    const strict = fuzzyMatchTechnique("Memory access pattern", techniques, 0.9)
    expect(lenient).not.toBeNull()
    expect(strict).toBeNull()
  })
})

describe("fuzzyMatchAll", () => {
  test("returns multiple matches sorted by score", () => {
    const matches = fuzzyMatchAll("Credential Dumping Memory", techniques, 0.1)
    expect(matches.length).toBeGreaterThan(0)
    // Scores should be sorted descending
    for (let i = 1; i < matches.length; i++) {
      expect(matches[i - 1].score).toBeGreaterThanOrEqual(matches[i].score)
    }
  })

  test("respects limit parameter", () => {
    const matches = fuzzyMatchAll("Credential", techniques, 0.1, 2)
    expect(matches.length).toBeLessThanOrEqual(2)
  })

  test("returns empty array on no matches", () => {
    const matches = fuzzyMatchAll("xyzqwerty", techniques)
    expect(matches).toEqual([])
  })
})
