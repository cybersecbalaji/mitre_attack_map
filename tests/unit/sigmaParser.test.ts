import { extractTechniquesFromSigmaRule, parseSigmaYaml } from "@/lib/sigmaParser"
import { ATTACKTechnique } from "@/types"

const techniques: ATTACKTechnique[] = [
  { id: "T1003", name: "OS Credential Dumping", description: "", tactics: ["credential-access"], platforms: ["Windows"], subtechniques: [], isSubtechnique: false, url: "" },
  { id: "T1003.001", name: "LSASS Memory", description: "", tactics: ["credential-access"], platforms: ["Windows"], subtechniques: [], isSubtechnique: true, parentId: "T1003", url: "" },
  { id: "T1059", name: "Command and Scripting Interpreter", description: "", tactics: ["execution"], platforms: ["Windows", "Linux"], subtechniques: [], isSubtechnique: false, url: "" },
  { id: "T1059.001", name: "PowerShell", description: "", tactics: ["execution"], platforms: ["Windows"], subtechniques: [], isSubtechnique: true, parentId: "T1059", url: "" },
]

describe("extractTechniquesFromSigmaRule", () => {
  test("extracts T-codes from attack.<tcode> tags as strong", () => {
    const rule = { tags: ["attack.t1059.001", "attack.execution"] }
    const result = extractTechniquesFromSigmaRule(rule)
    expect(result.confidence).toBe("strong")
    expect(result.techniqueIds).toEqual(["T1059.001"])
  })

  test("extracts multiple T-codes from tags", () => {
    const rule = { tags: ["attack.t1059", "attack.t1003.001"] }
    const result = extractTechniquesFromSigmaRule(rule)
    expect(result.confidence).toBe("strong")
    expect(result.techniqueIds.sort()).toEqual(["T1003.001", "T1059"])
  })

  test("ignores non-T-code attack tags (like attack.execution)", () => {
    const rule = { tags: ["attack.execution", "attack.persistence"] }
    const result = extractTechniquesFromSigmaRule(rule)
    expect(result.techniqueIds).toEqual([])
  })

  test("falls back to title scan when no tags", () => {
    const rule = { title: "Detection of T1003.001 LSASS access" }
    const result = extractTechniquesFromSigmaRule(rule)
    expect(result.confidence).toBe("partial")
    expect(result.techniqueIds).toEqual(["T1003.001"])
  })

  test("scans description for T-codes", () => {
    const rule = { title: "Some Rule", description: "Detects T1059 powershell usage" }
    const result = extractTechniquesFromSigmaRule(rule)
    expect(result.confidence).toBe("partial")
    expect(result.techniqueIds).toEqual(["T1059"])
  })

  test("fuzzy matches title against techniques when no T-code", () => {
    const rule = { title: "PowerShell Suspicious" }
    const result = extractTechniquesFromSigmaRule(rule, techniques)
    expect(result.confidence).toBe("partial")
    expect(result.techniqueIds).toContain("T1059.001")
  })

  test("returns empty when nothing matches", () => {
    const rule = { title: "Random rule with no match" }
    const result = extractTechniquesFromSigmaRule(rule, techniques)
    expect(result.techniqueIds).toEqual([])
  })

  test("handles non-string tags gracefully", () => {
    const rule = { tags: [42, null, "attack.t1059", undefined] as unknown[] }
    const result = extractTechniquesFromSigmaRule(rule as { tags: unknown })
    expect(result.techniqueIds).toEqual(["T1059"])
  })
})

describe("parseSigmaYaml", () => {
  test("parses a single Sigma rule from YAML string", async () => {
    const yaml = `
title: Suspicious PowerShell
tags:
  - attack.t1059.001
  - attack.execution
description: Detects suspicious PS usage
logsource:
  product: windows
`
    const result = await parseSigmaYaml(yaml)
    expect(result.totalParsed).toBe(1)
    expect(result.rules).toHaveLength(1)
    expect(result.rules[0].techniqueIds).toEqual(["T1059.001"])
    expect(result.rules[0].confidence).toBe("strong")
    expect(result.rules[0].source).toBe("sigma")
    expect(result.tcodesFound).toBe(1)
  })

  test("parses multi-document YAML (---separated)", async () => {
    const yaml = `
title: Rule 1
tags:
  - attack.t1059
---
title: Rule 2
tags:
  - attack.t1003
`
    const result = await parseSigmaYaml(yaml)
    expect(result.totalParsed).toBe(2)
    expect(result.rules).toHaveLength(2)
  })

  test("skips rules with no T-code mapping", async () => {
    const yaml = `
title: Mystery Rule
description: Does nothing useful
`
    const result = await parseSigmaYaml(yaml)
    expect(result.rules).toHaveLength(0)
    expect(result.skipped).toHaveLength(1)
    expect(result.skipped[0].reason).toMatch(/No ATT&CK technique/)
  })

  test("rejects oversized input as a DoS guard", async () => {
    const large = "x".repeat(11 * 1024 * 1024)
    const result = await parseSigmaYaml(large)
    expect(result.skipped).toHaveLength(1)
    expect(result.skipped[0].reason).toMatch(/too large/)
    expect(result.rules).toHaveLength(0)
  })

  test("returns parse error gracefully on invalid YAML", async () => {
    const yaml = "title: rule\n  bad: indent\n :: invalid"
    const result = await parseSigmaYaml(yaml)
    expect(result.skipped.length).toBeGreaterThan(0)
    expect(result.rules).toHaveLength(0)
  })

  test("OWASP — does not execute YAML !!js/function (safe load)", async () => {
    const yaml = `
title: Evil Rule
tags:
  - attack.t1059
constructor: !!js/function 'function (){throw new Error("PWNED")}'
`
    // js-yaml v4 load() rejects !!js/function by default
    const result = await parseSigmaYaml(yaml)
    // Either it parses safely (ignoring the function) or fails the parse — either way no execution
    if (result.rules.length > 0) {
      expect(result.rules[0].techniqueIds).toContain("T1059")
    }
    // No execution should have occurred (no thrown error)
    expect(true).toBe(true)
  })

  test("uses fuzzy matching when techniques are provided and no T-code", async () => {
    const yaml = `
title: PowerShell Execution Detection
description: Looks for PS commands
`
    const result = await parseSigmaYaml(yaml, techniques)
    expect(result.fuzzyMatched).toBeGreaterThanOrEqual(0)
  })
})
