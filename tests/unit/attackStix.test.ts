/**
 * Unit tests for lib/attackStix.ts
 * Uses a synthetic minimal STIX fixture to avoid real network calls.
 */

// We test the parsing logic by importing the internal helpers via the exported API.
// Since fetchAndParseSTIX uses global fetch, we mock it.

import { fetchAndParseSTIX, clearSTIXCache, flattenTechniques } from "@/lib/attackStix"

// Minimal synthetic STIX bundle
const SYNTHETIC_STIX = {
  type: "bundle",
  objects: [
    // Top-level technique: T1059 — Execution tactic
    {
      type: "attack-pattern",
      id: "attack-pattern--t1059",
      name: "Command and Scripting Interpreter",
      description: "Adversaries may abuse command and script interpreters.\n\nSecond paragraph.",
      x_mitre_deprecated: false,
      revoked: false,
      x_mitre_is_subtechnique: false,
      x_mitre_platforms: ["Windows", "Linux", "macOS"],
      kill_chain_phases: [{ kill_chain_name: "mitre-attack", phase_name: "execution" }],
      external_references: [
        { source_name: "mitre-attack", external_id: "T1059", url: "https://attack.mitre.org/techniques/T1059" },
      ],
    },
    // Sub-technique: T1059.001 — PowerShell
    {
      type: "attack-pattern",
      id: "attack-pattern--t1059-001",
      name: "PowerShell",
      description: "Adversaries may abuse PowerShell commands and scripts.",
      x_mitre_deprecated: false,
      revoked: false,
      x_mitre_is_subtechnique: true,
      x_mitre_platforms: ["Windows"],
      kill_chain_phases: [{ kill_chain_name: "mitre-attack", phase_name: "execution" }],
      external_references: [
        { source_name: "mitre-attack", external_id: "T1059.001" },
      ],
    },
    // Sub-technique: T1059.003 — Windows Command Shell
    {
      type: "attack-pattern",
      id: "attack-pattern--t1059-003",
      name: "Windows Command Shell",
      description: "Adversaries may abuse the Windows command shell.",
      x_mitre_deprecated: false,
      revoked: false,
      x_mitre_is_subtechnique: true,
      x_mitre_platforms: ["Windows"],
      kill_chain_phases: [{ kill_chain_name: "mitre-attack", phase_name: "execution" }],
      external_references: [
        { source_name: "mitre-attack", external_id: "T1059.003" },
      ],
    },
    // Top-level technique in different tactic: T1078 — Defense Evasion + Persistence
    {
      type: "attack-pattern",
      id: "attack-pattern--t1078",
      name: "Valid Accounts",
      description: "Adversaries may obtain and abuse credentials.",
      x_mitre_deprecated: false,
      revoked: false,
      x_mitre_is_subtechnique: false,
      x_mitre_platforms: ["Windows", "Linux", "AWS"],
      kill_chain_phases: [
        { kill_chain_name: "mitre-attack", phase_name: "defense-evasion" },
        { kill_chain_name: "mitre-attack", phase_name: "persistence" },
      ],
      external_references: [
        { source_name: "mitre-attack", external_id: "T1078" },
      ],
    },
    // Deprecated — must be excluded
    {
      type: "attack-pattern",
      id: "attack-pattern--deprecated",
      name: "Old Technique",
      x_mitre_deprecated: true,
      revoked: false,
      x_mitre_is_subtechnique: false,
      x_mitre_platforms: ["Windows"],
      kill_chain_phases: [{ kill_chain_name: "mitre-attack", phase_name: "execution" }],
      external_references: [{ source_name: "mitre-attack", external_id: "T9999" }],
    },
    // Revoked — must be excluded
    {
      type: "attack-pattern",
      id: "attack-pattern--revoked",
      name: "Revoked Technique",
      x_mitre_deprecated: false,
      revoked: true,
      x_mitre_is_subtechnique: false,
      x_mitre_platforms: ["Linux"],
      kill_chain_phases: [{ kill_chain_name: "mitre-attack", phase_name: "execution" }],
      external_references: [{ source_name: "mitre-attack", external_id: "T8888" }],
    },
    // Non-technique type — must be ignored
    {
      type: "x-mitre-tactic",
      id: "x-mitre-tactic--execution",
      name: "Execution",
    },
  ],
}

function mockFetch(body: object, status = 200) {
  const json = JSON.stringify(body)
  globalThis.fetch = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (name: string) => (name === "content-length" ? String(json.length) : null),
    },
    text: async () => json,
  } as unknown as Response)
}

beforeEach(() => {
  clearSTIXCache()
  jest.clearAllMocks()
})

