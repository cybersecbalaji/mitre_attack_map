import { v4 as uuidv4 } from "uuid"
import { MappedRule, ATTACKTechnique } from "@/types"
import { fuzzyMatchTechnique } from "./fuzzyMatch"

const MAX_INPUT_SIZE = 5 * 1024 * 1024 // 5 MB
const MAX_LINES = 50000                // DoS guard

const T_CODE_PATTERN = /\b(T\d{4}(?:\.\d{3})?)\b/gi

export interface IngestionResult {
  rules: MappedRule[]
  skipped: { name: string; reason: string }[]
  fuzzyMatched: number
  totalParsed: number
  tcodesFound: number
}

/**
 * Parse plain text or CSV input where each line represents a rule.
 * Supported formats per line:
 *   T1059.003 - PowerShell Execution
 *   T1078, Valid Accounts Detection
 *   Detect LSASS Memory Access    (name only, fuzzy matched)
 */
export function parsePlainText(
  text: string,
  techniques: ATTACKTechnique[] = []
): IngestionResult {
  const result: IngestionResult = {
    rules: [],
    skipped: [],
    fuzzyMatched: 0,
    totalParsed: 0,
    tcodesFound: 0,
  }

  if (text.length > MAX_INPUT_SIZE) {
    result.skipped.push({ name: "input", reason: "Input too large (>5MB)" })
    return result
  }

  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length > MAX_LINES) {
    result.skipped.push({ name: "input", reason: `Too many lines (${lines.length} > ${MAX_LINES})` })
    return result
  }

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (line.startsWith("#") || line.startsWith("//")) continue // comments
    result.totalParsed += 1

    // Find all T-code patterns
    const tcodes = new Set<string>()
    const matches = Array.from(line.matchAll(T_CODE_PATTERN))
    for (const m of matches) tcodes.add(m[1].toUpperCase())

    // Extract a rule name: text after the T-codes, or the whole line if no T-code
    let name = line
    let confidence: "strong" | "partial" = "strong"

    if (tcodes.size > 0) {
      // Strip T-codes and common separators (-, –, —, ,, :, |) from the line to get the name
      name = line
        .replace(T_CODE_PATTERN, "")
        .replace(/^[\s\-–—,:|]+|[\s\-–—,:|]+$/g, "")
        .trim()
      if (!name) name = `Rule for ${Array.from(tcodes).join(", ")}`
    } else {
      // No T-code — try fuzzy match against techniques
      if (techniques.length === 0) {
        result.skipped.push({ name: line, reason: "No T-code and no technique list for fuzzy match" })
        continue
      }
      const match = fuzzyMatchTechnique(line, techniques)
      if (!match) {
        result.skipped.push({ name: line, reason: "No T-code and no fuzzy match found" })
        continue
      }
      tcodes.add(match.id)
      confidence = "partial"
      result.fuzzyMatched += 1
    }

    if (tcodes.size === 0) {
      result.skipped.push({ name: line, reason: "Could not map to any technique" })
      continue
    }

    result.tcodesFound += tcodes.size
    result.rules.push({
      id: uuidv4(),
      name: name.slice(0, 200),
      techniqueIds: Array.from(tcodes),
      confidence,
      source: "csv",
    })
  }

  return result
}

/** Build a rule from manual entry (single technique selection) */
export function buildManualRule(
  techniqueId: string,
  label?: string
): MappedRule {
  return {
    id: uuidv4(),
    name: label?.slice(0, 200) || `Manual mapping: ${techniqueId}`,
    techniqueIds: [techniqueId],
    confidence: "strong",
    source: "manual",
  }
}
