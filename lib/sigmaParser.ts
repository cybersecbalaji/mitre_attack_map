import yaml from "js-yaml"
import JSZip from "jszip"
import { v4 as uuidv4 } from "uuid"
import { MappedRule, ATTACKTechnique } from "@/types"
import { fuzzyMatchTechnique } from "./fuzzyMatch"

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB per file
const MAX_ZIP_FILES = 1000             // OWASP zip-bomb / DoS guard

const T_CODE_PATTERN = /\b(T\d{4}(?:\.\d{3})?)\b/gi

interface SigmaRuleObject {
  title?: unknown
  description?: unknown
  tags?: unknown
  logsource?: unknown
}

export interface SigmaParseResult {
  rules: MappedRule[]
  skipped: { name: string; reason: string }[]
  fuzzyMatched: number
  totalParsed: number
  tcodesFound: number
}

function isString(v: unknown): v is string {
  return typeof v === "string"
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.filter(isString)
}

interface ExtractResult {
  techniqueIds: string[]
  confidence: "strong" | "partial"
}

export function extractTechniquesFromSigmaRule(
  rule: SigmaRuleObject,
  techniques?: ATTACKTechnique[]
): ExtractResult {
  const found = new Set<string>()
  const tags = asStringArray(rule.tags)

  // Primary: extract from tags field
  for (const tag of tags) {
    const match = tag.toLowerCase().match(/^attack\.(t\d{4}(?:\.\d{3})?)$/)
    if (match) {
      found.add(match[1].toUpperCase())
    }
  }

  if (found.size > 0) {
    return { techniqueIds: Array.from(found), confidence: "strong" }
  }

  // Secondary: scan title + description for T-code patterns
  const title = isString(rule.title) ? rule.title : ""
  const description = isString(rule.description) ? rule.description : ""
  const text = `${title} ${description}`
  const matches = Array.from(text.matchAll(T_CODE_PATTERN))
  for (const m of matches) {
    found.add(m[1].toUpperCase())
  }

  if (found.size > 0) {
    return { techniqueIds: Array.from(found), confidence: "partial" }
  }

  // Tertiary: fuzzy match the title against technique names
  if (techniques && title) {
    const match = fuzzyMatchTechnique(title, techniques)
    if (match) {
      return { techniqueIds: [match.id], confidence: "partial" }
    }
  }

  return { techniqueIds: [], confidence: "partial" }
}

export async function parseSigmaYaml(
  content: string,
  techniques?: ATTACKTechnique[],
  filename = "rule.yml"
): Promise<SigmaParseResult> {
  const result: SigmaParseResult = {
    rules: [],
    skipped: [],
    fuzzyMatched: 0,
    totalParsed: 0,
    tcodesFound: 0,
  }

  // Reject oversized input (DoS guard)
  if (content.length > MAX_FILE_SIZE) {
    result.skipped.push({ name: filename, reason: "File too large (>10MB)" })
    return result
  }

  let parsed: unknown
  try {
    // js-yaml v4: load() is safe by default (FAILSAFE_SCHEMA does not allow !!js/function etc.)
    // We use loadAll for multi-document YAML files (common in Sigma)
    const docs: unknown[] = []
    yaml.loadAll(content, (doc) => {
      if (doc !== null && doc !== undefined) docs.push(doc)
    })
    parsed = docs.length === 1 ? docs[0] : docs
  } catch (err) {
    const msg = err instanceof Error ? err.message : "YAML parse error"
    result.skipped.push({ name: filename, reason: `YAML parse failed: ${msg.slice(0, 80)}` })
    return result
  }

  const docs = Array.isArray(parsed) ? parsed : [parsed]

  for (const doc of docs) {
    if (!doc || typeof doc !== "object") {
      result.skipped.push({ name: filename, reason: "Not an object" })
      continue
    }

    const rule = doc as SigmaRuleObject
    const title = isString(rule.title) ? rule.title : "(untitled)"
    result.totalParsed += 1

    const { techniqueIds, confidence } = extractTechniquesFromSigmaRule(rule, techniques)

    if (techniqueIds.length === 0) {
      result.skipped.push({ name: title, reason: "No ATT&CK technique mapped" })
      continue
    }

    result.tcodesFound += techniqueIds.length
    if (confidence === "partial") result.fuzzyMatched += 1

    result.rules.push({
      id: uuidv4(),
      name: title,
      techniqueIds,
      confidence,
      source: "sigma",
      rawContent: content.slice(0, 4000), // truncated original for debugging
    })
  }

  return result
}

export async function parseSigmaZip(
  file: File,
  techniques?: ATTACKTechnique[]
): Promise<SigmaParseResult> {
  const result: SigmaParseResult = {
    rules: [],
    skipped: [],
    fuzzyMatched: 0,
    totalParsed: 0,
    tcodesFound: 0,
  }

  if (file.size > 50 * 1024 * 1024) {
    result.skipped.push({ name: file.name, reason: "ZIP too large (>50MB)" })
    return result
  }

  let zip: JSZip
  try {
    zip = await JSZip.loadAsync(file)
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error"
    result.skipped.push({ name: file.name, reason: `ZIP unreadable: ${msg.slice(0, 80)}` })
    return result
  }

  // OWASP DoS guard: limit number of entries
  const yamlEntries = Object.values(zip.files).filter((entry) => {
    if (entry.dir) return false
    const lower = entry.name.toLowerCase()
    return lower.endsWith(".yml") || lower.endsWith(".yaml")
  })

  if (yamlEntries.length > MAX_ZIP_FILES) {
    result.skipped.push({
      name: file.name,
      reason: `ZIP has too many YAML files (${yamlEntries.length} > ${MAX_ZIP_FILES})`,
    })
    return result
  }

  for (const entry of yamlEntries) {
    try {
      const content = await entry.async("string")
      // Per-file size guard (zip-bomb protection)
      if (content.length > MAX_FILE_SIZE) {
        result.skipped.push({ name: entry.name, reason: "Decompressed file too large" })
        continue
      }
      const fileResult = await parseSigmaYaml(content, techniques, entry.name)
      result.rules.push(...fileResult.rules)
      result.skipped.push(...fileResult.skipped)
      result.fuzzyMatched += fileResult.fuzzyMatched
      result.totalParsed += fileResult.totalParsed
      result.tcodesFound += fileResult.tcodesFound
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error"
      result.skipped.push({ name: entry.name, reason: `Read failed: ${msg.slice(0, 80)}` })
    }
  }

  return result
}