describe("fetchAndParseSTIX", () => {
  test("returns only non-deprecated, non-revoked attack-patterns", async () => {
    mockFetch(SYNTHETIC_STIX)
    const techniques = await fetchAndParseSTIX()
    const ids = techniques.map((t) => t.id)
    expect(ids).not.toContain("T9999")  // deprecated
    expect(ids).not.toContain("T8888")  // revoked
    expect(ids).toContain("T1059")
    expect(ids).toContain("T1078")
  })

  test("returns only top-level techniques (subtechniques nested)", async () => {
    mockFetch(SYNTHETIC_STIX)
    const techniques = await fetchAndParseSTIX()
    const topLevelIds = techniques.map((t) => t.id)
    expect(topLevelIds).not.toContain("T1059.001")
    expect(topLevelIds).not.toContain("T1059.003")
  })

  test("nests subtechniques under their parent", async () => {
    mockFetch(SYNTHETIC_STIX)
    const techniques = await fetchAndParseSTIX()
    const t1059 = techniques.find((t) => t.id === "T1059")
    expect(t1059).toBeDefined()
    expect(t1059!.subtechniques).toHaveLength(2)
    const subIds = t1059!.subtechniques.map((s) => s.id)
    expect(subIds).toContain("T1059.001")
    expect(subIds).toContain("T1059.003")
  })

  test("sorts subtechniques by ID", async () => {
    mockFetch(SYNTHETIC_STIX)
    const techniques = await fetchAndParseSTIX()
    const t1059 = techniques.find((t) => t.id === "T1059")!
    expect(t1059.subtechniques[0].id).toBe("T1059.001")
    expect(t1059.subtechniques[1].id).toBe("T1059.003")
  })

  test("extracts platforms correctly", async () => {
    mockFetch(SYNTHETIC_STIX)
    const techniques = await fetchAndParseSTIX()
    const t1059 = techniques.find((t) => t.id === "T1059")!
    expect(t1059.platforms).toEqual(expect.arrayContaining(["Windows", "Linux", "macOS"]))

    const t1078 = techniques.find((t) => t.id === "T1078")!
    expect(t1078.platforms).toContain("AWS")
  })

  test("extracts multiple tactics for T1078", async () => {
    mockFetch(SYNTHETIC_STIX)
    const techniques = await fetchAndParseSTIX()
    const t1078 = techniques.find((t) => t.id === "T1078")!
    expect(t1078.tactics).toContain("defense-evasion")
    expect(t1078.tactics).toContain("persistence")
  })

  test("truncates description at 300 chars and takes first paragraph", async () => {
    mockFetch(SYNTHETIC_STIX)
    const techniques = await fetchAndParseSTIX()
    const t1059 = techniques.find((t) => t.id === "T1059")!
    // Should only have first paragraph (before \n\n)
    expect(t1059.description).toBe(
      "Adversaries may abuse command and script interpreters."
    )
    expect(t1059.description).not.toContain("Second paragraph")
  })

  test("builds correct URL for top-level technique", async () => {
    mockFetch(SYNTHETIC_STIX)
    const techniques = await fetchAndParseSTIX()
    const t1059 = techniques.find((t) => t.id === "T1059")!
    expect(t1059.url).toBe("https://attack.mitre.org/techniques/T1059/")
  })

  test("builds correct URL for sub-technique", async () => {
    mockFetch(SYNTHETIC_STIX)
    const techniques = await fetchAndParseSTIX()
    const t1059 = techniques.find((t) => t.id === "T1059")!
    const ps = t1059.subtechniques.find((s) => s.id === "T1059.001")!
    expect(ps.url).toBe("https://attack.mitre.org/techniques/T1059/001/")
  })

  test("marks subtechniques with isSubtechnique=true and parentId", async () => {
    mockFetch(SYNTHETIC_STIX)
    const techniques = await fetchAndParseSTIX()
    const t1059 = techniques.find((t) => t.id === "T1059")!
    const ps = t1059.subtechniques.find((s) => s.id === "T1059.001")!
    expect(ps.isSubtechnique).toBe(true)
    expect(ps.parentId).toBe("T1059")
  })

  test("marks top-level techniques with isSubtechnique=false", async () => {
    mockFetch(SYNTHETIC_STIX)
    const techniques = await fetchAndParseSTIX()
    const t1059 = techniques.find((t) => t.id === "T1059")!
    expect(t1059.isSubtechnique).toBe(false)
    expect(t1059.parentId).toBeUndefined()
  })

  test("uses module-level cache on second call", async () => {
    mockFetch(SYNTHETIC_STIX)
    await fetchAndParseSTIX()
    await fetchAndParseSTIX()
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
  })

  test("throws on HTTP error", async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
      headers: { get: () => null },
    } as unknown as Response)
    await expect(fetchAndParseSTIX()).rejects.toThrow("HTTP 404")
  })

  test("throws on invalid JSON", async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      text: async () => "not valid json {{{",
    } as unknown as Response)
    await expect(fetchAndParseSTIX()).rejects.toThrow("Invalid JSON")
  })

  test("throws when bundle has no objects array", async () => {
    mockFetch({ type: "bundle", objects: "not-an-array" })
    await expect(fetchAndParseSTIX()).rejects.toThrow("Unexpected STIX bundle structure")
  })

  test("ignores objects with no mitre-attack external reference", async () => {
    const noRef = {
      ...SYNTHETIC_STIX,
      objects: [
        {
          type: "attack-pattern",
          name: "No Ref Technique",
          x_mitre_deprecated: false,
          revoked: false,
          x_mitre_is_subtechnique: false,
          x_mitre_platforms: [],
          kill_chain_phases: [],
          external_references: [{ source_name: "other-source", external_id: "X999" }],
        },
      ],
    }
    mockFetch(noRef)
    const techniques = await fetchAndParseSTIX()
    expect(techniques).toHaveLength(0)
  })
})

