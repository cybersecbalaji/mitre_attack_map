"use client"
import { WorkspaceSnapshot } from "@/types"
import { ScrollArea } from "@/components/ui/scroll-area"

interface WorkspaceHistoryProps {
  snapshots: WorkspaceSnapshot[]
  onLoad: (id: string) => void
}

function formatTimestamp(ts: number): string {
  const d = new Date(ts)
  const now = Date.now()
  const diff = now - ts
  if (diff < 60_000) return "just now"
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return d.toISOString().slice(0, 16).replace("T", " ")
}

export function WorkspaceHistory({ snapshots, onLoad }: WorkspaceHistoryProps) {
  if (snapshots.length === 0) {
    return (
      <div
        className="bg-slate-800/40 border border-slate-700 rounded-md p-2 text-xs"
        data-testid="workspace-history-empty"
      >
        <div className="text-slate-400 text-[11px]">
          No snapshots yet. Click <span className="text-teal-400">Save snapshot</span> to capture the current state.
        </div>
      </div>
    )
  }

  return (
    <div
      className="bg-slate-800/40 border border-slate-700 rounded-md p-2"
      data-testid="workspace-history"
    >
      <div className="text-teal-400 font-medium text-[11px] mb-1.5">
        Snapshots ({snapshots.length})
      </div>
      <ScrollArea className="max-h-44">
        <ul className="space-y-0.5 pr-2" data-testid="workspace-history-list">
          {snapshots.map((s) => (
            <li key={s.id}>
              <button
                onClick={() => onLoad(s.id)}
                className="w-full text-left text-[11px] px-1.5 py-1 rounded hover:bg-slate-700 group"
                data-testid={`snapshot-${s.id}`}
              >
                <div className="text-slate-200 truncate">{s.name}</div>
                <div className="text-[9px] text-slate-500 flex gap-2">
                  <span>{formatTimestamp(s.updatedAt)}</span>
                  <span>•</span>
                  <span>{s.rules.length} rule{s.rules.length !== 1 ? "s" : ""}</span>
                  <span>•</span>
                  <span>{s.coverageStats.coveragePercent.toFixed(1)}% covered</span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </ScrollArea>
    </div>
  )
}
