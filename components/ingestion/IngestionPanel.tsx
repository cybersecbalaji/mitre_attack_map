"use client"
import { useState } from "react"
import { MappedRule, ATTACKTechnique } from "@/types"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { SigmaUploader } from "./SigmaUploader"
import { PlainTextIngestion } from "./PlainTextIngestion"
import { ManualEntry } from "./ManualEntry"

interface IngestionPanelProps {
  techniques: ATTACKTechnique[]
  rules: MappedRule[]
  onRulesIngested: (rules: MappedRule[]) => void
  onClearRules: () => void
}

interface IngestSummary {
  totalParsed: number
  tcodesFound: number
  fuzzyMatched: number
  skipped: { name: string; reason: string }[]
}

export function IngestionPanel({ techniques, rules, onRulesIngested, onClearRules }: IngestionPanelProps) {
  const [lastSummary, setLastSummary] = useState<IngestSummary | null>(null)

  function handleIngestion(newRules: MappedRule[], summary?: Partial<IngestSummary>) {
    onRulesIngested(newRules)
    if (summary) {
      setLastSummary({
        totalParsed: summary.totalParsed ?? newRules.length,
        tcodesFound: summary.tcodesFound ?? newRules.reduce((acc, r) => acc + r.techniqueIds.length, 0),
        fuzzyMatched: summary.fuzzyMatched ?? 0,
        skipped: summary.skipped ?? [],
      })
    } else {
      setLastSummary({
        totalParsed: newRules.length,
        tcodesFound: newRules.reduce((acc, r) => acc + r.techniqueIds.length, 0),
        fuzzyMatched: 0,
        skipped: [],
      })
    }
  }

  const strongCount = rules.filter((r) => r.confidence === "strong").length
  const partialCount = rules.filter((r) => r.confidence === "partial").length

  return (
    <div className="flex flex-col gap-3 h-full">
      <Tabs defaultValue="sigma" className="w-full">
        <TabsList className="w-full bg-slate-800 h-8 p-0.5">
          <TabsTrigger value="sigma" className="flex-1 text-[11px] h-7">Sigma</TabsTrigger>
          <TabsTrigger value="text" className="flex-1 text-[11px] h-7">Plain Text</TabsTrigger>
          <TabsTrigger value="manual" className="flex-1 text-[11px] h-7">Manual</TabsTrigger>
        </TabsList>
        <TabsContent value="sigma" className="mt-0">
          <SigmaUploader
            techniques={techniques}
            onRulesIngested={(r, s) => handleIngestion(r, s)}
          />
        </TabsContent>
        <TabsContent value="text" className="mt-0">
          <PlainTextIngestion
            techniques={techniques}
            onRulesIngested={(r, s) => handleIngestion(r, s)}
          />
        </TabsContent>
        <TabsContent value="manual" className="mt-0">
          <ManualEntry
            techniques={techniques}
            onRulesIngested={(r) => handleIngestion(r)}
          />
        </TabsContent>
      </Tabs>

      {/* Last ingestion summary */}
      {lastSummary && (
        <div
          className="bg-slate-800/60 border border-slate-700 rounded-md p-2 text-xs"
          data-testid="ingestion-summary"
        >
          <div className="text-teal-400 font-medium mb-1 text-[11px]">Last ingestion</div>
          <div className="grid grid-cols-2 gap-1 text-[10px] text-slate-300">
            <span>Parsed: <span className="text-teal-300">{lastSummary.totalParsed}</span></span>
            <span>T-codes: <span className="text-teal-300">{lastSummary.tcodesFound}</span></span>
            <span>Fuzzy: <span className="text-amber-400">{lastSummary.fuzzyMatched}</span></span>
            <span>Skipped: <span className="text-red-400">{lastSummary.skipped.length}</span></span>
          </div>
          {lastSummary.skipped.length > 0 && (
            <details className="mt-1.5">
              <summary className="cursor-pointer text-slate-400 text-[10px] hover:text-slate-200">
                Show skipped ({lastSummary.skipped.length})
              </summary>
              <ScrollArea className="max-h-32 mt-1">
                <ul className="space-y-0.5 pr-2">
                  {lastSummary.skipped.slice(0, 50).map((s, i) => (
                    <li key={i} className="text-[9px] text-slate-400">
                      <span className="text-red-400">•</span> {s.name}
                      <span className="text-slate-500 ml-1">— {s.reason}</span>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            </details>
          )}
        </div>
      )}

      {/* Mapped rules list */}
      {rules.length > 0 && (
        <div className="bg-slate-800/40 border border-slate-700 rounded-md p-2 flex-1 min-h-0 flex flex-col">
          <div className="flex items-center justify-between mb-1.5">
            <div className="text-teal-400 font-medium text-[11px]">
              Mapped rules ({rules.length})
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={onClearRules}
              className="h-5 text-[10px] px-1.5 text-slate-400 hover:text-red-400"
              data-testid="clear-rules"
            >
              Clear all
            </Button>
          </div>
          <div className="flex gap-2 mb-1.5 text-[10px]">
            <span className="text-green-500">{strongCount} strong</span>
            <span className="text-amber-400">{partialCount} partial</span>
          </div>
          <ScrollArea className="flex-1 min-h-0">
            <ul className="space-y-0.5 pr-2" data-testid="rules-list">
              {rules.slice(0, 200).map((r) => (
                <li key={r.id} className="text-[10px] text-slate-300 truncate flex items-center gap-1">
                  <span
                    className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                      r.confidence === "strong" ? "bg-green-500" : "bg-amber-500"
                    }`}
                  />
                  <span className="font-mono text-teal-400 text-[9px]">
                    {r.techniqueIds.slice(0, 2).join(",")}
                    {r.techniqueIds.length > 2 ? "+" : ""}
                  </span>
                  <span className="truncate">{r.name}</span>
                </li>
              ))}
              {rules.length > 200 && (
                <li className="text-[10px] text-slate-500 italic">
                  ...{rules.length - 200} more
                </li>
              )}
            </ul>
          </ScrollArea>
        </div>
      )}
    </div>
  )
}
