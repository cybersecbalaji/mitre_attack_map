"use client"
import { useState, useEffect, useCallback, useRef } from "react"
import { v4 as uuidv4 } from "uuid"
import { id as instantId, tx } from "@instantdb/react"
import { db, isInstantDBConfigured } from "@/lib/instantdb"
import { MappedRule, CoverageStats, WorkspaceSnapshot } from "@/types"

const WS_ID_KEY = "attackmap_workspace_id"
const WS_NAME_KEY_PREFIX = "attackmap_ws_name_"
const WS_LOCAL_SNAPSHOTS_PREFIX = "attackmap_ws_snapshots_"
const WS_RULES_KEY_PREFIX = "attackmap_active_rules_" // user-scoped
const LEGACY_RULES_KEY = "attackmap_active_rules"     // unscoped, migrated then deleted
const SAVE_DEBOUNCE_MS = 400

type WorkspaceMode = "pending" | "shared" | "user" | "local"

interface InstantDBWorkspaceRow {
  id: string
  name?: string
  createdAt?: number
  updatedAt?: number
  platformFilter?: string[]
  rulesJson?: string
  coverageStats?: CoverageStats
  currentRules?: MappedRule[]
}

interface UseWorkspaceResult {
  workspaceId: string
  workspaceName: string
  setWorkspaceName: (name: string) => void
  isShared: boolean
  isReadOnly: boolean
  isInstantDBConfigured: boolean
  snapshots: WorkspaceSnapshot[]
  saveSnapshot: (data: { rules: MappedRule[]; platformFilter: string[]; coverageStats: CoverageStats; name?: string }) => Promise<WorkspaceSnapshot | null>
  loadSnapshot: (id: string) => WorkspaceSnapshot | null
  forkAsNew: () => string
  shareUrl: string
  rules: MappedRule[]
  addRules: (newRules: MappedRule[]) => void
  replaceRules: (newRules: MappedRule[]) => void
  clearRules: () => void
}

function readSharedIdFromUrl(): string | null {
  if (typeof window === "undefined") return null
  const params = new URLSearchParams(window.location.search)
  const ws = params.get("ws")
  if (!ws) return null
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ws) ? ws : null
}

function loadLocalSnapshots(workspaceId: string): WorkspaceSnapshot[] {
  if (typeof localStorage === "undefined") return []
  try {
    const raw = localStorage.getItem(WS_LOCAL_SNAPSHOTS_PREFIX + workspaceId)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveLocalSnapshot(workspaceId: string, snapshot: WorkspaceSnapshot): void {
  try {
    const all = loadLocalSnapshots(workspaceId)
    all.unshift(snapshot)
    localStorage.setItem(WS_LOCAL_SNAPSHOTS_PREFIX + workspaceId, JSON.stringify(all.slice(0, 25)))
  } catch {
    // Quota exceeded; ignore
  }
}

function readLocalRules(key: string): MappedRule[] | null {
  if (typeof localStorage === "undefined") return null
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as MappedRule[]) : null
  } catch {
    return null
  }
}

function writeLocalRules(key: string, rules: MappedRule[]): void {
  try {
    if (rules.length === 0) {
      localStorage.removeItem(key)
    } else {
      localStorage.setItem(key, JSON.stringify(rules))
    }
  } catch {
    // Quota exceeded; ignore
  }
}

