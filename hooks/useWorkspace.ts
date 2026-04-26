"use client"
import { useState, useEffect, useCallback } from "react"
import { v4 as uuidv4 } from "uuid"
import { id as instantId, tx } from "@instantdb/react"
import { db, isInstantDBConfigured } from "@/lib/instantdb"
import { MappedRule, CoverageStats, WorkspaceSnapshot } from "@/types"

const WS_ID_KEY = "attackmap_workspace_id"
const WS_NAME_KEY_PREFIX = "attackmap_ws_name_"
const WS_LOCAL_SNAPSHOTS_PREFIX = "attackmap_ws_snapshots_"

interface InstantDBSnapshotRow {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  platformFilter: string[]
  rulesJson: string
  coverageStats: CoverageStats
}

interface UseWorkspaceResult {
  workspaceId: string
  workspaceName: string
  setWorkspaceName: (name: string) => void
  isShared: boolean
  isInstantDBConfigured: boolean
  snapshots: WorkspaceSnapshot[]
  saveSnapshot: (data: { rules: MappedRule[]; platformFilter: string[]; coverageStats: CoverageStats; name?: string }) => Promise<WorkspaceSnapshot | null>
  loadSnapshot: (id: string) => WorkspaceSnapshot | null
  forkAsNew: () => string                  // generate a new workspace ID, return it
  shareUrl: string                          // current share URL with ?ws=<id>
}

function readSharedIdFromUrl(): string | null {
  if (typeof window === "undefined") return null
  const params = new URLSearchParams(window.location.search)
  const ws = params.get("ws")
  if (!ws) return null
  // Validate: must look like a UUID v4
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
    // Keep last 25 snapshots only
    localStorage.setItem(WS_LOCAL_SNAPSHOTS_PREFIX + workspaceId, JSON.stringify(all.slice(0, 25)))
  } catch {
    // Quota exceeded; ignore
  }
}

export function useWorkspace(): UseWorkspaceResult {
  const [workspaceId, setWorkspaceIdState] = useState("")
  const [workspaceName, setWorkspaceNameState] = useState("My Coverage Workspace")
  const [isShared, setIsShared] = useState(false)
  const [snapshots, setSnapshots] = useState<WorkspaceSnapshot[]>([])

  // InstantDB live query (only effective when configured AND we have an ID)
  const remoteQuery = db.useQuery(
    isInstantDBConfigured && workspaceId
      ? { workspaces: { $: { where: { id: workspaceId } } } }
      : null
  )

  // Initialise workspace ID on mount
  useEffect(() => {
    const sharedId = readSharedIdFromUrl()
    if (sharedId) {
      setWorkspaceIdState(sharedId)
      setIsShared(true)
      // Try to read its cached name from localStorage; remote will populate via useQuery
      const nm = localStorage.getItem(WS_NAME_KEY_PREFIX + sharedId)
      if (nm) setWorkspaceNameState(nm)
      setSnapshots(loadLocalSnapshots(sharedId))
      return
    }

    let id = localStorage.getItem(WS_ID_KEY)
    if (!id) {
      id = uuidv4()
      localStorage.setItem(WS_ID_KEY, id)
    }
    setWorkspaceIdState(id)
    setIsShared(false)
    const nm = localStorage.getItem(WS_NAME_KEY_PREFIX + id)
    if (nm) setWorkspaceNameState(nm)
    setSnapshots(loadLocalSnapshots(id))
  }, [])

  // Sync remote snapshot into local UI (when InstantDB is configured)
  useEffect(() => {
    if (!isInstantDBConfigured || !remoteQuery.data) return
    const rows = (remoteQuery.data.workspaces ?? []) as InstantDBSnapshotRow[]
    if (rows.length === 0) return

    // Use the most recent row as the "current" snapshot; merge into local list
    const remoteSnapshots: WorkspaceSnapshot[] = rows.map((r) => ({
      id: r.id,
      name: r.name,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      platformFilter: Array.isArray(r.platformFilter) ? r.platformFilter : [],
      rules: JSON.parse(r.rulesJson || "[]") as MappedRule[],
      coverageStats: r.coverageStats,
    }))

    // Most recent first
    remoteSnapshots.sort((a, b) => b.updatedAt - a.updatedAt)

    if (remoteSnapshots.length > 0) {
      setWorkspaceNameState(remoteSnapshots[0].name)
      localStorage.setItem(WS_NAME_KEY_PREFIX + workspaceId, remoteSnapshots[0].name)
    }

    // Merge remote with local; dedupe by id (remote wins)
    setSnapshots((prev) => {
      const remoteIds = new Set(remoteSnapshots.map((s) => s.id))
      const localOnly = prev.filter((s) => !remoteIds.has(s.id))
      return [...remoteSnapshots, ...localOnly].sort((a, b) => b.updatedAt - a.updatedAt)
    })
  }, [remoteQuery.data, workspaceId])

  const setWorkspaceName = useCallback((name: string) => {
    const trimmed = name.slice(0, 100)
    setWorkspaceNameState(trimmed)
    if (workspaceId) {
      localStorage.setItem(WS_NAME_KEY_PREFIX + workspaceId, trimmed)
    }
  }, [workspaceId])

  const saveSnapshot = useCallback(
    async (data: {
      rules: MappedRule[]
      platformFilter: string[]
      coverageStats: CoverageStats
      name?: string
    }): Promise<WorkspaceSnapshot | null> => {
      if (!workspaceId) return null
      const now = Date.now()
      const snapshotId = instantId()

      const snapshot: WorkspaceSnapshot = {
        id: snapshotId,
        name: data.name || `${workspaceName} — ${new Date(now).toISOString().slice(0, 19)}`,
        createdAt: now,
        updatedAt: now,
        platformFilter: data.platformFilter,
        rules: data.rules,
        coverageStats: data.coverageStats,
      }

      // Always save locally
      saveLocalSnapshot(workspaceId, snapshot)
      setSnapshots((prev) => [snapshot, ...prev].slice(0, 25))

      // Save remotely if configured
      if (isInstantDBConfigured) {
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
          console.warn("[useWorkspace] InstantDB save failed (saved locally):", err)
        }
      }

      return snapshot
    },
    [workspaceId, workspaceName]
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
    setIsShared(false)
    setSnapshots(loadLocalSnapshots(newId))
    // Strip ?ws= from URL
    const url = new URL(window.location.href)
    url.searchParams.delete("ws")
    window.history.replaceState({}, "", url.toString())
    return newId
  }, [])

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
    isShared,
    isInstantDBConfigured,
    snapshots,
    saveSnapshot,
    loadSnapshot,
    forkAsNew,
    shareUrl,
  }
}
