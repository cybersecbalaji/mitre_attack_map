// Core ATT&CK types
export type CoverageStatus = "covered" | "partial" | "uncovered"
export type RuleSource = "sigma" | "manual" | "csv"
export type ConfidenceLevel = "strong" | "partial"

export interface ATTACKTechnique {
  id: string              // e.g., "T1059"
  name: string
  description: string     // first 300 chars from STIX
  tactics: string[]       // phase_names, e.g., ["execution"]
  platforms: string[]     // e.g., ["Windows", "Linux"]
  subtechniques: ATTACKTechnique[]
  isSubtechnique: boolean
  parentId?: string       // for subtechniques, e.g., "T1059"
  url: string             // https://attack.mitre.org/techniques/T1059/
}

export interface MappedRule {
  id: string
  name: string
  techniqueIds: string[]
  confidence: ConfidenceLevel
  source: RuleSource
  rawContent?: string
}

export interface CoverageCell {
  techniqueId: string
  status: CoverageStatus
  rules: MappedRule[]
}

export type CoverageMap = Map<string, CoverageCell>

export interface CoverageStats {
  total: number
  covered: number
  partial: number
  uncovered: number
  coveragePercent: number
  partialPercent: number
}

export interface WorkspaceSnapshot {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  platformFilter: string[]
  rules: MappedRule[]
  coverageStats: CoverageStats
}

export interface NavigatorLayer {
  name: string
  versions: { attack: string; navigator: string; layer: string }
  domain: "enterprise-attack"
  description: string
  techniques: NavigatorTechnique[]
  gradient: { colors: string[]; minValue: number; maxValue: number }
  metadata: { name: string; value: string }[]
}

export interface NavigatorTechnique {
  techniqueID: string
  score: number
  comment: string
  color: string
  enabled: boolean
  metadata: { name: string; value: string }[]
}

export type MatrixType = "attack" | "atlas"

// Coverage colour constants
export const COVERAGE_COLORS = {
  covered: "#22c55e",   // green-500
  partial: "#f59e0b",   // amber-500
  uncovered: "#1e293b", // slate-800
  gap: "#ef4444",       // red-500
} as const

// ATT&CK tactic ordering
export const TACTIC_ORDER = [
  "reconnaissance",
  "resource-development",
  "initial-access",
  "execution",
  "persistence",
  "privilege-escalation",
  "defense-evasion",
  "credential-access",
  "discovery",
  "lateral-movement",
  "collection",
  "command-and-control",
  "exfiltration",
  "impact",
] as const

export const TACTIC_NAMES: Record<string, string> = {
  "reconnaissance": "Reconnaissance",
  "resource-development": "Resource Dev.",
  "initial-access": "Initial Access",
  "execution": "Execution",
  "persistence": "Persistence",
  "privilege-escalation": "Privilege Esc.",
  "defense-evasion": "Defense Evasion",
  "credential-access": "Credential Access",
  "discovery": "Discovery",
  "lateral-movement": "Lateral Movement",
  "collection": "Collection",
  "command-and-control": "C2",
  "exfiltration": "Exfiltration",
  "impact": "Impact",
}

export const AVAILABLE_PLATFORMS = [
  "Windows",
  "Linux",
  "macOS",
  "AWS",
  "Azure",
  "GCP",
  "Azure AD",
  "Office 365",
  "SaaS",
  "Network",
] as const

export type Platform = typeof AVAILABLE_PLATFORMS[number]
