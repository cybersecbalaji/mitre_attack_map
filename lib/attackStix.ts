import { ATTACKTechnique, DataSource, Mitigation } from "@/types"

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
  // data-component parent ref
  x_mitre_data_source_ref?: string
  // relationship fields
  relationship_type?: string
  source_ref?: string
  target_ref?: string
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
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch ATT&CK STIX data: HTTP ${response.status}`)
  }

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

  // --- Single pass: collect all object types ---
  const rawTechniques: StixObject[] = []
  // stix id → {DS0009, "Process"}
  const dataSourceByStixId = new Map<string, { id: string; name: string }>()
  // stix id → {component name, parent data-source stix id}
  const dataComponentByStixId = new Map<string, { name: string; parentStixId: string }>()
  // stix id → Mitigation
  const courseOfActionByStixId = new Map<string, Mitigation>()
  // attack-pattern stix id → ATT&CK technique id (T1059)
  const stixIdToAttackId = new Map<string, string>()
  // detects: data-component stix id → attack-pattern stix id
  const detectsRels: Array<{ sourceRef: string; targetRef: string }> = []
  // mitigates: course-of-action stix id → attack-pattern stix id
  const mitigatesRels: Array<{ sourceRef: string; targetRef: string }> = []
  // Fallback: parse x_mitre_data_sources strings directly from attack-pattern
  // Format: "Process: Process Creation" → { id: "process", name: "Process", component: "Process Creation" }
  const directDataSources = new Map<string, DataSource[]>()

  for (const obj of bundle.objects) {
    switch (obj.type) {
      case "attack-pattern": {
        if (obj.x_mitre_deprecated || obj.revoked) break
        rawTechniques.push(obj)
        const attackId = extractTechniqueId(obj)
        if (attackId) {
          stixIdToAttackId.set(obj.id, attackId)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const legacySources = (obj as any).x_mitre_data_sources as string[] | undefined
          if (legacySources?.length) {
            const sources: DataSource[] = []
            const seen = new Set<string>()
            for (const entry of legacySources) {
              const colonIdx = entry.indexOf(": ")
              if (colonIdx === -1) continue
              const sourceName = entry.slice(0, colonIdx).trim()
              const compName = entry.slice(colonIdx + 2).trim()
              const sourceId = sourceName.toLowerCase().replace(/\s+/g, "-")
              const key = `${sourceId}::${compName}`
              if (!seen.has(key)) {
                seen.add(key)
                sources.push({ id: sourceId, name: sourceName, component: compName })
              }
            }
            if (sources.length > 0) directDataSources.set(attackId, sources)
          }
        }
        break
      }
      case "x-mitre-data-source": {
        const dsId = obj.external_references?.find((r) => r.source_name === "mitre-attack")?.external_id
        if (dsId) dataSourceByStixId.set(obj.id, { id: dsId, name: obj.name })
        break
      }
      case "x-mitre-data-component": {
        dataComponentByStixId.set(obj.id, {
          name: obj.name,
          parentStixId: obj.x_mitre_data_source_ref ?? "",
        })
        break
      }
      case "course-of-action": {
        const mId = obj.external_references?.find((r) => r.source_name === "mitre-attack")?.external_id
        if (mId) {
          courseOfActionByStixId.set(obj.id, {
            id: mId,
            name: obj.name,
            description: truncateDescription(obj.description),
          })
        }
        break
      }
      case "relationship": {
        if (obj.relationship_type === "detects" && obj.source_ref && obj.target_ref) {
          detectsRels.push({ sourceRef: obj.source_ref, targetRef: obj.target_ref })
        } else if (obj.relationship_type === "mitigates" && obj.source_ref && obj.target_ref) {
          mitigatesRels.push({ sourceRef: obj.source_ref, targetRef: obj.target_ref })
        }
        break
      }
    }
  }

  // --- Build per-technique data-source maps ---
  const techDataSources = new Map<string, DataSource[]>()
  for (const { sourceRef, targetRef } of detectsRels) {
    const attackId = stixIdToAttackId.get(targetRef)
    if (!attackId) continue
    const comp = dataComponentByStixId.get(sourceRef)
    if (!comp) continue
    const ds = dataSourceByStixId.get(comp.parentStixId)
    if (!ds) continue
    const entry: DataSource = { id: ds.id, name: ds.name, component: comp.name }
    const list = techDataSources.get(attackId)
    if (list) {
      // Avoid duplicate components
      if (!list.some((d) => d.id === ds.id && d.component === comp.name)) list.push(entry)
    } else {
      techDataSources.set(attackId, [entry])
    }
  }

  // --- Build per-technique mitigation maps ---
  const techMitigations = new Map<string, Mitigation[]>()
  for (const { sourceRef, targetRef } of mitigatesRels) {
    const attackId = stixIdToAttackId.get(targetRef)
    if (!attackId) continue
    const mit = courseOfActionByStixId.get(sourceRef)
    if (!mit) continue
    const list = techMitigations.get(attackId)
    if (list) {
      if (!list.some((m) => m.id === mit.id)) list.push(mit)
    } else {
      techMitigations.set(attackId, [mit])
    }
  }

  // --- Build technique map ---
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
      dataSources: techDataSources.get(id) ?? directDataSources.get(id) ?? [],
      mitigations: techMitigations.get(id) ?? [],
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
