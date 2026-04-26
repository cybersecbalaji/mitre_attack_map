import { ATTACKTechnique } from "@/types"

export const STIX_URL =
  "https://raw.githubusercontent.com/mitre-attack/attack-stix-data/master/enterprise-attack/enterprise-attack.json"

const MAX_RESPONSE_BYTES = 100 * 1024 * 1024 // 100 MB guard (STIX bundle is ~50MB)

// Module-level cache so re-renders don't re-fetch
let cachedTechniques: ATTACKTechnique[] | null = null

interface StixObject {
  type: string
  id: string
  name: string
  description?: string
  x_mitre_deprecated?: boolean
  revoked?: boolean
  x_mitre_platforms?: string[]
  x_mitre_is_subtechnique?: boolean
  kill_chain_phases?: { kill_chain_name: string; phase_name: string }[]
  external_references?: { source_name: string; external_id?: string; url?: string }[]
}

interface StixBundle {
  objects: StixObject[]
}

function truncateDescription(desc: string | undefined): string {
  if (!desc) return ""
  // Take first paragraph only
  const firstPara = desc.split(/\n\n/)[0].replace(/\s+/g, " ").trim()
  return firstPara.length > 300 ? firstPara.slice(0, 297) + "…" : firstPara
}

function extractTechniqueId(obj: StixObject): string | null {
  const ref = obj.external_references?.find((r) => r.source_name === "mitre-attack")
  return ref?.external_id ?? null
}

function extractTactics(obj: StixObject): string[] {
  return (
    obj.kill_chain_phases
      ?.filter((p) => p.kill_chain_name === "mitre-attack")
      .map((p) => p.phase_name) ?? []
  )
}

function buildTechniqueUrl(techniqueId: string): string {
  // e.g. T1059 → /techniques/T1059/ or T1059.003 → /techniques/T1059/003/
  const parts = techniqueId.split(".")
  if (parts.length === 2) {
    return `https://attack.mitre.org/techniques/${parts[0]}/${parts[1]}/`
  }
  return `https://attack.mitre.org/techniques/${techniqueId}/`
}

export async function fetchAndParseSTIX(signal?: AbortSignal): Promise<ATTACKTechnique[]> {
  if (cachedTechniques) return cachedTechniques

  const response = await fetch(STIX_URL, {
    headers: { Accept: "application/json" },
    signal,
    // No credentials — this is a public CDN
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch ATT&CK STIX data: HTTP ${response.status}`)
  }

  // Guard against oversized responses
  const contentLength = response.headers.get("content-length")
  if (contentLength && parseInt(contentLength, 10) > MAX_RESPONSE_BYTES) {
    throw new Error("ATT&CK STIX response too large — possible tampering")
  }

  const text = await response.text()
  if (text.length > MAX_RESPONSE_BYTES) {
    throw new Error("ATT&CK STIX response exceeded size limit")
  }

  let bundle: StixBundle
  try {
    bundle = JSON.parse(text)
  } catch {
    throw new Error("Invalid JSON in ATT&CK STIX response")
  }

  if (!bundle || !Array.isArray(bundle.objects)) {
    throw new Error("Unexpected STIX bundle structure")
  }

  // Parse all valid attack-pattern objects
  const rawTechniques = bundle.objects.filter(
    (obj): obj is StixObject =>
      obj.type === "attack-pattern" &&
      !obj.x_mitre_deprecated &&
      !obj.revoked
  )

  // Build a map from technique ID → ATTACKTechnique (without subtechniques populated yet)
  const techniqueMap = new Map<string, ATTACKTechnique>()

  for (const obj of rawTechniques) {
    const id = extractTechniqueId(obj)
    if (!id) continue

    const technique: ATTACKTechnique = {
      id,
      name: obj.name,
      description: truncateDescription(obj.description),
      tactics: extractTactics(obj),
      platforms: obj.x_mitre_platforms ?? [],
      subtechniques: [],
      isSubtechnique: obj.x_mitre_is_subtechnique ?? id.includes("."),
      parentId: id.includes(".") ? id.split(".")[0] : undefined,
      url: buildTechniqueUrl(id),
    }

    techniqueMap.set(id, technique)
  }

  const allTechniqueValues = Array.from(techniqueMap.values())

  // Attach subtechniques to their parents
  for (const technique of allTechniqueValues) {
    if (technique.isSubtechnique && technique.parentId) {
      const parent = techniqueMap.get(technique.parentId)
      if (parent) {
        parent.subtechniques.push(technique)
      }
    }
  }

  // Sort subtechniques by ID within each parent
  for (const technique of allTechniqueValues) {
    technique.subtechniques.sort((a, b) => a.id.localeCompare(b.id))
  }

  // Return only top-level techniques (subtechniques are nested inside parents)
  const topLevel = allTechniqueValues
    .filter((t) => !t.isSubtechnique)
    .sort((a, b) => a.id.localeCompare(b.id))

  cachedTechniques = topLevel
  return topLevel
}

/** Reset the module-level cache (for testing) */
export function clearSTIXCache(): void {
  cachedTechniques = null
}

/** Get all techniques including subtechniques as a flat list */
export function flattenTechniques(techniques: ATTACKTechnique[]): ATTACKTechnique[] {
  const result: ATTACKTechnique[] = []
  for (const t of techniques) {
    result.push(t)
    result.push(...t.subtechniques)
  }
  return result
}
