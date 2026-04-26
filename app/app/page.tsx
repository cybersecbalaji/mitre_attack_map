"use client"
import { useState, useMemo, useCallback } from "react"
import { ATTACKTechnique, MatrixType, MatrixView } from "@/types"
import { WorkspaceHeader } from "@/components/workspace/WorkspaceHeader"
import { WorkspaceHistory } from "@/components/workspace/WorkspaceHistory"
import { ShareBanner } from "@/components/workspace/ShareBanner"
import { IngestionPanel } from "@/components/ingestion/IngestionPanel"
import { AttackMatrix } from "@/components/matrix/AttackMatrix"
import { CoverageKPIBar, DensityStats } from "@/components/panels/CoverageKPIBar"
import { TechniqueDetailSheet } from "@/components/panels/TechniqueDetailSheet"
import { AuthGuard } from "@/components/auth/AuthGuard"
import { useAttackData } from "@/hooks/useAttackData"
import { useAtlasData } from "@/hooks/useAtlasData"
import { useCoverageMap } from "@/hooks/useCoverageMap"
import { useWorkspace } from "@/hooks/useWorkspace"
import { calculateCoverageStats } from "@/lib/coverageCalculator"
import { generateNavigatorLayer, downloadNavigatorLayer } from "@/lib/navigatorExport"
import { db, isInstantDBConfigured } from "@/lib/instantdb"
import { useRouter } from "next/navigation"

function matchesPlatformFilter(technique: ATTACKTechnique, filter: string[]): boolean {
  if (filter.length === 0) return true
  const lower = filter.map((f) => f.toLowerCase())
  return technique.platforms.some((p) => lower.includes(p.toLowerCase()))
}

function matchesDataSourceFilter(technique: ATTACKTechnique, filter: string[]): boolean {
  if (filter.length === 0) return true
  return technique.dataSources.some((ds) => filter.includes(ds.id))
}