describe("data source parsing — ATT&CK v16 detection-strategy schema", () => {
  const V16_STIX = {
    type: "bundle",
    objects: [
      {
        type: "attack-pattern",
        id: "attack-pattern--t1059",
        name: "PowerShell",
        description: "Test",
        x_mitre_deprecated: false, revoked: false, x_mitre_is_subtechnique: false,
        x_mitre_platforms: ["Windows"],
        kill_chain_phases: [{ kill_chain_name: "mitre-attack", phase_name: "execution" }],
        external_references: [{ source_name: "mitre-attack", external_id: "T1059" }],
      },
      {
        type: "attack-pattern",
        id: "attack-pattern--t1040",
        name: "Network Sniffing",
        description: "Test",
        x_mitre_deprecated: false, revoked: false, x_mitre_is_subtechnique: false,
        x_mitre_platforms: ["Linux"],
        kill_chain_phases: [{ kill_chain_name: "mitre-attack", phase_name: "discovery" }],
        external_references: [{ source_name: "mitre-attack", external_id: "T1040" }],
      },
      // data-components (new schema: x_mitre_data_source_ref is empty)
      {
        type: "x-mitre-data-component",
        id: "x-mitre-data-component--dc001",
        name: "Process Creation",
        x_mitre_data_source_ref: "",
        external_references: [{ source_name: "mitre-attack", external_id: "DC0009" }],
      },
      {
        type: "x-mitre-data-component",
        id: "x-mitre-data-component--dc002",
        name: "Network Traffic Flow",
        x_mitre_data_source_ref: "",
        external_references: [{ source_name: "mitre-attack", external_id: "DC0011" }],
      },
      // analytics — bridge analytic → data-component
      {
        type: "x-mitre-analytic",
        id: "x-mitre-analytic--an001",
        name: "A1",
        x_mitre_data_component_ref: "x-mitre-data-component--dc001",
      },
      {
        type: "x-mitre-analytic",
        id: "x-mitre-analytic--an002",
        name: "A2",
        x_mitre_data_component_ref: "x-mitre-data-component--dc002",
      },
      // detection-strategies — one per technique, reference analytics
      {
        type: "x-mitre-detection-strategy",
        id: "x-mitre-detection-strategy--strat001",
        name: "Detection Strategy for PowerShell",
        x_mitre_analytic_refs: ["x-mitre-analytic--an001"],
      },
      {
        type: "x-mitre-detection-strategy",
        id: "x-mitre-detection-strategy--strat002",
        name: "Detection Strategy for Network Sniffing",
        x_mitre_analytic_refs: ["x-mitre-analytic--an002"],
      },
      // detects relationships (new schema: detection-strategy → attack-pattern)
      {
        type: "relationship",
        id: "relationship--r001",
        relationship_type: "detects",
        source_ref: "x-mitre-detection-strategy--strat001",
        target_ref: "attack-pattern--t1059",
      },
      {
        type: "relationship",
        id: "relationship--r002",
        relationship_type: "detects",
        source_ref: "x-mitre-detection-strategy--strat002",
        target_ref: "attack-pattern--t1040",
      },
    ],
  }

  test("populates dataSources via detection-strategy chain", async () => {
    mockFetch(V16_STIX)
    const techniques = await fetchAndParseSTIX()
    const t1059 = techniques.find((t) => t.id === "T1059")!
    expect(t1059.dataSources).toHaveLength(1)
    expect(t1059.dataSources[0].name).toBe("Process Creation")
    expect(t1059.dataSources[0].id).toBe("DC0009")
  })

  test("each technique gets its own data sources", async () => {
    mockFetch(V16_STIX)
    const techniques = await fetchAndParseSTIX()
    const t1040 = techniques.find((t) => t.id === "T1040")!
    expect(t1040.dataSources).toHaveLength(1)
    expect(t1040.dataSources[0].name).toBe("Network Traffic Flow")
  })

  test("techniques without a detects relationship have empty dataSources", async () => {
    mockFetch(SYNTHETIC_STIX) // original fixture — no detects rels
    const techniques = await fetchAndParseSTIX()
    for (const t of techniques) {
      expect(t.dataSources).toEqual([])
    }
  })
})

describe("flattenTechniques", () => {
  test("returns top-level plus all nested subtechniques", async () => {
    mockFetch(SYNTHETIC_STIX)
    const techniques = await fetchAndParseSTIX()
    const flat = flattenTechniques(techniques)
    const ids = flat.map((t) => t.id)
    expect(ids).toContain("T1059")
    expect(ids).toContain("T1059.001")
    expect(ids).toContain("T1059.003")
    expect(ids).toContain("T1078")
    // 2 top-level + 2 sub-techniques = 4 total
    expect(flat).toHaveLength(4)
  })
})
