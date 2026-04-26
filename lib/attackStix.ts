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
  relationship_type?: string
  source_ref?: string
  target_ref?: string
}

interface StixBundle {
  objects: StixObject[]
}

function truncateDescription(desc: string | undefined): string {
  if (!desc) return ""
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
  const parts = techniqueId.split(".")
  if (parts.length === 2) {
    return `https://attack.mitre.org/techniques/${parts[0]}/${parts[1]}/`
  }
  return `https://attack.mitre.org/techniques/${techniqueId}/`
}

function addDataSource(
  map: Map<string, DataSource[]>,
  attackId: string,
  entry: DataSource
): void {
  const list = map.get(attackId)
  if (list) {
    if (!list.some((d) => d.id === entry.id && d.component === entry.component)) {
      list.push(entry)
    }
  } else {
    map.set(attackId, [entry])
  }
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

  // Old schema (v9-v15): x-mitre-data-source → x-mitre-data-component → detects → attack-pattern
  const dataSourceByStixId = new Map<string, { id: string; name: string }>()
  const dataComponentByStixId = new Map<string, { name: string; externalId: string; parentStixId: string }>()

  // New schema (v16+): x-mitre-detection-strategy → detects → attack-pattern
  //   detection-strategy.x_mitre_analytic_refs → x-mitre-analytic.x_mitre_data_component_ref → data-component
  const analyticByStixId = new Map<string, { dataComponentRef: string }>()
  const detectionStrategyByStixId = new Map<string, { analyticRefs: string[] }>()

  const courseOfActionByStixId = new Map<string, Mitigation>()
  const stixIdToAttackId = new Map<string, string>()
  const detectsRels: Array<{ sourceRef: string; targetRef: string }> = []
  const mitigatesRels: Array<{ sourceRef: string; targetRef: string }> = []

  for (const obj of bundle.objects) {
    switch (obj.type) {
      case "attack-pattern": {
        if (obj.x_mitre_deprecated || obj.revoked) break
        rawTechniques.push(obj)
        const attackId = extractTechniqueId(obj)
        if (attackId) stixIdToAttackId.set(obj.id, attackId)
        break
      }
      case "x-mitre-data-source": {
        const dsId = obj.external_references?.find((r) => r.source_name === "mitre-attack")?.external_id
        if (dsId) dataSourceByStixId.set(obj.id, { id: dsId, name: obj.name })
        break
      }
      case "x-mitre-data-component": {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const parentRef = ((obj as any).x_mitre_data_source_ref as string | undefined) ?? ""
        const extId = obj.external_references?.find((r) => r.source_name === "mitre-attack")?.external_id ?? ""
        dataComponentByStixId.set(obj.id, { name: obj.name, externalId: extId, parentStixId: parentRef })
        break
      }
      case "x-mitre-analytic": {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const dcRef = (obj as any).x_mitre_data_component_ref as string | undefined
        if (dcRef) analyticByStixId.set(obj.id, { dataComponentRef: dcRef })
        break
      }
      case "x-mitre-detection-strategy": {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const refs = (obj as any).x_mitre_analytic_refs as string[] | undefined
        if (refs?.length) detectionStrategyByStixId.set(obj.id, { analyticRefs: refs })
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

    // Old schema (v9-v15): sourceRef is an x-mitre-data-component
    const comp = dataComponentByStixId.get(sourceRef)
    if (comp) {
      const parentDs = dataSourceByStixId.get(comp.parentStixId)
      if (parentDs) {
        // Full old schema: data-source (DS0009 "Process") + component ("Process Creation")
        addDataSource(techDataSources, attackId, { id: parentDs.id, name: parentDs.name, component: comp.name })
      } else {
        // Partial old schema: data-component only, use its external id + name
        const id = comp.externalId || comp.name.toLowerCase().replace(/\s+/g, "-")
        addDataSource(techDataSources, attackId, { id, name: comp.name, component: comp.name })
      }
      continue
    }

    // New schema (v16+): sourceRef is an x-mitre-detection-strategy
    const strategy = detectionStrategyByStixId.get(sourceRef)
    if (!strategy) continue

    for (const analyticRef of strategy.analyticRefs) {
      const analytic = analyticByStixId.get(analyticRef)
      if (!analytic) continue
      const dc = dataComponentByStixId.get(analytic.dataComponentRef)
      if (!dc) continue
      const id = dc.externalId || dc.name.toLowerCase().replace(/\s+/g, "-")
      addDataSource(techDataSources, attackId, { id, name: dc.name, component: dc.name })
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

    techniqueMap.set(id, {
      id,
      name: obj.name,
      description: truncateDescription(obj.description),
      tactics: extractTactics(obj),
      platforms: obj.x_mitre_platforms ?? [],
      subtechniques: [],
      isSubtechnique: obj.x_mitre_is_subtechnique ?? id.includes("."),
      parentId: id.includes(".") ? id.split(".")[0] : undefined,
      url: buildTechniqueUrl(id),
      dataSources: techDataSources.get(id) ?? [],
      mitigations: techMitigations.get(id) ?? [],
    })
  }

  const allTechniqueValues = Array.from(techniqueMap.values())

  for (const technique of allTechniqueValues) {
    if (technique.isSubtechnique && technique.parentId) {
      const parent = techniqueMap.get(technique.parentId)
      if (parent) parent.subtechniques.push(technique)
    }
  }

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
