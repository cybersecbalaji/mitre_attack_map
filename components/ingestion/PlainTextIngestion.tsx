"use client"
import { useState } from "react"
import { ATTACKTechnique, MappedRule } from "@/types"
import { parsePlainText, IngestionResult } from "@/lib/ruleIngestion"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

interface PlainTextIngestionProps {
  techniques: ATTACKTechnique[]
  onRulesIngested: (rules: MappedRule[], summary: IngestionResult) => void
}

const PLACEHOLDER = `T1059.003 - PowerShell Execution
T1078, Valid Accounts Detection
Detect LSASS Memory Access
# Lines starting with # or // are comments`

export function PlainTextIngestion({ techniques, onRulesIngested }: PlainTextIngestionProps) {
  const [text, setText] = useState("")
  const [busy, setBusy] = useState(false)

  function handleSubmit() {
    if (!text.trim()) return
    setBusy(true)
    try {
      const result = parsePlainText(text, techniques)
      onRulesIngested(result.rules, result)
      setText("")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-2 p-2">
      <label className="text-[11px] text-slate-300 font-medium">
        Paste rule list (one per line)
      </label>
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={PLACEHOLDER}
        className="bg-slate-800 border-slate-600 text-xs text-slate-200 font-mono min-h-[160px]"
        disabled={busy}
        data-testid="plaintext-input"
      />
      <Button
        onClick={handleSubmit}
        disabled={busy || !text.trim()}
        size="sm"
        className="bg-teal-700 hover:bg-teal-600 text-xs h-7"
        data-testid="plaintext-submit"
      >
        {busy ? "Parsing..." : "Parse Rules"}
      </Button>
    </div>
  )
}