export function useWorkspace(): UseWorkspaceResult {
  const { user } = db.useAuth()

  const [workspaceId, setWorkspaceIdState] = useState("")
  const [mode, setMode] = useState<WorkspaceMode>("pending")
  const [workspaceName, setWorkspaceNameState] = useState("My Coverage Workspace")
  const [snapshots, setSnapshots] = useState<WorkspaceSnapshot[]>([])
  const [rules, setRulesState] = useState<MappedRule[]>([])

  // Track which workspaceId we have already hydrated rules for, to make load idempotent
  const hydratedRef = useRef<string | null>(null)
  // Holds the latest rules so debounced save reads fresh values
  const rulesRef = useRef<MappedRule[]>([])
  // Debounce timer for InstantDB writes
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Latest workspace name + mode for the save closure
  const nameRef = useRef(workspaceName)
  const modeRef = useRef<WorkspaceMode>(mode)
  const wsIdRef = useRef(workspaceId)

  useEffect(() => { rulesRef.current = rules }, [rules])
  useEffect(() => { nameRef.current = workspaceName }, [workspaceName])
  useEffect(() => { modeRef.current = mode }, [mode])
  useEffect(() => { wsIdRef.current = workspaceId }, [workspaceId])

  // Resolve workspaceId + mode whenever auth state or shared URL changes
  useEffect(() => {
    const sharedId = readSharedIdFromUrl()
    if (sharedId) {
      setWorkspaceIdState(sharedId)
      setMode("shared")
      const nm = localStorage.getItem(WS_NAME_KEY_PREFIX + sharedId)
      if (nm) setWorkspaceNameState(nm)
      setSnapshots(loadLocalSnapshots(sharedId))
      return
    }

    if (!isInstantDBConfigured) {
      let id = localStorage.getItem(WS_ID_KEY)
      if (!id) {
        id = uuidv4()
        localStorage.setItem(WS_ID_KEY, id)
      }
      setWorkspaceIdState(id)
      setMode("local")
      const nm = localStorage.getItem(WS_NAME_KEY_PREFIX + id)
      if (nm) setWorkspaceNameState(nm)
      setSnapshots(loadLocalSnapshots(id))
      return
    }

    // InstantDB configured: must wait for auth
    if (user?.id) {
      setWorkspaceIdState(user.id)
      setMode("user")
      const nm = localStorage.getItem(WS_NAME_KEY_PREFIX + user.id)
      if (nm) setWorkspaceNameState(nm)
      setSnapshots(loadLocalSnapshots(user.id))
      return
    }

    // Configured but unauthenticated — keep pending; AuthGuard should redirect
    setWorkspaceIdState("")
    setMode("pending")
  }, [user?.id])

  // InstantDB live query — only when configured AND we have a workspaceId
  const remoteQuery = db.useQuery(
    isInstantDBConfigured && workspaceId
      ? { workspaces: { $: { where: { id: workspaceId } } } }
      : null
  )

  // Hydrate rules and metadata from remote / localStorage. Idempotent per workspaceId.
  useEffect(() => {
    if (!workspaceId || mode === "pending") return
    if (hydratedRef.current === workspaceId) return // already hydrated

    if (mode === "user" || mode === "shared") {
      // Wait for the live query to resolve at least once before deciding
      if (isInstantDBConfigured && remoteQuery.isLoading) return

      const row = (remoteQuery.data?.workspaces?.[0] as InstantDBWorkspaceRow | undefined)

      if (row?.currentRules && Array.isArray(row.currentRules)) {
        setRulesState(row.currentRules)
        if (row.name) setWorkspaceNameState(row.name)
        // Mirror to user-scoped localStorage so reload is fast / offline works
        if (mode === "user") writeLocalRules(WS_RULES_KEY_PREFIX + workspaceId, row.currentRules)
        hydratedRef.current = workspaceId

        // Clean up legacy unscoped key now that user has remote source of truth
        try { localStorage.removeItem(LEGACY_RULES_KEY) } catch {}
        return
      }

      // Remote empty — try user-scoped local cache, then legacy migration
      const userScoped = readLocalRules(WS_RULES_KEY_PREFIX + workspaceId)
      if (userScoped && userScoped.length > 0) {
        setRulesState(userScoped)
        hydratedRef.current = workspaceId
        // Push to remote so next device sees them
        if (mode === "user") void persistToRemote(userScoped)
        return
      }

      if (mode === "user") {
        const legacy = readLocalRules(LEGACY_RULES_KEY)
        if (legacy && legacy.length > 0) {
          setRulesState(legacy)
          writeLocalRules(WS_RULES_KEY_PREFIX + workspaceId, legacy)
          try { localStorage.removeItem(LEGACY_RULES_KEY) } catch {}
          void persistToRemote(legacy)
          hydratedRef.current = workspaceId
          return
        }
      }

      // Nothing to hydrate
      setRulesState([])
      hydratedRef.current = workspaceId
      return
    }

    // local mode: just read localStorage
    const localRules = readLocalRules(WS_RULES_KEY_PREFIX + workspaceId) ?? readLocalRules(LEGACY_RULES_KEY) ?? []
    setRulesState(localRules)
    hydratedRef.current = workspaceId
  }, [workspaceId, mode, remoteQuery.isLoading, remoteQuery.data])

  // Sync remote snapshot rows into local snapshots list (separate from currentRules)
  useEffect(() => {
    if (!isInstantDBConfigured || !remoteQuery.data) return
    const rows = (remoteQuery.data.workspaces ?? []) as InstantDBWorkspaceRow[]
    if (rows.length === 0) return

    const remoteSnapshots: WorkspaceSnapshot[] = rows
      .filter((r) => typeof r.rulesJson === "string")
      .map((r) => ({
        id: r.id,
        name: r.name || "Untitled",
        createdAt: r.createdAt ?? 0,
        updatedAt: r.updatedAt ?? 0,
        platformFilter: Array.isArray(r.platformFilter) ? r.platformFilter : [],
        rules: JSON.parse(r.rulesJson || "[]") as MappedRule[],
        coverageStats: r.coverageStats ?? { total: 0, covered: 0, partial: 0, uncovered: 0, coveragePercent: 0, partialPercent: 0 },
      }))
      .sort((a, b) => b.updatedAt - a.updatedAt)

    setSnapshots((prev) => {
      const remoteIds = new Set(remoteSnapshots.map((s) => s.id))
      const localOnly = prev.filter((s) => !remoteIds.has(s.id))
      return [...remoteSnapshots, ...localOnly].sort((a, b) => b.updatedAt - a.updatedAt)
    })
  }, [remoteQuery.data])

  const persistToRemote = useCallback(async (nextRules: MappedRule[]): Promise<void> => {
    const wsId = wsIdRef.current
    const m = modeRef.current
    if (!isInstantDBConfigured || !wsId || m !== "user") return
    try {
      await db.transact([
        tx.workspaces[wsId].update({
          name: nameRef.current,
          updatedAt: Date.now(),
          currentRules: nextRules,
        }),
      ])
    } catch (err) {
      console.warn("[useWorkspace] InstantDB rules save failed (kept local):", err)
    }
  }, [])

  const scheduleRemoteSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null
      void persistToRemote(rulesRef.current)
    }, SAVE_DEBOUNCE_MS)
  }, [persistToRemote])

  // Mutator: callback-driven save (no useEffect on rules)
  const persistRules = useCallback((next: MappedRule[]) => {
    const wsId = wsIdRef.current
    const m = modeRef.current
    if (m === "shared" || !wsId) return
    // Local cache is immediate; remote is debounced
    writeLocalRules(WS_RULES_KEY_PREFIX + wsId, next)
    if (m === "user") scheduleRemoteSave()
  }, [scheduleRemoteSave])

  const addRules = useCallback((newRules: MappedRule[]) => {
    setRulesState((prev) => {
      const existing = new Set(prev.map((r) => r.id))
      const next = [...prev, ...newRules.filter((r) => !existing.has(r.id))]
      persistRules(next)
      return next
    })
  }, [persistRules])

  const replaceRules = useCallback((newRules: MappedRule[]) => {
    setRulesState(newRules)
    persistRules(newRules)
  }, [persistRules])

  const clearRules = useCallback(() => {
    setRulesState([])
    persistRules([])
  }, [persistRules])

  const setWorkspaceName = useCallback((name: string) => {
    const trimmed = name.slice(0, 100)
    setWorkspaceNameState(trimmed)
    const wsId = wsIdRef.current
    if (wsId) {
      try { localStorage.setItem(WS_NAME_KEY_PREFIX + wsId, trimmed) } catch {}
      // Push name update to remote for user mode (bundled with next rules save would work too)
      if (modeRef.current === "user" && isInstantDBConfigured) {
        scheduleRemoteSave()
      }
    }
  }, [scheduleRemoteSave])

  const saveSnapshot = useCallback(
    async (data: {
      rules: MappedRule[]
      platformFilter: string[]
      coverageStats: CoverageStats
      name?: string
    }): Promise<WorkspaceSnapshot | null> => {
      const wsId = wsIdRef.current
      if (!wsId) return null
      const now = Date.now()
      const snapshotId = instantId()

      const snapshot: WorkspaceSnapshot = {
        id: snapshotId,
        name: data.name || `${nameRef.current} — ${new Date(now).toISOString().slice(0, 19)}`,
        createdAt: now,
        updatedAt: now,
        platformFilter: data.platformFilter,
        rules: data.rules,
        coverageStats: data.coverageStats,
      }

      saveLocalSnapshot(wsId, snapshot)
      setSnapshots((prev) => [snapshot, ...prev].slice(0, 25))

      if (isInstantDBConfigured && modeRef.current === "user") {
        try {
          await db.transact([
            tx.workspaces[snapshotId].update({
              name: snapshot.name,
              createdAt: snapshot.createdAt,
              updatedAt: snapshot.updatedAt,
              platformFilter: snapshot.platformFilter,
              rulesJson: JSON.stringify(snapshot.rules),
              coverageStats: snapshot.coverageStats,
            }),
          ])
        } catch (err) {
          console.warn("[useWorkspace] InstantDB snapshot save failed (saved locally):", err)
        }
      }

      return snapshot
    },
    []
  )

  const loadSnapshot = useCallback(
    (snapshotId: string): WorkspaceSnapshot | null => {
      const found = snapshots.find((s) => s.id === snapshotId)
      return found ?? null
    },
    [snapshots]
  )

  const forkAsNew = useCallback((): string => {
    const newId = uuidv4()
    localStorage.setItem(WS_ID_KEY, newId)
    setWorkspaceIdState(newId)
    setMode(isInstantDBConfigured && user?.id ? "user" : "local")
    setSnapshots(loadLocalSnapshots(newId))
    hydratedRef.current = null
    const url = new URL(window.location.href)
    url.searchParams.delete("ws")
    window.history.replaceState({}, "", url.toString())
    return newId
  }, [user?.id])

  const shareUrl =
    typeof window !== "undefined" && workspaceId
      ? (() => {
          const u = new URL(window.location.href)
          u.searchParams.set("ws", workspaceId)
          return u.toString()
        })()
      : ""

  return {
    workspaceId,
    workspaceName,
    setWorkspaceName,
    isShared: mode === "shared",
    isReadOnly: mode === "shared",
    isInstantDBConfigured,
    snapshots,
    saveSnapshot,
    loadSnapshot,
    forkAsNew,
    shareUrl,
    rules,
    addRules,
    replaceRules,
    clearRules,
  }
}
