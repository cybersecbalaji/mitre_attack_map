"use client"
import { useState, useEffect, useCallback } from "react"
import { ATTACKTechnique } from "@/types"
import { fetchAndParseSTIX, flattenTechniques } from "@/lib/attackStix"

interface UseAttackDataResult {
  techniques: ATTACKTechnique[]
  allTechniques: ATTACKTechnique[]
  loading: boolean
  error: string | null
  techniqueCount: number
}

const LOCAL_STORAGE_KEY = "attackmap_stix_cache_v2"
const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

function loadFromLocalStorage(): ATTACKTechnique[] | null {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY)
    if (!raw) return null
    const { data, timestamp } = JSON.parse(raw)
    if (Date.now() - timestamp > CACHE_TTL_MS) return null
    if (!Array.isArray(data) || data.length === 0) return null
    return data as ATTACKTechnique[]
  } catch {
    return null
  }
}

function saveToLocalStorage(techniques: ATTACKTechnique[]): void {
  try {
    localStorage.setItem(
      LOCAL_STORAGE_KEY,
      JSON.stringify({ data: techniques, timestamp: Date.now() })
    )
  } catch {
    // localStorage quota exceeded — non-fatal
  }
}

export function useAttackData(): UseAttackDataResult {
  const [techniques, setTechniques] = useState<ATTACKTechnique[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (signal: AbortSignal) => {
    setLoading(true)
    setError(null)

    try {
      // Check localStorage first
      const cached = loadFromLocalStorage()
      if (cached) {
        if (!signal.aborted) {
          setTechniques(cached)
          setLoading(false)
        }
        return
      }

      const data = await fetchAndParseSTIX(signal)

      if (!signal.aborted) {
        setTechniques(data)
        saveToLocalStorage(data)
        setLoading(false)
      }
    } catch (err) {
      if (!signal.aborted) {
        const message = err instanceof Error ? err.message : "Unknown error loading ATT&CK data"
        setError(message)
        setLoading(false)
        console.error("[useAttackData] Failed to load STIX:", err)
      }
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    load(controller.signal)
    // Cleanup: abort any in-flight fetch when component unmounts or rerenders
    return () => controller.abort()
  }, [load])

  const allTechniques = flattenTechniques(techniques)

  return {
    techniques,
    allTechniques,
    loading,
    error,
    techniqueCount: allTechniques.length,
  }
}