function AppContent() {
  const router = useRouter()
  const { user } = db.useAuth()

  const [matrixType, setMatrixType] = useState<MatrixType>("attack")
  const [view, setView] = useState<MatrixView>("coverage")

  const attackData = useAttackData()
  const atlasData = useAtlasData()

  const activeData = matrixType === "atlas" ? atlasData : attackData
  const { techniques, allTechniques, loading, error } = activeData
  const tacticOrder = matrixType === "atlas" ? atlasData.tacticOrder : undefined
  const tacticNames = matrixType === "atlas" ? atlasData.tacticNames : undefined

  const { coverageMap, rules, addRules, clearRules, replaceRules } = useCoverageMap(allTechniques)
  const {
    workspaceName,
    setWorkspaceName,
    isShared,
    snapshots,
    saveSnapshot,
    loadSnapshot,
    forkAsNew,
    shareUrl,
  } = useWorkspace()

  const [selectedTechnique, setSelectedTechnique] = useState<ATTACKTechnique | null>(null)
  const [platformFilter, setPlatformFilter] = useState<string[]>([])
  const [dataSourceFilter, setDataSourceFilter] = useState<string[]>([])
  const [shareCopied, setShareCopied] = useState(false)
  const [saving, setSaving] = useState(false)

  const filteredTopLevel = useMemo(
    () => techniques.filter((t) =>
      matchesPlatformFilter(t, platformFilter) && matchesDataSourceFilter(t, dataSourceFilter)
    ),
    [techniques, platformFilter, dataSourceFilter]
  )

  const filteredStats = useMemo(() => {
    const filteredAll: ATTACKTechnique[] = []
    for (const t of techniques) {
      if (!matchesPlatformFilter(t, platformFilter)) continue
      if (!matchesDataSourceFilter(t, dataSourceFilter)) continue
      filteredAll.push(t)
      for (const sub of t.subtechniques) {
        if (matchesPlatformFilter(sub, platformFilter) && matchesDataSourceFilter(sub, dataSourceFilter)) {
          filteredAll.push(sub)
        }
      }
    }
    return calculateCoverageStats(filteredAll, coverageMap)
  }, [techniques, platformFilter, dataSourceFilter, coverageMap])

  const densityStats = useMemo((): DensityStats => {
    const stats: DensityStats = { none: 0, low: 0, medium: 0, high: 0, over: 0 }
    for (const t of filteredTopLevel) {
      const count = coverageMap.get(t.id)?.rules.length ?? 0
      if (count === 0) stats.none++
      else if (count === 1) stats.low++
      else if (count <= 3) stats.medium++
      else if (count <= 5) stats.high++
      else stats.over++
    }
    return stats
  }, [filteredTopLevel, coverageMap])

  const handleExport = useCallback(() => {
    if (allTechniques.length === 0) return
    const layer = generateNavigatorLayer({
      techniques: allTechniques,
      coverageMap,
      workspaceName,
      platformFilter,
    })
    const safeName = workspaceName.replace(/[^a-z0-9_-]+/gi, "-").toLowerCase()
    downloadNavigatorLayer(layer, `${safeName}-navigator-layer.json`)
  }, [allTechniques, coverageMap, workspaceName, platformFilter])

  const handleShare = useCallback(async () => {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      setShareCopied(true)
      setTimeout(() => setShareCopied(false), 2000)
    } catch {
      window.prompt("Copy this URL to share your workspace:", shareUrl)
    }
  }, [shareUrl])

  const handleSaveSnapshot = useCallback(async () => {
    setSaving(true)
    try {
      await saveSnapshot({ rules, platformFilter, coverageStats: filteredStats })
    } finally {
      setSaving(false)
    }
  }, [saveSnapshot, rules, platformFilter, filteredStats])

  const handleLoadSnapshot = useCallback((id: string) => {
    const snap = loadSnapshot(id)
    if (!snap) return
    replaceRules(snap.rules)
    setPlatformFilter(snap.platformFilter)
    setWorkspaceName(snap.name)
  }, [loadSnapshot, replaceRules, setWorkspaceName])

  const handleForkAsNew = useCallback(() => { forkAsNew() }, [forkAsNew])

  const handleSignOut = useCallback(async () => {
    if (!isInstantDBConfigured) return
    await db.auth.signOut()
    router.push("/login")
  }, [router])

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900">
        <div className="text-red-400 text-center">
          <p className="text-lg font-semibold">
            Failed to load {matrixType === "atlas" ? "MITRE ATLAS" : "ATT&CK"} data
          </p>
          <p className="text-sm mt-2">{error}</p>
        </div>
      </div>
    )
  }

  const filtersActive = platformFilter.length > 0 || dataSourceFilter.length > 0

  return (
    <div className="flex flex-col h-screen bg-slate-900 overflow-hidden">
      <WorkspaceHeader
        workspaceName={workspaceName}
        onNameChange={setWorkspaceName}
        platformFilter={platformFilter}
        onPlatformFilterChange={setPlatformFilter}
        dataSourceFilter={dataSourceFilter}
        onDataSourceFilterChange={setDataSourceFilter}
        allTechniques={allTechniques}
        onExport={handleExport}
        onShare={handleShare}
        onSaveSnapshot={handleSaveSnapshot}
        shareCopied={shareCopied}
        saving={saving}
        isShared={isShared}
        matrixType={matrixType}
        onMatrixTypeChange={setMatrixType}
        view={view}
        onViewChange={setView}
        userEmail={user?.email ?? undefined}
        onSignOut={isInstantDBConfigured ? handleSignOut : undefined}
      />

      <ShareBanner visible={isShared} onSaveCopy={handleForkAsNew} />

      {!loading && allTechniques.length > 0 && filtersActive && (
        <div
          data-testid="platform-filter-active"
          className="bg-amber-900/30 border-b border-amber-700/40 px-4 py-1 text-amber-200 text-xs flex items-center gap-2 flex-wrap"
        >
          <span className="font-semibold">Filters active:</span>
          {platformFilter.length > 0 && (
            <span>Platform: {platformFilter.join(", ")}</span>
          )}
          {platformFilter.length > 0 && dataSourceFilter.length > 0 && (
            <span className="text-amber-500">•</span>
          )}
          {dataSourceFilter.length > 0 && (
            <span>Data sources: {dataSourceFilter.join(", ")}</span>
          )}
          <span className="text-amber-500">•</span>
          <span>{filteredTopLevel.length} top-level techniques shown</span>
        </div>
      )}

      {!loading && allTechniques.length > 0 && (
        <span data-testid="stix-debug-banner" className="sr-only">
          {matrixType === "atlas" ? "MITRE ATLAS" : "ATT&CK"} data loaded: {allTechniques.length.toLocaleString()} techniques • {techniques.length.toLocaleString()} top-level • {allTechniques.filter((t) => t.isSubtechnique).length.toLocaleString()} sub-techniques
        </span>
      )}

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-80 flex-shrink-0 border-r border-slate-700 overflow-y-auto bg-slate-900 flex flex-col gap-3 p-3">
          <IngestionPanel
            techniques={allTechniques}
            rules={rules}
            onRulesIngested={addRules}
            onClearRules={clearRules}
          />
          <WorkspaceHistory snapshots={snapshots} onLoad={handleLoadSnapshot} />
        </aside>

        <main className="flex-1 flex flex-col overflow-hidden">
          <div className="p-3 border-b border-slate-700">
            <CoverageKPIBar
              stats={filteredStats}
              view={view}
              densityStats={densityStats}
            />
          </div>

          {loading ? (
            <div className="flex-1 flex items-center justify-center text-slate-400">
              <div className="text-center">
                <div className="animate-spin w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full mx-auto mb-3" />
                <p className="text-sm">Loading {matrixType === "atlas" ? "MITRE ATLAS" : "ATT&CK"} data...</p>
                <p className="text-xs mt-1 text-slate-500">Fetching from GitHub...</p>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-auto">
              <AttackMatrix
                techniques={filteredTopLevel}
                coverageMap={coverageMap}
                platformFilter={platformFilter}
                onTechniqueClick={setSelectedTechnique}
                tacticOrder={tacticOrder}
                tacticNames={tacticNames}
                ariaLabel={matrixType === "atlas" ? "MITRE ATLAS Matrix" : "MITRE ATT&CK Enterprise Matrix"}
                view={view}
              />
            </div>
          )}
        </main>
      </div>

      <TechniqueDetailSheet
        technique={selectedTechnique}
        coverageCell={selectedTechnique ? coverageMap.get(selectedTechnique.id) : undefined}
        open={!!selectedTechnique}
        onClose={() => setSelectedTechnique(null)}
        tacticNames={tacticNames}
      />
    </div>
  )
}

export default function AppPage() {
  return (
    <AuthGuard>
      <AppContent />
    </AuthGuard>
  )
}
