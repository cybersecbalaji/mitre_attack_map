import { parsePlainText, buildManualRule } from "@/lib/ruleIngestion"
import { ATTACKTechnique } from "@/types"

const techniques: ATTACKTechnique[] = [
  { id: "T1059", name: "Command and Scripting Interpreter", description: "", tactics: ["execution"], platforms: ["Windows"], subtechniques: [], isSubtechnique: false, url: "" },
  { id: "T1059.001", name: "PowerShell", description: "", tactics: ["execution"], platforms: ["Windows"], subtechniques: [], isSubtechnique: true, parentId: "T1059", url: "" },
  { id: "T1003.001", name: "LSASS Memory", description: "", tactics: ["credential-access"], platforms: ["Windows"], subtechniques: [], isSubtechnique: true, parentId: "T1003", url: "" },
]

describe("parsePlainText", () => {
  test("parses single-T-code line", () => {
    const result = parsePlainText("T1059 - PowerShell Execution")
    expect(result.totalParsed).toBe(1)
    expect(result.rules).toHaveLength(1)
    expect(result.rules[0].techniqueIds).toEqual(["T1059"])
    expect(result.rules[0].confidence).toBe("strong")
    expect(result.rules[0].name).toBe("PowerShell Execution")
  })

  test("parses sub-technique T-code", () => {
    const result = parsePlainText("T1059.003")
    expect(result.rules[0].techniqueIds).toEqual(["T1059.003"])
  })

  test("parses CSV format with comma", () => {
    const result = parsePlainText("T1078, Valid Accounts Detection")
    expect(result.rules[0].techniqueIds).toEqual(["T1078"])
    expect(result.rules[0].name).toBe("Valid Accounts Detection")
  })

  test("parses multiple T-codes per line", () => {
    const result = parsePlainText("T1059 T1003.001 - Multi tcode rule")
    expect(result.rules[0].techniqueIds.sort()).toEqual(["T1003.001", "T1059"])
  })

  test("ignores comment lines", () => {
    const result = parsePlainText("# this is a comment\nT1059\n// another comment")
    expect(result.totalParsed).toBe(1)
    expect(result.rules).toHaveLength(1)
  })

  test("ignores blank lines", () => {
    const result = parsePlainText("T1059\n\n\nT1003")
    expect(result.totalParsed).toBe(2)
    expect(result.rules).toHaveLength(2)
  })

  test("fuzzy matches name-only lines when techniques provided", () => {
    const result = parsePlainText("PowerShell Suspicious", techniques)
    expect(result.fuzzyMatched).toBe(1)
    expect(result.rules[0].confidence).toBe("partial")
    expect(result.rules[0].techniqueIds).toContain("T1059.001")
  })

  test("skips name-only lines when no fuzzy match found", () => {
    const result = parsePlainText("Random unmatchable garbage qwerty", techniques)
    expect(result.skipped.length).toBeGreaterThan(0)
    expect(result.rules).toHaveLength(0)
  })

  test("rejects oversized input", () => {
    const big = "T1059\n".repeat(50001)
    const result = parsePlainText(big)
    expect(result.skipped.length).toBeGreaterThan(0)
  })

  test("strips T-code from name to extract clean rule label", () => {
    const result = parsePlainText("T1059.001 — PowerShell Execution Rule")
    expect(result.rules[0].name).toBe("PowerShell Execution Rule")
  })

  test("OWASP — does not crash on malicious input with control chars", () => {
    const result = parsePlainText("T1059\x00\x01\x02 - Rule\nT1003")
    expect(result.rules.length).toBeGreaterThan(0)
  })

  test("OWASP — does not crash on extremely long single line", () => {
    const longLine = "T1059 " + "x".repeat(10000)
    const result = parsePlainText(longLine)
    expect(result.rules).toHaveLength(1)
    // Name is truncated to 200 chars
    expect(result.rules[0].name.length).toBeLessThanOrEqual(200)
  })
})

describe("buildManualRule", () => {
  test("creates a strong manual rule with technique ID", () => {
    const rule = buildManualRule("T1059")
    expect(rule.techniqueIds).toEqual(["T1059"])
    expect(rule.confidence).toBe("strong")
    expect(rule.source).toBe("manual")
    expect(rule.name).toContain("T1059")
  })

  test("uses provided label when given", () => {
    const rule = buildManualRule("T1059", "My Custom Label")
    expect(rule.name).toBe("My Custom Label")
  })

  test("truncates oversized labels", () => {
    const longLabel = "x".repeat(500)
    const rule = buildManualRule("T1059", longLabel)
    expect(rule.name.length).toBeLessThanOrEqual(200)
  })

  test("generates unique IDs per call", () => {
    const r1 = buildManualRule("T1059")
    const r2 = buildManualRule("T1059")
    expect(r1.id).not.toBe(r2.id)
  })
})
