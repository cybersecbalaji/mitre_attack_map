"use client"
import { useState, useEffect, useCallback } from "react"
import { ATTACKTechnique } from "@/types"
import { fetchAndParseATLAS, flattenATLAS, ATLASData } from "@/lib/atlasData"

const LOCAL_STORAGE_KEY = "attackmap_atlas_cache"
const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

interface CachedATLAS {
  data: ATTACKTechnique[]
  tacticOrder: string[]
  tacticNames: Record<string, string>
  timestamp: number
}

function loadFromLocalStorage(): ATLASData | null {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY)
    if (!raw) return null
    const cached: CachedATLAS = JSON.parse(raw)
    if (Date.now() - cached.timestamp > CACHE_TTL_MS) return null
    if (!Array.isArray(cached.data) || cached.data.length === 0) return null
    return {
      techniques: cached.data,
      tacticOrder: cached.tacticOrder ?? [],
      tacticNames: cached.tacticNames ?? {},
    }
  } catch {
    return null
  }
}

function saveToLocalStorage(atlas: ATLASData): void {
  try {
    const payload: CachedATLAS = {
      data: atlas.techniques,
      tacticOrder: atlas.tacticOrder,
      tacticNames: atlas.tacticNames,
      timestamp: Date.now(),
    }
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(payload))
  } catch {
    // localStorage quota exceeded — non-fatal
  }
}

interface UseAtlasDataResult {
  techniques: ATTACKTechnique[]
  allTechniques: ATTACKTechnique[]
  tacticOrder: string[]
  tacticNames: Record<string, string>
  loading: boolean
  error: string | null
}

export function useAtlasData(): UseAtlasDataResult {
  const [atlas, setAtlas] = useState<ATLASData>({
    techniques: [],
    tacticOrder: [],
    tacticNames: {},
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (signal: AbortSignal) => {
    setLoading(true)
    setError(null)
    try {
      const cached = loadFromLocalStorage()
      if (cached) {
        if (!signal.aborted) {
          setAtlas(cached)
          setLoading(false)
        }
        return
      }
      const data = await fetchAndParseATLAS(signal)
      if (!signal.aborted) {
        setAtlas(data)
        saveToLocalStorage(data)
        setLoading(false)
      }
    } catch (err) {
      if (!signal.aborted) {
        setError(err instanceof Error ? err.message : "Failed to load ATLAS data")
        setLoading(false)
        console.error("[useAtlasData] Failed to load ATLAS:", err)
      }
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    load(controller.signal)
    return () => controller.abort()
  }, [load])

  return {
    techniques: atlas.techniques,
    allTechniques: flattenATLAS(atlas.techniques),
    tacticOrder: atlas.tacticOrder,
    tacticNames: atlas.tacticNames,
    loading,
    error,
  }
}
