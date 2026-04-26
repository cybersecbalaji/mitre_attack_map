"use client"
import { useState, useRef } from "react"
import { ATTACKTechnique, MappedRule } from "@/types"
import { parseSigmaYaml, parseSigmaZip, SigmaParseResult } from "@/lib/sigmaParser"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

interface SigmaUploaderProps {
  techniques: ATTACKTechnique[]
  onRulesIngested: (rules: MappedRule[], summary: SigmaParseResult) => void
}

export function SigmaUploader({ techniques, onRulesIngested }: SigmaUploaderProps) {
  const [pastedYaml, setPastedYaml] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    setBusy(true)
    setError(null)
    try {
      const lower = file.name.toLowerCase()
      let result: SigmaParseResult
      if (lower.endsWith(".zip")) {
        result = await parseSigmaZip(file, techniques)
      } else if (lower.endsWith(".yml") || lower.endsWith(".yaml")) {
        const text = await file.text()
        result = await parseSigmaYaml(text, techniques, file.name)
      } else {
        setError("Only .yml, .yaml, or .zip files are supported")
        setBusy(false)
        return
      }
      onRulesIngested(result.rules, result)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setBusy(false)
    }
  }

  async function handlePaste() {
    if (!pastedYaml.trim()) return
    setBusy(true)
    setError(null)
    try {
      const result = await parseSigmaYaml(pastedYaml, techniques, "(pasted)")
      onRulesIngested(result.rules, result)
      setPastedYaml("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Parse failed")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-3 p-2">
      <div>
        <label className="text-[11px] text-slate-300 font-medium block mb-1">
          Upload .yml / .yaml / .zip
        </label>
        <input
          ref={fileInputRef}
          type="file"
          accept=".yml,.yaml,.zip"
          data-testid="sigma-file-input"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleFile(file)
          }}
          className="text-xs text-slate-300 file:bg-teal-700 file:text-white file:px-2 file:py-1 file:rounded file:border-0 file:text-xs file:cursor-pointer file:hover:bg-teal-600 cursor-pointer w-full"
          disabled={busy}
        />
      </div>

      <div className="border-t border-slate-700 pt-3">
        <label className="text-[11px] text-slate-300 font-medium block mb-1">
          Or paste raw Sigma YAML
        </label>
        <Textarea
          value={pastedYaml}
          onChange={(e) => setPastedYaml(e.target.value)}
          placeholder="title: Suspicious Process&#10;tags:&#10;  - attack.t1059.001"
          className="bg-slate-800 border-slate-600 text-xs text-slate-200 font-mono min-h-[100px]"
          disabled={busy}
          data-testid="sigma-paste-input"
        />
        <Button
          onClick={handlePaste}
          disabled={busy || !pastedYaml.trim()}
          size="sm"
          className="mt-2 w-full bg-teal-700 hover:bg-teal-600 text-xs h-7"
          data-testid="sigma-paste-submit"
        >
          {busy ? "Parsing..." : "Parse YAML"}
        </Button>
      </div>

      {error && (
        <div className="text-red-400 text-xs p-2 bg-red-950/30 border border-red-900/50 rounded">
          {error}
        </div>
      )}
    </div>
  )
}
