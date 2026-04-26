import yaml from "js-yaml"
import { ATTACKTechnique } from "@/types"

const ATLAS_URL =
  "https://raw.githubusercontent.com/mitre-atlas/atlas-data/main/dist/ATLAS.yaml"
const MAX_RESPONSE_BYTES = 10 * 1024 * 1024 // 10MB

interface ATLASRawTactic {
  id: string
  name: string
  description?: string
  "object-type"?: string
}

interface ATLASRawTechnique {
  id: string
  "object-type"?: string
  name: string
  description?: string
  tactics?: string[]
  platforms?: string[]
  "subtechnique-of"?: string | null
}

interface ATLASMatrix {
  id?: string
  name?: string
  tactics?: ATLASRawTactic[]
  techniques?: ATLASRawTechnique[]
}

interface ATLASBundle {
  id?: string
  name?: string
  version?: string
  matrices?: ATLASMatrix[]
  tactics?: ATLASRawTactic[]
  techniques?: ATLASRawTechnique[]
}

export interface ATLASData {
  techniques: ATTACKTechnique[]
  tacticOrder: string[]
  tacticNames: Record<string, string>
}

export async function fetchAndParseATLAS(signal?: AbortSignal): Promise<ATLASData> {
  const response = await fetch(ATLAS_URL, { signal })
  if (!response.ok) throw new Error(`ATLAS fetch failed: ${response.status}`)

  const contentLength = response.headers.get("content-length")
  if (contentLength && parseInt(contentLength) > MAX_RESPONSE_BYTES) {
    throw new Error("ATLAS response too large")
  }

  const text = await response.text()
  if (text.length > MAX_RESPONSE_BYTES) throw new Error("ATLAS payload too large")

  // ATLAS distributes as YAML
  const bundle = yaml.load(text) as ATLASBundle

  // Data lives inside matrices[0]
  let rawTactics: ATLASRawTactic[] = []
  let rawTechniques: ATLASRawTechnique[] = []

  if (bundle.matrices && bundle.matrices.length > 0) {
    rawTactics = bundle.matrices[0].tactics ?? []
    rawTechniques = bundle.matrices[0].techniques ?? []
  } else {
    rawTactics = bundle.tactics ?? []
    rawTechniques = bundle.techniques ?? []
  }

  return parseATLAS(rawTactics, rawTechniques)
}

function parseATLAS(
  rawTactics: ATLASRawTactic[],
  rawTechniques: ATLASRawTechnique[]
): ATLASData {
  // Preserve the tactic order as they appear in the file
  const tacticOrder = rawTactics
    .filter((t) => t["object-type"] !== "subtechnique")
    .map((t) => t.id)

  const tacticNames: Record<string, string> = {}
  for (const t of rawTactics) {
    tacticNames[t.id] = t.name
  }

  // Separate parents from subtechniques
  const parents: ATLASRawTechnique[] = []
  const subs: ATLASRawTechnique[] = []
  for (const t of rawTechniques) {
    if (t["subtechnique-of"]) {
      subs.push(t)
    } else {
      parents.push(t)
    }
  }

  const parentMap = new Map<string, ATTACKTechnique>()
  for (const t of parents) {
    parentMap.set(t.id, {
      id: t.id,
      name: t.name,
      description: (t.description ?? "").slice(0, 300),
      tactics: t.tactics ?? [],
      platforms: t.platforms?.length ? t.platforms : ["Any"],
      subtechniques: [],
      isSubtechnique: false,
      url: `https://atlas.mitre.org/techniques/${t.id}/`,
      dataSources: [],
      mitigations: [],
    })
  }

  for (const t of subs) {
    const parentId = t["subtechnique-of"]!
    const parent = parentMap.get(parentId)
    const sub: ATTACKTechnique = {
      id: t.id,
      name: t.name,
      description: (t.description ?? "").slice(0, 300),
      tactics: t.tactics ?? parent?.tactics ?? [],
      platforms: t.platforms?.length ? t.platforms : parent?.platforms ?? ["Any"],
      subtechniques: [],
      isSubtechnique: true,
      parentId,
      url: `https://atlas.mitre.org/techniques/${t.id}/`,
      dataSources: [],
      mitigations: [],
    }
    parent?.subtechniques.push(sub)
  }

  return {
    techniques: Array.from(parentMap.values()),
    tacticOrder,
    tacticNames,
  }
}

export function flattenATLAS(techniques: ATTACKTechnique[]): ATTACKTechnique[] {
  const result: ATTACKTechnique[] = []
  for (const t of techniques) {
    result.push(t)
    result.push(...t.subtechniques)
  }
  return result
}

export function clearATLASCache(): void {
  try {
    localStorage.removeItem("attackmap_atlas_cache")
  } catch {}
}
